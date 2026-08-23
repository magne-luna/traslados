# Proposal: Una autorización por mes (1:1 → 1:N Presupuesto↔Autorización)

## Intent

Este change ejecuta el **punto 7** de los 8 cambios que Andrea pidió en la llamada del 2026-08-21, y
la **parte mensual del punto 8**. Los puntos 1-6 ya se implementaron, commitearon y aplicaron a la
base real en `presupuestos-vigencia-datos-traslado-vista-previa`, que dejó estos dos **explícitamente
fuera** (`proposal.md` §Out of Scope, `design.md` §Non-Goals) porque requerían una decisión de modelo
de datos que no se podía tomar sin Enzo.

**Pedido verbatim de Andrea (punto 7):** *"Una autorización por mes, no una sola por presupuesto: el
valor del km cambia mes a mes, así que cada mes llega una autorización distinta con su propio monto."*
Propuso rotularlas *"mes 1, mes 2, mes 3…"*.

**Punto 8, parte mensual:** el monto autorizado ya puede diferir del presupuestado hoy
(`validarAutorizacion.ts` / RN-PA-01 / trigger `validar_autorizacion_monto`) — eso **no es trabajo
nuevo**. Lo nuevo es que esa comparación pase a ocurrir **por mes**, con sus propios km y días
reconocidos (ejemplo real de Andrea: 326,60 km presupuestados vs. 264 autorizados, porque la obra
social liquida el recorrido más corto).

**El problema concreto que esto resuelve.** Hoy el modelo asume que la obra social responde **una
vez** por presupuesto y que ese cupo se repite todos los meses: `facturacion-seleccion-autorizacion/design.md:82`
lo dice literalmente — *"cupoMensualDias/cupoMensualKm son un cupo mensual **recurrente** […] Una
autorización genera una factura por mes"*. Eso es falso en el dominio de Andrea: no hay un cupo
recurrente, hay **N respuestas distintas**, una por mes, cada una con su monto, sus km reconocidos,
su vigencia y su PDF. Hoy no hay dónde guardar la segunda: la segunda respuesta pisa a la primera y
se pierde el historial que Andrea necesita para reclamar.

## Decisión arquitectónica — YA TOMADA, no se relitiga

Se evaluaron dos opciones y **la usuaria eligió explícitamente la primera**:

| Opción | Veredicto |
|---|---|
| **Romper el 1:1** — `facturacion.autorizacion` gana un campo de período, N filas por `presupuesto_id` | ✅ **ELEGIDA** |
| Tabla hija `autorizacion_mensual` bajo una autorización "maestra" | ❌ Descartada |

