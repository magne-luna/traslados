# Tasks — catalogo-accesorios-movilidad

> **⛔ GOVERNANCE — nada de SQL antes del gate §0.** Schema `pacientes` en producción: ninguna
> línea de `.sql` antes de coordinar con Enzo el estado real del schema (verificación solo-SELECT,
> el schema real manda sobre el repo).
>
> **⚠️ STRICT TDD ACTIVO** (`testing.strict_tdd: true`): RED → GREEN → TRIANGULATE → REFACTOR;
> safety net + baseline antes de tocar archivos existentes. Runner:
> `cd frontend && NODE_OPTIONS="--no-experimental-webstorage" npx vitest run` (flag obligatorio en
> este sandbox). Type-check: `cd frontend && npx tsc -b --noEmit`.
>
> **⚠️ Migraciones**: las escribe el agente; **las aplican la usuaria / Enzo, nunca el agente.**
>
> **Reglas duras**: nunca `any` (strict + narrowing); Tailwind v4 (nunca `style={{}}`); reusar
> `design-system/components.tsx`; nunca `SERVICE_ROLE_KEY` en frontend; Conventional Commits;
> docx manda en estructura, KB en reglas; la #11 se cierra en KB + `CHANGES.md`, **sin**
> `AvisoModeloDatos` nuevo (el `Alert` del DS cubre el aviso de desactivación).
>
> **PLAN RECORTADO (decisión de la usuaria)**: un SOLO PR, sin RPC nueva, sin EF nueva. La tabla
> `pacientes.accesorios` ya tiene policies WRITE por RLS — se escribe directo desde el repository
> con manejo accionable de la violación UNIQUE. La lectura cross-módulo (selector de Vehículo) se
> resuelve ajustando la policy de lectura, no con EF intermediaria.
>
> **Orden sin dejar el árbol a medias**: la migración es aditiva e inerte (columnas nuevas sin
> lectores); repository y mappers no rompen el compile (alias de tipo); el swap real de formularios
> ocurre en un commit único y revertible de la fase 6.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~500-650 total (migración ~40 · backend EF ~40 · frontend core ~250 · selector+swap ~200 · docs ~30) |
| 400-line budget risk | High (supera el guard) |
| Chained PRs recommended | No |
| Suggested split | Un solo PR con `size:exception` aprobado por la usuaria (decisión explícita: plan recortado en 1 PR) |
| Delivery strategy | ask-always → resuelto: 1 PR único con excepción aceptada |

Decision needed before apply: No (ya decidido por la usuaria)
Chained PRs recommended: No
400-line budget risk: High (aceptado — excepción explícita)
Suggested split: 1 PR

### Suggested Work Units

| Unit | Goal | Focused test command | Runtime harness | Rollback boundary |
|------|------|----------------------|-----------------|-------------------|
| 1 | Migración aditiva (icono/activa) + policy lectura cross-módulo + fix EF `pacientes-accesorios` + test texto SQL | `cd frontend && NODE_OPTIONS="--no-experimental-webstorage" npx vitest run accesorios` | Verificación solo-SELECT del schema real (D3 en vivo) antes de escribir el `.sql`; aplicación por Enzo | `DROP COLUMN icono, activa`; revertir policy; archivos EF inertes sin llamador |
| 2 | `catalogoAccesorios.ts` (tipos + alias) + repository directo (RLS, caché, error UNIQUE accionable) + icono display map + context | `cd frontend && NODE_OPTIONS="--no-experimental-webstorage" npx vitest run CatalogoAccesorios IconoAccesorio` | N/A — sin llamador real hasta el swap (tests con mocks) | Revertir commits 2; forms estáticos, compile verde por alias |
| 3 | Mappers limpios: sin `ACCESORIOS_VALIDOS`, sin descarte | `cd frontend && NODE_OPTIONS="--no-experimental-webstorage" npx vitest run vehiculoMapping pacienteMapping` | N/A — mapeo puro sin red | Revertir commits 3; vuelve el descarte sin romper |
| 4 | `AccesoriosMovilidadSelector` + swap de ambos forms (commit único) + consumidores de labels + baja `accesorioMovilidadOptions.ts` | `cd frontend && NODE_OPTIONS="--no-experimental-webstorage" npx vitest run AccesoriosMovilidadSelector PacienteDatosPersonalesFields VehiculoForm` | Manual navegador: cuenta `pacientes: write` (alta/menú/aviso/reactivar) y `vehiculos`-only (sin gestión) | Revertir commit de swap → selectores vuelven a la lista estática; `UPDATE activa = true` restaura cualquier baja |
| 5 | Docs: cierre #11 en KB + `CHANGES.md` | `npx oxlint` | — | Revertir docs |

