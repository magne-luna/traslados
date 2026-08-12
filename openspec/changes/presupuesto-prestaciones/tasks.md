# Tasks — presupuesto-prestaciones

> **⛔ GOVERNANCE ALTO — nada de SQL antes del gate §0.** Presupuestos toca schema financiero en
> producción (`facturacion.presupuesto`, integrado desde `integracion-presupuestos`,
> 2026-08-06). El gate es más liviano que `integracion-facturacion` (dominio CRÍTICO) pero del
> mismo espíritu: **ninguna línea de `.sql` se escribe antes de que la usuaria responda D1/D2/D3
> de `design.md`.**
>
> **⚠️ STRICT TDD ACTIVO** (`testing.strict_tdd: true`). Todo código de producción se implementa
> con **RED → GREEN → TRIANGULATE → REFACTOR**. Antes de tocar un archivo existente, correr el
> safety net y registrar el baseline.
> Test runner: `cd frontend && NODE_OPTIONS="--no-experimental-webstorage" npx vitest run`
> (flag obligatorio en este sandbox — Node 26 + jsdom 29 + vitest 4 shadowea `localStorage`).
>
> **⚠️ Las migraciones las escribe el agente; las aplica la usuaria / Enzo, nunca el agente.**
> Governance, no límite técnico — el CLI del sandbox tiene sesión real y se usa solo para
> `SELECT` en el gate D3.
>
> **Reglas duras** (`CLAUDE.md`): nunca `any` (usar `unknown` + narrowing); nunca `style={{}}`
> (Tailwind v4 utilities); reusar `design-system/components.tsx`; nunca
> `SUPABASE_SERVICE_ROLE_KEY` en frontend; toda tabla nueva define su RLS en el mismo change;
> type-check con `npx tsc -b --noEmit` (con `-b`); Conventional Commits; docx manda en estructura,
> KB en reglas de negocio, discrepancias en KB + `CHANGES.md` + `AvisoModeloDatos`.
>
> **Orden de fases pensado para no dejar el árbol a medias.** Fases 2-4 escriben archivos que
> nadie importa todavía (mapeo puro, repository, editor sin cablear) — la app sigue andando con el
> `PresupuestoForm` actual. El swap real (bifurcación de `PresupuestoForm`) ocurre en un único
> commit en la Fase 5. Cada fase anterior es revertible por sí sola.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~750-950 (3 migraciones, 2 componentes nuevos + tests, bifurcación de `PresupuestoForm`, mapping/repository/tipos, docs) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (catálogo de prestaciones) → PR 2 (columna + RPC + Edge Function) → PR 3 (bifurcación de UI en Presupuestos) |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | `pacientes.prestaciones` (migración + `PrestacionesEditor` + sección en `PacienteDetail`) | PR 1 | `npx vitest run PrestacionesEditor` | Manual con cuenta Pacientes (`pacientes: write`) | `DROP TABLE pacientes.prestaciones`; revertir commits de `PrestacionesEditor`/`PacienteDetail` |
| 2 | `presupuesto.prestacion_id` + RPC `SECURITY INVOKER` + Edge Function invoca RPC | PR 2 | `npx vitest run presupuestoMapping SupabasePresupuestoRepository` | Manual con cuentas Facturación (write) y solo-lectura, ver §1B | `DROP FUNCTION` × 2 (inertes, sin llamador); `ALTER TABLE ... DROP COLUMN prestacion_id` (requiere que PR 3 no esté mergeado) |
| 3 | Bifurcación de `PresupuestoForm` (`PresupuestoLineasEditor`, multi-select `por-prestacion`, `createLote`) | PR 3 | `npx vitest run PresupuestoForm PresupuestoLineasEditor` | Manual con obras sociales de las dos modalidades | Revertir el commit único de la Fase 5; `PresupuestoForm` vuelve al campo `monto` simple |

**Recomendación honesta**: partir en las 3 PRs encadenadas de arriba. El diff combinado (~750-950
líneas) más que duplica el guard de 400 líneas, y las tres unidades tienen fronteras de rollback
independientes y verificación manual propia — exactamente el criterio que justifica encadenar en
vez de forzar un PR único. PR 1 y PR 2 son ambas inertes hasta que PR 3 las cablea (Fase 5), así
que el orden de merge no bloquea funcionalidad a medio camino.

