## Context

Estado verificado en el código de la rama `feature/integracion-facturacion` (leído, no asumido):

- `FacturaForm.tsx` L226-263: el Paso 2 (`pasoObraSocialContent`) muestra la obra social de solo
  lectura y, cuando `obraSocial.modalidadFacturacion === 'por-prestacion'`, dos `Input` de texto
  libre (`prestadorNombre` / `prestadorDomicilio`). `faltaCompletarPrestador` (L182-184) gatea el
  botón "Siguiente" del Paso 2→3 **y** la vista previa de la descripción (L186-189).
- `useEmisionFactura.ts` L49-62: `resolverCupoAutorizado(pacienteId)` hace `presupuestoRepository
  .list()` + filtro por `pacienteId` + N × `autorizacionRepository.getByPresupuestoId()` y
  **devuelve la primera autorización con cupo cargado**. Es la heurística que este change elimina.
- `facturas.autorizacion_id` **no existe**: no está en el `select` de `SupabaseFacturaRepository.ts`
  (L19), ni en `CrearFacturaPayload` (`facturaMapping.ts` L247-272), ni en las dos RPC de
  `supabase/migrations/20260812160000_factura_rpc.sql` (ya aplicadas, `SECURITY INVOKER`, códigos
  de error `452xx`).
- `prestadorNombre`/`prestadorDomicilio` aparecen en **solo 5 archivos**: `shared/types/factura.ts`
  (L98-99), `FacturaForm.tsx`, `ResumenPasoWizard.tsx`, `mocks/facturasFixture.ts` y
  `FacturaForm.test.tsx`. **NO** están en `facturaMapping.ts` ni en `validateFacturaForm.ts`
  (el proposal §Impact los lista de más — corregido acá).

**⚠️ Hallazgo que corrige al proposal y al plan aprobado.** El proposal y el plan citan
`Presupuesto.prestacionId` y `openspec/changes/presupuesto-prestaciones/design.md` L434 como fuente
de "varias autorizaciones simultáneas, una por prestación". **Ninguna de las dos existe**:
`prestacionId` no aparece en ningún archivo de `frontend/src` (grep sin resultados) y el change
`presupuesto-prestaciones` no existe ni en `openspec/changes/` ni en `openspec/changes/archive/`.
La cita es infundada y no se la trata como confirmada. Lo que **sí** es estructuralmente cierto y
verificable: `Presupuesto` es N por paciente y cada uno tiene 0..1 `Autorizacion`
(`AutorizacionRepository.getByPresupuestoId`), así que **un paciente puede tener varias
autorizaciones vigentes al mismo tiempo, sin importar la modalidad**. Ese es el hecho que sostiene
D4; la etiqueta del selector se resuelve con campos reales (ver D4).

---

## ⚠️ Governance: CRÍTICO — Aprobaciones requeridas antes del apply

Facturación es dominio **CRÍTICO** (`CHANGES.md` §C-07), mismo régimen que `integracion-facturacion`:
**análisis solamente; ni una línea de SQL ni de código de aplicación sin aprobación humana
explícita**. Este `design.md` es análisis. **No autoriza el apply.**

| # | Decisión | Por qué necesita aprobación |
|---|---|---|
| **D1** | `ALTER TABLE facturacion.facturas ADD COLUMN autorizacion_id` + `CREATE INDEX` sin `CONCURRENTLY` | Modificación de schema sobre el registro financiero, y apartamiento de una regla dura de `database-schema-design`. Coordinar con Enzo/backend: si ya hay una columna equivalente planeada con otro nombre, se duplica para siempre (aprendizaje de D12-revertida de `integracion-obra-social`) |
| **D2** | `CREATE OR REPLACE FUNCTION` sobre las **dos RPC vivas** de facturación | Reemplaza código de servidor que **hoy está en producción y funciona**. Una versión mal aplicada rompe el alta y la edición de facturas |

Las migraciones **las aplica la usuaria / Enzo, nunca el agente**.

---

## Goals / Non-Goals

**Goals**
- Que la factura registre **qué autorización la habilitó** (`facturas.autorizacion_id`, N:1).
- Que el Paso 2 del wizard sea una **elección explícita** entre las autorizaciones pendientes del
  paciente, en vez de dos strings libres sin entidad detrás.
