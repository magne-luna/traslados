# Tareas — gateo-conductores

> **Change 4 de 4** del split de gateo de escritura. **Consume** el mecanismo compartido que construyó `gateo-obrasocial`; no lo modifica.
> Módulo: `conductores` · Rutas: `/conductores`, `/vehiculos` **y** `/hojas-de-ruta` (las tres bajo el mismo permiso, tal cual `seed_modulos.sql`)
>
> **Modo Strict TDD activo** (`openspec/config.yaml` → `testing.strict_tdd: true`).
> Runner: `cd frontend && npx vitest run` · Tipos: `cd frontend && npx tsc -b --noEmit` · Lint: `cd frontend && npx oxlint`
>
> Cada tarea de implementación es **un ciclo TDD completo** sobre **un solo comportamiento**:
> **RED** (test que falla primero) → **GREEN** (mínimo código para pasar) → **TRIANGULATE** (≥2 casos: camino feliz + borde) → **REFACTOR** (tests verdes tras cada paso).
> Ninguna tarea se marca `[x]` sin haber ejecutado el runner y visto pasar sus tests.
>
> ⚠️ **El riesgo más específico de todo el split vive en la sección 6**: los tres conmutadores de vista de `HojaDeRutaPage` **NO se gatean**. Leer design.md D1 antes de tocar esa pantalla.
>
> **Decisiones ya cerradas por la usuaria** (no re-abrir): deshabilitar nunca ocultar · sí al aviso visible · 4 changes uno por módulo · el módulo `conductores` gatea **las tres** rutas · todas las acciones de escritura al nivel `write`, ninguna requiere `admin`.

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

## 5. Ruta `/hojas-de-ruta` — armado

> 🛑 **BLOQUEADA — no implementada.** Ver hallazgo de la tarea 1.5: `moduloDeRuta('/hojas-de-ruta')` resuelve `'pacientes'`, no `'conductores'`. Gatear esta sección bajo una sesión con permiso `conductores` (como asumen los ciclos TDD de abajo) codificaría una premisa falsa. Requiere decisión humana antes de retomar — ver reporte de cierre de sdd-apply. Ninguna tarea de esta sección se marcó `[x]`; ninguna se intentó implementar, para no dejar código gateado contra el módulo equivocado.
>
> Spec: escenarios "Armado de una hoja de ruta", "Reordenamiento de paradas", "Asignación de vehículo y conductor a un recorrido", "Movimiento de filas en la vista global".
> Se llega acá con el patrón ya rodado en 5 pantallas (design.md D3): cualquier fricción es atribuible a esta pantalla, no al mecanismo.

- [ ] 5.1 **Ciclo TDD — alta de hoja.** RED: con solo `read`, *Crear hoja* (`HojaDeRutaPage:161`) queda visible y no activable. TRIANGULATE: con `write` activable; con rol `admin` sin filas, activable.
- [ ] 5.2 **Ciclo TDD — `NuevoRecorridoForm`.** RED: con solo `read`, el alta de recorrido (`:212`) y **todos** los campos de sus tres bloques (`PacienteTramoCampos`, `SelectorPaciente`, `RecorridoVehiculoConductor`) quedan inertes con **una sola** inserción del envoltorio (design.md D4). TRIANGULATE: con `write` todo operativo; verificar que los tres archivos de campos **no cambiaron ni una línea** ni recibieron props nuevas.
- [ ] 5.3 **Ciclo TDD — `RecorridoCard`.** RED: con solo `read`, *Sugerir orden* (`:144`), aceptar edición (`:147`) y entrar a editar (`:152`) quedan visibles y no activables. TRIANGULATE: con `write` los tres activables; con rol `admin` sin filas, los tres activables.
- [ ] 5.4 **Ciclo TDD — `ParadasList`.** RED: con solo `read`, los botones de reordenar (`:78`, `:87`) y el `<button>` nativo quedan inertes. TRIANGULATE: con `write` operativos; y con solo `read` las paradas **siguen legibles**. Verificar que no queda ningún camino de reordenamiento vivo (no hay arrastre acá — confirmado en 1.6).
- [ ] 5.5 **Ciclo TDD — `AsignacionPanel`.** RED: con solo `read`, la asignación (`:129`) y sus campos quedan inertes. TRIANGULATE: con `write` operativo; y con solo `read` la asignación actual **sigue legible**.
- [ ] 5.6 **Ciclo TDD — `VistaGlobalHojaDeRuta`.** RED: con solo `read`, mover filas (`:137`) queda inerte. TRIANGULATE: con `write` operativo; y con solo `read` la vista global **sigue legible**.
- [ ] 5.7 `tsc -b --noEmit` + `oxlint` limpios. Suite completa contra la línea base.