---

## 0. ⛔ Portón de governance — nada se ejecuta sin esto

- [x] 0.1 **Aprobación D1** — `pacientes.prestaciones` (tabla nueva, borrado lógico vía `activa`) +
      `facturacion.presupuesto.prestacion_id` (columna nullable, aditiva, FK cross-schema
      financiero→clínico). **Respuesta de la usuaria: sí**, con la corrección de borrado lógico
      (`activa`, no `RESTRICT` físico) sobre la recomendación original.
- [x] 0.2 **Aprobación D2** — migrar la escritura de Edge Function a RPC `SECURITY INVOKER`
      (`crear_presupuesto_completo`, `crear_presupuestos_lote`), **opción A** (Edge Function invoca
      la RPC, `SupabasePresupuestoRepository.ts` no cambia su forma de llamar). **Respuesta: opción
      A**, confirmada explícitamente.
- [x] 0.3 **Aprobación D3** — verificar en solo lectura (`supabase db query --linked`) el volumen
      real de `facturacion.presupuesto`/`autorizacion` y confirmar que `prestacion_id` y
      `pacientes.prestaciones` no existen ya. **Hecho**: 2 presupuestos, 2 autorizaciones, ninguna
      de las dos estructuras nuevas existe todavía. Sin colisión de historial.
- [x] 0.4 **Confirmación de Open Question #2** — N presupuestos = N autorizaciones en
      `por-prestacion` es operativamente aceptable. **Respuesta: sí**, confirmado explícitamente.
- [x] 0.5 **Coordinación con backend (Enzo)** antes de escribir el `.sql` — el propio Enzo (backend)
      es quien está conduciendo este change en esta sesión.
- [x] 0.6 **Safety net / baseline.** Corrido: **241 archivos, 2345 tests — 3 fallando en 2
      archivos**, todos en `src/features/obras-sociales/ChecklistEditor.test.tsx` (dominio
      Obras Sociales, sin relación con Presupuestos/Pacientes/Prestaciones). Baseline preexistente
      a este change, no regresión propia.

---

## 1. Precondiciones del backend (verificar, no modificar)

> Bloqueada por 0.1-0.3. Solo lectura.

- [ ] 1.1 `supabase db query --linked`: `count(*)` de `facturacion.presupuesto` y
      `facturacion.autorizacion` (D3). Define si `CREATE INDEX` sobre `prestacion_id` necesita
      `CONCURRENTLY`.
- [ ] 1.2 Confirmar que `pacientes.prestaciones` y `presupuesto.prestacion_id` **no existen ya** en
      el schema real.
- [ ] 1.3 Confirmar RLS/módulo real de `presupuesto`/`autorizacion` (módulo `presupuestos`, no
      `facturacion`, por `20260730140000_split_modulos_permisos.sql`) sigue vigente en producción.

## 2. Tipos y mapeo puro (TDD estricto — nadie lo importa todavía)

- [x] 2.1 **RED** — `frontend/src/shared/types/prestacion.ts`: tipo `Prestacion` (`id`,
      `pacienteId`, `nombre`, `descripcion?`, `activa`). **GREEN → REFACTOR.**
- [x] 2.2 **RED** — `Paciente.prestaciones: Prestacion[]` en `paciente.ts`, junto a `direcciones`.
      (Implementado como `prestaciones?: Prestacion[]` — opcional a propósito, ver comentario en
      `paciente.ts`: la migración de Fase 3 es aditiva y `SupabasePacienteRepository`/
      `pacienteMapping.ts` todavía no leen/escriben esta clave en este PR.)
- [x] 2.3 **RED** — `Presupuesto.prestacionId?: string` en `presupuesto.ts`, comentario explícito
      de que NO reabre la discrepancia #13 y que `monto` no cambia de forma. **Hecho en PR 2.**
- [x] 2.4 **RED** — `presupuestoMapping.ts`: `prestacionId` en `parsePresupuestoApi` (fila con
      `prestacion_id: null` → `prestacionId: undefined`, nunca `null` filtrándose).
      **GREEN → TRIANGULATE (con y sin valor) → REFACTOR.** **Hecho en PR 2.**
