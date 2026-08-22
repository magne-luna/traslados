# Design: Una autorización por mes (1:1 → 1:N)

## Estado verificado del código (leído, no asumido)

| Hecho | Evidencia |
|---|---|
| **`autorizacion.presupuesto_id` NO tiene `UNIQUE`** — la base ya permite N filas | `20260724100005_schema_facturacion.sql:26-34` (solo `NOT NULL` + FK `ON DELETE CASCADE`); `20260802100000_presupuesto_autorizacion_indices.sql:41-42` (`CREATE INDEX`, **no** `UNIQUE`) |
| El 1:1 es convención de **aplicación**, en 3 superficies | `.maybeSingle()` (`functions/autorizaciones/index.ts:142`), `getByPresupuestoId(): Promise<Autorizacion \| null>` (`AutorizacionRepository.ts:13`), `INSERT … VALUES (v_id, 'pendiente')` ×2 (`20260815090000:87`, `:142`) |
| El `.maybeSingle()` **ya estaba marcado como el punto que este change abre** | `functions/autorizaciones/index.ts:133-136`: *"es la superficie que expone la cardinalidad 1:1 … El punto 7 … es quien podría cuestionar esa cardinalidad; hasta que eso se decida, se deja tal cual"* |
| El modelo actual resuelve "mensual" con un **cupo recurrente**, no con N respuestas | `facturacion-seleccion-autorizacion/design.md:82`: *"cupoMensualDias/cupoMensualKm son un cupo **mensual recurrente** … Una autorización genera una factura por mes"* |
| `montoAutorizado` se valida hoy como tope **ANUAL** | `montoConsumido.ts:4-9` (*"es un tope ANUAL, no mensual"*), consumido en `FacturaForm.tsx:250-264` |
| `resolverCupoAutorizado` **ya recibe un `autorizacionId` explícito** | `useEmisionFactura.ts:60-68` — y su comentario dice *"dejó de adivinar"* (D6 de `facturacion-seleccion-autorizacion`) |
| El adjunto ya está cableado por `id` de autorización | `SupabaseAutorizacionRepository.ts:169` — `construirClaveArchivo(id, file.name, uuid)`, bucket `documentos-autorizaciones` |
| El bloque de autorización vive en `PresupuestoDetail.tsx`, **NO en `PresupuestoResumen.tsx`** | `PresupuestoDetail.tsx:103-141` (carga) y `:249-320` (render). `grep -i autorizacion PresupuestoResumen.tsx` → **0 coincidencias** |
| `presupuesto.vigencia_desde` ya existe y ya está **aplicado en la base real** | `20260821170000_presupuesto_vigencia_dependencia_traslado.sql`; verificado en vivo el 2026-08-21 (`presupuestos-vigencia…/proposal.md` §Success Criteria) |
| El trigger RN-PA-01 compara **una fila** contra `presupuesto.monto` completo | `20260729130000_schema_autorizacion_monto_vigencia.sql:12-33` |
| 5 consumidores de `getByPresupuestoId` en código de producción | `PresupuestoDetail.tsx:117`, `autorizacionesPendientes.ts:37`, `SupabaseAutorizacionRepository.ts:246`, `mockAutorizacionRepository.ts:78`, `edgeFunctionErrors.ts:122,143` |

## Goals / Non-Goals

**Goals**

- Que cada mes que llega de la obra social sea **una fila real e independiente**, con su monto, sus km
  y días reconocidos, su vigencia y su PDF.
- Que Andrea vea "Mes 1, Mes 2, Mes 3…" tal como lo dijo, **sin** que ese ordinal sea la clave.
- Que el operador **elija** el mes al facturar y que el sistema le **avise** si eligió otro, sin
  bloquearlo.
- Que una autorización creada antes de este change siga funcionando sin que nadie le invente un mes.

**Non-Goals**

- **NO se toca el trigger `validar_autorizacion_monto`** (RN-PA-01). Open Question 1.
- **NO se agrega la restricción "vigencia ⊆ su propio mes"**. Open Question 2.
- **NO se crea ninguna tabla** — decisión de la usuaria, `autorizacion_mensual` descartada.
- **NO se auto-resuelve** la autorización del mes facturado. D7.
- **NO se persiste el ordinal "Mes N"**. D2.
- **NO se hace backfill** de `periodo_mes`. D3.
- **NO se toca `uploadArchivo`/`getUrlArchivo`/`removeArchivo`**. D12.
- **NO se toca `cupoConsumido`/`montoConsumido`**. D8 es una reinterpretación, no un refactor.