## 6. Ruta `/hojas-de-ruta` — lo que NO se gatea (design.md D1)

> 🛑 **BLOQUEADA — no implementada**, mismo motivo que la sección 5. `HojaDeRutaPage` **no se tocó**: no hay riesgo de haber gateado por error los tres conmutadores de vista, porque no se tocó ningún archivo de esta ruta.
>
> Spec: escenarios "Conmutadores de vista de hojas de ruta operativos sin permiso de escritura", "Vista imprimible de una hoja de ruta".
> ⚠️ **Sección crítica.** Gatear esto es la regresión más costosa de todo el split: encerraría a una cuenta con `read` en la vista de armado, sin poder ver datos que su permiso **sí** la autoriza a ver.

- [ ] 6.1 **Ciclo TDD — los tres conmutadores de vista funcionan sin `write`.** RED: con solo `read` en `conductores`, los conmutadores *armado* (`HojaDeRutaPage:131`), *global* (`:135`) e *imprimir* (`:139`) **sí** se pueden activar y la vista cambia en los tres casos. TRIANGULATE: con `write` también funcionan; y con solo `read` **las tres vistas se renderizan completas** al conmutar.
- [ ] 6.2 **Ciclo TDD — la vista imprimible no se bloquea.** RED: con solo `read`, `HojaDeRutaImprimible` se renderiza completa y es utilizable (design.md D5). TRIANGULATE: con `write` ídem; y verificar que el archivo **no cambió ni una línea**.
- [ ] 6.3 **Ciclo TDD — vistas de solo lectura intactas.** RED: con solo `read`, `RecorridoMapa`, `RecorridoStat` y `RequisitosPaciente` se renderizan completos. TRIANGULATE: con `write` ídem; y verificar que los tres archivos **no cambiaron ni una línea**.
- [ ] 6.4 **Ciclo TDD — aviso de solo lectura visible en las tres vistas.** RED: con solo `read`, el aviso de `HojaDeRutaPage` sigue visible al conmutar entre armado, global e imprimir — la cuenta sigue en modo solo lectura (design.md D6). TRIANGULATE: con `write` no aparece en ninguna de las tres.
- [ ] 6.5 Revisión manual del diff de `HojaDeRutaPage`: confirmar que los tres `Button` de conmutación **no** llevan la prop de escritura y que ninguno quedó dentro de un envoltorio de solo lectura.
- [ ] 6.6 `tsc -b --noEmit` + `oxlint` limpios. Suite completa contra la línea base.

## 7. Verificación y cierre

> ⚠️ Alcance reducido: 5 y 6 quedaron bloqueadas (ver arriba). Las tareas de esta sección se completaron con alcance limitado a `/conductores` y `/vehiculos`, explícito en cada una.