- Que la alerta de cupo (`AlertaCupo`, RN-FA-02) se calcule contra la autorización **elegida**, no
  contra la primera que aparezca.
- Reusar los repositories tal cual están: cero métodos nuevos, cero endpoints, cero RPC de lectura.

**Non-Goals**
- No se reintroduce ninguna entidad `Prestador` (`sacar-prestadores` sigue vigente).
- No se filtra por "período ya facturado" ni se impide facturar dos veces el mismo mes (D3).
- No se agrega `UNIQUE` ni `NOT NULL` sobre `autorizacion_id`; no se migran facturas existentes.
- No se tocan Presupuestos/Autorizaciones, documentos, cobros, ARCA ni el circuito de estados.
- No se cierra ninguna pregunta abierta de prioridad Alta.

---

## Decisions

### D1 — `facturas.autorizacion_id`: columna nullable, sin `UNIQUE`, con índice ⚠️ REQUIERE APROBACIÓN

```sql
ALTER TABLE facturacion.facturas
  ADD COLUMN autorizacion_id UUID REFERENCES facturacion.autorizacion(id);
CREATE INDEX IF NOT EXISTS idx_facturas_autorizacion_id
  ON facturacion.facturas (autorizacion_id);
```

| Atributo | Elección | Por qué |
|---|---|---|
| Nullable | **Sí** | Las facturas anteriores a este change no tienen autorización asociada, y eso **es** su significado, no un dato faltante. `NOT NULL` exigiría backfill inventado sobre datos financieros |
| `UNIQUE` | **No** | La relación es **N:1**: `cupoMensualDias`/`cupoMensualKm` son un cupo **mensual recurrente** y `cupoConsumido` ya suma facturas por período. Una autorización genera una factura por mes. Un `UNIQUE` haría imposible facturar el segundo mes |
| `ON DELETE` | **Default (`NO ACTION`)** | Borrar una autorización que ya generó facturas debe fallar, no dejar facturas huérfanas ni cascadear sobre un documento fiscal |
| Índice | **Simple, sin `CONCURRENTLY`** | Misma justificación que D10 de `integracion-facturacion`: `CREATE INDEX CONCURRENTLY` no corre dentro de un bloque de transacción y las migraciones de Supabase van envueltas en una |

**⚠️ Condición de caducidad del índice — no asumir 0 filas.** D10 de `integracion-facturacion` se
apoyaba en un `count(*) = 0` verificado el 2026-07-31. Ese change **ya se aplicó**, así que
`facturacion.facturas` puede tener filas de prueba hoy. **Verificar `count(*)` inmediatamente antes
del `db push` es una tarea explícita y bloqueante**, no un supuesto: si la tabla tiene volumen real,
el índice se rehace con `CONCURRENTLY` fuera de transacción.

*Alternativa descartada:* derivar el vínculo factura↔autorización por paciente + período en cada
lectura. Es exactamente la heurística que este change viene a eliminar (D6), y además no sobrevive
a un cambio posterior de la autorización.

**Rollback**: `DROP INDEX` + `ALTER TABLE … DROP COLUMN autorizacion_id`. Ningún dato existente se
transforma ni se borra.

### D2 — `CREATE OR REPLACE` de las dos RPC vivas ⚠️ REQUIERE APROBACIÓN

Nueva migración `2026XXXXXXXXXX_factura_rpc_autorizacion.sql` que reemplaza
`facturacion.crear_factura_completa(jsonb)` y `facturacion.actualizar_factura_completa(uuid, jsonb)`
para leer/escribir `autorizacion_id` desde el `jsonb`:

- en `crear_…`: una columna más en el `INSERT`, `(p_factura ->> 'autorizacion_id')::uuid`;
- en `actualizar_…`: una línea más en el `UPDATE`, con el **mismo patrón `p_cambios ? 'clave'`** que
  el resto — clave ausente = no tocar. Confundirlo con `->>` borraría el vínculo en cada cambio de
  estado, que es la operación más frecuente del circuito.

