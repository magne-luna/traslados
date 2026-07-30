# Tareas — gateo-hojas-de-ruta

> **Rescate del alcance descopado de `gateo-conductores`.** `/hojas-de-ruta` pertenece al módulo **`pacientes`**, no a `conductores` (`app/routes.ts:59-69`, RLS en `20260724100004_schema_pacientes.sql:144-148`).
> **Consume** el mecanismo compartido que construyó `gateo-obrasocial`; no lo modifica.
> Módulo: `pacientes` · Ruta: `/hojas-de-ruta` · Comparte permiso con `/pacientes` (ya cableada por `gateo-pacientes`).
>
> **Modo Strict TDD activo** (`openspec/config.yaml` → `testing.strict_tdd: true`).
> Runner: `cd frontend && npx vitest run` · Tipos: `cd frontend && npx tsc -b --noEmit` · Lint: `cd frontend && npx oxlint`
>
> Cada tarea de implementación es **un ciclo TDD completo** sobre **un solo comportamiento**:
> **RED** (test que falla primero) → **GREEN** (mínimo código para pasar) → **TRIANGULATE** (≥2 casos: camino feliz + borde) → **REFACTOR** (tests verdes tras cada paso).
> Ninguna tarea se marca `[x]` sin haber ejecutado el runner y visto pasar sus tests.
>
> ⚠️ **El riesgo más costoso de todo el trabajo de gateo vive en la sección 6**: los tres conmutadores de vista y el selector de fecha de `HojaDeRutaPage` **NO se gatean**. Leer `design.md` D1 y D2 antes de tocar esa pantalla.
> ⚠️ **El riesgo técnico más sutil vive en la sección 4**: tres caminos de escritura no pasan por un `Button` (notas en `onBlur`, vehículo y conductor en `onChange`). Leer `design.md` D5.
>
> **Decisiones ya cerradas por la usuaria** (no re-abrir): deshabilitar nunca ocultar · sí al aviso visible · todas las acciones de escritura al nivel `write`, ninguna requiere `admin` · `/hojas-de-ruta` se gatea con el módulo `pacientes` y se atiende en este change propio.

## 0. Compuertas de gobernanza (bloqueantes)

- [x] 0.1 Obtener **aprobación humana explícita** para escribir código en este change (gobernanza CRÍTICO — dominio auth/permisos). Aprobación explícita obtenida de la usuaria el 2026-07-30.
- [x] 0.2 Confirmar que el **mecanismo compartido** de `gateo-obrasocial` está disponible y **se consume sin modificarlo**: `PuedeEscribirContext` poblado por `RequireAuth`, `usePuedeEscribir()` (`shared/auth/usePuedeEscribir.ts`), `CamposSoloLectura` y `AvisoSoloLectura` (`design-system/components.tsx`), y la prop opt-in `requiereEscritura` de `Button`. **Verificado**: los cinco existen en el árbol tal cual se esperaba.
- [x] 0.3 Confirmar que el **descope de `/hojas-de-ruta` en `gateo-conductores`** está hecho: su `proposal.md`, `design.md`, `specs/` y `tasks.md` ya no reclaman esta pantalla. **Verificado** contra el change ya archivado en `openspec/changes/archive/2026-07-30-gateo-conductores/`.

## 1. Red de seguridad, línea base y premisa del módulo

