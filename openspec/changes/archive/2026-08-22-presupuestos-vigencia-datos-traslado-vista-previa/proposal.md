# Proposal: Vigencia, datos de traslado e identificación de presupuestos + vista previa del adjunto de autorizaciones

## Intent

Andrea planteó 8 cambios sobre Presupuestos/Autorizaciones en la llamada del 2026-08-21. La
exploración previa (engram `opsx/cambios-andrea-presupuestos-autorizaciones/explore`) los partió en
**seguros (1-6)** y **bloqueados (7 y la parte mensual del 8)**. Este change ejecuta **solo los
puntos 1-6**.

El hilo común de los 6 puntos es uno solo: **hoy el presupuesto guarda un monto y una fecha de
emisión, y nada más de lo que Andrea efectivamente le presenta a la obra social.** Todo el resto
—qué período cubre, a qué prestación corresponde, con o sin dependencia, orígenes/destinos, horarios,
km, días y viajes del mes— vive en el formulario de papel de la obra social y en la cabeza de Andrea.
Consecuencias concretas hoy:

- El listado muestra N presupuestos del mismo paciente **indistinguibles entre sí** (mismo nombre,
  mismo monto redondo, distinta prestación).
- No hay dónde registrar que un presupuesto armado el **30/12** cubre **feb-2026 → ene-2027**, ni que
  se corta antes por vencimiento del **CUD** del paciente o del **RNP** del prestador.
- El cálculo de viajes mensuales que el equipo venía usando de un doc de referencia **estaba mal**:
  23 días hábiles se contaban como 24 viajes en vez de **46** (ida + vuelta).
- `integracion-documentos-autorizaciones` dejó explícito su checkpoint **G3**: *"aceptar «subo pero
  no veo» o ampliar el alcance"*. **Andrea contestó: ampliar.** Necesita revisar el PDF de la
  autorización todos los meses, no archivarlo a ciegas.

## Scope

### In Scope

1. **Vigencia de la prestación** (`vigenciaDesde`/`vigenciaHasta`) en `Presupuesto`, **separada de
   `fechaEmision`**, y `vigenciaHasta` en `Autorizacion` (que ya tiene `vigenciaDesde`) para que la
   obra social pueda autorizar un período **menor** al pedido.
2. **Identificación del presupuesto en el listado** — **sin columna nueva**: se renderiza la
   prestación (`prestacionId` en modalidad `por-prestacion`, `lineas[]` en `general`) + el rango de
   vigencia en cada tarjeta de `PresupuestosList.tsx`.
3. **Checkbox con/sin dependencia (CD/SD)** en **presupuesto** (lo pedido) **y** en **autorización**
   (lo concedido), desmarcable en la autorización.
4. **Bloque "datos de traslado"** en `Presupuesto`, replicando el formulario de la obra social:
   origen/destino de ida y de vuelta, horario de entrada y de salida, km de ida y de vuelta, días de
   la semana y días mensuales. **No reusa `RecorridoHabitual`** (ver design D2).
5. **Cálculo correcto de viajes y km mensuales** como **función pura nueva** —
   `viajesMensuales = diasMensuales × (tieneVuelta ? 2 : 1)` → 23 días = **46 viajes**. Verificado:
   **hoy este cálculo no existe en ningún lado del código**, así que es alta, no corrección de código.
6. **Vista previa del archivo de la autorización** (imagen y PDF) dentro de la app **+ "Abrir en otra
   pestaña"**, sobre el bucket `documentos-autorizaciones` que ya existe y ya funciona.

### Out of Scope

- **Punto 7 — una autorización por mes (1:1 → 1:many).** Bloqueado: `facturacion-seleccion-autorizacion/design.md:124`
  dice literalmente *"NO cambia la relación Autorización↔Presupuesto. Sigue siendo 1:1, sin
  excepciones."*, y romperlo tumba `autorizacionesPendientes.ts`, el `.maybeSingle()` de la Edge
  Function, la firma de `getByPresupuestoId`, la auto-creación de `crear_presupuesto_completo` y la
  semántica de RN-PA-01. **Decide: Enzo (backend), llamada del 2026-08-22.**
- **Punto 8, parte mensual.** `montoAutorizado ≠ presupuesto.monto` ya funciona hoy; solo la variación
  *mes a mes* queda atada al punto 7.
- **Descarga/vista previa del adjunto de `Presupuesto`** — sigue sin subida real (`archivo_url` de
  presupuesto guarda una URL, no una clave de bucket). Change hermano.
