# Tareas — gateo-escritura-formularios

> **Modo Strict TDD activo** (`openspec/config.yaml` → `testing.strict_tdd: true`).
> Runner: `cd frontend && npx vitest run` · Tipos: `cd frontend && npx tsc -b --noEmit` · Lint: `cd frontend && npx oxlint`
>
> Cada tarea de implementación es **un ciclo TDD completo** sobre **un solo comportamiento**:
> **RED** (test que falla primero) → **GREEN** (mínimo código para pasar) → **TRIANGULATE** (≥2 casos: camino feliz + borde) → **REFACTOR** (tests verdes tras cada paso).
> Ninguna tarea se marca `[x]` sin haber ejecutado el runner y visto pasar sus tests.
>
> **Gobernanza: CRÍTICO** (dominio auth/permisos). La sección 0 es una compuerta humana, no trabajo de agente.
> **Las secciones 3 a 7 no se empiezan hasta que la sección 0 esté cerrada.**

## ⚠️ Este change fue dividido en cuatro (2026-07-29)

Por la decisión 3 de la sección 0, **estas tareas no se ejecutan desde acá**. Se reparten entre los cuatro changes del split, cada uno con su propio `tasks.md`:

| Secciones de este archivo | Change destino |
|---|---|
| 1, 2, 3 (red de seguridad, contexto/hook, primitivas) + 5 | `gateo-escritura-obra-social` |
| 4 | `gateo-escritura-pacientes` |
| 7 | `gateo-escritura-facturacion` |
| 6 | `gateo-escritura-conductores` |
| 8 | repartida: la parte transversal en el change 1, la verificación por módulo en cada uno |

Se conserva como registro del desglose completo. La compuerta de gobernanza CRÍTICO sigue vigente **en cada uno de los cuatro changes**.

## 0. Compuerta de aprobación humana

- [ ] 0.1 Obtener aprobación humana explícita para escribir código (gobernanza CRÍTICO — dominio auth/permisos). **Sigue pendiente, y aplica a cada uno de los cuatro changes del split por separado.**
- [x] 0.2 Open Question 1 — **DESHABILITAR, nunca ocultar**. Las acciones de escritura siguen visibles en el DOM pero bloqueadas; los campos quedan no editables. Se descarta el criterio mixto de ocultar los puntos de entrada.
- [x] 0.3 Open Question 2 — **SÍ al indicador visible** de modo solo lectura, con `Alert` del design system. Tono, texto y ubicación exactos se fijan en el change 1 (`gateo-escritura-obra-social`) y los otros tres los reutilizan.
- [x] 0.4 Open Question 3 — **cuatro changes, uno por módulo real del backend**, cada uno proponible/aplicable/revisable de forma independiente. Ver `proposal.md` §Split para el orden y las dependencias.
- [x] 0.5 Open Question 4 — **agrupación confirmada tal cual**: `conductores` gatea Conductores + Vehículos + Hojas de Ruta; `facturacion` gatea Presupuestos + Facturación. Misma agrupación que la RLS de `seed_modulos.sql`.
- [x] 0.6 Open Question 5 — **nivel `write` para todas las acciones no-CRUD** (emitir factura, registrar cobro, corregir estado de asistencia, reordenar paradas). Ninguna requiere `admin`.

## 1. Red de seguridad y línea base

- [ ] 1.1 Ejecutar `cd frontend && npx vitest run` sobre el árbol intacto y registrar el conteo exacto de tests que pasan. Este número es la línea base de todo el change: al cierre debe ser ≥ y sin fallas nuevas.
- [ ] 1.2 Si algún test falla en la línea base, **detenerse** y reportarlo como falla preexistente. No arreglarlo dentro de este change.
- [ ] 1.3 Ejecutar `cd frontend && npx tsc -b --noEmit` y `npx oxlint` sobre el árbol intacto; registrar que salen limpios (o registrar el ruido preexistente).
- [ ] 1.4 Verificar que `auth-frontend-real` sigue proveyendo intactos `tienePermiso`, `usePermiso`, `moduloDeRuta`, `RequireAuth` y `renderConSesion`. Este change los **consume**; si alguno cambió de firma, el diseño se revisa antes de seguir.

## 2. Contexto y hook de permiso de escritura (design.md D1, D2)