- [x] 1.1 **Verificación bloqueante del módulo.** Confirmar que `moduloDeRuta('/hojas-de-ruta')` devuelve **`'pacientes'`** (`frontend/src/app/routes.ts`) y que la RLS lo respalda: `Write recorridos` y `Write historial_recorridos` usan `modulos.tiene_permiso('pacientes', 'write')` (`supabase/migrations/20260724100004_schema_pacientes.sql`). **Si no coinciden, detenerse y reportar**: es exactamente el fallo que originó este change. **No tocar `app/routes.ts` bajo ninguna circunstancia.** **Verificado**: `routes.ts:64-69` declara `modulo: 'pacientes'` con comentario explícito de la corrección; `20260724100004_schema_pacientes.sql:144-147` usa `tiene_permiso('pacientes', ...)` en `Write recorridos` y `Write historial_recorridos`. Coinciden.
- [x] 1.2 Ejecutar `cd frontend && npx vitest run` y registrar el conteo exacto de tests que pasan. Es la línea base del change. **Línea base: 182 archivos de test, 1153 tests, todos pasan.**
- [x] 1.3 Si algún test falla en la línea base, **detenerse** y reportarlo como falla preexistente. No arreglarlo dentro de este change. **No aplica: cero fallas en la línea base.**
- [x] 1.4 `npx tsc -b --noEmit` y `npx oxlint` limpios sobre el árbol intacto (o registrar el ruido preexistente). **`tsc -b --noEmit`: exit 0, cero errores. `oxlint`: 14 warnings preexistentes (todas `react(only-export-components)`, incluida una en `HojaDeRutaRepositoryContext.tsx` ya existente antes de este change), cero errors.**
- [x] 1.5 Registrar la línea base específica de la feature: ejecutar los tests de `frontend/src/features/hojas-de-ruta/` y anotar el conteo por separado (6 archivos de test, ~1500 líneas de componentes). Al cierre deben estar **intactos**: solo se agregan `describe` nuevos, no se edita ninguno existente. **Línea base de la feature: 11 archivos de test, 67 tests, todos pasan** (corregido de la estimación de 6 archivos — son 11: incluye `HojaDeRutaImprimible`, `HojaDeRutaRepositoryContext`, `HojaDeRutaRoute`, `RecorridoMapa`, `useHojasDeRuta` además de los citados en tasks.md).
- [x] 1.6 Verificar con grep que **no hay `draggable`** en `features/hojas-de-ruta/`: `ParadasList` reordena con botones (`:78`, `:87`), no con arrastre, así que el envoltorio alcanza (`design.md` D6). No asumirlo — verificarlo. **Verificado: `grep -rn draggable frontend/src/features/hojas-de-ruta/` no devuelve resultados.**
- [x] 1.7 Verificar el fixture de paradas disponible: los ciclos de `ParadasList` necesitan un recorrido con **al menos tres paradas** para poder afirmar sobre una parada **intermedia** (`design.md` D6 — con la primera o la última, `disabled` ya es `true` por el borde de la lista y el test pasaría sin gateo). Si el fixture no alcanza, construirlo dentro del test, sin tocar `hojasDeRutaFixture.ts`. **Verificado: `hojasDeRutaFixture.ts` y `RecorridoCard.test.tsx` (`buildRecorrido()`) solo tienen 2 paradas. Se construye un recorrido de 3 paradas inline en los tests nuevos de la sección 5, sin tocar ningún fixture existente.**

## 2. Alta de la hoja del día

> Spec: escenario "Alta de la hoja del día".

- [x] 2.1 **Ciclo TDD — crear la hoja del día.** RED: con solo `read` sobre `pacientes`, *Crear hoja de ruta para este día* (`HojaDeRutaPage:161`) queda **visible** y no activable, y el repositorio de hojas de ruta **no recibe ninguna llamada**. TRIANGULATE: con `write` es activable y crea la hoja; con rol `admin` sin filas en la matriz de permisos, también es activable. Verificar que el mensaje "No hay hoja de ruta cargada para el …" sigue legible en los tres casos. **Implementado**: `Button requiereEscritura` en `HojaDeRutaPage.tsx`. Tests en `HojaDeRutaPage.test.tsx` describe "gateo de escritura (alta de la hoja del día)", 3 tests, los 8 del archivo pasan.
- [x] 2.2 `tsc -b --noEmit` + `oxlint` limpios. Suite completa contra la línea base de 1.2. **`tsc -b --noEmit`: exit 0. `oxlint`: solo el warning preexistente de `HojaDeRutaRepositoryContext.tsx`.**