**La firma no cambia** (mismos nombres, mismos tipos de parámetro), así que `CREATE OR REPLACE`
basta y no hace falta `DROP` previo ni re-`GRANT`. Se conservan **byte por byte**: `SECURITY
INVOKER` explícito, `SET search_path = ''`, los códigos `45201`-`45204`, la semántica de reemplazo
completo de asistencias y la cabecera de advertencia. El `.sql` nuevo repite el bloque ⚠️⚠️ `NUNCA
SECURITY DEFINER` y queda cubierto por el test de texto de fuente ya existente (`node:fs`).

*Alternativa descartada:* escribir `autorizacion_id` con un `UPDATE` aparte de supabase-js después
de la RPC. Rompe la atomicidad que las RPC existen para garantizar: una factura podría quedar creada
sin su vínculo.

*Riesgo asumido:* `autorizacion_id` es **opcional** en el `jsonb`, así que un cliente viejo contra
la RPC nueva sigue funcionando; un cliente nuevo contra la RPC vieja escribe la factura **ignorando
en silencio** el vínculo (no da error). Por eso la migración es **bloqueante y previa** al commit
del frontend en el orden de aplicación.

### D3 — "Autorizaciones pendientes de facturar" se deriva client-side ✅ DECIDIDO

Nueva función en `frontend/src/shared/lib/facturacion/autorizacionesPendientes.ts`:

```
autorizacionesPendientes(pacienteId, presupuestoRepository, autorizacionRepository)
  1. presupuestoRepository.list()  →  filtrar por p.pacienteId === pacienteId
  2. por cada presupuesto: autorizacionRepository.getByPresupuestoId(p.id)
  3. quedarse con  autorizacion !== null && autorizacion.estado === 'autorizada'
  4. devolver [{ autorizacion, presupuesto }]  — el presupuesto viaja para poder etiquetar (D4)
```

*Por qué así:* es **el mismo patrón O(N) que `resolverCupoAutorizado` ya paga hoy**
(`useEmisionFactura.ts` L52-58) — no agrega costo nuevo, reordena el que ya existe. `Autorizacion`
no tiene `pacienteId` (solo `presupuestoId`), y ningún repository expone `listByPacienteId`; crear
uno obligaría a tocar dos interfaces, dos mocks y dos implementaciones Supabase para un dato que ya
es alcanzable.

**"Pendiente" = `estado === 'autorizada'`, sin filtrar por mes ya facturado.** El picker no lleva
ninguna lógica de período. **Asunción de negocio explícita, confirmada con la usuaria: se confía en
que no elige la misma autorización dos veces para el mismo período.** Se documenta como **riesgo
aceptado, no como garantía del sistema** — el sistema no lo impide ni lo detecta.

*Alternativas descartadas:* (a) RPC/vista `autorizaciones_pendientes_por_paciente` — más SQL sobre
un dominio CRÍTICO por cero necesidad funcional; (b) `AutorizacionRepository.listByPacienteId()` —
métodos nuevos en dos interfaces y sus tres implementaciones para ahorrar un filtro client-side.

### D4 — El Paso 2 del wizard pasa de "Obra social / Prestador" a "Autorización" ✅ DECIDIDO

- El paso conserva la obra social de **solo lectura** (derivada del paciente del Paso 1) y reemplaza
  los dos `Input` por un **selector** (`Select` del design system) de autorizaciones pendientes.
- **Etiqueta de cada opción.** El plan pedía distinguirlas por `Presupuesto.prestacionId` → nombre de
  la prestación. **Ese campo no existe** (ver §Context). La etiqueta se arma con datos **reales y
  presentes**: fecha de emisión del presupuesto + monto + cupos de la autorización
  (`cupoMensualDias`/`cupoMensualKm`) y `vigenciaDesde` cuando está. Es suficiente para distinguir N
  autorizaciones simultáneas del mismo paciente, y no inventa un campo. Queda como Open Question si
  la usuaria necesita ver el nombre de la prestación (requiere modelarlo antes, en Presupuestos).
- **Estado vacío** (0 autorizaciones pendientes): mensaje + link a Presupuestos y **"Siguiente"
  bloqueado**. `faltaCompletarPrestador` se elimina y su lugar en el gateo (L182-184, L395) lo toma
  `!values.autorizacionId`. La vista previa de la descripción (L186-189) deja de depender de esa
  bandera: sin prestador que completar, se comporta como en modalidad `general`.
