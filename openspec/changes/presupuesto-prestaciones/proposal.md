## Why

`facturacion.presupuesto` (módulo **C-06**, archivado como `2026-08-01-C-06-presupuestos-autorizaciones`
y luego integrado contra backend real por `2026-08-06-integracion-presupuestos`) modela hoy un
**`monto` único** por paciente/obra social, sin ninguna relación con prestaciones. Verificado en el
repo: `frontend/src/shared/types/presupuesto.ts:35` documenta literalmente *"Importe único propuesto
(docx: `Monto`). NO es un desglose por prestación"*, y `PresupuestoForm.tsx:119-121` repite la misma
nota sobre el campo.

Nuevo requerimiento de negocio: cuando la obra social factura **por prestación**
(`ObraSocial.modalidadFacturacion === 'por-prestacion'` — el tipo existe en
`frontend/src/shared/types/obraSocial.ts:13,79` y la columna en `obra_social.obra_social.modalidad_facturacion`),
un presupuesto tiene que poder asociarse a **UNA** prestación puntual de un **catálogo nuevo en la
ficha del paciente**. Cuando la obra social factura **general**, se sigue generando **un único
presupuesto**, pero el usuario carga un monto por cada prestación en el propio formulario y esos
montos se **suman en el frontend** para completar el campo `monto` ya existente — **sin persistir el
desglose**.

### ⚠️ Corrección de alcance — la discrepancia #13 NO se reabre

`knowledge-base/04_modelo_de_datos.md` §Discrepancias, entrada **#13**, es una decisión cerrada:
*"**`Presupuesto` = monto único vs. la lectura anterior de la KB ("estimación anual por prestación") —
NO SE REABRE**: ya se resolvió a favor del docx en `presupuestos-ui` (2026-07-24); este change no
vuelve sobre esa decisión"*.

Este change **tampoco la reabre**, y eso fue confirmado explícitamente por la usuaria:

- `presupuesto.monto` **sigue siendo un importe único**, nunca un desglose persistido. No cambia de
  tipo, ni de semántica, ni de nullability.
- Lo único estructuralmente nuevo es **una columna opcional** que vincula un presupuesto a **UNA**
  prestación puntual (caso `por-prestacion`). Eso se documenta como **discrepancia NUEVA**, no como
  reapertura de la #13. La #13 solo se **referencia**, no se edita.

La relación **Autorización↔Presupuesto sigue siendo 1:1 sin ningún cambio**: cada presupuesto (sea el
de una prestación individual, o el general con el monto ya sumado) genera su propia autorización,
exactamente como funciona hoy.

---

## What Changes

### 1. Catálogo de prestaciones del paciente (nuevo)

- **Tabla `pacientes.prestaciones`**: `id UUID PK`, `paciente_id UUID NOT NULL REFERENCES
  pacientes.paciente(id) ON DELETE CASCADE`, `nombre TEXT NOT NULL`, `descripcion TEXT` (opcional).
  **Calcada del patrón exacto de `pacientes.direcciones`** (`20260724100004_schema_pacientes.sql:62-68`):
  misma forma de FK, RLS estándar del módulo `pacientes`
  (`Read/Write prestaciones … modulos.tiene_permiso('pacientes', 'read'|'write')`), `GRANT` a
  `authenticated`, trigger `auditoria.log_action()` en INSERT/UPDATE/DELETE, e índice sobre la FK.
- **`PrestacionesEditor.tsx`** nuevo en `frontend/src/features/pacientes/`, **copia estructural de
  `DireccionesEditor.tsx`**: alta / edición / baja in-place, con confirmación de borrado si la
  prestación tiene presupuestos asociados.
- Cableado como **sección nueva** en `PacienteDetail.tsx`.
- **`frontend/src/shared/types/prestacion.ts`** nuevo, y `Paciente.prestaciones: Prestacion[]` en
  `paciente.ts` (mismo lugar donde ya vive `direcciones: Direccion[]`, `paciente.ts:105`).

### 2. `facturacion.presupuesto.prestacion_id` (columna nueva)

- `UUID NULL REFERENCES pacientes.prestaciones(id)` — **nullable y aditiva**. Se puebla **solo** en
  modalidad `por-prestacion`; en modalidad `general` queda `NULL`.
- **`monto` no cambia** de tipo ni de semántica (ver §Why).

### 3. Migración de escritura: Edge Function → RPC `SECURITY INVOKER`

Hoy `supabase/functions/presupuestos/index.ts` hace **CRUD directo contra la tabla**
(`.schema('facturacion').from('presupuesto').insert(...)`, líneas 92-94) — patrón **distinto al
resto del repo**, que ya usa RPC atómicas para escrituras multi-fila.

Se agregan **dos funciones Postgres `SECURITY INVOKER`** (mismo molde que
`obra_social.crear_obra_social_completa` en `20260731120001_obra_social_rpc.sql` y que
`pacientes.crear_paciente_completo` en `20260730180000_crear_paciente_completo.sql`; **nunca
`SECURITY DEFINER`**):

| Función | Uso |
|---|---|
| `facturacion.crear_presupuesto_completo(jsonb) RETURNS uuid` | Alta simple — modalidad `general` |
| `facturacion.crear_presupuestos_lote(jsonb) RETURNS uuid[]` | Alta **atómica** de N presupuestos en una sola transacción, uno por prestación elegida en el multi-select — modalidad `por-prestacion` |

El Edge Function pasa a **invocar la RPC**; si conviene reemplazarlo por invocación directa desde el
repository se define en `design.md` (**D2**).

### 4. UI — `PresupuestoForm.tsx` bifurca por `ObraSocial.modalidadFacturacion`