---

## D1 — La cardinalidad se rompe **sin** `DROP CONSTRAINT` ✅ RESUELTA

**La base ya permite N filas.** No hay `UNIQUE` sobre `presupuesto_id` (evidencia arriba). Lo único
que hay que hacer en SQL es **agregar** la columna de período y **agregar** la unicidad correcta:

```sql
ALTER TABLE facturacion.autorizacion
  ADD COLUMN periodo_mes DATE
  CHECK (periodo_mes IS NULL OR EXTRACT(DAY FROM periodo_mes) = 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_autorizacion_presupuesto_periodo
  ON facturacion.autorizacion (presupuesto_id, periodo_mes)
  WHERE periodo_mes IS NOT NULL;
```

**Por qué el `CHECK` de día 1 y no confiar en el mapping.** Sin él, `2026-03-15` y `2026-03-01`
son dos "marzos" distintos para el índice único, y la unicidad que el índice promete se vuelve
falsa. Acá la cerradura **sí** va en la base — criterio distinto al de `dias_semana TEXT[]` del change
hermano (D2 de ese design: *"la cerradura la impone este tipo, no la base"*), y a propósito: allá lo
que se protegía era un valor de presentación; acá lo que se protege es la **clave de unicidad de un
dato financiero**.

**Por qué índice único PARCIAL (`WHERE periodo_mes IS NOT NULL`).** Las filas legacy no tienen mes y
tienen que poder coexistir. Un índice total dependería del comportamiento `NULLS DISTINCT` de
Postgres, que es un default histórico y no una intención escrita — el `WHERE` hace la intención
explícita y es a prueba de que alguien active `NULLS NOT DISTINCT` más adelante.

**Sin RLS nueva**: no hay tabla nueva, así que las policies de `presupuestos`
(`20260730140000_split_modulos_permisos.sql`) ya cubren la columna. Mismo criterio que G3 del change
hermano. **Se verifica en vivo igual** (§0.3).

**Alternativas descartadas**

| Alternativa | Por qué no |
|---|---|
| Tabla hija `autorizacion_mensual` bajo una fila maestra | Descartada por la usuaria: en el modelo de Andrea **no existe** la fila maestra. Además crearía una tabla nueva con RLS, auditoría e índices propios para expresar algo que ya cabe en una columna |
| Dejar sin unicidad y confiar en la UI | La UI no es una garantía. Cargar dos veces "abril" es el error más probable del flujo, y duplicaría el monto autorizado del mes en `montoConsumido` |
| `UNIQUE (presupuesto_id, periodo_mes)` total, sin `WHERE` | Depende de `NULLS DISTINCT`, un default no escrito. Y si alguna vez se hace backfill parcial, empieza a rechazar filas legacy legítimas |

---

## D2 — El mes se persiste como **`DATE` día-1 absoluto**; "Mes 1 / Mes 2 / Mes 3" es **derivado** ✅ RESUELTA

Andrea propuso rotularlas *"mes 1, mes 2, mes 3…"*. **Eso es el rótulo, no la clave.**

**Se persiste** `periodo_mes DATE` = primer día del mes calendario (`2026-03-01`).
**Se deriva** el ordinal: posición de ese período entre los períodos cargados de ese presupuesto,
ordenados ascendentemente — función pura en `periodoAutorizacion.ts`, **nunca una columna**.

**Por qué NO un ordinal persistido (`mes SMALLINT`)**, que es lo que Andrea dijo literalmente:

1. **Se corrompe si se saltea un mes.** Si la obra social no autoriza marzo, ¿abril es "mes 2" o
   "mes 3"? Un ordinal persistido obliga a decidir eso al escribir, y la decisión se congela mal.
2. **Se corrompe si llegan fuera de orden.** RN-PA-02 admite carga retroactiva: mayo puede cargarse
   antes que marzo. Con ordinal persistido, mayo nace "mes 1".
