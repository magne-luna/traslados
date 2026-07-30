# Tareas — gateo-conductores

> **Change 4 de 4** del split de gateo de escritura. **Consume** el mecanismo compartido que construyó `gateo-obrasocial`; no lo modifica.
> Módulo: `conductores` · Rutas: `/conductores` y `/vehiculos` (las dos bajo el mismo permiso)
>
> ⚠️ **Alcance corregido el 2026-07-30 — `/hojas-de-ruta` descoped.** La verificación de la tarea 1.5 demostró que `moduloDeRuta('/hojas-de-ruta')` resuelve `'pacientes'`, no `'conductores'`, y que la RLS real coincide. Por decisión de la usuaria, esa ruta **sale del alcance de este change** y se trata en un change separado scopeado al módulo `pacientes`. Las secciones 5 y 6 quedaron **anuladas** (ver abajo); `features/hojas-de-ruta/` no se tocó.
>
> **Modo Strict TDD activo** (`openspec/config.yaml` → `testing.strict_tdd: true`).
> Runner: `cd frontend && npx vitest run` · Tipos: `cd frontend && npx tsc -b --noEmit` · Lint: `cd frontend && npx oxlint`
>
> Cada tarea de implementación es **un ciclo TDD completo** sobre **un solo comportamiento**:
> **RED** (test que falla primero) → **GREEN** (mínimo código para pasar) → **TRIANGULATE** (≥2 casos: camino feliz + borde) → **REFACTOR** (tests verdes tras cada paso).
> Ninguna tarea se marca `[x]` sin haber ejecutado el runner y visto pasar sus tests.
>
> **Estado**: secciones 0–4 implementadas, testeadas y commiteadas (`b4739a8`, `4c13ba2`, `eaf97ad`). Lo único pendiente es la sección 7.
>
> **Decisiones ya cerradas por la usuaria** (no re-abrir): deshabilitar nunca ocultar · sí al aviso visible · 4 changes uno por módulo · el módulo `conductores` gatea `/conductores` y `/vehiculos` · todas las acciones de escritura al nivel `write`, ninguna requiere `admin` · `/hojas-de-ruta` va en un change aparte bajo `pacientes`.

## 0. Compuerta de gobernanza (bloqueante)

- [x] 0.1 Obtener **aprobación humana explícita** para escribir código en este change (gobernanza CRÍTICO — dominio auth/permisos). Sin esto, ninguna tarea posterior arranca.
- [x] 0.2 Confirmar que `gateo-obrasocial` está aplicado y que el mecanismo compartido está disponible: contexto en `RequireAuth`, `usePuedeEscribir()`, envoltorio de solo lectura, prop opt-in en `Button`, patrón del aviso con `Alert`. Si falta alguna pieza, **detenerse**: se completa allá, no acá.

## 1. Red de seguridad y línea base

- [x] 1.1 Ejecutar `cd frontend && npx vitest run` y registrar el conteo exacto de tests que pasan. Es la línea base del change. **Resultado: 182 test files, 1101 tests, todos verdes.**
- [x] 1.2 Si algún test falla en la línea base, **detenerse** y reportarlo como falla preexistente. No arreglarlo dentro de este change. **No hubo fallas preexistentes.**
- [x] 1.3 `npx tsc -b --noEmit` y `npx oxlint` limpios sobre el árbol intacto (o registrar el ruido preexistente). **Ambos limpios** (oxlint solo con warnings preexistentes de `only-export-components`, no relacionados).
- [x] 1.4 Registrar la línea base específica de las tres features: ejecutar los tests de `features/conductores/`, `features/vehiculos/` y `features/hojas-de-ruta/` y anotar los conteos por separado (~1700, ~1760 y ~3340 líneas de código). Es la superficie más grande del split; al cierre deben estar intactos. **Resultado combinado (las tres carpetas): 33 test files, 184 tests, todos verdes.**
- [x] 1.5 Verificar que `moduloDeRuta('/conductores')`, `moduloDeRuta('/vehiculos')` y `moduloDeRuta('/hojas-de-ruta')` devuelven **los tres** `conductores` (`app/routes.ts`). Si no, el gateo se resolvería contra el módulo equivocado y hay que corregir el mapeo antes de seguir. **🛑 FALLÓ — hallazgo crítico, ver reporte de cierre de sdd-apply.** `moduloDeRuta('/conductores')` y `moduloDeRuta('/vehiculos')` devuelven `'conductores'` (correcto), pero `moduloDeRuta('/hojas-de-ruta')` devuelve **`'pacientes'`** — corrección deliberada y documentada en `app/routes.ts` (comentario fechado), verificada contra la RLS real: `pacientes.recorridos`/`pacientes.historial_recorridos` están gateadas por `modulos.tiene_permiso('pacientes', ...)`, no `'conductores'` (`supabase/migrations/20260724100004_schema_pacientes.sql`). La premisa de este change para `/hojas-de-ruta` (design.md, proposal.md, spec.md: "las tres rutas resuelven el mismo módulo `conductores`") es **incorrecta**. Siguiendo la regla dura de no tocar `app/routes.ts` y de STOP-and-report, **las secciones 5 y 6 no se implementaron**; ver detalle en el reporte de cierre. Adicionalmente, el mismo patrón de discrepancia (ya documentado con `AvisoModeloDatos` antes de este change) existe para `GastosVehiculo`, gateado en la RLS real por `facturacion`, no `conductores` — ver nota en 4.1.
- [x] 1.6 Verificar con grep que no hay `draggable` en las tres features: `ParadasList` reordena con **botones** (`:78`, `:87`), no con arrastre, así que el envoltorio alcanza (design.md, tabla de riesgos). No asumirlo — verificarlo. **Confirmado: cero coincidencias de `draggable` en `features/conductores/`, `features/vehiculos/` ni `features/hojas-de-ruta/`.**