> Spec: Requirement "Permiso de escritura derivado de la ruta activa".

- [ ] 2.1 **Ciclo TDD — resolución del permiso desde el módulo de la ruta.** RED: test que monta el proveedor en una ruta de módulo y afirma que expone verdadero con una cuenta `write` sobre ese módulo. GREEN: proveedor mínimo. TRIANGULATE: cuenta con solo `read` → falso; cuenta con `admin` sobre el módulo → verdadero. REFACTOR.
- [ ] 2.2 **Ciclo TDD — short-circuit del rol `admin` sin filas de permisos.** RED: cuenta con rol `admin` y matriz de permisos **vacía** en una ruta de módulo → verdadero. TRIANGULATE: la misma cuenta con rol `empleado` y matriz vacía → falso. Este es el falso negativo más caro del change (dejar a la administradora sin escritura); tiene su propio ciclo a propósito.
- [ ] 2.3 **Ciclo TDD — rutas sin módulo propio.** RED: en `/` (Dashboard) el permiso de escritura es verdadero sin consultar la matriz. TRIANGULATE: idem en `/cuentas` y `/design-system`; y contraste con `/pacientes` en la misma cuenta sin permisos → falso.
- [ ] 2.4 **Ciclo TDD — rutas agrupadas bajo un módulo compartido.** RED: cuenta con solo `read` en `conductores` → falso en `/vehiculos`. TRIANGULATE: falso también en `/hojas-de-ruta` y `/conductores`; y con `write` en `conductores` → verdadero en las tres.
- [ ] 2.5 **Ciclo TDD — `usePuedeEscribir()` sin proveedor por encima.** RED: componente que consume el hook montado sin proveedor → verdadero (preserva el comportamiento previo al gateo; ver design.md D1, es lo que mantiene verdes los ~190 tests existentes). TRIANGULATE: el mismo componente dentro del proveedor con solo `read` → falso.
- [ ] 2.6 **Ciclo TDD — punto de inyección en `RequireAuth`.** RED: test que renderiza una ruta protegida real y afirma que un componente hijo profundo recibe el permiso de escritura correcto sin recibirlo por props. TRIANGULATE: dos rutas de módulos distintos en la misma sesión con permisos distintos → cada pantalla resuelve el suyo.
- [ ] 2.7 Verificar que `RequireAuth` conserva **intacto** su gateo de `read` (`AccesoDenegado` para módulo sin permiso, para ruta no declarada y para `/cuentas` sin rol `admin`). Ejecutar `RequireAuth.test.tsx` completo: cero regresiones.
- [ ] 2.8 Documentar en el código nuevo, con el mismo lenguaje que ya usan `permisos.ts` y `SidebarNav.tsx`, que este gateo es UX y **no** frontera de seguridad, y que la autorización efectiva la impone la RLS vía `modulos.tiene_permiso(modulo, 'write')` (spec: Requirement "El gateo de escritura del cliente no sustituye a la RLS").
- [ ] 2.9 Auditoría de una sola implementación: confirmar por lectura del código que el permiso de escritura sale de la misma `tienePermiso` existente y que **no** se introdujo una segunda versión de la jerarquía `read < write < admin`.
- [ ] 2.10 `tsc -b --noEmit` + `oxlint` limpios. Cero `any`. Ejecutar la suite completa: línea base de 1.1 intacta.

## 3. Primitivas de design system (design.md D3, D4, D5)

> Spec: Requirements "Campos de formulario no editables sin permiso de escritura", "Acciones de escritura deshabilitadas sin permiso", "Modo solo lectura visible para la cuenta activa".
> **No arrancar sin la sección 0 cerrada** — 0.2 define la forma de 3.3 y 0.3 decide si 3.4 existe.