3. **No se puede cruzar con facturación.** `factura.mesFacturado`/`anioFacturado` son **absolutos** y
   ya son la clave de `cupoConsumido`/`montoConsumido`. Un ordinal relativo al presupuesto no se puede
   comparar contra ellos sin resolver primero el presupuesto — o sea, no sirve para D7.
4. **No es indexable como unicidad real.** `UNIQUE (presupuesto_id, mes_ordinal)` impide dos "mes 2",
   pero no impide dos autorizaciones para abril rotuladas 2 y 3.
5. **Misma regla que el change hermano.** D4 de `presupuestos-vigencia…` decidió **no** persistir
   `viajesMensuales` porque *"sería una segunda fuente de verdad … que puede desincronizarse en
   cualquier edición"*. El ordinal es exactamente eso respecto del período. Se aplica el mismo criterio.

**Por qué NO un par `periodo_desde`/`periodo_hasta`.** Dos columnas para un mes permiten estados
imposibles (un "mes" de 45 días) y se confunden con `vigencia_desde`/`vigencia_hasta`, que ya existen
en la fila y significan **otra cosa**: la ventana efectivamente autorizada, que puede ser **más corta**
que el mes (la obra social recorta). Meterlos en la misma forma borra esa distinción, que es
justamente lo que el change hermano acaba de construir (par pedido/concedido, D1/D3).

**Por qué NO derivar el mes de `vigencia_desde`.** `vigencia_desde` lo controla la obra social: es
recortable y retroactivo (RN-PA-02). Si la identidad de la fila se deriva de un valor que el tercero
puede cambiar, **la identidad cambia cuando el tercero recorta** — y con el índice único encima, un
recorte podría chocar contra otro mes. La identidad tiene que ser independiente del valor.

**Formato en TypeScript:** `periodoMes?: string` en ISO `YYYY-MM-01`, mismo criterio que el resto de
las fechas del contrato (`vigenciaDesde`, `fechaEmision`). No un `Date`, no un `{ anio, mes }`.

**Funciones puras nuevas** (`frontend/src/shared/lib/presupuestos/periodoAutorizacion.ts`, TDD estricto):

| Función | Contrato |
|---|---|
| `normalizarPeriodoMes(valor: string): string` | `'2026-03'` o `'2026-03-15'` → `'2026-03-01'`. Es lo que evita que el `CHECK` de la base sea la primera línea de defensa |
| `ordinalMes(periodoMes, periodosDelPresupuesto): number \| undefined` | Posición 1-based dentro de los períodos ordenados. `undefined` para filas sin período (legacy) |
| `etiquetaPeriodoMes(periodoMes): string` | `'2026-03-01'` → `'marzo 2026'`. `undefined` → `'Sin mes cargado'`, **nunca** un mes inventado |
| `coincidePeriodoFacturado({ periodoMes, mesFacturado, anioFacturado }): boolean` | Insumo de D7 |

---

## D3 — `periodo_mes` es **NULLABLE** y `NULL` significa "modelo anterior" ✅ RESUELTA

**No hay backfill.** Las filas que existen hoy en la base real se crearon bajo el modelo 1:1 (varias
por la auto-creación de `20260815090000`, aplicada el 2026-08-15). Asignarles un mes derivado de
`fecha_emision` o de `vigencia_desde` sería **fabricar un dato financiero** que nadie cargó.

Mismo criterio, textual, que el change hermano para vigencia: *"`NULL` es semánticamente correcto (se
emitieron bajo el modelo anterior) … la UI muestra 'Sin vigencia cargada', nunca un rango inventado"*.

Consecuencias que hay que aceptar explícitamente:

- Una fila legacy **puede** convivir con filas mensuales del mismo presupuesto (el índice parcial no
  lo impide). Es correcto: significa "esta respuesta vieja no sabemos de qué mes era".
- El operador **puede** editarla y ponerle un mes. Eso es una corrección manual legítima, no un
  backfill automático.
- La UI las ordena **primero** y las rotula "Sin mes cargado".
- `montoAutorizado` de una fila legacy conserva la semántica **anual** (D8).

---

## D4 — La auto-creación de la RPC crea **UN** mes (el primero), no N, no cero ✅ RESUELTA