## 3. Alta de un recorrido — `NuevoRecorridoForm`

> Spec: escenario "Alta de un recorrido". Ver `design.md` D4 (un solo envoltorio cubre los bloques de campos).

- [x] 3.1 **Ciclo TDD — acción de alta.** RED: con solo `read`, *Crear recorrido* (`NuevoRecorridoForm:212`) queda visible y no activable, y no se emite ninguna escritura al repositorio. TRIANGULATE: con `write` activable y da de alta el recorrido; con rol `admin` sin filas, activable. **Implementado junto con 3.2 en una sola inserción de `CamposSoloLectura`** que también cubre el `Button requiereEscritura` de "Crear recorrido" (mismo patrón que `AsignacionSemanalTabla.tsx`: fieldset + prop opt-in redundante en la acción).
- [x] 3.2 **Ciclo TDD — campos del formulario.** RED: con solo `read`, **ninguno** de los campos acepta entrada: `SelectorPaciente`, los campos de `PacienteTramoCampos` (tramo, direcciones, hora), el select de vehículo (`:167`), el de conductor (`:186`), el checkbox *Recorrido manual* (`:202`) y la textarea de notas (`:222`) — todos con **una sola** inserción del envoltorio (`design.md` D4). TRIANGULATE: con `write` todos operativos; y verificar que `SelectorPaciente` y `PacienteTramoCampos` **no cambiaron ni una línea** ni recibieron props nuevas. **Nota**: `PacienteTramoCampos` solo se testea estructuralmente (queda dentro del mismo `<fieldset disabled>`) porque con `SelectorPaciente` deshabilitado la cuenta de solo lectura nunca llega a elegir un paciente y por lo tanto ese subcomponente nunca llega a montarse — documentado en el comentario del test. `SelectorPaciente.tsx` y `PacienteTramoCampos.tsx` confirmados sin cambios (no aparecen en el diff de esta sección).
- [x] 3.3 `tsc -b --noEmit` + `oxlint` limpios. Suite completa contra la línea base. **`tsc -b --noEmit`: exit 0. `oxlint`: solo el warning preexistente. Suite de la feature: 11 archivos, 73 tests, todos pasan (67 línea base + 6 nuevos de las secciones 2 y 3).**

## 4. Edición de un recorrido — `RecorridoCard` y sus escrituras silenciosas

> Spec: escenarios "Sugerencia de orden y entrada al modo de edición de un recorrido", "Salir del modo de edición de un recorrido", "Cambio de vehículo y de conductor de un recorrido", "Notas de un recorrido".
> ⚠️ **Sección de mayor riesgo técnico**: tres caminos persisten sin pasar por un `Button` (`design.md` D5). Las aserciones van sobre el **repositorio mock**, no solo sobre `toBeDisabled()`.