- [ ] 3.1 **Ciclo TDD — envoltorio de solo lectura sobre `<fieldset disabled>`.** RED: los controles hijos directos (`input`, `select`, `textarea`, `button`) quedan deshabilitados cuando el permiso de escritura es falso. TRIANGULATE: con permiso verdadero todos quedan habilitados; y un control anidado dos niveles más abajo (dentro de un subcomponente que la primitiva no conoce) también queda deshabilitado.
- [ ] 3.2 **Ciclo TDD — el envoltorio no altera el layout.** RED: test que afirma que la primitiva neutraliza los estilos de agente de usuario del `<fieldset>` (`min-w-0 border-0 p-0 m-0`, utilidades Tailwind — cero estilos inline). TRIANGULATE: verificar contra un formulario real que el árbol renderizado no gana ni pierde contenedores visibles respecto de antes.
- [ ] 3.3 **Ciclo TDD — `Button` con declaración opt-in de escritura.** RED: `Button` con la prop de escritura declarada, dentro de un proveedor sin permiso → deshabilitado, reutilizando `BUTTON_DISABLED_CLASSES` (no un estilo nuevo). TRIANGULATE: (a) con permiso → habilitado; (b) **sin** la prop declarada y sin permiso → habilitado (retrocompatibilidad de los ~78 call sites existentes); (c) con la prop declarada y además `disabled` propio en `false` pero sin permiso → deshabilitado (disyunción: el gateo nunca habilita lo que la lógica del call site quería deshabilitado).
- [ ] 3.4 **Ciclo TDD — aviso visible de modo solo lectura** (aprobado en 0.3). RED: sin permiso de escritura, la pantalla muestra el aviso reutilizando `Alert` de `design-system/feedback.tsx`. TRIANGULATE: con permiso de escritura el aviso **no** aparece; y el aviso no aparece en rutas sin módulo propio.
- [ ] 3.5 Verificar que ningún `Button` existente cambió de comportamiento: ejecutar la suite completa y confirmar la línea base de 1.1. Un solo test roto acá significa que 3.3 dejó de ser opt-in.
- [ ] 3.6 Registrar las primitivas nuevas en la vitrina `/design-system` siguiendo el patrón de los componentes ya expuestos ahí.
- [ ] 3.7 `tsc -b --noEmit` + `oxlint` limpios. Suite completa verde.

## 4. Cableado del módulo `pacientes` (design.md D6, fase 2)

> Ruta: `/pacientes`. Componentes: `PacientesList`, `PacienteResumen`, `PacienteForm`, `CudFields`, `DireccionesEditor`, `PersonasACargoEditor`, `PacienteDocumentos`/`PacienteDocumentosChecklist`.

- [ ] 4.1 **Ciclo TDD — punto de entrada de alta en el listado.** RED: cuenta con solo `read` en `pacientes` → la acción de crear paciente no se puede activar (`PacientesList:60` y el atajo de estado vacío `:82`). TRIANGULATE: cuenta con `write` → se puede activar; cuenta con rol `admin` sin filas de permisos → se puede activar.
- [ ] 4.2 **Ciclo TDD — punto de entrada de edición en el detalle.** RED: con solo `read`, la acción de editar de `PacienteResumen:116` y el botón por fila de `PacientesList:159` no se pueden activar. TRIANGULATE: con `write`, ambas sí; y la fila del listado **sigue navegando** al detalle (fila 100% clickeable intacta).
- [ ] 4.3 **Ciclo TDD — campos y guardado de `PacienteForm`.** RED: con solo `read`, ningún campo acepta entrada y la acción de guardar (`:101`) no se puede activar. TRIANGULATE: con `write` todo editable y guardable; y con solo `read` **no se emite ninguna escritura al repositorio** (el mock de repositorio no recibe llamadas).
- [ ] 4.4 **Ciclo TDD — `Cancelar` sobrevive al modo solo lectura.** RED: con solo `read`, `PacienteForm:98` (`Cancelar`) **sí** se puede activar y cierra el formulario. TRIANGULATE: idem `VolverAlListadoLink`/`VolverAlListadoButton` de la pantalla de detalle. (Spec: Requirement "Acciones sin escritura preservadas en modo solo lectura".)
- [ ] 4.5 **Ciclo TDD — editores anidados sin conocer el módulo.** RED: con solo `read`, los campos y acciones de `DireccionesEditor` (`:123`), `PersonasACargoEditor` (`:203`) y `CudFields` (`:53`, `:90`, `:93`, `:163`, `:166`) quedan inertes **sin** que ninguno reciba el módulo por props. TRIANGULATE: con `write` todos operativos; y verificar por lectura del código que ninguno importa un literal de módulo.
- [ ] 4.6 **Ciclo TDD — documentos del paciente.** RED: con solo `read`, la carga/baja de documentos en `PacienteDocumentos`/`PacienteDocumentosChecklist` no se puede activar. TRIANGULATE: con `write` sí; y la **consulta/descarga** de un documento existente sigue disponible con solo `read`.
- [ ] 4.7 **Ciclo TDD — aviso de solo lectura en la pantalla** (aprobado en 0.3). RED: con solo `read` en `pacientes`, la pantalla informa el modo solo lectura. TRIANGULATE: con `write`, no.
- [ ] 4.8 `tsc -b --noEmit` + `oxlint` limpios. Suite completa: línea base de 1.1 intacta, cero tests de pacientes preexistentes tocados.