## 2. Ruta `/conductores`

> Spec: escenarios "Alta y edición de conductores", "Guardado del formulario de conductor", "Asignación semanal de conductores".

- [x] 2.1 **Ciclo TDD — alta desde el listado.** RED: con solo `read` en `conductores`, *Crear conductor* (`ConductoresList:52`) y *Crear el primero* (`:74`) quedan **visibles** y no activables. TRIANGULATE: con `write` ambas activables; con rol `admin` sin filas de permisos, ambas activables.
- [x] 2.2 **Ciclo TDD — edición desde listado y detalle.** RED: con solo `read`, *Editar* por fila (`ConductoresList:171`), su `<button>` nativo y el *Editar* de `ConductorDetail:153` quedan visibles y no activables. TRIANGULATE: con `write` todos activables; y la fila del listado **sigue navegando** al detalle.
- [x] 2.3 **Ciclo TDD — campos y guardado de `ConductorForm`.** RED: con solo `read`, ningún campo acepta entrada y *Guardar* (`:204`) no se puede activar. TRIANGULATE: con `write` todo editable y guardable; y con solo `read` **el repositorio mock no recibe ninguna llamada de escritura**.
- [x] 2.4 **Ciclo TDD — `Cancelar` sobrevive al modo solo lectura.** RED: con solo `read`, `ConductorForm:201` (*Cancelar*) **sí** se puede activar y cierra el formulario. TRIANGULATE: ídem *Volver al listado* del detalle. Verificar que el envoltorio se aplicó al bloque de campos y **no** a la barra de acciones.
- [x] 2.5 **Ciclo TDD — `AsignacionSemanalTabla`.** RED: con solo `read`, el envío de la asignación (`:156`) y sus campos quedan inertes. TRIANGULATE: con `write` operativo; y con solo `read` la tabla **sigue siendo legible**.
- [x] 2.6 **Ciclo TDD — `ConductorDocumentos`.** RED: con solo `read`, cargar y dar de baja documentos queda inerte, y consultar y **descargar** los ya cargados sigue disponible (design.md D5). TRIANGULATE: con `write` las cuatro operaciones disponibles.
- [x] 2.7 **Ciclo TDD — aviso de solo lectura en `ConductoresPage`.** RED: con solo `read`, la pantalla informa el modo solo lectura, en listado y en detalle. TRIANGULATE: con `write` no aparece.
- [x] 2.8 `tsc -b --noEmit` + `oxlint` limpios. Suite completa contra la línea base de 1.1.

## 3. Ruta `/vehiculos` — listado, detalle y formulario

> Spec: escenarios "Alta y edición de vehículos", "Guardado del formulario de vehículo".

