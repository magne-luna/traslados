# Design: Catálogo de accesorios de movilidad gestionable

## Context (verificado, no asumido)

El backend YA es el catálogo real: `pacientes.accesorios (id, tipo UNIQUE, descripcion)` con RLS
completa (`20260724100004_schema_pacientes.sql:39-50,132-133`) y seed de 5 valores
(`20260729140000_seed_accesorios.sql`). El frontend lo duplica en 5 lugares:

| Lugar | Rol hoy | Veredicto |
|---|---|---|
| `shared/types/vehiculo.ts:8` | unión cerrada `AccesorioMovilidad` (5 literales) | → alias de `TipoAccesorio = string` |
| `features/vehiculos/accesorioMovilidadOptions.ts` | labels + iconos estáticos | → muere; nace `iconoAccesorioMap` + `labelAccesorio` |
| `shared/lib/vehiculos/vehiculoMapping.ts:292-309` | `ACCESORIOS_VALIDOS` + descarte | → se elimina (cierra #11) |
| `shared/lib/pacientes/pacienteMapping.ts:317-339` | ídem + `parseAccesorios` | → se elimina la lista; acepta el maestro |
| `supabase/functions/pacientes-accesorios/index.ts:12` | `ACCESORIOS_VALIDOS` (rechaza el resto) | → valida contra el maestro (`activa = true`) |

**Patrones reales del repo (leídos, no asumidos):**

- **Escrituras** — dos moldes conviven: Pacientes escribe **directo con RLS**
  (`SupabasePacienteRepository.ts`: `.from('accesorios')`, `.upsert`, `.delete`, traducción de
  errores tipo `23505`/`42501`); ObraSocial escribe **vía RPC `SECURITY INVOKER` invocada desde el
  repository** (`SupabaseObraSocialRepository.ts:178-183`: `supabase.schema().rpc('crear_obra_social_completa',
  …)` + `mapearErrorObraSocial` con ERRCODEs propios `45101-45103`). `crear_paciente_completo`
  (`20260730180000`) es RPC `SECURITY INVOKER` aplicada. La governance del repo dice "toda escritura
  es RPC para dominios críticos"; el precedente directo+RLS de Pacientes es deuda, no patrón a
  extender.
- **Lectura cross-módulo** — la EF `vehiculos` (`supabase/functions/vehiculos/index.ts:138-165`)
  ya lee `pacientes.accesorios` con **cliente `admin`**, explícitamente porque el módulo `pacientes`
  nunca se verificó en esa request ("el catálogo es un conjunto cerrado… así que esa lectura no
  puede pasar a userClient"). El único gate de esa lectura es app-level (`requirePermiso('vehiculos')`).
  **Este change legítima y centraliza esa mecánica** para el catálogo.
- **RLS del catálogo** es single-module (`modulos.tiene_permiso('pacientes', …)`). Un usuario con
  solo `vehiculos: write` NO puede SELECT directo sobre `pacientes.accesorios` (42501). `tiene_permiso(_, 'read')`
  es verdadero para cualquier nivel `read|write|admin` (comentario en `crear_paciente_completo:170-172`).
- **UI** — `ChecklistOption` (`design-system/components.tsx:613-642`) recibe `label` + `icon` como
  props; `PrestacionesEditor.tsx` es el molde del editor inline con baja lógica (tachado + Reactivar,
  nunca oculta inactivas); `usePermiso(modulo, nivelMinimo)` (`shared/auth/usePermiso.ts`) es el hook
  de permisos del frontend; los repositories se inyectan por Context por feature
  (`PacienteRepositoryContext.tsx`, `VehiculoRepositoryContext.tsx` — este último ya se importa
  cross-feature desde `features/conductores/`). `iconos.tsx:186-231` tiene los 5 SVGs de accesorios.
- **Consumidores de labels**: `ACCESORIO_MOVILIDAD_LABELS` se importa en 7+ pantallas
  (VehiculoDetail, VehiculosList, PacienteResumen, RequisitosPaciente, RecorridoVehiculoConductor,
  NuevoRecorridoForm) — con catálogo dinámico necesitan `labelAccesorio(tipo)` con fallback.

**Restricciones duras**: nunca `any`; Tailwind v4 (nunca `style={{}}`); RLS en la misma migración;
nunca `SERVICE_ROLE_KEY` en frontend; reusar design-system; la migración la escribe el agente y la
aplica la usuaria/Enzo; el schema real va por delante del repo (lección repetida 3+ changes);
Conventional Commits.

---

## ⚠️ Governance: ALTO — Aprobaciones requeridas antes de escribir SQL

Mismo espíritu que `presupuesto-prestaciones`: ninguna línea de `.sql` antes de aprobar. Replicadas
como checkboxes bloqueantes en `tasks.md` §0:

| # | Decisión | Por qué necesita aprobación |
|---|---|---|
| **D1** | Escritura del catálogo vía RPC `SECURITY INVOKER` única, invocada directo desde el repository | Agrega una función Postgres que escribe en schema `pacientes` en producción; define el canal de errores accionables |
| **D2** | Migración aditiva: `icono TEXT` (backfill `SET NOT NULL`) + `activa BOOLEAN DEFAULT true` | Única modificación de schema; RLS intacta |
| **D3** | Verificar el schema real en vivo ANTES de escribir el `.sql` (`supabase db query --linked`, solo SELECT: ¿`icono`/`activa` ya existen? ¿la RPC ya existe?) | El schema real va por delante del repo (pasó 3+ veces); evita colisión de historial |

**Coordinación con Enzo antes del `.sql`.** **La migración la escribe el agente; la aplica la
usuaria / Enzo, nunca el agente.**

---

## Goals / Non-Goals

**Goals**

- Catálogo global **gestionable desde el selector** (alta/edición/baja con aviso/reactivación), sin
  pantalla nueva — compartido por Pacientes, Vehículos y Conductores (docx §Accesorios del Paciente).
- Selectores de `PacienteDatosPersonalesFields` y `VehiculoForm` alimentados por el catálogo
  `activa = true`, sin recompilar ni reseedar al dar de alta.
- Ícono en la base como **string** (clave del DS), resuelto a SVG con fallback defensivo.
- Los 5 puntos de duplicación desaparecen; la EF `pacientes-accesorios` valida contra el maestro;
  se cierra la discrepancia **#11**.
- RN-VE-01 intacta (comparación de strings del mismo catálogo).

**Non-Goals**

- **NO** borrado físico desde la UI (baja lógica, misma semántica que `prestaciones`).
- **NO** pantalla/sección dedicada de administración.
- **NO** cambia `pacientes.crear_paciente_completo` (ya resuelve tipo→id contra el maestro; los
  selectores no ofrecen inactivos, así que el payload nunca los trae).
- **NO** `AvisoModeloDatos` nuevo (cerrada #11 no queda mismatch que señalizar; la desactivación usa
  `Alert` del DS).
- **NO** se reabre la semántica de `tipo` como clave de negocio (se conserva `UNIQUE`, ahora editable).

---

## Decisions

### D1 — Escritura: RPC `SECURITY INVOKER` única, invocada desde el repository ⚠️ REQUIERE APROBACIÓN

**Qué.** Una función Postgres nueva:

```sql
pacientes.gestionar_accesorio(p_accion text, p_id uuid, p_tipo text, p_icono text)
  RETURNS pacientes.accesorios
```
- `SECURITY INVOKER` explícito + `SET search_path = ''` + `COMMENT ON FUNCTION` (capas de defensa,
  patrón `integracion-facturacion` D4).
- `p_accion ∈ {'crear','editar','desactivar','reactivar'}`. Normaliza `p_tipo`
  (trim + colapso de espacios internos, rechaza vacío con `45112`). Valida `p_icono` no vacío.
- Duplicado de `tipo`: pre-check `IF EXISTS … WHERE tipo = p_tipo AND id <> COALESCE(p_id, …)` →
  `RAISE EXCEPTION … USING ERRCODE = '45110'`; el `UNIQUE` queda como backstop (carrera → `23505`
  mapeado como genérico por el repository).
- `desactivar/reactivar` = `UPDATE … SET activa = … WHERE id = p_id` (si no existe → `45111`).
- `GRANT EXECUTE … TO authenticated`; `REVOKE` de `anon`/`PUBLIC`.

**Invocación**: `CatalogoAccesoriosRepository` llama `supabase.schema('pacientes').rpc('gestionar_accesorio', …)`
**directo, sin Edge Function en el medio** — precedente exacto de `SupabaseObraSocialRepository`.
RLS aplica (INVOKER + sesión del usuario): un `pacientes: write` pasa, un `vehiculos: write` sin
`pacientes` es rechazado por `mapearErrorCatalogo` (42501 → mensaje accionable) incluso si la UI se
equivocara.

**Por qué así.**

| Alternativa | Tradeoff | Decisión |
|---|---|---|
| **A. RPC INVOKER desde el repository** (elegida) | Errores deterministas por ERRCODE (`45110` nombra el duplicado sin parsear texto de constraint); normalización centralizada; único contrato de escritura reutilizable por futuras EFs (conductores); satisface la governance "toda escritura es RPC" | ✅ |
| **B. Repository directo + RLS** (patrón Pacientes) | Menos SQL; pero duplicado → `23505` con parseo de nombre de constraint (`accesorios_tipo_unique`), sin normalización central, y extiende la deuda de escritura directa del módulo | ❌ |
| **C. Escritura vía EF `catalogo-accesorios`** | Un salto de red extra (cliente→EF→RPC); duplicaría el gateo (EF y RLS); la EF queda como lectora pura y chica | ❌ |

**La EF `catalogo-accesorios` es SOLO lectura** (D2) — no expone POST/PATCH.

### D2 — Lectura cross-módulo: EF `catalogo-accesorios` con gate por múltiples módulos ⚠️ DECIDIDO

El selector de Vehículo vive en el módulo `vehiculos` pero lee el catálogo de `pacientes`. Con RLS
single-module, la lectura **no puede** ser PostgREST directo desde el frontend para un usuario
`vehiculos`-only. Se resuelve con **EF nueva**:

- `supabase/functions/catalogo-accesorios/index.ts`, **solo GET**:
  - `GET /activos` → `AccesorioCatalogo[]` con `activa = true`, ordenado por `tipo`. Gate:
    `requirePermisoAny(req, ['pacientes','vehiculos','conductores'], 'read')` — helper **aditivo** en
    `_shared/auth.ts` que itera módulos (no toca `requirePermiso` existente). Puerto para el futuro
    selector de Conductores sin tocar nada.
  - `GET /todos` (manager: muestra inactivas tachadas) → gate: `pacientes: read`.
  - Lectura con cliente `admin` del EF y gate app-level: **misma mecánica que la EF `vehiculos`** ya
    usa para esta misma tabla; el catálogo no es dato de salud sensible y el gate es la lista fija de
    módulos consumidores. Documentado en la cabecera.
- Frontend: lectura SIEMPRE vía `functions.invoke('catalogo-accesorios')` en el repository (un solo
  código para ambos módulos).

| Alternativa | Tradeoff | Decisión |
|---|---|---|
| **EF con gate multi-módulo** (elegida) | Un endpoint; centraliza la lista de módulos consumidores; sigue el precedente EF `vehiculos` | ✅ |
| **Policy RLS adicional `OR tiene_permiso('vehiculos','read')` sobre `pacientes.accesorios`** | Lectura directa sin EF; pero acopla la lista de módulos al schema `pacientes` (cada consumidor nuevo = política ALTO), rompe el precedente cross-módulo-vía-EF y desdibuja el dueño del gate | ❌ |

### D3 — Componente reutilizable: `AccesoriosMovilidadSelector` ⚠️ DECIDIDO

**Qué.** Un componente único compartido por ambos formularios + un hook de carga:

- `frontend/src/features/pacientes/AccesoriosMovilidadSelector.tsx` (owner: schema `pacientes`;
  import cross-feature, precedente de `features/conductores/` → `VehiculoRepositoryContext`):
  - Props: `{ idBase: string; seleccion: TipoAccesorio[]; onChange: (seleccion: TipoAccesorio[]) => void }`.
    `VehiculoForm` lo importa desde `../pacientes/…`.
  - Render: grid de `ChecklistOption` (mismo layout que hoy: `lg:grid-cols-5`) con `label =
    labelAccesorio(tipo)`, `icon = iconoAccesorioMap[icono] ?? iconoAccesorioFallback`.
  - **Gestión inline gateada por `usePermiso('pacientes','write')`** — independiente del módulo de la
    ruta (en `VehiculoForm` el `PuedeEscribirContext` de la ruta es `vehiculos`, NO sirve acá). Sin
    ese permiso: solo elige entre activos (spec "Sin escritura no se gestiona").
  - **"+ Agregar accesorio"** al final del fieldset → form inline compacto (nombre + picker de icono
    de la lista fija) → `crear()` → el nuevo queda **seleccionable y seleccionado** en el mismo
    render, sin recargar.
  - **Menú ⋮ por opción** (editar nombre/icono, desactivar) — solo con `pacientes: write`.
    Desactivar → `Alert` del DS con el aviso ("queda visible en pacientes/vehículos que ya lo usan y
    deja de ofrecerse en asignaciones nuevas") → confirmar → `activa = false`. Inactivas se ven
    **tachadas** y con acción Reactivar (patrón `PrestacionesEditor`, nunca se ocultan).
  - Duplicado al crear/editar → mensaje del repository (`45110`) bajo el form y queda abierto.
- Carga: `CatalogoAccesoriosRepositoryContext.tsx` (patrón idéntico a
  `VehiculoRepositoryContext.tsx`) proveyendo `CatalogoAccesoriosRepository`; `useCatalogoAccesorios()`
  hace `listarActivos()` (público) y, si `usePermiso('pacientes','write')`, `listarTodos()` para los
  tachados — una sola fuente, dos vistas.
- **Conductores**: hoy NO tiene selector propio (solo consume `accesoriosCompatibles` del vehículo);
  cuando lo tenga, importa el mismo componente y el gate de lectura ya lo cubre.

### D4 — Ícono string → SVG: lista fija + fallback defensivo ⚠️ DECIDIDO

- **Lista fija del alta (picker) = los 5 SVGs de accesorios existentes** (`icons.tsx:186-231`):
  `'silla-plegable' | 'silla-rigida' | 'silla-postural' | 'andador' | 'tripode'`. Claves de icono =
  las mismas strings del seed → backfill trivial `icono = tipo`.
- `iconoAccesorioMap: Record<string, ReactNode>` (en el módulo de display nuevo) mapea clave → SVG.
- **Fallback**: `iconoAccesorioFallback` = `iconAccesorioGenerico`, UN SVG nuevo en `icons.tsx`
  (glifo neutral, mismo criterio "trazo/currentColor"): un icono desconocido (p. ej. fila creada en
  otra base) renderiza el genérico sin romper nada — defensivo, no silencioso.
- **`tipo` = nombre libre** (clave de negocio y display a la vez; el alta no deriva slugs): la
  usuaria escribe "Silla eléctrica" y ese es el `tipo`. `labelAccesorio(tipo)` = overrides de los 5
  labels actuales exactos ("Silla plegable", …) ?? `humanizar(tipo)` (guiones → espacios, primera
  letra mayúscula). RN-VE-01 compara strings del mismo maestro, sin cambio.
- Extensión futura: sumar un SVG al DS + una entrada al map (aditivo trivial, documentado). Nunca
  emoji ni imagen subida.

### D5 — Catálogo en el frontend: tipos, repository, caché ⚠️ DECIDIDO

**Nuevos archivos:**

- `shared/types/catalogoAccesorios.ts`: `export type TipoAccesorio = string;` +
  `interface AccesorioCatalogo { id: string; tipo: string; descripcion?: string; icono: string; activa: boolean }`.
- `shared/lib/accesorios/CatalogoAccesoriosRepository.ts` (interfaz) +
  `SupabaseCatalogoAccesoriosRepository.ts` + `.test.ts` (+ `mockCatalogoAccesoriosRepository.ts`
  para fixtures, patrón `mockVehiculoRepository`):
  - `listarActivos()`, `listarTodos()`, `crear(tipo, icono)`, `editar(id, { tipo?, icono? })`,
    `desactivar(id)`, `reactivar(id)`.
  - Lectura vía `functions.invoke('catalogo-accesorios')`; escritura vía `supabase.rpc('gestionar_accesorio')`.
  - `mapearErrorCatalogo` (ERRCODEs `45110`/`45111`/`45112`/`23505`/`42501` → mensajes en español,
    molde `mapearErrorObraSocial`).
  - **Caché por sesión**: módulo-scoped `let cacheActivos` (promise cache), invalidada en cada
    escritura del mismo singleton; así el alta inline se refleja sin refetch y sin volver al
    servidor en cada re-render del dropdown.
- `features/pacientes/CatalogoAccesoriosRepositoryContext.tsx` + `useCatalogoAccesorios()`.

**Reemplaza los 5 puntos de duplicación:**

| Punto | Cambio |
|---|---|
| `vehiculo.ts:8` | `AccesorioMovilidad` pasa a `export type AccesorioMovilidad = TipoAccesorio;` (alias de `catalogoAccesorios.ts`, importado) — sin unión cerrada, mínimo churn de ~20 fixtures |
| `paciente.ts:6,100` | `accesorioMovilidad: TipoAccesorio[]` (import del tipo nuevo; alias en `vehiculo.ts` cubre el resto de imports) |
| `accesorioMovilidadOptions.ts` | **Se elimina** (PR3); `ACCESORIO_MOVILIDAD_ICONS/LABELS/OPTIONS` nacen como `iconoAccesorioMap` + `labelAccesorio` en `shared/lib/accesorios/IconoAccesorio.ts` (o módulo display homónimo); los 7 consumidores migran a `labelAccesorio` |
| `vehiculoMapping.ts:292-309` | `ACCESORIOS_VALIDOS` + `esAccesorioMovilidad` + filtro de `parseAccesoriosRows` eliminados → `string[]` tal cual (espejo del maestro) |
| `pacienteMapping.ts:317-339` | `ACCESORIOS_VALIDOS` eliminado; `parseAccesorios` conserva cualquier `tipo` string (cierra #11); descarte solo de filas malformadas |
| EF `pacientes-accesorios/index.ts:12` | `ACCESORIOS_VALIDOS` → consulta real `SELECT id FROM pacientes.accesorios WHERE tipo = ANY(…) AND activa = true`, `invalidos` = los ausentes con error que los nombra |

### D6 — Migración aditiva (escribe el agente, aplica la usuaria/Enzo) ⚠️ REQUIERE APROBACIÓN

`supabase/migrations/2026XXXXXXXXXX_catalogo_accesorios_icono_activa.sql`:

```sql
ALTER TABLE pacientes.accesorios ADD COLUMN icono TEXT;
UPDATE pacientes.accesorios SET icono = tipo WHERE icono IS NULL;      -- backfill: clave = slug del seed
ALTER TABLE pacientes.accesorios ALTER COLUMN icono SET NOT NULL;
ALTER TABLE pacientes.accesorios ADD COLUMN activa BOOLEAN NOT NULL DEFAULT true;
-- + D1: CREATE FUNCTION pacientes.gestionar_accesorio(...) SECURITY INVOKER + GRANT/REVOKE/COMMENT
```

- RLS **sin cambios** (policies `Read/Write accesorios` ya cubren las columnas nuevas; `activa` no
  agrega un gate por fila — la baja lógica es un UPDATE normal con permiso de escritura).
- Fila de "otra base" con `tipo` fuera de las 5 claves → `icono = tipo` desconocido → fallback en
  render (defensivo por diseño).
- **D3** confirma en vivo que ni `icono`/`activa` ni la RPC existen ya.

### D7 — Documentación: cierre de #11 ⚠️ DECIDIDO

- `knowledge-base/04_modelo_de_datos.md` §Discrepancias, punto 11 → marcado **CERRADA** con motivo:
  "el catálogo es la fuente de verdad; `AccesorioMovilidad` deja de ser unión cerrada; el frontend no
  descarta desconocidos".
- `CHANGES.md` §C-05 (dueño del catálogo) + referencia en §C-08: bullet del change con la lista de
  puntos tocados. **Sin** `AvisoModeloDatos` nuevo (spec).

---

## Data Flow

```
┌─ PacienteDatosPersonalesFields ─┐   ┌─ VehiculoForm ────────────────┐
│  <AccesoriosMovilidadSelector>  │   │  <AccesoriosMovilidadSelector> │
└──────────────┬──────────────────┘   └──────────────┬─────────────────┘
               │ useCatalogoAccesorios() (módulo vehiculos: RLS NO alcanza)
               ▼                                    │
   CatalogoAccesoriosRepository (shared) ───────────┤
        │ lectura: functions.invoke('catalogo-accesorios')   │
        │         GET /activos (gate: pacientes|vehiculos|conductores) / /todos (pacientes)
        ▼                                    ▼
   EF catalogo-accesorios ──admin-read──► pacientes.accesorios
        │ escritura (solo con pacientes:write, UI tachada/oculta sin eso):
        ▼
   supabase.rpc('gestionar_accesorio') ──SECURITY INVOKER──► RLS aplica ──► tabla (+activa, +icono)
        │
        └─► invalida caché de sesión → el alta/edición/baja se refleja sin recargar
```

Selectores leen `activa = true`; `CRUD` de pacientes/vehículos sigue intacto (vínculos por `id`,
nunca se tocan).

---

## File Changes

| Archivo | Acción | Descripción |
|---|---|---|
| `supabase/migrations/2026XXXXXXXXXX_catalogo_accesorios_icono_activa.sql` | Crear | Columnas `icono`/`activa` + backfill + RPC D1 (INVOKER) + GRANT/COMMENT |
| `supabase/functions/catalogo-accesorios/index.ts` | Crear | GET /activos y /todos con gate multi-módulo (D2) |
| `supabase/functions/_shared/auth.ts` | Modificar | Helper aditivo `requirePermisoAny(req, modulos[], nivel)` |
| `supabase/functions/pacientes-accesorios/index.ts` | Modificar | `ACCESORIOS_VALIDOS` → resolución contra el maestro activo |
| `frontend/src/shared/types/catalogoAccesorios.ts` | Crear | `TipoAccesorio`, `AccesorioCatalogo` |
| `frontend/src/shared/types/vehiculo.ts`, `paciente.ts` | Modificar | Unión cerrada → `TipoAccesorio` (alias) |
| `frontend/src/shared/lib/accesorios/{CatalogoAccesoriosRepository,SupabaseCatalogoAccesoriosRepository}.ts` + tests | Crear | Interfaz + Supabase + `mapearErrorCatalogo` + caché |
| `frontend/src/shared/lib/accesorios/IconoAccesorio.ts` (display) | Crear | `iconoAccesorioMap` + `iconoAccesorioFallback` + `labelAccesorio` |
| `frontend/src/features/pacientes/CatalogoAccesoriosRepositoryContext.tsx` + `AccesoriosMovilidadSelector.tsx` | Crear | Context + componente reutilizable con gestor inline (D3) |
| `frontend/src/features/pacientes/PacienteDatosPersonalesFields.tsx` | Modificar | Fieldset → `<AccesoriosMovilidadSelector>` |
| `frontend/src/features/vehiculos/VehiculoForm.tsx` | Modificar | Ídem (import cross-feature) |
| `frontend/src/shared/lib/vehiculos/vehiculoMapping.ts`, `pacienteMapping.ts` | Modificar | Eliminar `ACCESORIOS_VALIDOS` y el descarte |
| `frontend/src/features/vehiculos/accesorioMovilidadOptions.ts` | Eliminar | Muere con los 7 imports migrados a `labelAccesorio`/`iconoAccesorioMap` |
| `frontend/src/design-system/icons.tsx` | Modificar | +`iconAccesorioGenerico` (fallback) |
| `knowledge-base/04_modelo_de_datos.md`, `CHANGES.md` | Modificar | Cierre de #11 + bullets (D7) |
| VehiculoDetail/List, PacienteResumen, RequisitosPaciente, RecorridoVehiculoConductor, NuevoRecorridoForm | Modificar | `ACCESORIO_MOVILIDAD_LABELS` → `labelAccesorio` |

## Interfaces / Contracts

```ts
// shared/types/catalogoAccesorios.ts
export type TipoAccesorio = string;                    // valores del maestro, nunca unión cerrada
export interface AccesorioCatalogo { id: string; tipo: string; descripcion?: string; icono: string; activa: boolean; }

// CatalogoAccesoriosRepository
listarActivos(): Promise<AccesorioCatalogo[]>;
listarTodos(): Promise<AccesorioCatalogo[]>;           // solo pacientes:read (manager)
crear(tipo: string, icono: string): Promise<AccesorioCatalogo>;
editar(id: string, cambios: { tipo?: string; icono?: string }): Promise<AccesorioCatalogo>;
desactivar(id: string): Promise<void>; reactivar(id: string): Promise<void>;
```

ErrorCodes RPC: `45110` duplicado (nombra el tipo) · `45111` no existe · `45112` payload inválido.

## Testing Strategy

| Capa | Qué se testea | Cómo |
|---|---|---|
| Unit (mapeo) | `labelAccesorio` (overrides de los 5 + humanize), `iconoAccesorioMap` con fallback ante clave desconocida, `parseAccesorios*` acepta cualquier string | puro, sin red |
| Unit (repository) | `listarActivos`/`listarTodos` (mock de `functions.invoke`), `crear/editar/desactivar/reactivar` (mock de `rpc`), `mapearErrorCatalogo` para `45110`/`45111`/`45112`/`42501` | vitest + mocks de cliente |
| Componente (RTL) | Selector: alimentado por activos; alta inline (queda seleccionado); duplicado muestra error y el form sigue abierto; menú ⋮ editar/desactivar con `Alert`; tachado + reactivar; **sin `pacientes:write` no hay botón ni menús**; icono desconocido renderiza fallback | `@testing-library/react`, context con stub |
| Integración | `VehiculoForm`/`PacienteDatosPersonalesFields` renderizan el selector con el catálogo activo (no la lista estática); `VehiculoDetail`/`PacienteResumen` muestran labels de tipos nuevos | RTL con repository stub |
| Migración (fuente) | El texto del `.sql`: contiene `SECURITY INVOKER` y NO `SECURITY DEFINER` en la función nueva; backfill presente | test de código fuente (patrón `integracion-facturacion` D4) |

Runner: `cd frontend && NODE_OPTIONS="--no-experimental-webstorage" npx vitest run` + `npx tsc -b --noEmit` (Strict TDD).

## Threat Matrix

`N/A — no hay routing, shell, subprocess, automatización VCS/PR, clasificación de ejecutables ni
integración de procesos.` (El gate de autorización de la EF es lógica de negocio cubierta por
test de repository/componente, no una frontera de ejecución.)

## Migration Plan

1. **Gate §0** — aprobación de D1, D2, D3. Nada se escribe antes.
2. **D3 en vivo** — `supabase db query --linked` (solo SELECT): ¿existen `icono`/`activa`? ¿existe
   `gestionar_accesorio`?
3. Escribir el `.sql` (D6), **la usuaria/Enzo lo aplican**.
4. Backend: EF `catalogo-accesorios` + `requirePermisoAny` + fix de `pacientes-accesorios` (PR1).
5. Frontend: tipos → repository + caché → display map → context → mappers limpios (PR2) →
   componente + integración + migración de labels (PR3).
6. Docs (D7) con el cierre de #11.

**Entre (3) y (5) la app sigue funcionando**: columnas nuevas inertes, EF sin llamador, RPC sin
invocación — el frontend estático convive hasta el PR final.

## Rollback

- **Migración**: estrictamente aditiva. `DROP COLUMN icono, activa` y/o `DROP FUNCTION
  gestionar_accesorio` — sin pérdida de datos (vínculos por `id` intactos en todo momento).
- **Backend EF**: sin llamador, revertir = borrar la carpeta + el helper.
- **Frontend por PR**: PR1 independiente (backend); PR2 (tipos/repo/map — los forms siguen estáticos,
  compile verde por el alias); PR3 (componente/forms) revertible a la lista estática — si algo se
  desactivó, `UPDATE activa = true` restaura sin pérdida. Los 5 valores del seed siguen existiendo.

## Risks / Trade-offs

| # | Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|---|
| 1 | **Schema real ya tiene columnas/RPC** (pasó 3+ veces) | Alta | Colisión de historial | **D3** + coordinación con Enzo antes del `.sql` |
| 2 | **RPC sin harness automatizado** (pgTAP ausente) | Media | Errores solo en vivo | Test del texto del `.sql` + verificación manual con cuentas reales como tarea |
| 3 | Una futura EF convierte `gestionar_accesorio` a DEFINER | Baja | Crítico — bypassea RLS | INVOKER explícito + `COMMENT ON FUNCTION` + test del texto |
| 4 | Renombrar `tipo` (clave de negocio) rompe resolución vieja | Baja | Medio | Vínculos por `id`; EFs/RPC resuelven por `tipo` al LEER (siempre fresco); backstop `UNIQUE` |
| 5 | Diff grande (migración + EF + repo + componente + 7 consumidores) | Alta | Reviewer burnout (guard 400 líneas) | **3 PRs encadenados con rollback independiente**; `sdd-tasks` forecast con las guard lines + `size:exception` si PR2 excede |

## Open Questions

1. **¿La usuaria quiere además «ocultar del historial» un accesorio desactivado?** Fuera de alcance;
   hoy los tachados son trazabilidad (mismo criterio que `PrestacionesEditor`). **Decide: la usuaria.**
2. **¿Sumar SVGs nuevos al DS para más iconos en el alta?** YAGNI: la lista fija arranca con los 5;
   la extensión es aditiva. **Decide: la usuaria, cuando aparezca la necesidad.**
3. **pgTAP/Supabase local** — sigue abierta; este change suma 1 función más sin harness.
4. **¿Conductores necesita selector propio pronto?** El gate de lectura ya lo cubre; el componente se
   importa igual. **Decide: usuaria, cuando exista la pantalla.**

## Plan de implementación por fases (para `sdd-tasks`)

- **PR1 — Backend** (`~300 líneas`): migración (D6) + RPC (D1) + EF `catalogo-accesorios` (D2) +
  `requirePermisoAny` + fix EF `pacientes-accesorios` + test del texto del `.sql`. Frontera de
  rollback: aditivo, inerte sin frontend.
- **PR2 — Frontend core** (`~450-550 líneas`): tipos (`catalogoAccesorios.ts` + alias en
  vehiculo/paciente) + repository + caché + `mapearErrorCatalogo` + display map (`iconoAccesorioMap`,
  `labelAccesorio`, fallback) + mappers sin `ACCESORIOS_VALIDOS`. Frontera: los forms siguen
  estáticos (compile verde por el alias). **Si excede 400 líneas: chained 2a (tipos+repo+map) /
  2b (mappers)** — el alias permite cortarlo.
- **PR3 — Selector UI + docs** (`~400-500 líneas`): `AccesoriosMovilidadSelector` + context +
  integración en ambos forms + migración de los 7 consumidores de labels + baja de
  `accesorioMovilidadOptions.ts` + icono fallback en DS + KB/CHANGES (D7).

`Decision needed before apply: Yes (Gate §0 D1/D2/D3)`. `Chained PRs recommended: Yes (3)`.
`400-line budget risk: Medium-High (PR2, PR3)` — se confirma con count exacto en `sdd-tasks`.