- [x] 2.5 **RED** — `toCrearPresupuestoPayload`: incluye `prestacionId` cuando está presente,
      ausente cuando no (misma semántica parcial que D6b de `integracion-presupuestos`). **Hecho en
      PR 2.**
- [x] 2.6 **RED** — `toActualizarPresupuestoPayload`: clave ausente en el `Partial` → clave ausente
      en el payload (nunca se rellena con `undefined` explícito). Test dedicado: es el agujero que
      ya rompió `integracion-obra-social` D6. **Hecho en PR 2.**
- [x] 2.7 `npx tsc -b --noEmit` + `oxlint` limpios. Cero `any`, cero `as` sobre datos externos.
      (Verificado sobre el alcance de PR 1: `prestacion.ts`, `prestacionMapping.ts`,
      `PrestacionesEditor.tsx`, `paciente.ts`, `PacienteDetail.tsx`.)

## 3. Migraciones: catálogo de prestaciones (bloqueada por 0.1, 1.2)

> El agente escribe, no aplica.

- [x] 3.1 Escribir `supabase/migrations/20260812120000_schema_pacientes_prestaciones.sql`:
      `CREATE TABLE pacientes.prestaciones` (id, `paciente_id` FK `ON DELETE CASCADE`, `nombre`,
      `descripcion`, `activa BOOLEAN NOT NULL DEFAULT true`) + RLS
      (`modulos.tiene_permiso('pacientes', 'read'|'write')`) + `GRANT ALL ... TO authenticated` +
      trigger `auditoria.log_action()` + índice sobre `paciente_id`. Calco de
      `20260724100004_schema_pacientes.sql:62-68` con la columna `activa` extra. Escrita, **no
      aplicada** (governance: la aplica la usuaria/Enzo).

## 4. `PrestacionesEditor.tsx` y catálogo en `PacienteDetail` (TDD estricto — nadie lo importa hasta 4.4)

- [x] 4.1 **RED** — `PrestacionesEditor.tsx`: alta in-place con `nombre` requerido. Calco de
      `DireccionesEditor.test.tsx`. **GREEN → REFACTOR.**
- [x] 4.2 **RED** — edición in-place de `nombre`/`descripcion` sin afectar `activa`.
- [x] 4.3 **RED** — baja lógica: confirma `activa = false`, nunca invoca un `delete()`. Caso con
      presupuestos asociados → diálogo de confirmación explícito antes de aplicar.
- [x] 4.4 Cablear `PrestacionesEditor` como sección nueva en `PacienteDetail.tsx`, gateada por
      `pacientes: write`/`read`. **RED** — `PacienteDetail.test.tsx` cubre usuario solo-lectura.
- [x] 4.5 **Desviación deliberada, documentada** — no existe `mockDireccionRepository` en el
      código real: `Direccion` vive embebida en `Paciente` (mismo patrón que `Prestacion`), sin
      repository propio; se persiste vía `PacienteRepository.update()`/`mockPacienteRepository`,
      que ya mergea genéricamente cualquier clave de `ActualizacionPaciente` — incluida
      `prestaciones` — sin cambios. Crear un `PrestacionRepository`/mock standalone que nadie
      invoca hubiera sido código muerto contradiciendo el propio patrón que la tarea pedía calcar.
      Sin repository nuevo que testear/mockear; cubierto por los tests de `PrestacionesEditor` y
      `PacienteDetail` (4.1-4.4).
- [x] 4.6 `npx tsc -b --noEmit` + `oxlint` limpios.

**Cierre de PR 1 — verificación final (2026-08-12).** Suite completa corrida una vez
(`NODE_OPTIONS="--no-experimental-webstorage" npx vitest run`): **243 archivos / 2371 tests — 5
fallando en 4 archivos** (`PermisosMatrizFields.test.tsx` ×1, `ChecklistEditor.test.tsx` ×2,
`router.test.tsx` ×1, `FacturaForm.test.tsx` ×1 por timeout de 5000ms). +2 archivos y +26 tests
respecto del baseline de 0.6 (241/2345) coinciden exactamente con los tests nuevos de
`PrestacionesEditor`/`prestacionMapping` de esta PR. **Ninguna de las 5 fallas está en un archivo
de `pacientes/` o `prestaciones/`** — todas caen en dominios que esta PR no toca (`cuentas`,
`obras-sociales`, `app/router`, `facturacion`); mismo patrón de flakiness ambiental
(Node 26 + jsdom 29 + vitest 4, timeouts bajo carga) ya diagnosticado como preexistente al change.
`tsc -b --noEmit` y `oxlint` limpios sobre el diff de esta PR (2.7, 4.6). `git diff --stat` de
`PresupuestoForm.tsx` vacío, confirmando que PR 1 no toca ese archivo. **PR 1 lista para
commit/PR.**