## 5. Cableado del módulo `obra_social` (design.md D6, fase 3)

> Ruta: `/obras-sociales`. Componentes: `ObrasSocialesList`, `ObraSocialDetail`, `ObraSocialForm`, `ChecklistEditor`, `PlantillaFacturaEditor`.

- [ ] 5.1 **Ciclo TDD — alta y edición.** RED: con solo `read` en `obra_social`, no se pueden activar crear (`ObrasSocialesList:41`, `:58`), editar por fila (`:136`) ni editar del detalle (`ObraSocialDetail:133`). TRIANGULATE: con `write` todas sí; con rol `admin` sin filas de permisos, todas sí.
- [ ] 5.2 **Ciclo TDD — campos y guardado de `ObraSocialForm`.** RED: con solo `read`, campos inertes y guardar (`:157`) no activable, sin escrituras al repositorio. TRIANGULATE: con `write` todo operativo; `Cancelar` (`:154`) activable en ambos casos.
- [ ] 5.3 **Ciclo TDD — `ChecklistEditor`.** RED: con solo `read`, agregar/quitar/editar ítems de checklist (`:80` y `ChecklistItemRow`) queda inerte. TRIANGULATE: con `write` operativo; y el checklist sigue **legible** con solo `read`.
- [ ] 5.4 **Ciclo TDD — `PlantillaFacturaEditor`.** RED: con solo `read`, agregar/editar campos de plantilla (`:139` y `PlantillaCampoRow`) queda inerte. TRIANGULATE: con `write` operativo; plantilla legible con solo `read`.
- [ ] 5.5 **Ciclo TDD — aviso de solo lectura** (aprobado en 0.3): presente con solo `read`, ausente con `write`.
- [ ] 5.6 `tsc -b --noEmit` + `oxlint` limpios. Suite completa verde contra la línea base.

## 6. Cableado del módulo `conductores` (design.md D6, fase 4)

> Rutas: `/conductores`, `/vehiculos`, `/hojas-de-ruta` — **las tres bajo el mismo módulo** (confirmado en 0.5).

