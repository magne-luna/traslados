# Proposal: Catálogo de accesorios de movilidad gestionable

## Why

Los accesorios de movilidad son hoy un **conjunto cerrado hardcodeado** en el frontend, duplicado en
**5 lugares** del repo:

| Lugar | Rol |
|---|---|
| `frontend/src/shared/types/vehiculo.ts:8` | unión `AccesorioMovilidad` (5 literales) |
| `frontend/src/features/vehiculos/accesorioMovilidadOptions.ts:14-33` | labels + iconos estáticos |
| `frontend/src/shared/lib/vehiculos/vehiculoMapping.ts:292-309` | `ACCESORIOS_VALIDOS` + descarte de desconocidos |
| `frontend/src/shared/lib/pacientes/pacienteMapping.ts:317-339` | ídem + `parseAccesorios` |
| `supabase/functions/pacientes-accesorios/index.ts:12` | `ACCESORIOS_VALIDOS` (rechaza todo lo demás) |

Agregar un accesorio nuevo exige editar los 5 archivos, recompilar, y re-seedear la base — la RPC
`pacientes.crear_paciente_completo` aborta con `45001` cualquier tipo fuera de la lista
(`20260730180000_crear_paciente_completo.sql:166-191`). La usuaria no puede operar el catálogo sin
tocar código.

El **backend ya es un catálogo real**: `pacientes.accesorios` (`id`, `tipo UNIQUE`, `descripcion`)
con RLS completa en `20260724100004_schema_pacientes.sql:39-50,132-136`, seed de 5 valores en
`20260729140000_seed_accesorios.sql`, y vínculos N:N desde Pacientes (`accesorios_pacientes`) y
Vehículos (`conductores.accesorios_vehiculo`). El docx confirma que es un **catálogo compartido y
reutilizable** ("Este mismo catálogo de Accesorios es reutilizado por el Área de Conductores",
§Accesorios del Paciente), no un conjunto cerrado — la cerrazón es una decisión de implementación del
frontend, documentada como **discrepancia #11** en `knowledge-base/04_modelo_de_datos.md`.

**Objetivo**: que la usuaria cree/edite/desactive accesorios desde la UI (icono + nombre, icono desde
lista fija de SVGs del design system) y que el resultado se refleje en los selectores de Pacientes y
Vehículos sin recompilar.

## What Changes

### 1. Migración `..._catalogo_accesorios_icono_activa.sql` (aditiva, RLS intacta)

- `ALTER TABLE pacientes.accesorios ADD COLUMN icono TEXT;` → backfill de los 5 del seed (p.ej.
  `silla-plegable` → `'silla-plegable'`) → `SET NOT NULL`.
- `ADD COLUMN activa BOOLEAN NOT NULL DEFAULT true` — baja lógica (mismo criterio que
  `pacientes.prestaciones`).
- **RLS sin cambios**: las policies `Read/Write accesorios` ya cubren SELECT/ALL vía
  `modulos.tiene_permiso('pacientes', ...)`. Las columnas nuevas no requieren policies nuevas.
- Regla de governance: la migración la **escribe el agente, la aplica la usuaria/Enzo** (patrón
  `presupuesto-prestaciones`).

### 2. Frontend — catálogo dinámico (reemplaza la unión cerrada)

- `frontend/src/shared/types/catalogoAccesorios.ts` (nuevo): `AccesorioCatalogo { id, tipo, icono,
  activa }` + tipo `TipoAccesorio = string` (los selectores pasan de unión de literales a valores del
  catálogo).
- `vehiculo.ts:8` / `paciente.ts:100`: `AccesorioMovilidad[]` → `TipoAccesorio[]` (o se re-exporta el
  tipo nuevo). La **validación RN-VE-01 sigue intacta**: compara strings, y ahora ambos lados vienen
  del mismo catálogo.