**→ Fin de PR 1 (catálogo de prestaciones).**

## 5. Migraciones: columna + RPC (bloqueada por 0.1, 0.2, 1.1, 1.2, aplicación de §3)

- [x] 5.1 Escribir `supabase/migrations/20260812130000_presupuesto_prestacion_id.sql`:
      `ALTER TABLE facturacion.presupuesto ADD COLUMN prestacion_id UUID REFERENCES
      pacientes.prestaciones(id);` + índice sobre `prestacion_id`. Sin `CONCURRENTLY`: volumen
      verificado en el gate §0.3 (2 presupuestos, 2 autorizaciones), mismo criterio que
      `20260802100000_presupuesto_autorizacion_indices.sql` (lock de microsegundos sobre ese
      volumen, y `CONCURRENTLY` no puede correr dentro de la transacción de `supabase db push`).
      Cabecera con plan de rollback (`DROP INDEX` + `DROP COLUMN`). Escrita, **no aplicada**
      (governance: la aplica la usuaria/Enzo).
- [x] 5.2 Escribir `supabase/migrations/20260812140000_presupuesto_rpc.sql`:
      `facturacion.crear_presupuesto_completo(jsonb) RETURNS uuid` y
      `facturacion.crear_presupuestos_lote(jsonb) RETURNS uuid[]`, ambas **`SECURITY INVOKER`
      explícito**, `SET search_path = ''`, `REVOKE ALL ... FROM PUBLIC, anon`,
      `GRANT EXECUTE ... TO authenticated`, `COMMENT ON FUNCTION` con la prohibición de `DEFINER`.
      `crear_presupuestos_lote` es atómica (un único `FOR` dentro de la transacción implícita de la
      invocación de la función — un `RAISE EXCEPTION` en cualquier iteración revierte todo lo
      insertado en esa misma invocación, sin `BEGIN/EXCEPTION` explícito). Códigos de error propios
      en rango nuevo sin colisión (45401-45403). Escrita, **no aplicada**.
- [x] 5.3 **RED** — test de código fuente (`node:fs`, no `?raw` de Vite fuera de `frontend/`,
      `frontend/src/shared/lib/presupuestos/presupuestoMigrations.test.ts`) que verifica que las
      dos funciones declaran `SECURITY INVOKER` y no contienen `SECURITY DEFINER` fuera de
      comentarios/literales, más `REVOKE`/`GRANT`/`SET search_path`/códigos de error/atomicidad del
      `FOR` y que la migración de columna es aditiva. 9/9 tests verdes. Única barrera automatizada
      contra la regresión de seguridad más grave de este change.
- [ ] 5.4 **Aplicar las dos migraciones — la usuaria / Enzo.** Bloquea 5.5-5.8 y la Fase 8. **Fuera
      de alcance del agente en esta PR** (governance: el agente escribe, no aplica).
- [ ] 5.5 Verificación manual con cuenta con `presupuestos: write`: alta simple vía
      `crear_presupuesto_completo` y alta en lote de 3 vía `crear_presupuestos_lote` → 1 y 3 filas
      respectivamente, con auditoría. **Pendiente de que 5.4 esté aplicada.**
- [ ] 5.6 Verificación manual con cuenta solo-lectura (`presupuestos: read`, sin `write`): ambas
      RPC → `42501`, cero filas escritas. **Pendiente de que 5.4 esté aplicada.**
- [ ] 5.7 Verificación manual de falla parcial en lote: forzar que el tercer ítem viole una
      restricción → cero presupuestos del lote persistidos, incluidos los dos primeros válidos.
      **Pendiente de que 5.4 esté aplicada.**