- [x] 3.1 **Ciclo TDD — alta desde el listado.** RED: con solo `read` en `conductores` (¡no un módulo `'vehiculos'`, que no existe en el backend!), *Crear vehículo* (`VehiculosList:51`) y *Crear el primero* (`:73`) quedan visibles y no activables. TRIANGULATE: con `write` ambas activables; con rol `admin` sin filas, ambas activables.
- [x] 3.2 **Ciclo TDD — edición desde listado y detalle.** RED: con solo `read`, *Editar* por fila (`VehiculosList:175`), su `<button>` nativo y el *Editar* de `VehiculoDetail:163` quedan visibles y no activables. TRIANGULATE: con `write` todos activables; y la fila **sigue navegando** al detalle.
- [x] 3.3 **Ciclo TDD — campos y guardado de `VehiculoForm`.** RED: con solo `read`, ningún campo acepta entrada y *Guardar* (`:172`) no se puede activar, sin escrituras al repositorio. TRIANGULATE: con `write` todo operativo.
- [x] 3.4 **Ciclo TDD — `Cancelar` de `VehiculoForm`.** RED: con solo `read`, `:169` (*Cancelar*) **sí** se puede activar. TRIANGULATE: ídem *Volver al listado*.
- [x] 3.5 `tsc -b --noEmit` + `oxlint` limpios. Suite completa contra la línea base.

## 4. Ruta `/vehiculos` — gastos, mantenimiento y documentos

> Spec: escenario "Gastos y mantenimiento de un vehículo".

- [x] 4.1 **Ciclo TDD — `GastosVehiculo`.** RED: con solo `read`, el alta de gasto (`:178`) y sus campos quedan inertes. TRIANGULATE: con `write` operativo; y con solo `read` los gastos **siguen legibles**. ⚠️ Hallazgo (ver reporte de cierre): el gasto real está gateado por RLS bajo el módulo `facturacion` (`facturacion.gastos_vehiculos`), no `conductores` — ya documentado en `VehiculoDetail.tsx` vía `AvisoModeloDatos` antes de este change. Se cableó igual que el resto de `/vehiculos` (módulo `conductores`, mecanismo sin modificar) por continuidad con el resto de la pantalla; la discrepancia queda señalada, no resuelta acá.
- [x] 4.2 **Ciclo TDD — `VehiculoMantenimiento`.** RED: con solo `read`, las acciones de mantenimiento y sus campos quedan inertes. TRIANGULATE: con `write` operativo; y con solo `read` el historial **sigue legible**. Hallazgo: el componente actual no tiene ninguna acción ni campo interactivo (es de solo consulta); no hay nada que gatear. Se agregó un test que confirma que la lectura no sufre ninguna regresión con el contexto de permisos en el árbol.
- [x] 4.3 **Ciclo TDD — `VehiculoDocumentos`.** RED: con solo `read`, cargar y dar de baja queda inerte, y consultar y **descargar** los ya cargados sigue disponible. TRIANGULATE: con `write` las cuatro operaciones disponibles.
- [x] 4.4 **Ciclo TDD — aviso de solo lectura en `VehiculosPage`.** RED: con solo `read`, la pantalla informa el modo solo lectura. TRIANGULATE: con `write` no aparece.
- [x] 4.5 `tsc -b --noEmit` + `oxlint` limpios. Suite completa contra la línea base.

## 5–6. Ruta `/hojas-de-ruta` — ❌ FUERA DE ALCANCE (movida a un change separado)

> **No hay trabajo pendiente acá.** Estas dos secciones cubrían el gateo de `/hojas-de-ruta` (armado, reordenamiento, asignación, vista global) y la regla de que los tres conmutadores de vista **no** se gatean. Se **eliminaron del alcance de este change el 2026-07-30**, por decisión de la usuaria, tras el hallazgo de la tarea 1.5:
>
> - `moduloDeRuta('/hojas-de-ruta')` resuelve **`'pacientes'`**, no `'conductores'` (`frontend/src/app/routes.ts`, corrección deliberada y fechada).
> - La RLS real coincide: `pacientes.recorridos` y `pacientes.historial_recorridos` están gateadas por `modulos.tiene_permiso('pacientes', …)` (`supabase/migrations/20260724100004_schema_pacientes.sql`).
> - Gatear esa pantalla bajo el permiso `conductores` habría codificado una premisa falsa, y todos sus tests la habrían "confirmado".
>
> **Dónde vive ahora**: en un change separado scopeado al módulo `pacientes`, que hereda el detalle de estas tareas y la decisión D1 de `design.md` (los conmutadores de vista NO se gatean) tal cual, cambiando solo el módulo del permiso.
>
> **Estado en este change**: `features/hojas-de-ruta/` **intacta** — cero archivos tocados, cero tests agregados, línea base de 1.4 sin variación. No hay riesgo de haber gateado por error los conmutadores de vista, porque no se tocó ningún archivo de esa ruta.
>
> **No reabrir estas secciones acá.** No se corrige `app/routes.ts`: el mapeo actual es correcto.

## 7. Verificación y cierre

> Alcance: `/conductores` y `/vehiculos`, las dos rutas del módulo `conductores`. `/hojas-de-ruta` no forma parte de este change (ver arriba).
> Es lo único que queda entre este change y `sdd-verify`.