- **Cambiar `presupuesto.monto`** — la discrepancia KB #13 **no se reabre**.
- **Definir numéricamente qué le hace CD/SD al valor del km.** Se modela el booleano; el efecto sobre
  el nomenclador es pregunta abierta para Andrea (ver Risks).
- **Tabla nueva de cualquier tipo.** Todo el change es aditivo por columnas.

## Capabilities

### New Capabilities

- `presupuesto-vigencia`: período de prestación (desde/hasta) en el presupuesto, independiente de la
  fecha de emisión, con su espejo en la autorización.
- `presupuesto-dependencia`: CD/SD pedido (presupuesto) vs. concedido (autorización).
- `presupuesto-datos-traslado`: bloque de datos del formulario de la obra social (origen/destino
  ida-vuelta, horarios, km, días de semana, días mensuales).
- `presupuesto-calculo-viajes`: cálculo puro de viajes y km mensuales (fix 23 días = 46 viajes).
- `autorizacion-archivo-vista-previa`: URL firmada `inline`, previsualización embebida y apertura en
  pestaña nueva del adjunto de la autorización.

### Modified Capabilities

- `presupuesto-contract`: `Presupuesto` gana vigencia, dependencia y datos de traslado;
  `Autorizacion` gana `vigenciaHasta`, `conDependencia` y `archivo.tipoMime`.
- `presupuesto-crud`: formulario y **listado** (identificación por prestación + vigencia).
- `presupuesto-repository-supabase`: mapeo de los campos nuevos en las 3 direcciones.
- `autorizacion-gestion`: vigencia hasta, checkbox CD/SD desmarcable, acción de vista previa.
- `autorizacion-repository-supabase`: método `getUrlArchivo(id, modo)` + `archivoTipoMime`.
- `autorizacion-archivo-storage`: se levanta la exclusión de "descarga/previsualización fuera de
  alcance" que dejó `integracion-documentos-autorizaciones` (checkpoint G3 contestado).

## Approach

**Principio rector: pedido vs. concedido.** Todo campo nuevo que Andrea *pide* vive en
`facturacion.presupuesto`; su contraparte de *lo que la obra social concedió* vive en
`facturacion.autorizacion`. Es exactamente la forma que el modelo ya tiene para el dinero
(`monto` → `montoAutorizado`, con el trigger RN-PA-01 validando `≤`). Este change extiende esa forma
a **período** y a **dependencia**, sin inventar una estructura nueva.

1. **SQL (2 migraciones aditivas, cero tablas nuevas)** — columnas nullable en `facturacion.presupuesto`
   y `facturacion.autorizacion`. Como no hay tabla nueva, **la RLS existente del módulo `presupuestos`
   ya las cubre** (`20260730140000_split_modulos_permisos.sql`); no hacen falta policies nuevas.
2. **RPC** — `crear_presupuesto_completo` y `crear_presupuestos_lote` (`20260816110000_presupuesto_lineas.sql`)
   enumeran las columnas **una por una**, así que hay que `CREATE OR REPLACE` ambas para que los
   campos nuevos viajen en el `jsonb`. Se mantiene `SECURITY INVOKER` (D2 de `presupuesto-prestaciones`).
3. **Edge Functions** `presupuestos` y `autorizaciones` — campos nuevos en row/`toApi`/`toDb`.
4. **Frontend** — tipos → mapping puro → repositories → `calculoViajes.ts` (función pura, TDD) →
   `PresupuestoForm`/`PresupuestoDetail`/`PresupuestosList` → `AutorizacionForm` + vista previa.
5. **Vista previa** — se **extrae** `ContenidoPreview` (hoy privado en `DocumentChecklist.tsx`) a un
   `shared/components/VistaPreviaArchivo.tsx` reutilizable, para no reimplementar las lecciones ya
   pagadas ahí (pdf.js sobre `<canvas>` porque el visor nativo no corre en iframe sandboxeado).

## Affected Areas