Hoy `crear_presupuesto_completo` y `crear_presupuestos_lote` hacen
`INSERT INTO facturacion.autorizacion (presupuesto_id, estado) VALUES (v_id, 'pendiente')`
(`20260815090000:87` y `:142`), en la misma transacción, por requerimiento aprobado el 2026-08-15.

**Decisión:** se conserva el `INSERT`, agregándole el período **derivado de `vigencia_desde` del
propio payload**:

```sql
INSERT INTO facturacion.autorizacion (presupuesto_id, estado, periodo_mes)
VALUES (
  v_id,
  'pendiente',
  date_trunc('month', NULLIF(p_presupuesto ->> 'vigencia_desde', '')::date)::date
);
```

`date_trunc` sobre `NULL` da `NULL`, así que **si el presupuesto no trae vigencia, el comportamiento es
byte por byte el de hoy** (fila `pendiente` sin período). No hay rama nueva, no hay `IF`.

**Por qué NO auto-crear N filas (una por cada mes del rango de vigencia).** Un presupuesto de
feb-2026→ene-2027 generaría **12 filas 'pendiente'** de golpe. Tres problemas:
1. Fabrica respuestas de la obra social que todavía no llegaron — y puede que nunca lleguen (Andrea
   dice *"cada mes llega una autorización distinta"*, no "van a llegar las 12").
2. Contamina el selector del Paso 2 con 11 opciones no accionables (`autorizacionesPendientes` filtra
   por `autorizada`/`judicializada`, así que hoy no las mostraría — pero contamina igual
   `PresupuestoDetail` y cualquier lectura futura).
3. Si la vigencia se corrige después, hay que borrar filas ya creadas. Borrar filas de autorización es
   exactamente lo que el `ON DELETE NO ACTION` de `facturas.autorizacion_id` está ahí para impedir.

**Por qué NO auto-crear nada.** Sería una regresión del requerimiento aprobado el 2026-08-15
(*"sin que el usuario tenga que completar `AutorizacionForm` como paso aparte"*) y dejaría
`PresupuestoDetail` con una tabla vacía apenas creado el presupuesto — un empeoramiento visible.

**Los meses 2..N se agregan de a uno**, explícitamente, desde `PresupuestoDetail` ("Agregar mes"),
cuando la autorización de ese mes efectivamente llega. **Esto es literalmente el modelo mental de
Andrea.**

⚠️ El trigger RN-PA-01 no se activa en este `INSERT` (solo valida cuando `monto_autorizado IS NOT NULL`,
`20260729130000:21`), así que sigue sin bloquear el alta — igual que hoy.

---

## D5 — `getByPresupuestoId` **se reemplaza**, no se convive ✅ RESUELTA

```ts
// antes
getByPresupuestoId(presupuestoId: string): Promise<Autorizacion | null>;
// después
listByPresupuestoId(presupuestoId: string): Promise<Autorizacion[]>;
```