- [ ] 4.1 **Ciclo TDD — sugerir orden.** RED: con solo `read`, *Sugerir orden* (`RecorridoCard:144`) queda visible y no activable, y el repositorio no recibe ninguna llamada. TRIANGULATE: con `write` activable y reordena; con `admin` sin filas, activable.
- [ ] 4.2 **Ciclo TDD — entrada al modo de edición.** RED: con solo `read`, *Editar* (`RecorridoCard:152`) queda visible y no activable, y la tarjeta permanece en el resumen (`design.md` D3). TRIANGULATE: con `write` activable y la tarjeta entra en modo edición; y con solo `read` el resumen del recorrido **sigue legible** (paradas, vehículo, conductor, notas).
- [ ] 4.3 **Ciclo TDD — la salida del modo de edición NO se gatea.** RED: con solo `read` y la tarjeta forzada al modo de edición, *Listo* (`RecorridoCard:147`) **sí** se puede activar y devuelve la tarjeta al resumen (`design.md` D3 — no persiste nada, mismo criterio que *Cancelar* en `gateo-pacientes`). TRIANGULATE: con `write` ídem. Verificar que el envoltorio se aplicó a los bloques de campos y **no** a la barra de acciones.
- [ ] 4.4 **Ciclo TDD — notas del recorrido (escritura en `onBlur`).** RED: con solo `read`, la textarea de notas (`RecorridoCard:201-209`) no acepta entrada y, al quitarle el foco, `handleGuardarNotas` **no emite ninguna escritura al repositorio**. TRIANGULATE: con `write` la nota se escribe y sí se persiste al perder el foco. La aserción principal es sobre el mock, no sobre el atributo del campo.
- [ ] 4.5 **Ciclo TDD — vehículo y conductor (escritura en `onChange`).** RED: con solo `read`, los selects de `RecorridoVehiculoConductor` (`:78` vehículo, `:97` conductor) no aceptan cambios y el repositorio **no recibe ninguna llamada**, pese a que persisten directamente en el `onChange`, sin confirmación. TRIANGULATE: con `write` los dos cambian y persisten; y verificar que `RecorridoVehiculoConductor` **no cambió ni una línea**.
- [ ] 4.6 **Ciclo TDD — la rama de solo lectura de `RecorridoVehiculoConductor` no sufre regresión.** RED/TRIANGULATE: con `read` y con `write`, la tarjeta en modo resumen sigue mostrando vehículo y conductor como texto plano vía `RecorridoStat` (`RecorridoVehiculoConductor:50-65`), igual que antes del change.
- [ ] 4.7 `tsc -b --noEmit` + `oxlint` limpios. Suite completa contra la línea base.

## 5. Paradas y asignación — `ParadasList` y `AsignacionPanel`

> Spec: escenarios "Reordenamiento y baja de paradas", "Agregado de un pasajero a un recorrido". Ver `design.md` D6.

- [ ] 5.1 **Ciclo TDD — reordenar paradas.** RED: con solo `read`, *Subir* (`ParadasList:78`) y *Bajar* (`:87`) de una parada **intermedia** (≥3 paradas, ver 1.7) quedan visibles y no activables, y `onReordenar` no dispara. TRIANGULATE: con `write` ambas operativas sobre la misma parada intermedia; y verificar que el `disabled` **preexistente** de la primera y la última parada sigue funcionando igual que antes, por su propia razón (borde de la lista) y no por el gateo.
- [ ] 5.2 **Ciclo TDD — quitar parada (`<button>` nativo).** RED: con solo `read`, el `<button>` nativo *Quitar* (`ParadasList:96`) queda inerte y `onQuitar` no dispara — lo cubre el envoltorio, no la prop de `Button` (`design.md` D6). TRIANGULATE: con `write` operativo; y con solo `read` las paradas **siguen legibles** (paciente, tramo, hora, direcciones).
- [ ] 5.3 **Ciclo TDD — agregar pasajero.** RED: con solo `read`, *Agregar pasajero* (`AsignacionPanel:129`) queda visible y no activable, y sus campos (`SelectorPaciente`, `PacienteTramoCampos`) no aceptan entrada, con una sola inserción del envoltorio. TRIANGULATE: con `write` todo operativo; y con solo `read` `RequisitosPaciente` **sigue renderizándose** para el paciente seleccionado.
- [ ] 5.4 `tsc -b --noEmit` + `oxlint` limpios. Suite completa contra la línea base.

## 6. Lo que NO se gatea (`design.md` D1 y D2)

> Spec: escenarios "Conmutadores de vista operativos sin permiso de escritura", "Selector de fecha operativo sin permiso de escritura", "Vista imprimible de una hoja de ruta", "Vistas de consulta del armado".
> ⚠️ **Sección crítica.** Gatear cualquiera de estos cuatro controles es la regresión más costosa del trabajo de gateo: le quitaría a una cuenta con `read` acceso a datos que su permiso **sí** la autoriza a ver.