- **Modo edición** (`esEdicion`): la autorización elegida se muestra de **solo lectura**, no se puede
  recambiar — mismo criterio "la edición no bifurca" ya usado en Presupuestos y en el propio wizard
  (que en edición se saltea por completo).
- `ResumenPasoWizard` cambia sus props `prestadorNombre`/`prestadorDomicilio` por la autorización
  elegida.

*Alternativa descartada:* dejar el selector como un campo opcional más del Paso 3. Perdería el orden
del flujo real (paciente → autorización → datos) y dejaría el Paso 2 sin contenido propio.

### D5 — `prestadorNombre`/`prestadorDomicilio` se eliminan por completo ✅ DECIDIDO

Se retiran de `Factura` (`shared/types/factura.ts` L91-99), `FacturaFormValues` (derivado de
`Factura`, sale solo), `FacturaForm.tsx`, `ResumenPasoWizard.tsx`, `facturasFixture.ts` y
`FacturaForm.test.tsx`.

**No requieren migración de baja**: no tienen columna real en producción, no están en
`facturaMapping.ts` ni en `SupabaseFacturaRepository.ts` ni en las RPC. Cambio de frontend puro.
Corrección al proposal §Impact: `validateFacturaForm` y `facturaMapping.ts` **no** los contienen, así
que no se tocan por D5 (`facturaMapping.ts` sí se toca, pero por D1/D2).

*Riesgo asumido:* cualquier factura que hoy tenga esos valores en el `localStorage` del mock los
pierde. Son fixtures de desarrollo, no datos reales.

### D6 — `resolverCupoAutorizado` deja de adivinar ✅ DECIDIDO

`useEmisionFactura.ts` pasa de resolver por heurística ("la primera autorización con cupo cargado")
a recibir la **autorización elegida** y derivar el `CupoAutorizado` de ESA:

```
antes:  resolverCupoAutorizado(pacienteId)  → list() + N getByPresupuestoId() → primera con cupo
ahora:  resolverCupoAutorizado(pacienteId, autorizacionId)
          → autorizacionRepository.getById(autorizacionId) → derivarCupoAutorizado(auth, pacienteId)
          → sin autorizacionId (facturas viejas, `autorizacion_id NULL`) → undefined
```

`derivarCupoAutorizado` **se reusa sin cambios**. La firma sigue aceptando facturas sin autorización
(devuelve `undefined`, que es exactamente lo que `validarCupoFacturacion` ya tolera hoy: sin cupo, no
alerta). `FacturaForm.tsx` L152-160 pasa a depender también de `values.autorizacionId`.

*Por qué importa:* con varias autorizaciones simultáneas por paciente, la heurística actual puede
alertar (o callarse) contra la autorización equivocada sobre una factura real. La alerta sigue siendo
**no bloqueante por diseño** (`factura-cupo-validacion`), así que el operador sigue siendo la última
barrera — pero deja de recibir un dato de la autorización que no eligió.

---

## Data Flow

```
Paso 1 · Paciente ──> values.pacienteId
      │
      ▼
Paso 2 · Autorización
   autorizacionesPendientes(pacienteId, presupuestoRepo, autorizacionRepo)     [D3]
      ├─ presupuestoRepo.list()  ──filtro pacienteId──> N presupuestos
      ├─ N × autorizacionRepo.getByPresupuestoId(p.id)
      └─ filtro estado === 'autorizada'
            ├── 0 resultados ──> estado vacío + link a Presupuestos + "Siguiente" bloqueado  [D4]
            └── N resultados ──> Select ──> values.autorizacionId
      │
      ▼
Paso 3 · Datos ──> AlertaCupo ← derivarCupoAutorizado(autorización ELEGIDA)     [D6]
      │
      ▼
Guardar ──> toCrearFacturaPayload ──> rpc crear_factura_completa(jsonb)         [D2]
                                        └──> facturas.autorizacion_id           [D1]
```

## File Changes