- `accesorioMovilidadOptions.ts`: muere la lista estática; nace `iconoAccesorioMap: Record<string,
  ReactNode>` (string `icono` → SVG del design system, con **fallback genérico** ante un icono
  desconocido — defensivo, no silencioso). `icons.tsx` conserva los 5 SVGs y puede sumar más (a
  definir en `design.md`) — siempre SVGs propios, nunca emoji libre ni imagen subida.

### 3. Selectores (ambos sin reestructuración)

`PacienteDatosPersonalesFields.tsx:145-162` y `VehiculoForm.tsx:162-179` ya renderizan
`ChecklistOption` con `label` + `icon` como props — el catálogo dinámico los alimenta cargando
**solo accesorios `activa = true`** desde el repository. El vehículo lee el catálogo con permiso
combinado (`vehiculos` + lectura de `pacientes.accesorios`, misma mecánica que la EF `vehiculos`).

### 4. Gestor de catálogo — inline en el selector (sin pantalla nueva)

Decisión de la usuaria: **sin sección ni página dedicada**. Todo vive dentro del campo de
accesorios de movilidad:

- **Botón "+ Agregar accesorio"** al final del fieldset: abre un form inline compacto (nombre +
  icono de la lista fija del DS) y crea el accesorio; queda seleccionable de inmediato en el mismo
  campo.
- **Menú de acciones por opción**: cada opción del checklist lleva un menú chico (⋮) con editar
  (nombre/icono) y desactivar. Al desactivar se muestra el aviso (`Alert`): "El accesorio queda
  visible en pacientes/vehículos que ya lo usan y deja de ofrecerse en asignaciones nuevas". Las
  opciones inactivas se ven tachadas (patrón `PrestacionesEditor.tsx`) y se pueden reactivar.
  Editar y desactivar solo los ve quien tiene permiso de escritura; el resto del equipo
  simplemente elige entre los activos.
- **Componente compartido**: ambos selectores (`PacienteDatosPersonalesFields.tsx:145-162` y
  `VehiculoForm.tsx:162-179`) usan la MISMÍSIMA implementación (ChecklistOption + botón agregar +
  menú por opción, a extraer como componente reutilizable en `design.md`). El catálogo es global,
  así el alta/edición/baja hecha en cualquier ficha aplica en todo el sistema.
- **Semántica de baja lógica** (confirmada con la usuaria):
  - Las filas existentes (`accesorios_pacientes`, `conductores.accesorios_vehiculo`) **no se tocan**
    — referencian por `id`, no por catálogo activo.
  - Los selectores ofrecen solo `activa = true` → deja de ofrecerse en asignaciones nuevas.
  - Un accesorio desactivado **puede reactivarse** (patrón `PrestacionesEditor`).
- `CatalogoAccesoriosRepository` (`Supabase`): listar (activos / todos), crear, actualizar
  (nombre/icono), desactivar. Escrituras vía **RPC `SECURITY INVOKER`** (nunca `DEFINER`, molde de
  `obra_social.crear_obra_social_completa`) o repository directo — se define en `design.md` (D1).

### 5. Mappers y Edge Function — dejar de rechazar/descartar