- [ ] 6.1 **Ciclo TDD — los tres conmutadores de vista funcionan sin `write`.** RED: con solo `read`, *Armado* (`HojaDeRutaPage:131`), *Vista global* (`:135`) e *Imprimir* (`:139`) **sí** se pueden activar y la vista cambia en los tres casos. TRIANGULATE: con `write` también funcionan; y con solo `read` **las tres vistas se renderizan completas** al conmutar.
- [ ] 6.2 **Ciclo TDD — el selector de fecha funciona sin `write`.** RED: con solo `read`, el `<input type="date">` (`HojaDeRutaPage:111`) acepta el cambio y la pantalla pasa a mostrar la hoja de ese día (o su estado vacío). TRIANGULATE: con `write` ídem; y verificar que el encabezado de la pantalla (`:104-145`) **no quedó dentro de ningún envoltorio de solo lectura** (`design.md` D2).
- [ ] 6.3 **Ciclo TDD — la vista imprimible no se bloquea.** RED: con solo `read`, `HojaDeRutaImprimible` se renderiza completa y es utilizable. TRIANGULATE: con `write` ídem; y verificar que el archivo **no cambió ni una línea**.
- [ ] 6.4 **Ciclo TDD — vistas de consulta intactas.** RED: con solo `read`, `RecorridoMapa`, `RecorridoStat` y `RequisitosPaciente` se renderizan completos. TRIANGULATE: con `write` ídem; y verificar que los tres archivos **no cambiaron ni una línea**.
- [ ] 6.5 **Ciclo TDD — la vista global sigue legible.** RED: con solo `read`, `VistaGlobalHojaDeRuta` renderiza los recorridos y sus conflictos, y solo quedan inertes el `<select>` de destino (`:122`) y *Mover* (`:137`), sin emitir escrituras. TRIANGULATE: con `write` la reasignación funciona de punta a punta.
- [ ] 6.6 **Revisión manual del diff de `HojaDeRutaPage`**: confirmar que los tres `Button` de conmutación y el `<input type="date">` **no** llevan `requiereEscritura` ni quedaron dentro de un `CamposSoloLectura`. Confirmar también que los dos `AvisoModeloDatos` (`:97`, `:148`) siguen intactos y en su lugar.
- [ ] 6.7 `tsc -b --noEmit` + `oxlint` limpios. Suite completa contra la línea base.

## 7. Aviso de modo solo lectura

> Spec: escenario "Aviso de modo solo lectura en las tres vistas". Ver `design.md` D7.

- [ ] 7.1 **Ciclo TDD — aviso en `HojaDeRutaPage`.** RED: con solo `read`, la pantalla informa el modo solo lectura con `AvisoSoloLectura`, sin props. TRIANGULATE: con `write` no aparece; con rol `admin` sin filas, tampoco.
- [ ] 7.2 **Ciclo TDD — el aviso sobrevive al conmutador.** RED: con solo `read`, el aviso **sigue visible** al pasar de armado a global y a imprimir — está arriba del switch de vistas, no dentro de una rama (`design.md` D7). TRIANGULATE: con `write` no aparece en ninguna de las tres.
- [ ] 7.3 `tsc -b --noEmit` + `oxlint` limpios. Suite completa contra la línea base.

## 8. Coherencia, verificación y cierre