| Archivo | Acción | Qué cambia |
|---|---|---|
| `supabase/migrations/2026XXXXXXXXXX_factura_autorizacion_id.sql` | Crear | 1 columna + 1 índice (D1). **La aplica la usuaria/Enzo** |
| `supabase/migrations/2026XXXXXXXXXX_factura_rpc_autorizacion.sql` | Crear | `CREATE OR REPLACE` × 2 (D2). **La aplica la usuaria/Enzo** |
| `frontend/src/shared/lib/facturacion/autorizacionesPendientes.ts` (+ `.test.ts`) | Crear | Derivación client-side (D3) |
| `frontend/src/shared/types/factura.ts` | Modificar | `+autorizacionId?: string`, `−prestadorNombre`, `−prestadorDomicilio` |
| `frontend/src/shared/lib/facturacion/facturaMapping.ts` (+ test) | Modificar | `autorizacion_id ↔ autorizacionId` en `parseFacturaRow`, `CrearFacturaPayload`, `toCrearFacturaPayload`, `toActualizarFacturaPayload` |
| `frontend/src/shared/lib/facturacion/SupabaseFacturaRepository.ts` (+ test) | Modificar | `autorizacion_id` en la lista de columnas del `select` (L19) |
| `frontend/src/features/facturacion/FacturaForm.tsx` (+ test) | Modificar | Paso 2 completo, `PASOS_WIZARD`, gateo `faltaCompletarPrestador` → `!values.autorizacionId` |
| `frontend/src/features/facturacion/ResumenPasoWizard.tsx` (+ test) | Modificar | Props de prestador → autorización elegida |
| `frontend/src/features/facturacion/useEmisionFactura.ts` (+ test) | Modificar | `resolverCupoAutorizado` deja de adivinar (D6) |
| `frontend/src/shared/lib/mocks/facturasFixture.ts` | Modificar | Sacar los dos campos de prestador |
| `knowledge-base/04_modelo_de_datos.md`, `CHANGES.md` §C-07 | Modificar | Discrepancia N7 (abajo) |

`validateFacturaForm.ts`: **sin cambios por D5**. Si la autorización pasa a ser obligatoria a nivel
formulario (no solo a nivel wizard), se agrega ahí — decisión que se resuelve en `sdd-tasks`.

## Testing Strategy

| Capa | Qué se prueba | Cómo |
|---|---|---|
| Unit (puro) | `autorizacionesPendientes`: filtro por paciente, filtro `estado === 'autorizada'`, `getByPresupuestoId` → `null`, 0 resultados, N resultados simultáneos | Repositories fake tipados, sin red, sin `any` |
| Unit (mapeo) | `autorizacion_id` ↔ `autorizacionId` en las 4 funciones; `NULL` → campo ausente; clave ausente vs. presente en `toActualizarFacturaPayload` | `facturaMapping.test.ts`, funciones puras |
| Componente | Paso 2: render del selector, estado vacío bloqueante con link, "Siguiente" gateado por `autorizacionId`, solo lectura en edición | Testing Library sobre `FacturaForm` |
| Hook | `resolverCupoAutorizado` deriva de la autorización elegida; sin `autorizacionId` → `undefined` | Test de `useEmisionFactura` |
| SQL | Texto del `.sql`: `SECURITY INVOKER` presente, `SECURITY DEFINER` ausente fuera de comentarios | `node:fs` (el patrón ya resuelto — `?raw` de Vite no sirve fuera de `frontend/`) |
| Manual | Alta `por-prestacion` con **varias autorizaciones simultáneas**; edición de solo el estado → el vínculo y las asistencias sobreviven; factura vieja con `autorizacion_id NULL` se abre sin romper | 3 cuentas reales de `VITE_TEST_ACCOUNTS`, a cargo de la usuaria |

Régimen: Strict TDD (RED→GREEN→TRIANGULATE→REFACTOR) por archivo, `npx tsc -b --noEmit` + `oxlint`
limpios en cada fase, suite completa una sola vez al final contra el baseline de
`integracion-facturacion/tasks.md` (0.8), con `NODE_OPTIONS="--no-experimental-webstorage"`.

## Threat Matrix

N/A — no hay routing, shell, subprocesos, automatización de VCS/PR, clasificación de archivos
ejecutables ni integración de procesos. La superficie de seguridad de este change es RLS + `SECURITY
INVOKER`, cubierta por D2.

## Migration / Rollout