| Área | Impacto | Descripción |
|------|---------|-------------|
| `supabase/migrations/<ts>_presupuesto_vigencia_dependencia_traslado.sql` | New | Columnas nuevas en `facturacion.presupuesto` |
| `supabase/migrations/<ts>_autorizacion_vigencia_dependencia_mime.sql` | New | `vigencia_hasta`, `con_dependencia`, `archivo_tipo_mime` |
| `supabase/migrations/<ts>_presupuesto_rpc_campos_nuevos.sql` | New | `CREATE OR REPLACE` de las 2 RPC de alta |
| `supabase/functions/presupuestos/index.ts` | Modified | Campos nuevos en row/API/DB |
| `supabase/functions/autorizaciones/index.ts` | Modified | Campos nuevos en row/API/DB |
| `frontend/src/shared/types/presupuesto.ts` | Modified | `Presupuesto`, `Autorizacion`, `ArchivoAdjunto.tipoMime?`, `DatosTraslado` |
| `frontend/src/shared/lib/presupuestos/presupuestoMapping.ts` | Modified | Campos nuevos, semántica parcial de `toActualizar…` intacta |
| `frontend/src/shared/lib/presupuestos/autorizacionMapping.ts` | Modified | Ídem + `tipoMime` |
| `frontend/src/shared/lib/presupuestos/calculoViajes.ts` | **New** | Función pura: viajes/km mensuales (punto 5) |
| `frontend/src/shared/lib/presupuestos/{Autorizacion,SupabaseAutorizacion}Repository.ts` | Modified | `getUrlArchivo(id, modo)` |
| `frontend/src/shared/components/VistaPreviaArchivo.tsx` | **New** | Extracción de `ContenidoPreview` |
| `frontend/src/shared/components/DocumentChecklist.tsx` | Modified | Pasa a consumir el componente extraído |
| `frontend/src/features/presupuestos/PresupuestoForm.tsx` | Modified | ⚠️ **Colisión alta** con `presupuesto-prestaciones` D9 |
| `frontend/src/features/presupuestos/PresupuestosList.tsx` | Modified | Identificación (punto 2) |
| `frontend/src/features/presupuestos/{PresupuestoDetail,AutorizacionForm}.tsx` | Modified | Campos nuevos + vista previa |
| `knowledge-base/04_modelo_de_datos.md`, `CHANGES.md`, `10_preguntas_abiertas.md` | Modified | 5 discrepancias nuevas + respuestas de Andrea |

## Risks

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| **Colisión con `presupuesto-prestaciones` (48/58) en `PresupuestoForm.tsx`** — su D9 bifurca ese archivo en 3 ramas de render | **Alta** | **Task bloqueante §0.4**: no arrancar la Fase 4 (UI) hasta que `presupuesto-prestaciones` esté aplicado. Las Fases 1-3 (SQL/EF/mapping) no lo tocan y pueden ir en paralelo |
| **Los deltas de spec de `integracion-documentos-autorizaciones` todavía no están sincronizados** a `openspec/specs/` (19/20 tasks, sin archivar) | **Alta** | Este change **modifica** `autorizacion-archivo-storage`, que solo existe como delta en esa carpeta. Archivar ese change **primero** (`/opsx:archive`) o el sync de specs va a chocar |
| **El schema real va por delante del repo** — pasó 4 changes seguidos | **Alta** | **Task bloqueante §0.3**: `supabase db query --linked` de solo lectura antes de escribir una línea de `.sql` |
| **No sabemos qué le hace CD/SD al valor del km** | **Alta** | Se modela el booleano y **nada más**. El valor del km sigue siendo carga manual (como ya dice la KB). Pregunta explícita a Andrea, **no se adivina** — dominio de facturación de salud |
| **`dias_semana` como `TEXT[]` sin CHECK** en la base | Media | Mismo criterio ya documentado en `recorridoHabitual.ts`: *"la cerradura la impone este tipo, no la base"*. Unión cerrada `DiaSemana` en TS + validación en el mapping |
| **Persistir `viajesMensuales` crearía dos fuentes de verdad** con `diasMensuales` | Media | **No se persiste.** Se deriva con `calcularViajesMensuales()`. Mismo criterio que `presupuesto-prestaciones` D6 ("la suma de líneas es regla de formulario, no de base") |
| **`archivo_tipo_mime` es NULL en autorizaciones ya subidas** (bucket vivo desde 2026-08-18) | Media | Fallback por extensión **solo** para filas viejas, con comentario explícito. Las nuevas lo toman de `File.type` |
| **La vista previa expone documentación de obra social** | Baja | URL firmada de expiración corta sobre bucket privado, misma constante y mismo patrón que `resolverPrevisualizacionDocumento`. RLS del módulo `presupuestos` sin cambios |
| **Presupuestos viejos quedan sin vigencia** | Alta (esperado) | `NULL` es semánticamente correcto (se emitieron bajo el modelo anterior). Se dice en la cabecera del `.sql` y en la KB; la UI muestra "Sin vigencia cargada", nunca un rango inventado |