**Por qué reemplazar y no agregar `listByPresupuestoId` al lado del singular.** Dejar el singular vivo
deja un método que, con N filas, devuelve **alguna** — exactamente la clase de bug que D6 de
`facturacion-seleccion-autorizacion` eliminó (*"dejó de adivinar: antes iteraba TODOS los presupuestos
del paciente y devolvía la primera autorización con cupo cargado"*). Reintroducirlo con otro nombre
sería repetir el bug con más pasos.

Reemplazar además convierte al type-checker en la lista de tareas: `npx tsc -b --noEmit` marca los 5
call sites. Ninguno se puede olvidar.

**Edge Function** (`functions/autorizaciones/index.ts:132-146`):

- `.maybeSingle()` fuera. `GET ?presupuestoId=` devuelve **`200` con un array ordenado por
  `periodo_mes` (`NULLS FIRST`)**, incluido `[]`.
- **El `404` de esa consulta desaparece.** "Este presupuesto todavía no tiene autorización" deja de ser
  un error y pasa a ser una lista vacía. En consecuencia, el `esErrorNotFound` de
  `SupabaseAutorizacionRepository.getByPresupuestoId` (`:253-256`) se retira, y `edgeFunctionErrors.ts:122,143`
  actualiza su documentación (`getById` sí lo conserva).
- Se agrega `&periodoMes=` como filtro opcional, para la lectura de un mes puntual sin traer todos.
- ⚠️ **Cambio de forma de respuesta.** El frontend viejo contra la EF nueva rompe, y la EF vieja contra
  N filas **falla** (`.maybeSingle()` con >1 fila devuelve error de PostgREST, no la primera).
  Consecuencia directa en el Rollback Plan: capas 1 y 2 se revierten **juntas**.

**Error de duplicado.** El índice único parcial de D1 devuelve un `23505` crudo. Se mapea en
`edgeFunctionErrors.ts` a *"Ya existe una autorización para ese mes en este presupuesto."* — mismo
criterio que los códigos `45401`-`45404` de las RPC.

---

## D6 — El wizard de facturación **no gana un selector de mes**: la autorización mensual **ya es** la elección del mes ✅ RESUELTA

Leído `FacturaForm.tsx:326-381` (Paso 2) y `autorizacionesPendientes.ts` completo: el operador **ya
elige exactamente una `Autorizacion`** por factura, y ese id se persiste en `factura.autorizacion_id`.
Bajo el modelo mensual, **cada `Autorizacion` es un mes**, así que elegir la autorización **es** elegir
el mes. Un selector de mes aparte sería un segundo control para el mismo grado de libertad — dos
fuentes de verdad en la UI.

Lo que **sí** cambia:

**a) `autorizacionesPendientes.ts:36-41` — de `getByPresupuestoId` a `flatMap` sobre la lista.**
El filtro de "pendiente de facturar" (`autorizada` o `judicializada`) se aplica **por mes**, no por
presupuesto. Consecuencia deseada: los meses todavía en `pendiente` no aparecen; los meses ya
respondidos, sí — uno por uno, a medida que llegan.

**b) `etiquetaAutorizacion.ts` — el período entra en la etiqueta. Es un REQUISITO, no cosmética.**
Hoy la etiqueta es el **nombre de la prestación** (`:26-33`), con fallback a fecha+monto+cupos. Con N
meses del mismo presupuesto, los 12 renderizan **la misma cadena**: 12 opciones idénticas en un
`<select>`. Es exactamente el problema *"presupuestos indistinguibles entre sí"* que el **punto 2** del
change hermano acaba de arreglar para el listado. Etiqueta nueva: `{prestación o fallback} · {mes}`,
con `'Sin mes cargado'` para legacy. Escenario de spec obligatorio.

**c) Orden.** Hoy el orden es el de `presupuestoRepository.list()` (`:32-33`). Con N meses hay que
ordenar por `periodoMes` ascendente para que se lea "mes 1, mes 2, mes 3…" como Andrea lo piensa. Los
legacy (`undefined`) van primero.

**d) `resolverCupoAutorizado` NO cambia.** `useEmisionFactura.ts:60-68` ya recibe un `autorizacionId`
explícito y hace `getById` + `derivarCupoAutorizado`. Bajo el modelo mensual eso deriva el cupo **de
ese mes**, que es exactamente lo correcto. **Cero líneas.** La hipótesis del brief queda confirmada por
lectura.

**e) `derivarCupoAutorizado`/`CupoAutorizado` NO cambian.** Se podría agregar `periodoMes` a la
proyección, pero nadie la consume por período: `cupoConsumido` ya se llama con `mesFacturado`/
`anioFacturado` de la factura (`FacturaForm.tsx:240`). Agregarla sería un campo muerto.

---

## D7 — Coherencia mes-autorización ↔ mes-facturado: **advertencia, no bloqueo, sin auto-resolución** ⚠️ REQUIERE FIRMA

Este es el punto que decide la corrección de la facturación mensual. Tres opciones:

| Opción | Veredicto |
|---|---|
| **(a) Auto-resolver**: el sistema elige la autorización cuyo `periodoMes` coincide con `(mesFacturado, anioFacturado)` | ❌ Es **deshacer D6 de `facturacion-seleccion-autorizacion`**, cuyo texto es *"dejó de adivinar"*. Y rompe RN-PA-02: una factura de enero puede facturarse legítimamente contra una autorización que llegó en abril |
| **(b) Bloquear** cuando no coinciden | ❌ Vuelve infacturable el caso retroactivo de RN-PA-02, que es un caso **normal** del dominio, no un error. Y bloquea correcciones legítimas |
| **(c) Elección explícita + advertencia visible no bloqueante + preselección del mes coincidente** | ✅ **ELEGIDA** |