- [x] 7.1 **Ciclo TDD — coherencia entre las tres rutas.** ⚠️ **Alcance reducido a `/conductores` y `/vehiculos`** (las dos únicas que de verdad comparten módulo `conductores`; `/hojas-de-ruta` excluida por el hallazgo de 1.5 — afirmar coherencia ahí sería una aserción falsa). RED/TRIANGULATE verificados de punta a punta contra `RequireAuth` real: una cuenta con `write` en `conductores` tiene escritura en ambas sin aviso; con solo `read`, ambas en solo lectura; con `write` solo en `facturacion` y `read` en `conductores`, ambas siguen en solo lectura (`ConductoresPage.test.tsx`, describe "Coherencia del permiso 'conductores' entre /conductores y /vehiculos").
- [x] 7.2 Suite completa: conteo ≥ línea base de 1.1, cero fallas, **cero tests preexistentes de las features editadas modificados** (solo se agregaron describes nuevos, verificado por lectura de cada diff). **Resultado: 1101 → 1153 tests (+52), 182 test files, cero fallas.** `features/hojas-de-ruta/` no se tocó — su línea base de 1.4 sigue intacta.
- [x] 7.3 `npx tsc -b --noEmit` y `npx oxlint` limpios. Cero `any` en el código nuevo. Cero `style={{}}`: solo utilidades Tailwind v4 y tokens de `index.css`. **Confirmado** (grep de control sobre `git diff --name-only`).
- [x] 7.4 Auditoría OWASP A04 (*Insecure Design*), sobre lo efectivamente implementado (`/conductores`, `/vehiculos`): (a) el gateo lleva comentario explícito de "esto es UX, no frontera de seguridad" en cada archivo tocado; (b) no hay una segunda implementación de `read < write < admin` — todo pasa por `usePuedeEscribir()`/`CamposSoloLectura`/`Button.requiereEscritura` sin re-derivar el permiso; (c) ninguna policy de RLS ni Edge Function fue tocada; (d) no se agregó ningún camino que escriba sorteando la RLS; (e) el cliente no es más restrictivo que la RLS en ninguna acción **excepto** el hallazgo ya señalado en `GastosVehiculo` (4.1) y el trabajo no implementado de `/hojas-de-ruta` — ninguno de los dos hace al cliente *más* restrictivo que el servidor, ambos son des-alineaciones ya documentadas, no nuevas.
- [x] 7.5 Confirmado por `git diff --stat`: el diff **no** contiene cambios en el mecanismo compartido (`PuedeEscribirContext.tsx`, `usePuedeEscribir.ts`, `design-system/components.tsx`), ni en `supabase/`, ni en `permisos.ts`, ni en `usePermiso.ts`, ni en `app/routes.ts`, ni en `RequireAuth.tsx`/`SidebarNav.tsx`.
- [x] 7.6 Confirmado: no se tocó ningún archivo de `features/pacientes/`, `features/obras-sociales/` ni `features/facturacion/`.
- [x] 7.7 Grep de control: ningún componente de `features/conductores/` ni `features/vehiculos/` importa el literal `'conductores'` para gatear escritura — todo pasa por el contexto. (`features/hojas-de-ruta/` no se tocó, por lo tanto tampoco aplica.)
- [x] 7.8 `CHANGES.md` actualizado: entrada de `gateo-conductores` agregada bajo la nota de gateo de escritura de C-02, marcada 🟡 implementada parcialmente / bloqueada, con el detalle del hallazgo. **No** se cerró la nota general de los 4 changes como completa (queda `gateo-facturacion` sin aplicar y esta misma con `/hojas-de-ruta` pendiente).
- [x] 7.9 Commits en Conventional Commits, separados por ruta: `feat(conductores): …` y `feat(vehiculos): …`. No hay commit `feat(hojas-de-ruta)` porque esa ruta no se tocó.
- [ ] 7.10 **Verificación manual humana** — **pendiente**, no intentada ni simulada. Requiere una cuenta real de solo `read` sobre `conductores` contra Supabase y, además, que se resuelva antes la decisión humana sobre `/hojas-de-ruta` (5/6) para que el punto (d) del checklist (conmutadores de vista) tenga sentido verificar.
- [x] 7.11 Tabla de evidencia del ciclo TDD reportada en el cierre de sdd-apply.