## Rollback Plan

Tres capas independientes, en este orden:

1. **Frontend** — revertir los commits de la Fase 4. Los formularios vuelven a los campos actuales,
   el listado a las 3 celdas de hoy, `AutorizacionForm` pierde la vista previa. Cero pérdida de datos.
   `VistaPreviaArchivo.tsx` puede quedarse (extracción neutral) o revertirse con `DocumentChecklist`.
2. **Edge Functions** — redeploy de la versión anterior de `presupuestos`/`autorizaciones`: los campos
   nuevos dejan de viajar, las columnas quedan con datos y el mapeo viejo ignora claves desconocidas.
3. **Base** — `CREATE OR REPLACE` de las 2 RPC a su versión anterior (**primero**), luego
   `DROP COLUMN` de las columnas nuevas.
   ⚠️ **Punto de no retorno**: una vez que haya presupuestos reales con vigencia y datos de traslado
   cargados, el `DROP COLUMN` **pierde información de negocio real**. El rollback barato es el de las
   capas 1-2. Igual que en `presupuesto-prestaciones`, esto justifica los PRs encadenados.

## Dependencies

**Bloqueantes de orden (no de contenido):**

- `integracion-documentos-autorizaciones` (19/20, verificado completo hoy) — **archivar primero**.
  Este change se apoya en su bucket, sus columnas `archivo_*` y su `uploadArchivo`, y **modifica** su
  capability `autorizacion-archivo-storage`. Levanta su checkpoint G3.
- `presupuesto-prestaciones` (48/58) — sus 3 migraciones **ya están aplicadas**
  (`20260812120000`/`20260812130000`/`20260812140000`); lo que falta es UI. El punto 2 de este change
  **depende de que `prestacionId`/`lineas` lleguen a la pantalla**, y la Fase 4 colisiona con su D9.

**Bloqueante externo:** ninguno para los puntos 1-6. El punto 7 (fuera de alcance) espera a Enzo.

## ⚠️ Governance — ALTO

Presupuestos/Autorizaciones es dominio ALTO (`CHANGES.md` §C-06): datos de salud + facturación a obra
social. **Ninguna línea de `.sql` se escribe antes de aprobación explícita.** Gate replicado como
checkboxes bloqueantes en `tasks.md` §0.

| # | Decisión | Recomendación |
|---|----------|---------------|
| **G1** | Vigencia en `presupuesto`, **no** en `presupuesto_linea` (design D1) | **Sí** — el corte lo causa el CUD/RNP, que son del paciente/prestador, no de una línea |
| **G2** | Datos de traslado **no** reusan `RecorridoHabitual` (design D2) | **Sí** — ciclo de vida distinto: el presupuesto es una declaración congelada, no el estado actual del paciente |
| **G3** | Columnas nuevas sin RLS propia (no hay tabla nueva) | **Sí** — la RLS de `presupuestos` ya cubre ambas tablas. Verificar en vivo igual |
| **G4** | Qué le hace CD/SD al valor del km | **Decide Andrea.** Hoy: se guarda el booleano, el km sigue manual |

## Success Criteria

- [x] Schema real verificado en vivo antes de escribir `.sql` (§0.3). **Verificado 2026-08-21** por el
      orquestador (no por un sub-agente): `supabase db query --linked` contra `pkryfoljypuzfifofdwp`
      confirmó, antes de escribir las Fases 1-3, que ninguna de las 15 columnas nuevas existía aún; y
      después de que la usuaria corrió `supabase db push`, una segunda consulta confirmó las 13
      columnas de `facturacion.presupuesto`, las 3 de `facturacion.autorizacion`, y
      `security_type = 'INVOKER'` en ambas RPCs vía `information_schema.routines`. `tasks.md` §0.3 y
      §3.5 actualizados con esta evidencia.
- [ ] Un presupuesto emitido el 30/12 con vigencia 2026-02-01 → 2027-01-31 sobrevive recarga y
      reapertura, y `fechaEmision` **no** cambia. **Parcialmente verificado**: el schema ya está
      aplicado en vivo (criterio anterior) y el round-trip de mapping (`presupuestoMapping.test.ts`) y
      la separación visual de campos (`PresupuestoForm.tsx:591`, tarea 8.2) están verificados por
      test. Lo que falta es exclusivamente la prueba manual en la app real (10.4) — no marcado hasta
      que la usuaria la haga.