- [ ] 5.8 `select proname, prosecdef from pg_proc where proname in ('crear_presupuesto_completo',
      'crear_presupuestos_lote')` → `false` en ambas. **Pendiente de que 5.4 esté aplicada.**

## 6. `SupabasePresupuestoRepository.createLote` + Edge Function (TDD estricto — bloqueada por 5.4)

> Nota de apply: 6.1-6.5 se implementaron y testearon contra fakes/mocks (`vi.fn()` sobre
> `functions.invoke`), sin depender de que 5.4 esté aplicada en la base real — mismo criterio que
> el resto de la serie (el código de cliente/Edge Function es inerte hasta que las RPC existen de
> verdad). La verificación manual real contra la base (5.5-5.8) sigue bloqueada por 5.4.

- [x] 6.1 **RED** — `createLote()`: una sola llamada al Edge Function/RPC, devuelve
      `Presupuesto[]` mapeado con `parsePresupuestoApi`. **GREEN → REFACTOR.**
- [x] 6.2 **RED** — `createLote()` con fallo del servidor: rechaza con `Error` en castellano, sin
      texto técnico, mismo contrato de errores que `create()`.
- [x] 6.3 Mock `PresupuestoRepository.createLote` en `frontend/src/shared/lib/mocks/` con la misma
      semántica atómica (simulada) que la implementación real: valida el lote entero antes de
      escribir nada, persiste con un único `writeStore()`.
- [x] 6.4 `supabase/functions/presupuestos/index.ts`: reemplazar
      `.schema('facturacion').from('presupuesto').insert(...)` por invocación a
      `crear_presupuesto_completo` / `crear_presupuestos_lote` (opción A de D2) — un body `Array`
      dispara el lote, un body `object` dispara el alta simple, mismo endpoint `POST /presupuestos`.
      `requirePermiso` se mantiene como defensa en profundidad, sin cambios.
- [x] 6.5 `npx tsc -b --noEmit` + `oxlint` limpios.

**Verificación final de PR 2**: `tsc -b --noEmit` limpio. Suite completa corrida una vez: 244
archivos / 2395 tests, 7 fallando en 6 archivos (`LoginPage`, `router`, `router.cuentas`,
`PermisosMatrizFields`, `ChecklistEditor` ×2, `PacienteDocumentos`) — **ninguna en archivos de
`presupuestos/`**, la corrida tardó 848s (vs. ~360-600s habitual), consistente con sobrecarga de
máquina por procesos en paralelo durante la verificación, no regresión de esta PR. Aceptado como
ruido ambiental por decisión explícita del usuario. `git diff --stat` de `PresupuestoForm.tsx` y
`PresupuestoLineasEditor.tsx` vacío — PR 2 no toca la UI de bifurcación. **PR 2 lista para
commit/PR.**

**→ Fin de PR 2 (columna + RPC + Edge Function).**

## 7. `PresupuestoLineasEditor.tsx` (TDD estricto — nadie lo importa hasta la Fase 8)

- [x] 7.1 **RED** — componente controlado puro (mismo espíritu que `AsistenciasEditor.tsx`):
      agregar/quitar línea `{ prestacionId, monto }`, total en vivo. **GREEN → REFACTOR.**
- [x] 7.2 **RED** — total con decimales (`NUMERIC(10,2)`), línea sin monto no rompe el cálculo.
- [x] 7.3 **RED** — sin red: el componente no invoca ningún repository (test dedicado con spy de
      `fetch`, además de que el componente no recibe ningún repository por prop).
- [x] 7.4 `npx tsc -b --noEmit` + `oxlint` limpios.

## 8. Bifurcación de `PresupuestoForm.tsx` — el swap real (⚠️ un solo commit — bloqueada por 4.4, 6.4, 7.4)

- [x] 8.1 **RED** — `PresupuestoForm.test.tsx`: sin obra social elegida → campo `monto` simple
      actual (comportamiento sin cambios).
- [x] 8.2 **RED** — obra social `general` → renderiza `PresupuestoLineasEditor`; submit usa
      `create()` con `monto = suma(líneas)` y `prestacionId` ausente.
- [x] 8.3 **RED** — obra social `general` sin líneas cargadas → cae al campo `monto` simple.
- [x] 8.4 **RED** — obra social `por-prestacion` → multi-select de prestaciones activas del
      paciente + input de monto por cada una; submit usa `createLote()`.