**Razón:** coincide con el modelo mental literal de Andrea (*"cada mes llega una autorización
distinta"*, *"mes 1, mes 2, mes 3…"*). En su cabeza **no existe** una fila maestra — cada mes es una
autorización independiente y real. Una tabla hija inventaría un agregado que el dominio no tiene, y
repetiría el error de forma que la discrepancia KB #13 ya prohibió para `presupuesto.monto`.

Este change **diseña y planifica la implementación** de esa decisión. No la vuelve a discutir.

## Hallazgo que abarata todo el change

**`facturacion.autorizacion.presupuesto_id` NO tiene `UNIQUE`.** Verificado en
`20260724100005_schema_facturacion.sql:26-34` (solo `NOT NULL` + FK `ON DELETE CASCADE`) y en
`20260802100000_presupuesto_autorizacion_indices.sql:41-42` (índice **no** único). **La base ya
permite N filas hoy.** El 1:1 es convención de aplicación (RPC + `.maybeSingle()` + firma del
repository), no un constraint de schema.

Consecuencia: la migración **no borra ningún constraint**. Es aditiva (una columna + un índice único
parcial nuevo). No hay `DROP CONSTRAINT` sobre datos financieros vivos. Esto baja el riesgo del
change de "cambio destructivo de cardinalidad" a "columna nueva + reescritura de 4 superficies de
lectura".

## Scope

### In Scope

1. **Columna de período** en `facturacion.autorizacion` (`periodo_mes DATE`, primer día del mes) +
   índice único parcial `(presupuesto_id, periodo_mes)`. Ver design D2/D3.
2. **`CREATE OR REPLACE` de las 2 RPC de alta** (`crear_presupuesto_completo`, `crear_presupuestos_lote`)
   para que la autorización auto-creada nazca con el **primer mes** de la vigencia del presupuesto.
   Ver design D4.
3. **Edge Function `autorizaciones`** — `GET ?presupuestoId=` deja de ser `.maybeSingle()` y devuelve
   una **lista ordenada**; filtro opcional `&periodoMes=`. Es el `// Fase 6 … no se toca en este
   change` que quedó marcado en `index.ts:133-136` esperando exactamente a este change.
4. **`AutorizacionRepository`** — `getByPresupuestoId` (singular) **se reemplaza** por
   `listByPresupuestoId` (plural). Ver design D5.
5. **`autorizacionesPendientes.ts` + `etiquetaAutorizacion.ts`** — el wizard de facturación pasa a
   ver los N meses de cada presupuesto, ordenados, con el período **en la etiqueta** (sin él, 12
   meses del mismo presupuesto se renderizan como 12 opciones idénticas). Ver design D6.
6. **Advertencia de coherencia de período** — función pura nueva que avisa (sin bloquear) cuando el
   mes de la autorización elegida no coincide con `mesFacturado`/`anioFacturado`. Ver design D7.
7. **Campo de mes en `AutorizacionForm.tsx`** + rótulo derivado "Mes 1 / Mes 2 / Mes 3…" (nunca
   persistido). Ver design D2/D11.
8. **`PresupuestoDetail.tsx`** — el bloque de autorización única pasa a ser una **tabla de meses**
   con acción "Agregar mes". Ver design D10.

### Out of Scope

- **Definir qué valida RN-PA-01 por mes.** Es la Open Question 1 (abajo). **No se toca el trigger
  `validar_autorizacion_monto`** en este change: sigue comparando cada fila contra `presupuesto.monto`
  exactamente como hoy. Cualquier cambio de esa regla espera respuesta de Andrea.
- **Definir si la vigencia de cada mes debe estar contenida en su propio mes.** Open Question 2.
  `validarVigenciaAutorizacion` sigue validando contra la vigencia del **presupuesto**, sin agregar
  una restricción "⊆ su propio mes" que nadie documentó.
- **Backfill de `periodo_mes` en filas existentes.** `NULL` significa "autorización del modelo
  anterior". Ver design D3.
- **Auto-crear las N autorizaciones del período de vigencia.** Se crea **una** (el primer mes). D4.
- **Auto-resolver la autorización del mes que se está facturando.** El operador la sigue eligiendo.
  D7 — reintroducir la heurística sería deshacer D6 de `facturacion-seleccion-autorizacion`.
- **Cambiar `montoConsumido`/`cupoConsumido`.** Su firma no cambia; lo que cambia es la *lectura* de
  su resultado. Es una reinterpretación semántica, no código — y como toca una validación financiera
  viva, va a gate de governance. D8.
- **`PresupuestoResumen.tsx`.** ⚠️ **Corrección al brief**: no tiene código de autorización
  (`grep autorizacion` → 0 coincidencias). El bloque vive en `PresupuestoDetail.tsx:249-320`.
- **`AutorizacionRepository.uploadArchivo`/`getUrlArchivo`/`removeArchivo`.** Verificado: ya están
  cableados por `id` de autorización y la clave del bucket es `{autorizacionId}/{uuid}-{nombre}`
  (`SupabaseAutorizacionRepository.ts:169`). **N meses ⇒ N adjuntos, con cero cambios.** D12.
- **Tabla nueva de cualquier tipo.** La decisión de la usuaria descarta `autorizacion_mensual`.

## Capabilities

### New Capabilities

- `autorizacion-periodo-mensual`: la autorización pertenece a un mes calendario; N autorizaciones por
  presupuesto, unicidad por `(presupuesto, mes)`, rótulo ordinal derivado ("Mes 1, Mes 2…").
- `autorizacion-listado-por-presupuesto`: lectura plural de las autorizaciones de un presupuesto
  (EF + repository + UI de tabla mensual + alta de un mes nuevo).
- `factura-coherencia-periodo`: advertencia no bloqueante cuando el mes de la autorización elegida no
  coincide con el período facturado.

### Modified Capabilities

- `presupuesto-contract`: `Autorizacion` gana `periodoMes`; se documenta que la relación con
  `Presupuesto` pasa a **1:N**.
- `autorizacion-gestion`: `AutorizacionForm` gana el campo de mes; `PresupuestoDetail` pasa de una
  card única a una tabla de meses + "Agregar mes".
- `autorizacion-repository-supabase`: `getByPresupuestoId` → `listByPresupuestoId`; el 404 deja de ser
  el camino normal de esa consulta (lista vacía en su lugar).
- `factura-autorizacion-seleccion`: el selector del Paso 2 muestra N meses por presupuesto, ordenados
  por período y etiquetados con él. **Levanta el Non-Goal** *"NO cambia la relación
  Autorización↔Presupuesto. Sigue siendo 1:1, sin excepciones"* (`facturacion-seleccion-autorizacion/design.md:124`).
- `factura-cupo-validacion`: se documenta que `montoAutorizado` deja de ser un tope **anual** y pasa a
  ser el tope **de ese mes** para las filas con `periodoMes` (las filas legacy conservan la semántica
  anterior). D8 — **requiere firma humana**.

## Approach

**Principio rector: el mes es una identidad absoluta, no un ordinal ni una derivación.** Andrea dice
"mes 1, mes 2, mes 3" — eso es su **rótulo**, no la clave. Se persiste el mes calendario real
(`periodo_mes DATE`, día 1) y el ordinal se **deriva** para mostrarlo, con el mismo criterio que
`viajesMensuales` en el change hermano (D4 de ese design: *"no se persiste, se deriva"*, para no crear
dos fuentes de verdad). Un ordinal persistido se corrompe en cuanto se saltea un mes o llega una
autorización fuera de orden, y no se puede cruzar con `factura.mesFacturado`/`anioFacturado`, que ya
son absolutos y ya son la clave de `cupoConsumido`/`montoConsumido`.

Orden de trabajo:

1. **Gate de governance (§0 de `tasks.md`)** — verificación en vivo del schema real + firma humana de
   D8 y de las 2 Open Questions. Ninguna línea de `.sql` antes de eso.
2. **SQL** — 1 migración aditiva (columna + índice único parcial) + 1 `CREATE OR REPLACE` de las 2 RPC.
   Cero tablas nuevas ⇒ la RLS del módulo `presupuestos` (`20260730140000_split_modulos_permisos.sql`)
   ya cubre la columna, igual que en el change hermano.
3. **Edge Function** — `GET ?presupuestoId=` plural + `&periodoMes=`, `periodo_mes` en row/`toApi`/`toDb`.
4. **Frontend, de adentro hacia afuera** — tipo → mapping → `periodoAutorizacion.ts` (funciones puras:
   normalizar mes, ordinal derivado, coherencia de período; TDD estricto) → repositories + mocks →
   `autorizacionesPendientes`/`etiquetaAutorizacion` → `AutorizacionForm` → `PresupuestoDetail` →
   `FacturaForm` Paso 2.
5. **KB / CHANGES.md** — discrepancias nuevas + las 2 Open Questions en `10_preguntas_abiertas.md`,
   con `AvisoModeloDatos` en las pantallas afectadas (regla dura del proyecto).

## Affected Areas

| Área | Impacto | Descripción |
|------|---------|-------------|
| `supabase/migrations/<ts>_autorizacion_periodo_mes.sql` | **New** | `periodo_mes DATE` + índice único parcial `(presupuesto_id, periodo_mes)` |
| `supabase/migrations/<ts>_presupuesto_rpc_autorizacion_primer_mes.sql` | **New** | `CREATE OR REPLACE` de las 2 RPC de alta (D4) |
| `supabase/functions/autorizaciones/index.ts` | Modified | `.maybeSingle()` → lista ordenada; `&periodoMes=`; `periodo_mes` en row/API/DB (`index.ts:8-9`, `:132-146`) |
| `frontend/src/shared/types/presupuesto.ts` | Modified | `Autorizacion.periodoMes?`; el comentario "relación 1---1" (`:189`) pasa a 1:N |
| `frontend/src/shared/lib/presupuestos/autorizacionMapping.ts` | Modified | `periodoMes` en las 3 direcciones |
| `frontend/src/shared/lib/presupuestos/periodoAutorizacion.ts` | **New** | Funciones puras: normalizar a día 1, ordinal derivado, coherencia de período |
| `frontend/src/shared/lib/presupuestos/AutorizacionRepository.ts` | Modified | `getByPresupuestoId` → `listByPresupuestoId` (D5) |
| `frontend/src/shared/lib/presupuestos/SupabaseAutorizacionRepository.ts` | Modified | Ídem (`:246-259`); el `esErrorNotFound` de esa consulta se retira |
| `frontend/src/shared/lib/mocks/mockAutorizacionRepository.ts` | Modified | Ídem (`:78`) + bump de `SCHEMA_VERSION` |
| `frontend/src/shared/lib/facturacion/autorizacionesPendientes.ts` | Modified | `flatMap` sobre la lista + orden por `periodoMes` (`:37`) |
| `frontend/src/shared/lib/facturacion/etiquetaAutorizacion.ts` | Modified | El período entra en la etiqueta — **requisito, no cosmética** (D6) |
| `frontend/src/features/presupuestos/AutorizacionForm.tsx` | Modified | Campo de mes + rótulo ordinal |
| `frontend/src/features/presupuestos/PresupuestoDetail.tsx` | Modified | Card única → tabla de meses + "Agregar mes" (`:103-141`, `:249-320`) |
| `frontend/src/features/facturacion/FacturaForm.tsx` | Modified | Paso 2: preselección del mes coincidente + aviso de coherencia (`:326-381`) |
| `knowledge-base/{04,05,10}*.md`, `CHANGES.md` §C-06 | Modified | Discrepancias + 2 Open Questions + reapertura de C-06 |

## Risks

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| **La semántica de `montoAutorizado` cambia de tope ANUAL a tope MENSUAL sin que cambie una sola línea de `montoConsumido`** (D8) — y para filas legacy (`periodo_mes NULL`) sigue siendo anual, o sea dos semánticas conviviendo en la misma función | **Alta** | **Gate de governance con firma humana (§0.2).** El código no cambia; lo que se firma es la interpretación. Test de regresión explícito para cada semántica |
| **Open Question 1 sin respuesta bloquea el sentido de RN-PA-01 por mes** | **Alta** | El trigger **no se toca**. Se implementa todo lo demás; la regla queda como está hasta que Andrea responda |
| **Sobre-facturación / sub-facturación a la obra social** si el operador factura un mes contra la autorización de otro | **Alta** | D7: advertencia visible + preselección del mes coincidente. **No** bloqueo (RN-PA-02 permite retroactivo) |
| **`GET ?presupuestoId=` cambia su forma de respuesta** (objeto o 404 → array) — EF y frontend no se pueden desplegar ni revertir por separado | **Alta** | Orden de despliegue explícito y PRs encadenados; el rollback barato es revertir los dos juntos |
| **12 opciones indistinguibles en el selector del Paso 2** si `etiquetaAutorizacion` no incluye el período | **Alta** | Es literalmente el problema que el punto 2 del change hermano arregló para el listado de presupuestos. Escenario de spec obligatorio |
| **El schema real va por delante del repo** (pasó 5 changes seguidos) | **Alta** | **Task bloqueante §0.3**: `supabase db query --linked` de solo lectura antes de escribir `.sql` |
| **`autorizacionesPendientes` pasa de O(N presupuestos) a O(N presupuestos) con payload N× más grande** | Media | La complejidad no cambia (una llamada por presupuesto, ahora plural). Se mide antes de optimizar; `listByPacienteId` sigue fuera de alcance, igual que hoy |
| **Filas legacy sin `periodo_mes` aparecen mezcladas con las mensuales** | Media (esperado) | `NULL` es semánticamente correcto. Se ordenan primero y se rotulan "Sin mes cargado", nunca con un mes inventado |
| **Índice único parcial rechaza un alta duplicada con un error crudo de Postgres** | Media | Se mapea a un mensaje de dominio en `edgeFunctionErrors.ts` ("Ya existe una autorización para ese mes") |
| **`presupuesto.vigenciaDesde` es `NULL` en presupuestos viejos**, así que la RPC no puede derivar el primer mes | Media (esperado) | D4: si no hay vigencia, se conserva **exactamente** el comportamiento de hoy (fila `pendiente` sin período) |

## Rollback Plan

Tres capas, en este orden:

1. **Frontend** — revertir los commits de la fase de UI. Se pierde la tabla mensual y el aviso de
   coherencia; los datos quedan. ⚠️ **No es independiente de la capa 2**: el frontend viejo llama a
   `getByPresupuestoId` esperando un objeto y la EF nueva devuelve un array. Revertir 1 y 2 **juntos**.
2. **Edge Function** — redeploy de la versión anterior de `autorizaciones`. Vuelve el `.maybeSingle()`:
   con más de una fila por presupuesto, `maybeSingle()` **falla con error de Postgres**, no devuelve
   la primera. ⚠️ Por eso el rollback de la EF **exige** que antes se hayan borrado las filas
   mensuales extra, o quedan presupuestos inaccesibles desde `PresupuestoDetail`.
3. **Base** — `CREATE OR REPLACE` de las 2 RPC a su versión anterior (**primero**), luego
   `DROP INDEX` + `DROP COLUMN periodo_mes`.
   ⚠️ **Punto de no retorno**: en cuanto exista una segunda autorización real cargada para un
   presupuesto, el `DROP COLUMN` la deja indistinguible de la primera y el `.maybeSingle()` de la EF
   revertida rompe ese presupuesto. **El rollback deja de ser barato apenas se carga el segundo mes
   real.** Esto justifica PRs encadenados y una ventana de validación con la usuaria antes de cargar
   datos reales del segundo mes.

## Dependencies

- **`presupuestos-vigencia-datos-traslado-vista-previa`** — ya implementado, commiteado y **aplicado a
  la base real (2026-08-21)**. Este change depende de su `presupuesto.vigencia_desde` para D4 y de su
  `autorizacion.vigencia_hasta`/`con_dependencia` para la tabla mensual. **Archivarlo primero**: este
  change **modifica** capabilities que ese change dejó como deltas sin sincronizar.
- **`facturacion-seleccion-autorizacion`** — este change **levanta su Non-Goal de cardinalidad**
  (`design.md:124`) y **reinterpreta su D1/§82** (*"cupo mensual recurrente"*). Si esa carpeta sigue
  sin archivar, el sync de specs va a chocar.
- **Bloqueante externo: Enzo (backend)** — la decisión de modelo ya la tomó la usuaria; lo que falta de
  Enzo es la validación de que `periodo_mes` + índice único parcial no choca con nada que él tenga en
  vuelo sobre `facturacion.autorizacion`.
- **Bloqueante externo: Andrea** — Open Questions 1 y 2 (abajo).

## ⚠️ Governance — CRÍTICO

`CHANGES.md` marca C-06 como dominio **ALTO**. Este change es más que eso: **cambia una relación de
cardinalidad de la que depende la corrección de la facturación a una obra social** (datos de salud +
facturación). Un error acá significa **facturar de más o de menos a un tercero**. Se trata como
**CRÍTICO**: *análisis y diseño solamente en este paso.*

- **NO se escribe ni se aplica ninguna migración SQL en este change de propose.** Los `.sql` de la
  sección "Affected Areas" son artefactos de diseño planificados, no archivos escritos.
- **La fase de apply requiere firma humana explícita, fase por fase.**
- **La lógica de resolución del cupo mensual (D7/D8) requiere firma humana ANTES de que se escriba
  una línea de código**, porque es una pregunta de negocio, no de ingeniería: no se puede resolver
  leyendo el código.

| # | Decisión | Estado |
|---|----------|--------|
| **G1** | Romper el 1:1 con `periodo_mes` en `autorizacion` (no tabla hija) | ✅ **Decidido por la usuaria** — no se relitiga |
| **G2** | Mes como `DATE` día-1 absoluto, ordinal "Mes N" derivado (design D2) | Recomendado — **requiere firma** |
| **G3** | Auto-creación: **un** mes (el primero de la vigencia), no N, no cero (design D4) | Recomendado — **requiere firma** |
| **G4** | `montoAutorizado` pasa de tope anual a tope del mes, con dos semánticas conviviendo (design D8) | ⚠️ **BLOQUEANTE — requiere firma explícita antes de codear** |
| **G5** | Coherencia mes-autorización vs. mes-facturado: advertencia, no bloqueo, sin auto-resolución (design D7) | ⚠️ **BLOQUEANTE — requiere firma explícita antes de codear** |
| **G6** | Columna nueva sin RLS propia (no hay tabla nueva) | Recomendado — verificar en vivo igual (§0.3) |

## ⚠️ Open Questions — para Andrea, NO se adivinan

Regla dura del proyecto (`CLAUDE.md`): *"nunca resolverla adivinando"*. Estas dos **no tienen respuesta
en la KB ni en `Traslados-Modelo-Datos.docx`**, y no se pueden deducir del código.

**OQ-1 — ¿Contra qué se compara el monto autorizado de un mes?** Hoy el trigger compara cada
`monto_autorizado` contra `presupuesto.monto` **completo**. Con N meses hay tres lecturas posibles y
nada en el dominio las distingue:
  a. `presupuesto.monto` es el monto **mensual** ⇒ cada mes se compara contra él, el trigger queda
     como está;
  b. `presupuesto.monto` es el **total del período de vigencia** ⇒ la regla pasa a ser
     `SUM(monto_autorizado del presupuesto) ≤ presupuesto.monto`, un trigger agregado, mucho más pesado;
  c. no hay relación ⇒ si *"el valor del km cambia mes a mes"* (palabras de Andrea), comparar cada mes
     contra un total presupuestado fijo puede no significar nada.
  El ejemplo del punto 8 (326,60 km presupuestados vs. 264 autorizados) describe **un** mes recortado —
  no dice si el monto del presupuesto era mensual o total. **Hasta que Andrea responda, el trigger no
  se toca.**

**OQ-2 — ¿La vigencia de la autorización de un mes tiene que estar contenida en ese mes?** Lo natural
sería `vigenciaDesde/Hasta ⊆ periodoMes`, pero es una **suposición**: la obra social podría autorizar
una ventana a caballo de dos meses, y RN-PA-02 ya admite vigencias retroactivas. **No se agrega esa
restricción** hasta tener respuesta.

**OQ-3 (menor, para Enzo)** — ¿`periodo_mes` o algún equivalente ya existe en el modelo real que él
mantiene? El schema real fue por delante del repo en 5 changes consecutivos; se verifica en vivo (§0.3).

## Success Criteria

- [ ] Un presupuesto puede tener **3 autorizaciones** (marzo, abril, mayo) con **montos distintos**,
      cada una con su propio adjunto, y las tres sobreviven recarga.
      **Sin marcar (2026-08-23, Fase 8)**: depende de 8.4 (verificación manual con la usuaria contra
      la base real) — no hay round-trip de persistencia real automatizado, solo tests con fixtures
      mockeadas. No se marca por evidencia ajena a un test o confirmación real.
- [x] Cargar **dos veces el mismo mes** para el mismo presupuesto falla con un mensaje de dominio
      ("Ya existe una autorización para ese mes"), no con un error crudo de Postgres.
      **Evidencia (2026-08-23)**: `AutorizacionForm.test.tsx:935` ("elegir un mes que ya está cargado
      en otra fila del presupuesto bloquea el guardado con el mensaje de dominio del `23505`") +
      `edgeFunctionErrors.test.ts:100,115` (mapeo del `23505` crudo, con y sin texto distinto, a
      `MENSAJE_AUTORIZACION_DUPLICADA`, nunca el código Postgres crudo en el mensaje).
- [x] Las 3 aparecen en el selector del Paso 2 de `FacturaForm` **distinguibles entre sí por el mes**,
      ordenadas cronológicamente — verificado sin abrir ningún detalle.
      **Evidencia (2026-08-23)**: `etiquetaAutorizacion.test.ts` (test obligatorio de 5.3: 3 meses
      del mismo presupuesto/misma prestación producen 3 etiquetas distintas, `new Set(...).size ===
      3`) + `autorizacionesPendientes.test.ts:280-334` (orden cronológico entre presupuestos
      insertados fuera de orden, legacy siempre primero).
- [x] Facturar mayo eligiendo la autorización de marzo **muestra una advertencia visible** y **no
      bloquea** (RN-PA-02 sigue permitiendo retroactivo).
      **Evidencia (2026-08-23)**: `FacturaForm.test.tsx:674` ("Paso 3: aviso no bloqueante cuando el
      mes facturado no coincide con el periodoMes de la autorización elegida") — asserta el texto
      "no coincide" visible Y el botón "Guardar" `toBeEnabled()` en el mismo test.
- [x] Una autorización creada **antes** de este change (`periodo_mes NULL`) sigue funcionando: se
      muestra rotulada "Sin mes cargado", se puede facturar contra ella, y **nadie le inventó un mes**.
      **Evidencia (2026-08-23)**: `FacturaForm.test.tsx:692` ("aviso distinto (no bloqueante) cuando
      la autorización elegida es legacy sin periodoMes" — "sin mes cargado" visible + Guardar
      habilitado) + `etiquetaAutorizacion.test.ts` (sufijo `'Sin mes cargado'` para legacy) +
      `PresupuestoDetail.test.tsx` (5 estados de D10, incluye legacy sin mes).
- [x] `PresupuestoDetail` muestra la tabla de meses rotulada "Mes 1 / Mes 2 / Mes 3" **derivada**, y
      `grep periodo_ordinal supabase/migrations/` no encuentra ninguna columna.
      **Evidencia (2026-08-23)**: `grep -rn "periodo_ordinal" supabase/migrations/` → sin matches
      (corrido en esta verificación) + `periodoAutorizacion.test.ts:57-97` (`ordinalMes`) +
      `PresupuestoDetail.test.tsx` (Table de meses, los 5 estados de D10).
- [x] El adjunto de cada mes es **independiente**: reemplazar el PDF de abril no toca el de marzo
      (cae solo de D12 — se verifica, no se asume).
      **Evidencia (2026-08-23)**: `PresupuestoDetail.test.tsx` (`describe('PresupuestoDetail — el
      adjunto de un mes no afecta al de otro mes')`, test dedicado de 6a.7).
- [x] Las Open Questions 1 y 2 figuran en `knowledge-base/10_preguntas_abiertas.md` con prioridad
      **Alta** y con `AvisoModeloDatos` visible en `AutorizacionForm`/`PresupuestoDetail`.
      **Evidencia (2026-08-23)**: `knowledge-base/10_preguntas_abiertas.md:483-504` (sección
      "Preguntas nuevas — `autorizacion-mensual` — prioridad Alta", OQ-1/OQ-2 con Decisor) +
      `AutorizacionForm.test.tsx`/`PresupuestoDetail.test.tsx` (tests de `AvisoModeloDatos`, 6a.6).
- [x] Schema real verificado en vivo antes de escribir `.sql` (§0.3).
      **Evidencia**: `tasks.md` 0.5, verificado en vivo por el orquestador (2026-08-22) vía
      `supabase db query --linked`, antes de escribir cualquier `.sql`.
- [x] `cd frontend && npx tsc -b --noEmit` y `npx vitest run` en verde. Cero `any`.
      **Evidencia (2026-08-23, Fase 8)**: `tsc -b --noEmit` → limpio (exit 0). Grep de control de
      `any` sobre los 36 archivos que este change tocó → cero usos reales (solo `expect.any(File)` de
      vitest y comentarios que dicen "sin `any`"). `vitest run` completo: 3221/3245 passed, 24 fallos
      en 6 archivos que **no tocan ningún archivo de este change**
      (`PermisosMatrizFields.test.tsx`, `RecorridoCard.test.tsx`, `ChecklistEditor.test.tsx`,
      `VehiculosPage.test.tsx`, `PacienteDetail.test.tsx`, `PacientesPage.test.tsx` — mock de Google
      Maps, conteo de SVG y `useCatalogoAccesoriosRepository` sin provider, sin relación con
      `periodoMes`/autorizaciones), mismo conteo (~24) que el baseline documentado en Fases 4/6a — no
      creció. "En verde" interpretado como este proyecto lo viene documentando en toda la Fase 4-6b:
      cero regresiones nuevas, no cero fallos globales preexistentes.