- [x] La autorización puede recortar la vigencia (`vigenciaHasta` < la del presupuesto) y **no** puede
      guardarse con `vigenciaDesde > vigenciaHasta`. Verificado por test:
      `validarAutorizacion.test.ts` (describe `validarVigenciaAutorizacion`, tarea 8.6) y
      `AutorizacionForm.test.tsx` (describe "vigenciaHasta y CD/SD desmarcable", tarea 8.8): vigencia
      dentro del período guarda, vigencia que excede bloquea con mensaje que no reusa el de RN-PA-01.
- [x] Dos presupuestos del mismo paciente con prestaciones distintas se distinguen **en el listado**,
      sin abrir el detalle. Verificado: `PresupuestosList.test.tsx` (describe "prestación y vigencia",
      tarea 8.1, 21/21) — chip de prestación (o "Sin prestación asociada") + rango de vigencia en cada
      tarjeta, buscador filtra también por prestación.
- [x] `conDependencia` marcado en el presupuesto puede quedar **desmarcado** en la autorización, y ese
      estado persiste. Verificado: `AutorizacionForm.tsx:391-406` (checkbox nunca `disabled` en función
      del CD del presupuesto, comentario explícito) + test "arranca marcado CON sugerencia pero sigue
      desmarcable — clic + submit confirma `conDependencia: false`" (tarea 8.8, `AutorizacionForm.test.tsx`).
- [x] `calcularViajesMensuales(23, { tieneVuelta: true }) === 46` y `(23, { tieneVuelta: false }) === 23`,
      con tests que cubren 0 días, días negativos y el caso 24 (el valor viejo, como test de regresión
      del bug del doc de referencia). Verificado: `calculoViajes.test.ts` (Fase 4, TDD estricto
      RED→GREEN→TRIANGULATE→REFACTOR completo), incluye el test nombrado literalmente "23 días NO son
      24 viajes (bug del doc de referencia)" (tarea 4.4).
- [x] `viajesMensuales` **no** existe como columna en la base (se deriva). Re-verificado en esta Fase 10:
      `grep -rn "viajes_mensuales" supabase/migrations/` → 2 matches, ambos dentro de comentarios SQL
      explicando por qué NO existe la columna (D4), cero apariciones en un `ADD COLUMN`/`CREATE TABLE`
      real.
- [ ] El PDF de una autorización se ve dentro de la app **y** se abre en pestaña nueva **sin
      descargarse** (URL firmada sin `Content-Disposition: attachment`). **No marcado**: el código está
      cubierto por test (`SupabaseAutorizacionRepository.test.ts` confirma que el modo `'inline'` omite
      la opción `download` al llamar `createSignedUrl`; `VistaPreviaArchivo.test.tsx` cubre los 5
      desenlaces; `AutorizacionForm.test.tsx` confirma el `<a target="_blank">`), pero el comportamiento
      real del navegador contra una URL firmada real de Supabase Storage es exactamente lo que cubre la
      verificación manual de 10.4 — no se marca sin esa confirmación.
- [ ] Una cuenta con `presupuestos: read` **ve** la vista previa; una sin el módulo **no**. **No
      marcado**: depende enteramente de 10.4 (2 cuentas reales), tarea humana no ejecutada por el
      agente.
- [x] Las 5 discrepancias nuevas figuran en `knowledge-base/04_modelo_de_datos.md` §Discrepancias,
      en `CHANGES.md` con ⚠️, y con `AvisoModeloDatos` visible en las 3 pantallas afectadas. Verificado:
      Fase 9 completa (`04_modelo_de_datos.md:347-370`, `CHANGES.md:940-967`,
      `PresupuestoResumen.tsx:132-140,169-173`, `PresupuestoForm.tsx:592-596,624-628`,
      `AutorizacionForm.tsx:290-298`), con tests RTL confirmando los carteles renderizados.
- [x] `cd frontend && npx tsc -b --noEmit` y `npx vitest run` en verde. Cero `any`. Verificado en esta
      Fase 10: `tsc -b --noEmit` limpio (exit 0, cero errores). `vitest run`: 254/280 archivos y
      2969/3160 tests en verde; los 26 archivos restantes fallan por un bug de entorno documentado y
      preexistente (`localStorage.clear()` undefined bajo Node 26 en esta máquina, confirmado no
      relacionado con este change — 0 regresiones nuevas, ver `tasks.md` 10.2/10.3). Cero `any`: grep
      de control sin matches nuevos (ver `tasks.md` 10.3).