- [ ] 8.1 **Ciclo TDD — coherencia con `/pacientes`.** RED/TRIANGULATE de punta a punta contra `RequireAuth` real (`design.md` D8): con solo `read` sobre `pacientes`, **las dos** pantallas (`/pacientes` y `/hojas-de-ruta`) quedan en solo lectura; con `write` sobre `pacientes`, las dos habilitadas y sin aviso. **No modificar ningún archivo de `features/pacientes/`**: si la verificación fallara de ese lado, es un hallazgo para reportar, no para parchear acá.
- [ ] 8.2 **Ciclo TDD — el permiso de otro módulo no habilita esta pantalla.** RED: con `write` sobre `conductores` y solo `read` sobre `pacientes`, `/hojas-de-ruta` queda en **solo lectura**, aunque `/conductores` y `/vehiculos` estén habilitadas. TRIANGULATE: con `write` sobre `pacientes` y solo `read` sobre `conductores`, `/hojas-de-ruta` queda **habilitada** — los vehículos y conductores solo se consultan para poblar selectores.
- [ ] 8.3 Suite completa: conteo ≥ línea base de 1.2, cero fallas, **cero tests preexistentes modificados** (solo `describe` nuevos — verificar leyendo cada diff, no de memoria).
- [ ] 8.4 `npx tsc -b --noEmit` y `npx oxlint` limpios. Cero `any` en el código nuevo. Cero `style={{}}`: solo utilidades Tailwind v4 y tokens de `index.css`.
- [ ] 8.5 **Auditoría OWASP A04 (*Insecure Design*)**: (a) el gateo lleva comentario explícito de "esto es UX, no frontera de seguridad" en cada archivo tocado; (b) no hay una segunda implementación de `read < write < admin` — todo pasa por `usePuedeEscribir()` / `CamposSoloLectura` / `Button.requiereEscritura` sin re-derivar el permiso; (c) ninguna policy de RLS ni Edge Function fue tocada; (d) no se agregó ningún camino que escriba sorteando la RLS; (e) el cliente no quedó **más restrictivo** que la RLS en ninguna acción — en particular la vista imprimible, los conmutadores y el selector de fecha.
- [ ] 8.6 Confirmar por `git diff --name-only` que el diff **no** contiene: `PuedeEscribirContext.tsx`, `usePuedeEscribir.ts`, `design-system/components.tsx`, `app/routes.ts`, `permisos.ts`, `usePermiso.ts`, `RequireAuth.tsx`, `SidebarNav.tsx`, nada bajo `supabase/`, ni ningún archivo de `openspec/changes/gateo-conductores/` o `gateo-pacientes/`.
- [ ] 8.7 Confirmar que no se tocó ningún archivo de `features/pacientes/`, `features/conductores/`, `features/vehiculos/`, `features/obras-sociales/` ni `features/facturacion/`.
- [ ] 8.8 **Grep de control**: ningún componente de `features/hojas-de-ruta/` menciona el literal `'pacientes'` (ni ningún otro módulo) para gatear escritura — todo pasa por el contexto de la ruta.
- [ ] 8.9 Confirmar que los cuatro archivos de solo lectura (`HojaDeRutaImprimible.tsx`, `RecorridoMapa.tsx`, `RecorridoStat.tsx`, `RequisitosPaciente.tsx`) y los tres de campos anidados (`PacienteTramoCampos.tsx`, `SelectorPaciente.tsx`, `RecorridoVehiculoConductor.tsx`) **no aparecen en el diff**.
- [ ] 8.10 `CHANGES.md` actualizado: entrada de `gateo-hojas-de-ruta` bajo la nota de gateo de escritura de C-02, con la explicación del descope desde `gateo-conductores` y del módulo correcto (`pacientes`).
- [ ] 8.11 Commit en Conventional Commits: `feat(hojas-de-ruta): …`.
- [ ] 8.12 **Verificación manual humana** (no automatizable con mocks, a cargo de la usuaria). Con una cuenta real de solo `read` sobre `pacientes` contra Supabase, confirmar los ocho puntos (a)–(h) del Migration Plan de `design.md`: acciones de escritura visibles pero bloqueadas · aviso visible en las tres vistas · **los tres conmutadores de vista funcionan** · **el selector de fecha funciona** · la vista imprimible se renderiza completa · no se pueden escribir notas ni cambiar vehículo/conductor desde los selects · una cuenta con `write` sobre `pacientes` arma hojas sin trabas · una cuenta con `write` sobre `conductores` pero solo `read` sobre `pacientes` queda en solo lectura acá.
- [ ] 8.13 Tabla de evidencia del ciclo TDD reportada en el cierre de `/opsx:apply`.