- [ ] 6.1 **Ciclo TDD — Conductores: alta y edición.** RED: con solo `read` en `conductores`, no se pueden activar crear (`ConductoresList:52`, `:74`), editar por fila (`:171`) ni editar del detalle (`ConductorDetail:153`). TRIANGULATE: con `write` sí; con rol `admin` sin filas, sí.
- [ ] 6.2 **Ciclo TDD — `ConductorForm` y `ConductorDocumentos`.** RED: con solo `read`, campos inertes, guardar (`:204`) no activable, carga de documentos no activable. TRIANGULATE: con `write` operativo; `Cancelar` (`:201`) y la consulta de documentos disponibles con solo `read`.
- [ ] 6.3 **Ciclo TDD — `AsignacionSemanalTabla`.** RED: con solo `read`, el envío de la asignación semanal (`:156`) queda inerte. TRIANGULATE: con `write` operativo; la tabla sigue legible con solo `read`.
- [ ] 6.4 **Ciclo TDD — Vehículos: alta, edición y formulario.** RED: con solo `read` en `conductores` (¡no un módulo "vehiculos"!), no se pueden activar crear (`VehiculosList:51`, `:73`), editar (`:175`, `VehiculoDetail:163`) ni guardar (`VehiculoForm:172`), y los campos están inertes. TRIANGULATE: con `write` todo operativo; `Cancelar` (`:169`) activable en ambos casos.
- [ ] 6.5 **Ciclo TDD — subpantallas de Vehículos.** RED: con solo `read`, `GastosVehiculo` (`:178`), `VehiculoMantenimiento` y `VehiculoDocumentos` quedan inertes para escritura. TRIANGULATE: con `write` operativos; y los tres siguen siendo **consultables** con solo `read`.
- [ ] 6.6 **Ciclo TDD — Hojas de Ruta: creación y edición de recorridos.** RED: con solo `read`, no se pueden activar crear hoja (`HojaDeRutaPage:161`), `NuevoRecorridoForm` (`:212`), edición de `RecorridoCard` (`:147`, `:152`), sugerir orden (`:144`), reordenar en `ParadasList` (`:78`, `:87`), `AsignacionPanel` (`:129`) ni mover filas en `VistaGlobalHojaDeRuta` (`:137`). TRIANGULATE: con `write` todo operativo; con rol `admin` sin filas, todo operativo.
- [ ] 6.7 **Ciclo TDD — Hojas de Ruta: los conmutadores de vista NO se gatean.** RED: con solo `read`, los tres conmutadores `armado` / `global` / `imprimir` (`HojaDeRutaPage:131`, `:135`, `:139`) **sí** se pueden activar y la vista cambia. TRIANGULATE: la vista `imprimir` (`HojaDeRutaImprimible`) se renderiza completa con solo `read`. (Spec: Requirement "Acciones sin escritura preservadas".)
- [ ] 6.8 **Ciclo TDD — coherencia de las tres rutas.** RED: una única cuenta con solo `read` en `conductores` queda en solo lectura en `/conductores`, `/vehiculos` y `/hojas-de-ruta`. TRIANGULATE: la misma cuenta con `write` en `conductores` tiene escritura en las tres; y con `write` solo en `pacientes` sigue en solo lectura en las tres.
- [ ] 6.9 **Ciclo TDD — aviso de solo lectura** (aprobado en 0.3) en las tres rutas: presente con solo `read`, ausente con `write`.
- [ ] 6.10 `tsc -b --noEmit` + `oxlint` limpios. Suite completa verde contra la línea base.

## 7. Cableado del módulo `facturacion` (design.md D6, fase 5)

> Rutas: `/presupuestos`, `/facturacion` — **ambas bajo el mismo módulo** (confirmado en 0.5). El nivel de las acciones no-CRUD viene de 0.6.

- [ ] 7.1 **Ciclo TDD — Presupuestos: alta, edición y formulario.** RED: con solo `read` en `facturacion`, no se pueden activar crear (`PresupuestosList:54`, `:76`), editar (`:140`, `PresupuestoResumen:59`) ni guardar (`PresupuestoForm:158`), y los campos están inertes. TRIANGULATE: con `write` todo operativo; `Cancelar` (`:155`) activable en ambos casos.
- [ ] 7.2 **Ciclo TDD — `AutorizacionForm`.** RED: con solo `read`, editar autorización (`PresupuestoDetail:233`) y guardar (`AutorizacionForm:226`) quedan inertes, campos incluidos. TRIANGULATE: con `write` operativo; `Cancelar` (`:223`) activable en ambos casos.
- [ ] 7.3 **Ciclo TDD — Facturación: alta, edición y formulario.** RED: con solo `read`, no se pueden activar nueva factura (`FacturasList:72`, `:102`), editar (`:172`, `FacturaDetail:172`) ni guardar (`FacturaForm:197`), y los campos de `FacturaFormDatosBasicos` y `FacturaFormEconomicos` están inertes. TRIANGULATE: con `write` todo operativo; `Cancelar` (`:196`) activable en ambos casos.
- [ ] 7.4 **Ciclo TDD — acciones no-CRUD de facturación**, al nivel que fijó 0.6. RED: con solo `read`, emitir factura (`FacturaAccionesEmision:38`, confirmar `:46`), registrar cobro (`CobrosPanel:170`), corregir estado (`FacturaCobrosSection:59`) y editar asistencias (`AsistenciasEditor:119`) quedan inertes. TRIANGULATE: con el nivel que 0.6 haya fijado, operativas; y si 0.6 asignó `admin` a alguna, una cuenta con `write` (no `admin`) la ve inerte.
- [ ] 7.5 **Ciclo TDD — lectura preservada en facturación.** RED: con solo `read`, `FacturaResumen`, `FacturaImprimible`, `AlertaCupo`, `FacturaAvisoDiscrepancias` y la consulta de `FacturaDocumentos` se renderizan y son navegables. TRIANGULATE: la vista imprimible se renderiza completa; la fila del listado sigue navegando al detalle.
- [ ] 7.6 **Ciclo TDD — coherencia de las dos rutas.** RED: una cuenta con solo `read` en `facturacion` queda en solo lectura en `/presupuestos` **y** `/facturacion`. TRIANGULATE: con `write` en `facturacion`, escritura en ambas.
- [ ] 7.7 **Ciclo TDD — aviso de solo lectura** (aprobado en 0.3) en ambas rutas: presente con solo `read`, ausente con `write`.
- [ ] 7.8 `tsc -b --noEmit` + `oxlint` limpios. Suite completa verde contra la línea base.