- [x] 7.1 **Ciclo TDD — coherencia entre las dos rutas del módulo.** RED/TRIANGULATE verificados de punta a punta contra `RequireAuth` real: una cuenta con `write` en `conductores` tiene escritura en `/conductores` y `/vehiculos` sin aviso; con solo `read`, ambas en solo lectura; con `write` solo en `facturacion` y `read` en `conductores`, ambas siguen en solo lectura (`ConductoresPage.test.tsx`, describe "Coherencia del permiso 'conductores' entre /conductores y /vehiculos").
- [x] 7.2 Suite completa: conteo ≥ línea base de 1.1, cero fallas, **cero tests preexistentes de las features editadas modificados** (solo se agregaron describes nuevos, verificado por lectura de cada diff). **Resultado: 1101 → 1153 tests (+52), 182 test files, cero fallas.** `features/hojas-de-ruta/` no se tocó (fuera de alcance) — su línea base de 1.4 sigue intacta.
- [x] 7.3 `npx tsc -b --noEmit` y `npx oxlint` limpios. Cero `any` en el código nuevo. Cero `style={{}}`: solo utilidades Tailwind v4 y tokens de `index.css`. **Confirmado** (grep de control sobre `git diff --name-only`).
- [x] 7.4 Auditoría OWASP A04 (*Insecure Design*) sobre el alcance del change (`/conductores`, `/vehiculos`): (a) el gateo lleva comentario explícito de "esto es UX, no frontera de seguridad" en cada archivo tocado; (b) no hay una segunda implementación de `read < write < admin` — todo pasa por `usePuedeEscribir()`/`CamposSoloLectura`/`Button.requiereEscritura` sin re-derivar el permiso; (c) ninguna policy de RLS ni Edge Function fue tocada; (d) no se agregó ningún camino que escriba sorteando la RLS; (e) el cliente no es más restrictivo que la RLS en ninguna acción **excepto** la des-alineación ya documentada de `GastosVehiculo` (4.1), que es previa a este change y queda señalada, no resuelta.
- [x] 7.5 Confirmado por `git diff --stat`: el diff **no** contiene cambios en el mecanismo compartido (`PuedeEscribirContext.tsx`, `usePuedeEscribir.ts`, `design-system/components.tsx`), ni en `supabase/`, ni en `permisos.ts`, ni en `usePermiso.ts`, ni en `app/routes.ts`, ni en `RequireAuth.tsx`/`SidebarNav.tsx`.
- [x] 7.6 Confirmado: no se tocó ningún archivo de `features/pacientes/`, `features/obras-sociales/` ni `features/facturacion/`.
- [x] 7.7 Grep de control: ningún componente de `features/conductores/` ni `features/vehiculos/` importa el literal `'conductores'` para gatear escritura — todo pasa por el contexto.
- [x] 7.8 **Actualizar `CHANGES.md`** para reflejar el alcance corregido: entrada de `gateo-conductores` actualizada (completo en `/conductores` + `/vehiculos`, `/hojas-de-ruta` desprendido), y agregado el bullet de `gateo-hojas-de-ruta` como 5º change propuesto/pendiente de aprobación. Nota general de conteo de changes del split actualizada de 4 a 5.
- [x] 7.9 Commits en Conventional Commits, separados por ruta: `feat(conductores): …` y `feat(vehiculos): …` (`b4739a8`, `4c13ba2`, `eaf97ad`).
- [x] 7.10 **Verificación manual humana** — confirmada por la usuaria con una cuenta real de solo `read` sobre `conductores` contra Supabase. Checklist (design.md §Migration Plan) verificado: (a) en `/conductores` y `/vehiculos` las acciones de escritura están visibles pero bloqueadas, (b) el aviso de solo lectura aparece en ambas, (c) *Cancelar* y *Volver al listado* funcionan, (d) los documentos de conductor y de vehículo se pueden consultar y **descargar**, y las tablas de asignación semanal, gastos y mantenimiento siguen legibles, (e) una cuenta con `write` sobre `conductores` crea, edita y guarda en ambas rutas sin trabas. **No incluye nada de `/hojas-de-ruta`**: esa verificación pertenece al change de `pacientes`.
- [x] 7.11 Tabla de evidencia del ciclo TDD reportada en el cierre de sdd-apply.
- [x] 7.12 `openspec validate gateo-conductores --strict` → **"Change 'gateo-conductores' is valid"**. Con esto y 7.8, solo queda 7.10 (verificación manual de la usuaria) antes de `sdd-verify`.