---

## 0. ⛔ Portón de governance — nada se ejecuta sin esto

- [x] 0.1 **Coordinación con Enzo** antes de escribir el `.sql`: verificación solo-SELECT del schema
      real de `pacientes.accesorios` (¿existen `icono`/`activa`? policies RLS vigentes Read/Write?)
      — el schema real manda sobre el repo.
- [x] 0.2 Confirmación explícita del **PR único con `size:exception`** (decisión de la usuaria:
      plan recortado, sin RPC ni EF nuevas).
- [-] 0.3 **Safety net / baseline** — suite completa corrida antes de tocar archivos existentes,
      baseline registrado.

## 1. Migración + policy + EF (escrita por el agente, NO aplicada)

- [x] 1.1 Escribir `supabase/migrations/2026XXXXXXXXXX_catalogo_accesorios_icono_activa.sql`:
      aditivo (`icono TEXT` → backfill `icono = tipo` → `SET NOT NULL`; `activa BOOLEAN NOT NULL
      DEFAULT true`). **Sin CREATE FUNCTION** (ni RPC ni DEFINER). Ajustar la policy de LECTURA de
      `pacientes.accesorios` para que el selector de Vehículo (`vehiculos`, `conductores`) pueda
      leer el catálogo activo, manteniendo la WRITE solo para `pacientes`. Verificar contra las
      policies vigentes (0.1). Escrita, **no aplicada**.
- [x] 1.2 **RED** — test de código fuente (node:fs, patrón del repo): columnas aditivas, backfill
      presente, NO contiene `CREATE FUNCTION`, NO contiene `SECURITY DEFINER`, la policy de lectura
      cubre `vehiculos`/`conductores`. **GREEN.**
- [x] 1.3 Modificar `supabase/functions/pacientes-accesorios/index.ts:12`:
      `ACCESORIOS_VALIDOS` → consulta real `SELECT id FROM pacientes.accesorios WHERE
      tipo = ANY(…) AND activa = true`; inválidos = ausentes, error accionable que los nombra.
- [-] 1.4 Verificación real post-aplicación (bloqueada por aplicación de 1.1 por Enzo): alta/edición/
      desactivación con cuenta `pacientes: write`; cuenta `vehiculos`-only lee el catálogo sin poder
      escribir. **Pendiente — requiere cuentas reales (`VITE_TEST_ACCOUNTS`).**

## 2. Frontend core A — tipos, repository, display (TDD — inertes hasta el swap)

- [x] 2.1 **RED** — `shared/types/catalogoAccesorios.ts`: `TipoAccesorio = string` +
      `AccesorioCatalogo { id; tipo; descripcion?; icono; activa }`. **GREEN.**
- [x] 2.2 **RED** — `vehiculo.ts:8`: `AccesorioMovilidad = TipoAccesorio` (alias importado);
      `paciente.ts:100`: `accesorioMovilidad: TipoAccesorio[]`. Fixtures (5 literales) siguen
      compilando (string); `tsc -b` verde. **GREEN.**
- [x] 2.3 **RED** — interfaz `CatalogoAccesoriosRepository` + mock con fixtures.
- [x] 2.4 **RED** — `SupabaseCatalogoAccesoriosRepository`: `listarActivos`/`listarTodos` con
      lectura por RLS (SELECT directo a `pacientes.accesorios`, `activa = true` en activos);
      `crear/editar/desactivar/reactivar` por escritura directa RLS con manejo accionable de
      `23505` (UNIQUE) y `42501` (permiso) → mensajes en español bajo el form; **caché de sesión
      invalidada en cada escritura**. **GREEN → TRIANGULATE → REFACTOR.**
- [x] 2.5 **RED** — `shared/lib/accesorios/IconoAccesorio.ts`: `iconoAccesorioMap` (5 claves → SVG
      del DS), `iconoAccesorioFallback`, `labelAccesorio(tipo)` (overrides exactos de los 5 labels
      actuales ?? humanizar). Tests: clave desconocida → fallback; humanize. **GREEN.**