## 8. Verificación transversal y cierre

- [ ] 8.1 Ejecutar `cd frontend && npx vitest run` completo: conteo ≥ línea base de 1.1, cero fallas, cero tests preexistentes modificados para acomodar este change.
- [ ] 8.2 `cd frontend && npx tsc -b --noEmit` y `npx oxlint` limpios. Cero `any` en el código nuevo. Cero `style={{}}`: solo utilidades Tailwind v4 y tokens de `index.css`.
- [ ] 8.3 **Ciclo TDD — matriz de permisos completa end-to-end.** RED: cuenta con `write` en `pacientes` y solo `read` en los otros tres módulos → escritura habilitada **solo** en `/pacientes`, solo lectura en las otras 6 rutas de módulo. TRIANGULATE: invertir el módulo con `write` y confirmar que el gateo se mueve; y cuenta con rol `admin` sin ninguna fila → escritura habilitada en las 7.
- [ ] 8.4 **Ciclo TDD — cuenta sin ningún permiso.** RED: cuenta sin filas y rol `empleado` sigue viendo el mensaje de "pedí acceso a la administradora" del shell, sin regresión respecto de `auth-frontend-real`. TRIANGULATE: no accede a ninguna ruta de módulo (el gateo de `read` de `RequireAuth` sigue actuando primero).
- [ ] 8.5 Auditoría OWASP A04 (*Insecure Design*): confirmar por lectura del diff que (a) el gateo está documentado como UX en todo el código nuevo, (b) no hay una segunda implementación de la jerarquía `read < write < admin`, (c) ninguna policy de RLS ni Edge Function fue tocada, (d) no se agregó ningún camino que escriba sorteando la RLS.
- [ ] 8.6 Confirmar que el diff **no** contiene cambios en `supabase/`, ni en `permisos.ts`, ni en `usePermiso.ts`, ni en `app/routes.ts` (más allá de comentarios), ni en el gateo de `read` de `RequireAuth`/`SidebarNav`.
- [ ] 8.7 Grep de control: ningún componente de `features/` importa un literal de módulo (`'pacientes'`, `'obra_social'`, `'facturacion'`, `'conductores'`) para gatear escritura — todo pasa por el contexto (design.md D1/D2).
- [ ] 8.8 Actualizar `CHANGES.md`: agregar una nota de progreso bajo la entrada **C-02** siguiendo el mismo patrón que la nota de `auth-frontend-real` (qué se cerró, la nota de seguridad de "esto es UX, la RLS es la frontera real", y qué queda pendiente a cargo de la usuaria).
- [ ] 8.9 Commit(s) en Conventional Commits, uno por fase de la sección 2-7 (`feat(auth): …`, `feat(pacientes): …`, etc.).
- [ ] 8.10 **Verificación manual humana (no automatizable con mocks)** — a cargo de la usuaria: con una cuenta real de solo `read` contra el proyecto Supabase, recorrer las 7 rutas de módulo y confirmar que (a) las acciones de escritura están gateadas, (b) `Cancelar`/`Volver`/conmutadores de vista siguen funcionando, (c) una cuenta con `write` no ve nada deshabilitado, y (d) un intento forzado de escritura sin permiso sigue siendo rechazado por la RLS. Mismo patrón de cierre que `auth-frontend-real`.
- [ ] 8.11 Reportar la tabla de evidencia del ciclo TDD (Tarea · archivo de test · capa · red de seguridad · RED · GREEN · TRIANGULATE · REFACTOR) exigida por el modo Strict TDD.