| Modalidad | Comportamiento | Persistencia |
|---|---|---|
| `por-prestacion` | **Multi-select** de prestaciones del paciente elegido + **monto por cada una** | Alta en lote vía `crear_presupuestos_lote` — N presupuestos, cada uno con su `prestacion_id` y su `monto` |
| `general` | **`PresupuestoLineasEditor.tsx`** nuevo (mismo espíritu que `AsistenciasEditor.tsx` de Facturación): líneas de prestación + monto que **solo viven en el estado del formulario**, con total calculado en vivo | **Un** presupuesto vía `crear_presupuesto_completo`, con el total como `monto` único. **Las líneas no se persisten** |

---

## Capabilities

### New Capabilities

- **`prestaciones-paciente`**: catálogo de prestaciones embebido en la ficha del Paciente — alta,
  edición y baja in-place, gateo por el módulo `pacientes`, y borrado protegido cuando la prestación
  ya tiene presupuestos asociados.
- **`presupuesto-prestacion`**: relación opcional presupuesto↔prestación y **bifurcación del alta por
  `modalidadFacturacion`** de la obra social — lote atómico en `por-prestacion`, suma en frontend
  sobre `monto` único en `general`.

### Modified Capabilities

- **`presupuesto-contract`** (`openspec/specs/presupuesto-contract/spec.md` — nombre verificado, existe
  como spec principal y viene de `presupuestos-ui` + `integracion-presupuestos`): el contrato de
  `Presupuesto` gana un campo opcional `prestacionId`, y el payload de alta pasa a tener **dos formas
  legítimas** según la modalidad.
- **`presupuesto-crud`**: el alta deja de ser siempre 1-a-1 con el formulario — en `por-prestacion`
  un solo submit crea N presupuestos de forma atómica.
- **`paciente-ficha`**: la ficha del paciente suma una sección nueva (catálogo de prestaciones).

---

## Impact

**Código nuevo**
- `frontend/src/features/pacientes/PrestacionesEditor.tsx` + `.test.tsx`
- `frontend/src/features/presupuestos/PresupuestoLineasEditor.tsx` + `.test.tsx`
- `frontend/src/shared/types/prestacion.ts`
- `supabase/migrations/2026XXXXXXXXXX_schema_pacientes_prestaciones.sql` (tabla + RLS + GRANT +
  auditoría + índice)
- `supabase/migrations/2026XXXXXXXXXX_presupuesto_prestacion_id.sql` (columna + índice)
- `supabase/migrations/2026XXXXXXXXXX_presupuesto_rpc.sql` (las dos funciones `SECURITY INVOKER`)

**Código modificado**
- `frontend/src/features/presupuestos/PresupuestoForm.tsx` (**el corazón del change**: la bifurcación)
- `frontend/src/features/presupuestos/PresupuestoDetail.tsx` (mostrar la prestación asociada)
- `frontend/src/features/presupuestos/validatePresupuestoForm.ts` (+ su `.test.ts`)
- `frontend/src/shared/lib/presupuestos/presupuestoMapping.ts` (+ `.test.ts`) — **nombre verificado**,
  es el archivo real del mapeo fila↔dominio
- `frontend/src/shared/lib/presupuestos/SupabasePresupuestoRepository.ts` (+ `.test.ts`)
- `frontend/src/shared/types/paciente.ts`, `frontend/src/shared/types/presupuesto.ts`
- `frontend/src/features/pacientes/PacienteDetail.tsx` (+ `.test.tsx`)
- `supabase/functions/presupuestos/index.ts`

**Documentación**
- `knowledge-base/04_modelo_de_datos.md` §Discrepancias — **entrada NUEVA**; la **#13 NO se toca** más
  que para referenciarla.
- `CHANGES.md` §C-06 — nota de **reapertura post-archivo**.

**Sin impacto**
- `facturacion.autorizacion` y su relación 1:1 con `presupuesto` — **sin ningún cambio**.
- El trigger `facturacion.validar_autorizacion_monto` (RN-PA-01,
  `20260729130000_schema_autorizacion_monto_vigencia.sql`) — **no se toca**, porque `monto` no cambia
  de forma. Ver `design.md`.
- `cupoAutorizado.ts`, `validarAutorizacion.ts`, `AutorizacionForm.tsx`, `autorizacionMapping.ts`.

---

## ⚠️ Governance

Presupuestos es dominio **ALTO** (no CRÍTICO como Facturación), pero **toca schema financiero en
producción**: necesita **gate de aprobación explícito antes de escribir SQL** — más liviano que
`integracion-facturacion`, pero del mismo espíritu.

Decisiones a aprobar (desarrolladas en `design.md`, replicadas como **checkboxes bloqueantes** en
`tasks.md` §0):

| # | Decisión | Por qué necesita aprobación |
|---|---|---|
| **D1** | Agregar `facturacion.presupuesto.prestacion_id` (nullable, aditiva) + tabla `pacientes.prestaciones` | Modifica el schema de un dominio financiero vivo |
| **D2** | Migrar la escritura de Edge Function a RPC `SECURITY INVOKER` | Alcance extra **ya aceptado por la usuaria**; es código de servidor que escribe datos financieros |
| **D3** | Verificar el **volumen real** de `facturacion.presupuesto` en producción antes de aplicar | Solo lectura (`supabase db query --linked`); define si la migración es trivial o necesita ventana |

**Coordinación con backend (Enzo) antes de escribir el `.sql`** — mismo aprendizaje que
`integracion-facturacion` D3: en este proyecto el schema real históricamente va **por delante** del
repo, y ya pasó tres changes consecutivos.

**Las migraciones las escribe el agente pero las aplica la usuaria / Enzo, nunca el agente.** Es una
regla de governance del repo, no un límite técnico.