- `vehiculoMapping.ts` / `pacienteMapping.ts`: desaparecen `ACCESORIOS_VALIDOS` y el **descarte en
  silencio** de desconocidos (discrepancia #11 → los valores del catálogo son la fuente de verdad).
  `parseAccesorios*` pasa a aceptar el catálogo real.
- `supabase/functions/pacientes-accesorios/index.ts:12`: `ACCESORIOS_VALIDOS` se elimina; la
  validación pasa a resolver contra el maestro real (`pacientes.accesorios`, filtrando
  `activa = true`), devolviendo error accionable si el tipo no existe.
- `pacientes.crear_paciente_completo` (RPC, `45001`): **no cambia su lógica** — ya resuelve
  tipo→id contra el maestro y aborta si falta; con catálogo gestionable ese comportamiento es
  exactamente el correcto (se actualiza solo el mensaje, si hace falta).
- EF `vehiculos/index.ts` (comentario "conjunto cerrado de 5 valores", líneas 20-22): se actualiza el
  comentario; la lógica de resolución contra el maestro ya es correcta.

---

## Capabilities

### New Capabilities

- **`catalogo-accesorios-movilidad`**: gestión del catálogo global compartido **desde el propio
  selector** — alta por botón inline (nombre + icono de lista fija del DS), edición y desactivación
  con aviso y reactivación por menú de acción por opción, sin pantalla dedicada; lectura por los
  selectores de Pacientes y Vehículos; icono como string resuelto a SVG del design system con
  fallback.

### Modified Capabilities

- **`paciente-contract`**: `accesorioMovilidad` deja de ser unión cerrada de literales → valores del
  catálogo dinámico (`string[]`).
- **`vehiculo-contract`**: `accesoriosCompatibles` ídem; el escenario "conjunto cerrado tipado" se
  reemplaza por "catálogo dinámico".
- **`asignacion-compatibilidad-accesorio`**: la validación RN-VE-01 se nutre de valores del catálogo
  (sigue comparando strings; la fuente deja de ser una unión en TS).
- **`paciente-repository-supabase`**: los escenarios "accesorios desconocidos se descartan" se
  reemplazan por lectura real del catálogo (cierra discrepancia #11).
- **`vehiculo-crud`**: los accesorios compatibles se cargan desde el catálogo (activos), no de una
  lista estática.

---

## Impact

**Código nuevo**

- `frontend/src/shared/lib/accesorios/CatalogoAccesoriosRepository.ts` + `.test.ts`
- `frontend/src/shared/types/catalogoAccesorios.ts`
- Componente reutilizable del selector con botón "+ Agregar" + menú por opción (a extraer en
  `design.md`; sin página ni sección nueva)
- `supabase/migrations/2026XXXXXXXXXX_catalogo_accesorios_icono_activa.sql`
- RPC de escritura del catálogo (a definir en `design.md` D1)

**Código modificado**

- `frontend/src/features/vehiculos/accesorioMovilidadOptions.ts` → `iconoAccesorioMap` + fallback
- `frontend/src/shared/types/vehiculo.ts`, `frontend/src/shared/types/paciente.ts`
- `frontend/src/features/pacientes/PacienteDatosPersonalesFields.tsx`,
  `frontend/src/features/vehiculos/VehiculoForm.tsx` (fuente de datos: catálogo activo)
- `frontend/src/shared/lib/vehiculos/vehiculoMapping.ts`,
  `frontend/src/shared/lib/pacientes/pacienteMapping.ts` (sin `ACCESORIOS_VALIDOS`)
- `frontend/src/design-system/icons.tsx` (SVGs nuevos si la lista fija se amplía — `design.md`)
- `supabase/functions/pacientes-accesorios/index.ts`

**Documentación**

- `knowledge-base/04_modelo_de_datos.md` §Discrepancias — **#11 se cierra** (catálogo = fuente de
  verdad; el frontend deja de descartar desconocidos) + nota en `CHANGES.md`.
- RN-VE-01 **no se reescribe**: valida compatibilidad contra valores del catálogo; la
  cerrazón del conjunto era implementación, no regla de negocio.

**Sin impacto**

- RLS de `pacientes.accesorios` (aditiva, policies ya cubren las columnas nuevas).
- `pacientes.crear_paciente_completo` (ya resuelve contra el maestro).
- `conductores.accesorios_vehiculo` (referencia por `id`, sin cambios estructurales).

---

## Alternativas consideradas

| Alternativa | Veredicto |
|---|---|
| **A1** — Ampliar la unión a mano por cada accesorio nuevo | ❌ Rechazada: editar 5 archivos + recompilar + reseed por valor; la usuaria no puede operar |
| **A2** — Catálogo dinámico (elegida) | ✅ El backend ya es catálogo; costo = el tipo TS deja de ser unión cerrada → validación runtime contra el catálogo (mitigado con tests) |
| **A3a** — `icono` NOT NULL con backfill de los 5 (elegida) | ✅ Sin iconos vacíos en selectores; guard de fallback en el mapeo por si llega un string desconocido |
| **A3b** — `icono` nullable con fallback genérico | ❌ Permite iconos ausentes en el alta (la usuaria pidió elegir icono) |
| **A4** — Migrar vínculos a `id` (abandonar `tipo` como clave) | ❌ Invasivo: RPC/EF/mappers resuelven por `tipo` hoy; se conserva `tipo UNIQUE` como clave de negocio legible |
| **A5** — Pantalla/sección dedicada para el gestor vs. gestión inline | ❌ Rechazada la pantalla: la usuaria pidió un botón de agregar y menú por opción dentro del campo, sin sección nueva. El componente selector reutilizable cubre alta/edición/baja en ambos módulos |

---

## Rollback Plan

- Migración **aditiva** (columnas nuevas + backfill): revertir = `DROP COLUMN icono, activa` o dejar
  las columnas y revertir solo el frontend. Los vínculos (`accesorios_pacientes`,
  `accesorios_vehiculo`) no se tocan en ningún momento.
- Frontend: restaurar la unión de 5 literales + `ACCESORIOS_VALIDOS` en mappers y EF (los valores del
  seed siguen existiendo en la base).
- Si una desactivación rompe algo: `UPDATE activa = true` — operación no destructiva.

## Dependencies

- Tabla `pacientes.accesorios` + RLS + seed (ya existen, `20260724`/`20260729`).
- Patrón de editor con baja lógica: `PrestacionesEditor.tsx`, `SupabasePacienteRepository.ts:464-473`.
- Patrón de catálogo global CRUD + aviso: `ObraSocialesPage.tsx`, `ChecklistEditor.tsx`.
- Migraciones: las escribe el agente, **las aplica la usuaria/Enzo** — coordinar antes de `apply`.

## Success Criteria

- [ ] Alta de un accesorio nuevo desde la UI → aparece en los selectores de Pacientes y Vehículos *sin recompilar ni reseedar*.
- [ ] Edición de nombre/icono → se refleja en selectores y en los registros que lo usan.
- [ ] Desactivar con aviso → deja de ofrecerse en asignaciones nuevas; pacientes/vehículos que lo usan lo conservan; RN-VE-01 sigue bloqueando asignaciones incompatibles.
- [ ] Los 5 accesorios del seed funcionan con su icono backfilled y sin regresión en los 64 tests de Pacientes / suite de Vehículos.
- [ ] EF `pacientes-accesorios` acepta cualquier tipo presente en el maestro y rechaza los inexistentes con error accionable.
- [ ] `tsc -b --noEmit` limpio, suite vitest verde (Strict TDD).

## Unresolved Questions

1. **`tipo` como clave de negocio**: ¿se mantiene `tipo UNIQUE` como identificador legible (propuesta:
   sí — RPC/EF/mappers ya resuelven por él) o se migra a `id`? Decidido en `design.md` (D1).
2. **Desactivar un valor del seed** (ej. `tripode`): se conserva en registros existentes y se puede
   reactivar — confirmar con la usuaria si quiere además poder ocultarlo del historial.
3. **Borrado físico de un accesorio nunca usado**: primera iteración **solo baja lógica** (consistente
   con el resto de catálogos del repo); el borrado físico queda fuera de alcance.

---

## ⚠️ Governance

- Dominio **ALTO** (schema `pacientes` en producción, sin datos críticos financieros): gate de
  aprobación para la migración aditiva y para la RPC de escritura (D1) — replicados como checkboxes
  bloqueantes en `tasks.md` §0.
- **Coordinación con backend (Enzo)** antes de escribir el `.sql` (mismo aprendizaje que
  `integracion-facturacion` D3): el schema real puede diferir del repo.
- **Migraciones**: las escribe el agente; **las aplica la usuaria / Enzo, nunca el agente**.
- RPC de escritura: `SECURITY INVOKER`, nunca `SECURITY DEFINER`.
- Ícono en la base = **string** (clave del mapeo del design system), nunca SVG inline ni emoji.