**Forma de (c):**

1. El operador **sigue eligiendo** en el Paso 2. Nada se resuelve solo.
2. Cuando existe **exactamente una** autorización pendiente cuyo `periodoMes` coincide con
   `(values.mesFacturado, values.anioFacturado)`, se **preselecciona**. Preselección ≠ resolución: es
   un default visible y cambiable, no una inferencia oculta detrás de una llamada de red.
3. Función pura nueva `validarCoherenciaPeriodo({ periodoMes, mesFacturado, anioFacturado })` →
   advertencia cuando difieren, en el mismo lugar y con el mismo tono que
   `validarCupoFacturacion`/`validarMontoAutorizado` ya usan. **No bloquea el submit.**

**Por qué no bloquea, dicho una vez más:** D6 de `facturacion-seleccion-autorizacion` ya fijó el
patrón — *"exige confirmación explícita — sin bloquear"* (`useEmisionFactura.ts:34-39`). Este aviso se
suma a esa familia, no inventa una tercera política.

⚠️ **Gate G5.** Aunque la ingeniería es clara, la política ("avisar, no impedir") es una decisión de
negocio sobre facturación a un tercero. **Requiere firma humana antes de escribir código.**

---

## D8 — `montoAutorizado` pasa de tope **ANUAL** a tope **del mes** sin que cambie una línea de código ⚠️ REQUIERE FIRMA — EL RIESGO MÁS ALTO DEL CHANGE

`montoConsumido.ts:15-30` suma las facturas que cumplen
`factura.autorizacionId === autorizacionId && factura.anioFacturado === anio`.

- **Hoy** (1:1): N facturas del año apuntan a **la misma** autorización ⇒ la suma es el consumo
  **anual** contra un `montoAutorizado` anual. El comentario del archivo lo dice explícitamente.
- **Después** (1:N mensual): cada factura apunta a la autorización **de su mes** ⇒ la suma para una
  autorización dada incluye **solo las facturas de ese mes** ⇒ **el mismo código valida un tope
  mensual.** El parámetro `anio` queda redundante-pero-inocuo (todas las facturas de un mes comparten
  año, porque `anioFacturado` es el año del período facturado, no el de emisión).

**Esto es correcto y no requiere refactor. Y precisamente por eso es peligroso**: una validación
financiera viva **cambia de significado sin que ningún diff lo muestre**. Nadie que lea el PR lo ve.

Peor: las dos semánticas **conviven**. Una fila legacy (`periodoMes NULL`) sigue recibiendo N facturas
del año ⇒ para ella `montoConsumido` sigue siendo anual. La misma función, dos reglas de negocio,
según un campo que ni siquiera recibe.

**Decisión:** no se refactoriza `montoConsumido` (refactorizarlo forzaría a elegir **una** de las dos
semánticas y rompería los datos de la otra). Se hace lo siguiente:

1. **Firma humana explícita (G4)** de que "tope anual → tope del mes" es la lectura correcta.
2. **Comentario de cabecera reescrito** en `montoConsumido.ts` explicando las dos semánticas y de qué
   depende cuál aplica.
3. **Dos tests de regresión nominados**, uno por semántica: *"fila legacy sin período: sigue sumando
   el año"* y *"fila mensual: suma solo su mes"*.
4. `AvisoModeloDatos` en `FacturaForm` mientras convivan filas de los dos modelos.

**Alternativa descartada:** agregar `periodoMes` como parámetro de `montoConsumido` y bifurcar adentro.
Pondría una regla de negocio no resuelta (OQ-1) dentro de una función pura que hoy no la tiene, y
obligaría a decidir OQ-1 para poder escribirla.

---

## D9 — RN-PA-01 y `validarVigenciaAutorizacion` por mes: **OPEN QUESTION, no se inventa la fórmula** ⚠️ SIN RESOLVER — A PROPÓSITO

**OQ-1 — ¿contra qué se compara el monto autorizado de un mes?**
El trigger `validar_autorizacion_monto` (`20260729130000:12-33`) compara **cada fila** contra
`presupuesto.monto` **completo**. Con N filas mensuales hay tres lecturas, y **ni la KB
(`05_reglas_de_negocio.md`, RN-PA-01/02/03) ni `Traslados-Modelo-Datos.docx` las distinguen**:

| Lectura | Qué implicaría |
|---|---|
| **(a)** `presupuesto.monto` es el monto **mensual** | El trigger queda tal cual; cada mes se compara contra él. Es el comportamiento actual, sin cambios |
| **(b)** `presupuesto.monto` es el **total del período de vigencia** | La regla pasa a `SUM(monto_autorizado del presupuesto) ≤ presupuesto.monto`: trigger agregado, `SELECT` sobre hermanos en cada `INSERT`/`UPDATE`, y un problema de concurrencia real |
| **(c)** No hay relación | Andrea dice *"el valor del km cambia mes a mes"*. Si el monto de cada mes lo fija un nomenclador variable, compararlo contra un total presupuestado fijo puede no significar nada |

El punto 8 de Andrea (326,60 km presupuestados vs. 264 autorizados) describe **un mes recortado en km**.
**No dice** si el monto del presupuesto era mensual o total. No se puede deducir.

**Decisión: el trigger NO se toca en este change.** Sigue haciendo exactamente lo de hoy (lectura (a)
por omisión, que además es la única que no requiere migración). La pregunta va a
`knowledge-base/10_preguntas_abiertas.md` con prioridad **Alta** y a `CHANGES.md` §C-06 con ⚠️, y a
`AvisoModeloDatos` en `AutorizacionForm`. **Regla dura del proyecto: no se resuelve adivinando.**

**OQ-2 — ¿la vigencia de un mes tiene que estar contenida en ese mes?**
`validarVigenciaAutorizacion` (`validarAutorizacion.ts:56-77`) valida hoy
`autorizada ⊆ presupuestada`. Eso **sigue siendo válido y no cambia**. Lo que **no** se agrega es
`vigenciaDesde/Hasta ⊆ periodoMes`: parece natural, pero es una suposición — la obra social podría
autorizar una ventana a caballo de dos meses, y RN-PA-02 ya admite vigencias retroactivas que no
respetan ningún límite de mes. **Sin respuesta de Andrea, no se agrega la restricción.**

---

## D10 — `PresupuestoDetail`: **tabla** de meses, no chips ✅ RESUELTA

⚠️ **Corrección al brief:** el bloque de autorización **no** está en `PresupuestoResumen.tsx`
(`grep` → 0 coincidencias). Está en `PresupuestoDetail.tsx:249-320` — una `<Section label="Autorización">`
con un `<Card>` único y una grilla de 2/4 columnas con **6 campos** (monto, cupo, fecha de respuesta,
vigencia desde, vigencia hasta, CD/SD). El estado se carga en `:103-141`.

**Forma nueva:** un `Table` del design system, **una fila por mes**:

| Columna | Contenido |
|---|---|
| Mes | `Mes {ordinalMes}` + `etiquetaPeriodoMes` → *"Mes 2 · abril 2026"*. Legacy: *"Sin mes cargado"* |
| Estado | `Chip` (`ESTADO_AUTORIZACION_CHIP_KIND`, reusado sin cambios) |
| Monto autorizado | Igual que hoy |
| Cupo | `{días} días · {km} km` |
| Vigencia | `desde → hasta` |
| Adjunto | Presencia + vista previa (reusa `VistaPreviaArchivo`, D12) |

Fila **100% clickeable** (convención de UI del proyecto) → despliega `AutorizacionForm` **de ese mes**,
inline, nunca modal. Acción **"Agregar mes"** al pie.

**Por qué tabla y no chips por mes.** Un chip transporta un dato; acá hay 6 por mes. Repetir N veces la
grilla de 4 columnas actual produce una pared vertical ilegible ya con 3 meses. `Table` es la respuesta
que el design system ya tiene para filas homogéneas repetidas, y `PresupuestosList` ya estableció el
patrón "una tarjeta/fila por ítem, clickeable" en esta misma feature.

**Estados a cubrir**: cargando · sin ninguna autorización (legacy pre-2026-08-15) · solo legacy sin mes ·
N meses · mezcla legacy + meses.

---

## D11 — `AutorizacionForm`: campo de mes, y es el **único campo de identidad** del formulario ✅ RESUELTA