1. **⚠️ Portón de governance**: aprobación explícita de **D1 y D2**. Sin respuesta, no se escribe SQL.
2. Coordinar **D1 con Enzo/backend**: confirmar que `autorizacion_id` no está ya planeada con otro
   nombre.
3. **Verificar `count(*)` de `facturacion.facturas`** inmediatamente antes del `db push` — es la
   condición que sostiene el índice sin `CONCURRENTLY` (D1), y **ya no se puede asumir 0**.
4. Fase aditiva de frontend (tipos + mapeo + repository): nadie la consume todavía, no rompe nada.
5. **Aplicar las dos migraciones** (usuaria/Enzo). **Bloquea el paso 6.**
6. Swap del Paso 2 del wizard + `useEmisionFactura` — **el corte real**, un commit.
7. Documentación (KB §Discrepancias, `CHANGES.md` §C-07, `AvisoModeloDatos`) y verificación manual.

**Rollback**: revertir el commit del paso 6 (el Paso 2 vuelve a los dos `Input`) y re-aplicar la
versión anterior de las dos RPC desde `20260812160000_factura_rpc.sql`. La columna queda nullable y
sin lectores: es inerte. **Ningún dato existente se transforma ni se borra en ningún paso.**

---

## Inventario de discrepancias

| # | Frontend / KB | Base real (docx) | Resolución |
|---|---|---|---|
| **N7** (nueva) | `Factura.autorizacionId` — vínculo factura↔autorización | El docx **no prevé** ninguna referencia de la Factura a la Autorización | **Se agrega igual** (D1), documentada por triplicado: `knowledge-base/04_modelo_de_datos.md` §Discrepancias + `CHANGES.md` §C-07 + `AvisoModeloDatos` en el Paso 2 del wizard. **No se resuelve unilateralmente**: queda marcada para confirmar con el cliente / quien mantiene el docx |
| **N8** (nueva, de proceso) | El proposal y el plan aprobado citan `Presupuesto.prestacionId` y `presupuesto-prestaciones/design.md` L434 | **Ninguno de los dos existe** en el repo | **No se resuelve acá**: la etiqueta del selector usa campos reales (D4). Se eleva a §Open Questions — si el negocio necesita "una autorización por prestación", hay que modelar la prestación en Presupuestos **antes** |
| N1-N6 de `integracion-facturacion` | — | — | **Sin cambios**. Este change no cierra ni reabre ninguna |

Se retiran del código: `prestadorNombre`/`prestadorDomicilio` (D5) — nunca fueron una discrepancia
con el docx, eran un remanente de `sacar-prestadores` sin columna real detrás.

## Open Questions

- [ ] **¿Hace falta un aviso visual cuando la autorización elegida ya tiene una factura del mismo
  mes?** Pregunta que quedó abierta del proposal. **Decisión tomada: NO se agrega en este change** —
  el alcance se mantiene acotado a lo ya aprobado, y agregarlo exigiría lógica de período en el
  picker que D3 excluye explícitamente. Se puede pedir aparte si hace falta. **Decisor**: usuaria.
- [ ] **¿La factura debe poder facturarse dos veces contra la misma autorización en el mismo
  período?** Hoy el sistema **no lo impide ni lo detecta** (D3, riesgo aceptado). Si el negocio dice
  que no, es un `UNIQUE (autorizacion_id, mes_facturado, anio_facturado)` parcial + una validación —
  otro change. **Decisor**: cliente / usuaria.
- [ ] **¿Existe el concepto de "prestación" a nivel Presupuesto?** (N8). Sin él, el selector no puede
  etiquetar por prestación y "una autorización por prestación" no es modelable. **Decisor**: cliente
  / quien mantiene el docx.
- [ ] **¿`facturas.autorizacion_id` debería ser `NOT NULL` a futuro?** Requeriría backfill de las
  facturas ya creadas. Hoy no hay fuente que lo pida. **Decisor**: backend.
- [ ] **¿Cuántas filas tiene hoy `facturacion.facturas`?** Determina si el índice de D1 puede ir sin
  `CONCURRENTLY`. **No se asume**: se verifica antes del `db push`. **Decisor**: verificación técnica.
- [ ] Las 4 preguntas de negocio de prioridad **Alta** siguen abiertas (identificador, formato del
  período, plazos de cobro, ARCA). Este change **no cierra ninguna**.