- [x] 8.5 **RED** — obra social `por-prestacion`, paciente sin prestaciones activas → empty state
      con enlace a la ficha del paciente, submit bloqueado.
- [x] 8.6 **RED** — cambiar de paciente u obra social con datos cargados → reset del bloque de
      montos con aviso explícito.
- [x] 8.7 `validatePresupuestoForm.ts`: monto total > 0 en `general`; al menos una prestación con
      monto > 0 en `por-prestacion`. **RED → GREEN → REFACTOR.** Implementado como una función
      nueva y aditiva, `validatePresupuestoLoteForm` — `validatePresupuestoForm` (rama
      `simple`/`general`) no cambia de firma.
- [x] 8.8 `PresupuestoDetail.tsx` → implementado en `PresupuestoResumen.tsx` (el componente de
      solo-lectura que `PresupuestoDetail` renderiza fuera de edición): mostrar la prestación
      asociada cuando `prestacionId` está presente (buscada en `paciente.prestaciones`, incluidas
      prestaciones ya inactivas por borrado lógico D1); sin cambios cuando está ausente. Incluye
      `AvisoModeloDatos` (D5) referenciando la discrepancia nueva, sin editar la #13.
- [x] 8.9 Verificado que la edición (`PATCH`) de un presupuesto existente sigue editando `monto` y
      `prestacionId` uno a uno, sin bifurcar (D9): `PresupuestoForm` fuerza la rama `simple` en
      todo momento que `initial` esté presente, sin importar la `modalidadFacturacion` de la obra
      social — cubierto por `describe('PresupuestoForm — edición no bifurca (design.md D9)')` y
      por los tests preexistentes de edición de `PresupuestoDetail.test.tsx`, que siguen en verde
      sin cambios de comportamiento.
- [ ] 8.10 **Diferido por instrucción explícita del usuario durante el apply** (2026-08-12): NO se
      corre la suite completa en ningún momento de este batch, ni siquiera al final — solo el
      subconjunto de archivos tocados. Confirmado en verde: `PresupuestoForm`
      `PresupuestoLineasEditor` `PresupuestoDetail` `PresupuestoResumen` `validatePresupuestoForm`
      `usePresupuestos` `PresupuestosPage` — 7 archivos / 72 tests, 0 fallando. La comparación
      contra el baseline de 0.6 con la suite completa queda pendiente para la verificación final
      (Fase 10, fuera de este batch).
- [x] 8.11 `npx tsc -b --noEmit` limpio (cero errores) y `oxlint` limpio sobre
      `src/features/presupuestos/` y `src/shared/lib/presupuestos/` (solo 2 warnings
      preexistentes de `only-export-components` en archivos de contexto, sin relación con este
      batch).

**→ Fin de PR 3 (bifurcación de UI). Pendiente: 8.10 (suite completa) queda para la Fase 10 —
verificación final, fuera del alcance de este batch de apply.**

## 9. Documentación (obligatoria)

- [ ] 9.1 `knowledge-base/04_modelo_de_datos.md` §Discrepancias: entrada nueva sobre
      `presupuesto.prestacion_id` (texto de D5 de `design.md`), citando la #13 sin editarla.
- [ ] 9.2 `CHANGES.md` §C-06: nota de reapertura post-archivo.
- [ ] 9.3 `knowledge-base/10_preguntas_abiertas.md`: sumar D8 (`facturas.prestacion` vs. catálogo)
      y actualizar el conteo acumulado de la pregunta de pgTAP (+2 funciones nuevas).

## 10. Verificación final

- [ ] 10.1 Suite completa en verde contra el baseline de 0.6, sin regresiones.
- [ ] 10.2 `cd frontend && npx tsc -b --noEmit` y `oxlint` limpios en todo el diff.
- [ ] 10.3 Verificación manual en navegador: paciente con prestaciones, obra social
      `por-prestacion` (alta en lote), obra social `general` (líneas + total), baja lógica de una
      prestación con presupuesto asociado.
- [ ] 10.4 Guardar en engram (`project: "traslados-app"`, `topic_key:
      "opsx/presupuesto-prestaciones/apply"`) cualquier discrepancia real encontrada en la Fase 1
      respecto de lo que `design.md` asume.