- Control: `<input type="month">` → `YYYY-MM` → `normalizarPeriodoMes` → `YYYY-MM-01`.
  **Por qué no un date picker completo:** un día distinto de 1 rompe la unicidad prometida por el
  índice (dos "marzos"). El tipo de control **es** la validación.
- **Prefill en alta:** el primer mes **no cargado** del presupuesto, derivado del rango de vigencia del
  presupuesto y de los meses ya existentes. Derivado, nunca persistido.
- **Editable en edición**, con re-chequeo de unicidad. El operador puede haberse equivocado de mes, y
  no dársela a arreglar lo obligaría a borrar la fila — borrar autorizaciones es justo lo que
  `factura.autorizacion_id ON DELETE NO ACTION` está para impedir.
- **Rótulo "Mes N"** visible junto al campo, derivado en vivo.
- El resto del formulario (vigenciaHasta, CD/SD desmarcable, adjunto + vista previa — todo construido
  el 2026-08-21) **no cambia**: pasa a describir **ese mes** en lugar del presupuesto entero.
- `AvisoModeloDatos` con OQ-1 y OQ-2 mientras estén abiertas.

---

## D12 — El adjunto por mes **cae solo** — verificado, no asumido ✅ RESUELTA

`SupabaseAutorizacionRepository.ts:169`: `construirClaveArchivo(id, file.name, crypto.randomUUID())`,
bucket `documentos-autorizaciones` (`:27`). La clave es `{autorizacionId}/{uuid}-{nombreSeguro}`.
`uploadArchivo`/`removeArchivo`/`getUrlArchivo` operan **todos** sobre el `id` de la fila
(`:160-219`, `:125-130`), y las columnas `archivo_*` (`20260818090000`) están **en la fila**.

⇒ **N filas mensuales = N archivos independientes, con cero cambios en la capa de storage.** El
reemplazo compensado de D5 de `integracion-documentos-autorizaciones` (upload → patch → delete viejo)
sigue funcionando por fila.

Es el único eje del punto 7 que sale gratis — y es, además, exactamente lo que Andrea pidió: el PDF de
cada mes, no un PDF por presupuesto. **Se verifica con un test** (reemplazar el adjunto de abril no
toca el de marzo), no se declara verificado por lectura.

---

## Orden de aplicación (no negociable)

```
§0 Gate governance (firma G2/G3/G4/G5 + verificación de schema en vivo)
        │
        ▼
1. Migración periodo_mes + índice único parcial     ──┐
2. CREATE OR REPLACE de las 2 RPC (D4)                │  base
        │                                             ──┘
        ▼
3. Edge Function autorizaciones (D5)  ⚠️ rompe el frontend viejo
        │
        ▼   (mismo PR / mismo deploy)
4. Tipos → mapping → periodoAutorizacion.ts (TDD) → repositories + mocks
        │
        ▼
5. autorizacionesPendientes + etiquetaAutorizacion (D6)
        │
        ├──▶ 6a. AutorizacionForm (D11) + PresupuestoDetail (D10)
        └──▶ 6b. FacturaForm Paso 2: preselección + aviso (D7)
        │
        ▼
7. KB / CHANGES.md / 10_preguntas_abiertas.md + AvisoModeloDatos
```

Los pasos **3 y 4-6 no se pueden desplegar por separado** (D5: cambia la forma de la respuesta).

## Open Questions (resumen)

| # | Pregunta | Para | Bloquea |
|---|---|---|---|
| **OQ-1** | ¿`presupuesto.monto` es mensual, total del período, o no comparable? | **Andrea** | Cualquier cambio al trigger RN-PA-01. **No bloquea el resto del change** |
| **OQ-2** | ¿La vigencia de un mes debe estar contenida en ese mes? | **Andrea** | Agregar esa restricción. **No bloquea el resto** |
| **OQ-3** | ¿`periodo_mes` choca con algo en vuelo sobre `facturacion.autorizacion`? | **Enzo** | La migración (§0.3 lo verifica en vivo) |
| **G4** | ¿"tope anual → tope del mes" es la lectura correcta de `montoAutorizado`? | **Usuaria (firma)** | ⚠️ **Sí, bloquea** el Paso 6b |
| **G5** | ¿Avisar y no impedir cuando el mes no coincide? | **Usuaria (firma)** | ⚠️ **Sí, bloquea** el Paso 6b |