- [x] 2.6 **RED** — context `CatalogoAccesoriosRepositoryContext` + `useCatalogoAccesorios()`
      (activos siempre; `listarTodos` solo si `usePermiso('pacientes','write')`). **GREEN.**
- [x] 2.7 `tsc -b --noEmit` + `oxlint` limpios sobre el diff.

## 3. Frontend core B — mappers limpios (TDD)

- [x] 3.1 **RED** — `vehiculoMapping.ts:292-309`: eliminar `ACCESORIOS_VALIDOS` +
      `esAccesorioMovilidad` + filtro de `parseAccesoriosRows` → `string[]` espejo del maestro.
      **GREEN → TRIANGULATE.**
- [x] 3.2 **RED** — `pacienteMapping.ts:317-339`: eliminar `ACCESORIOS_VALIDOS`; `parseAccesorios`
      conserva cualquier `tipo` del maestro (descarta solo filas malformadas). **GREEN** (cierra #11
      en código).
- [x] 3.3 `tsc -b --noEmit` + `oxlint`; suites de Pacientes (64 tests) y Vehículos verdes.

## 4. Selector UI + integración (TDD — swap en commit único y revertible)

- [x] 4.1 **RED** — `design-system/icons.tsx`: `iconAccesorioGenerico` (SVG nuevo, trazo/currentColor).
- [x] 4.2 **RED** — `AccesoriosMovilidadSelector.tsx` (owner `features/pacientes/`): grid
      `ChecklistOption` con `labelAccesorio` + `iconoAccesorioMap ?? fallback`; "+ Agregar
      accesorio" inline (nombre + picker de lista fija) → `crear()` → queda seleccionado en el
      mismo render; menú ⋮ por opción (editar/desactivar) SOLO con `usePermiso('pacientes','write')`
      (independiente del módulo de ruta — en `VehiculoForm` no sirve `PuedeEscribirContext` de
      ruta); desactivar → `Alert` del DS con aviso ("queda visible donde ya se usa y deja de
      ofrecerse en asignaciones nuevas") → confirmar; inactivas **tachadas** + Reactivar (patrón
      `PrestacionesEditor`); duplicado con error accionable bajo el form, form abierto. Tests RTL
      con context stub: alta inline queda seleccionada, menú, aviso, read-only (sin botón ni menús),
      icono desconocido → fallback. **GREEN → REFACTOR.**
- [x] 4.3 **Swap en commit único y revertible** — `PacienteDatosPersonalesFields.tsx:145-162` y
      `VehiculoForm.tsx:162-179` (import cross-feature desde `features/pacientes/`) → ambos usan
      `<AccesoriosMovilidadSelector>`. Tests de integración con repository stub (catálogo activo,
      no lista estática).
- [x] 4.4 **RED** — migrar los 7 consumidores de `ACCESORIO_MOVILIDAD_LABELS/ICONS`
      (VehiculoDetail, VehiculosList, PacienteResumen, RequisitosPaciente,
      RecorridoVehiculoConductor, NuevoRecorridoForm) → `labelAccesorio`/`iconoAccesorioMap`.
- [x] 4.5 Eliminar `accesorioMovilidadOptions.ts` (últimos imports migrados); `tsc -b --noEmit` +
      `oxlint` + suites verdes.

## 5. Documentación

- [-] 5.1 `knowledge-base/04_modelo_de_datos.md` §Discrepancias: #11 → **CERRADA** con motivo
      ("el catálogo es la fuente de verdad; `AccesorioMovilidad` deja de ser unión cerrada; el
      frontend no descarta desconocidos").
- [-] 5.2 `CHANGES.md`: bullet del change + referencia en la lista de puntos tocados.
- [-] 5.3 Verificado: **sin** `AvisoModeloDatos` nuevo (cerrada #11 no deja mismatch; la
      desactivación usa `Alert` del DS).

## 6. Verificación final

- [-] 6.1 Suite completa en verde contra el baseline de 0.3, sin regresiones.
- [-] 6.2 `cd frontend && npx tsc -b --noEmit` + `oxlint` limpios en todo el diff.
- [-] 6.3 Manual navegador: alta inline, edición, desactivar con aviso, reactivar, cuenta
      `vehiculos`-only sin gestión (pero ve el catálogo), icono desconocido → fallback, alta en
      Pacientes visible en Vehículos sin recompilar.