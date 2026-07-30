# Tareas — gateo-obrasocial

> **Change 1 de 4** del split de gateo de escritura. Construye el **mecanismo compartido** que consumen `gateo-pacientes`, `gateo-facturacion` y `gateo-conductores`, y lo estrena sobre el módulo `obra_social` (ruta `/obras-sociales`).
>
> **Modo Strict TDD activo** (`openspec/config.yaml` → `testing.strict_tdd: true`).
> Runner: `cd frontend && npx vitest run` · Tipos: `cd frontend && npx tsc -b --noEmit` · Lint: `cd frontend && npx oxlint`
>
> Cada tarea de implementación es **un ciclo TDD completo** sobre **un solo comportamiento**:
> **RED** (test que falla primero) → **GREEN** (mínimo código para pasar) → **TRIANGULATE** (≥2 casos: camino feliz + borde) → **REFACTOR** (tests verdes tras cada paso).
> Ninguna tarea se marca `[x]` sin haber ejecutado el runner y visto pasar sus tests.
>
> **Decisiones ya cerradas por la usuaria** (no re-abrir): deshabilitar nunca ocultar · sí al aviso visible · 4 changes uno por módulo · agrupación módulo→pantalla tal cual `seed_modulos.sql` · todas las acciones de escritura al nivel `write`, ninguna requiere `admin`.

## 0. Compuerta de gobernanza (bloqueante)

- [x] 0.1 Obtener **aprobación humana explícita** para escribir código en este change (gobernanza CRÍTICO — dominio auth/permisos). Sin esto, ninguna tarea posterior arranca. *(Aprobación confirmada por la usuaria antes de iniciar esta sesión de apply.)*

## 1. Red de seguridad y línea base

- [x] 1.1 Ejecutar `cd frontend && npx vitest run` sobre el árbol intacto y registrar el conteo exacto de tests que pasan. Es la línea base de todo el change: al cierre debe ser ≥ y sin fallas nuevas. **Línea base: 179 test files, 1013 tests, todos verdes.**
- [x] 1.2 Si algún test falla en la línea base, **detenerse** y reportarlo como falla preexistente. No arreglarlo dentro de este change. *(No aplica — la línea base estaba completamente verde.)*
- [x] 1.3 Ejecutar `npx tsc -b --noEmit` y `npx oxlint` sobre el árbol intacto; registrar que salen limpios (o el ruido preexistente). **`tsc -b --noEmit`: 0 errores. `oxlint`: 14 warnings preexistentes (todos `react(only-export-components)`, ningún error).**
- [x] 1.4 Verificar que `auth-frontend-real` sigue proveyendo intactos `tienePermiso`, `usePermiso`, `moduloDeRuta`, `RequireAuth` y `renderConSesion`. Este change los **consume**; si alguno cambió de firma, revisar el diseño antes de seguir. **Verificado por lectura — las 5 firmas intactas.**

## 2. Mecanismo compartido — contexto y hook (design.md D1, D2)

> Spec: Requirement "Permiso de escritura derivado de la ruta activa".
> **Lo que se construya acá lo consumen los otros 3 changes sin modificarlo.** Pensar la firma pública antes de escribirla.

- [x] 2.1 **Ciclo TDD — resolución del permiso desde el módulo de la ruta.** RED: el proveedor expone verdadero con una cuenta `write` sobre el módulo de la ruta. GREEN: proveedor mínimo. TRIANGULATE: cuenta con solo `read` → falso; cuenta con `admin` sobre el módulo → verdadero. REFACTOR.
- [x] 2.2 **Ciclo TDD — short-circuit del rol `admin` sin filas de permisos.** RED: rol `admin` con matriz de permisos **vacía** en una ruta de módulo → verdadero. TRIANGULATE: la misma cuenta con rol `empleado` y matriz vacía → falso. Ciclo propio a propósito: es el falso negativo más caro del change (dejar a la administradora sin escritura) y un test de "solo read" no lo detecta.
- [x] 2.3 **Ciclo TDD — rutas sin módulo propio.** RED: en `/` (Dashboard) el permiso de escritura es verdadero sin consultar la matriz. TRIANGULATE: ídem `/cuentas` y `/design-system`; y contraste con `/obras-sociales` en la misma cuenta sin permisos → falso.
- [x] 2.4 **Ciclo TDD — `usePuedeEscribir()` sin proveedor por encima.** RED: componente que consume el hook montado sin proveedor → verdadero (design.md D1: es lo que mantiene verdes los ~190 tests existentes). TRIANGULATE: el mismo componente dentro del proveedor con solo `read` → falso.
- [x] 2.5 **Ciclo TDD — punto de inyección en `RequireAuth`.** RED: renderizar una ruta protegida real y afirmar que un componente hijo profundo recibe el permiso correcto **sin recibirlo por props**. TRIANGULATE: dos rutas de módulos distintos en la misma sesión con permisos distintos → cada pantalla resuelve el suyo.
- [x] 2.6 Verificar que `RequireAuth` conserva **intacto** su gateo de `read` (`AccesoDenegado` para módulo sin permiso, para ruta no declarada y para `/cuentas` sin rol `admin`). Ejecutar `RequireAuth.test.tsx` completo: cero regresiones.
- [x] 2.7 Documentar en el código nuevo, con el mismo lenguaje de `permisos.ts` y `SidebarNav.tsx`, que este gateo es UX y **no** frontera de seguridad, y que la autorización efectiva la impone la RLS vía `modulos.tiene_permiso(modulo, 'write')`.
- [x] 2.8 Auditoría de una sola implementación: confirmar por lectura del código que el permiso sale de la misma `tienePermiso` existente y que **no** se introdujo una segunda versión de la jerarquía `read < write < admin`.
- [x] 2.9 `tsc -b --noEmit` + `oxlint` limpios. Cero `any`. Suite completa: línea base de 1.1 intacta.

## 3. Mecanismo compartido — primitivas de design system (design.md D3, D5, D6)

> Spec: Requirements "Acciones de escritura visibles pero deshabilitadas sin permiso", "Campos de formulario no editables sin permiso de escritura", "Modo solo lectura visible para la cuenta activa".

- [x] 3.1 **Ciclo TDD — envoltorio de solo lectura sobre `<fieldset disabled>`.** RED: los controles hijos directos (`input`, `select`, `textarea`, `button`) quedan deshabilitados cuando el permiso es falso. TRIANGULATE: con permiso verdadero todos habilitados; y un `<button>` **nativo** (no componente `Button`) anidado dos niveles más abajo también queda deshabilitado — es el caso de `ChecklistItemRow` y `PlantillaCampoRow`.
- [x] 3.2 **Ciclo TDD — el envoltorio no altera el layout.** RED: la primitiva neutraliza los estilos de agente de usuario del `<fieldset>` (`min-w-0 border-0 p-0 m-0`, utilidades Tailwind — cero estilos inline). TRIANGULATE: verificar contra `ObraSocialForm` real que el árbol renderizado no gana ni pierde contenedores visibles.
- [x] 3.3 **Ciclo TDD — `Button` con prop opt-in de escritura.** RED: `Button` con la prop declarada, dentro del proveedor sin permiso → deshabilitado y **visible**, reutilizando `BUTTON_DISABLED_CLASSES` (no un estilo nuevo). TRIANGULATE: (a) con permiso → habilitado; (b) **sin** la prop y sin permiso → habilitado (retrocompatibilidad de los ~78 call sites); (c) con la prop y además `disabled` propio, sin permiso → deshabilitado (disyunción: el gateo nunca habilita lo que la lógica del call site quería bloquear).
- [x] 3.4 **Ciclo TDD — el control deshabilitado sigue en el DOM.** RED: sin permiso, el control de escritura sigue presente y consultable en el árbol renderizado, solo deshabilitado (decisión 1 de la usuaria: deshabilitar, nunca ocultar). TRIANGULATE: con permiso, presente y habilitado.
- [x] 3.5 **Ciclo TDD — aviso visible de modo solo lectura.** RED: sin permiso de escritura, la pantalla muestra el aviso reutilizando `Alert` de `design-system/feedback.tsx`. TRIANGULATE: con permiso el aviso **no** aparece; y no aparece en rutas sin módulo propio. Fijar acá tono, texto y ubicación: **los otros 3 changes replican este patrón**.
- [x] 3.6 Verificar que ningún `Button` existente cambió de comportamiento: suite completa contra la línea base de 1.1. Un solo test roto acá significa que 3.3 dejó de ser opt-in.
- [x] 3.7 Registrar las primitivas nuevas en la vitrina `/design-system` siguiendo el patrón de los componentes ya expuestos ahí — los otros 3 changes las van a consumir desde ahí.
- [x] 3.8 `tsc -b --noEmit` + `oxlint` limpios. Suite completa verde.

## 4. Cableado del módulo `obra_social` (ruta `/obras-sociales`)

> Spec: Requirement "Gateo de escritura en la pantalla de Obras Sociales".

- [x] 4.1 **Ciclo TDD — alta desde el listado.** RED: con solo `read` en `obra_social`, *Crear obra social* (`ObrasSocialesList:41`) y *Crear la primera* (`:58`) quedan visibles y no activables. TRIANGULATE: con `write` ambas activables; con rol `admin` sin filas de permisos, ambas activables.
- [x] 4.2 **Ciclo TDD — edición desde listado y detalle.** RED: con solo `read`, el botón *Editar* por fila (`ObrasSocialesList:136`) y el *Editar* del detalle (`ObraSocialDetail:133`) quedan visibles y no activables. TRIANGULATE: con `write` ambos activables; y la fila del listado **sigue navegando** al detalle (fila 100% clickeable intacta).
- [x] 4.3 **Ciclo TDD — campos y guardado de `ObraSocialForm`.** RED: con solo `read`, los 8 campos (`Field`/`Input`/`Select` de `design-system/form`) no aceptan entrada y *Guardar* (`:157`) no se puede activar. TRIANGULATE: con `write` todo editable y guardable; y con solo `read` **el repositorio mock no recibe ninguna llamada de escritura**.
- [x] 4.4 **Ciclo TDD — `Cancelar` sobrevive al modo solo lectura.** RED: con solo `read`, `ObraSocialForm:154` (*Cancelar*) **sí** se puede activar y cierra el formulario. TRIANGULATE: ídem *Volver al listado* del detalle. Verificar además que el envoltorio de solo lectura se aplicó al bloque de campos y **no** a la barra de acciones (design.md, tabla de riesgos).
- [x] 4.5 **Ciclo TDD — `ChecklistEditor` + `ChecklistItemRow`.** RED: con solo `read`, agregar (`ChecklistEditor:80`), renombrar (el `Input` de `ChecklistItemRow`) y los 3 `<button>` nativos de la fila (`:69`, `:78`, `:87` — ver, subir/bajar, eliminar) quedan inertes. TRIANGULATE: con `write` todos operativos; y con solo `read` el checklist **sigue siendo legible** (los ítems se renderizan).
- [x] 4.6 **Ciclo TDD — arrastre bloqueado en `ChecklistItemRow`.** RED: con solo `read`, el `<li draggable>` (`ChecklistItemRow:39`) no es arrastrable y `onDragStart`/`onDrop` no persisten reordenamiento — **el `<fieldset disabled>` NO cubre esto** (design.md D4). TRIANGULATE: con `write` el arrastre reordena con normalidad; y sin permiso el reordenamiento por botones tampoco funciona (ya cubierto en 4.5, se verifica junto).
- [x] 4.7 **Ciclo TDD — `PlantillaFacturaEditor` + `PlantillaCampoRow`.** RED: con solo `read`, agregar (`PlantillaFacturaEditor:139`), los 2 campos de `PlantillaCampoRow` (`Input` + `Select` de origen) y sus 3 `<button>` nativos (`:84`, `:93`, `:102`) quedan inertes, y el `<li draggable>` (`:53`) no es arrastrable. TRIANGULATE: con `write` todo operativo; con solo `read` la plantilla sigue legible.
- [x] 4.8 **Ciclo TDD — aviso de solo lectura en `ObraSocialesPage`.** RED: con solo `read` en `obra_social`, la pantalla informa el modo solo lectura, tanto en la vista de lista como en la de detalle (una sola inserción en la página de 43 líneas cubre ambas). TRIANGULATE: con `write` no aparece.
- [x] 4.9 **Ciclo TDD — el permiso de otro módulo no habilita este.** RED: cuenta con `write` en `pacientes` y solo `read` en `obra_social` → la pantalla de obras sociales queda en modo solo lectura. TRIANGULATE: invertir (con `write` en `obra_social` y solo `read` en `pacientes`) → obras sociales queda escribible.
- [x] 4.10 Verificar que ninguno de los 7 componentes cableados importa un literal de módulo (`'obra_social'`) para gatear: todo pasa por el contexto (design.md D1/D2).
- [x] 4.11 `tsc -b --noEmit` + `oxlint` limpios. Suite completa: línea base de 1.1 intacta, **cero tests preexistentes de obras sociales modificados** para acomodar este change.

## 5. Verificación y cierre

- [x] 5.1 Suite completa: conteo ≥ línea base de 1.1, cero fallas, cero tests preexistentes editados para acomodar el change.
- [x] 5.2 `npx tsc -b --noEmit` y `npx oxlint` limpios. Cero `any` en el código nuevo. Cero `style={{}}`: solo utilidades Tailwind v4 y tokens de `index.css`.
- [x] 5.3 Auditoría OWASP A04 (*Insecure Design*): confirmar por lectura del diff que (a) el gateo está documentado como UX en todo el código nuevo, (b) no hay una segunda implementación de la jerarquía `read < write < admin`, (c) ninguna policy de RLS ni Edge Function fue tocada, (d) no se agregó ningún camino que escriba sorteando la RLS.
- [x] 5.4 Confirmar que el diff **no** contiene cambios en `supabase/`, ni en `permisos.ts`, ni en `usePermiso.ts`, ni en `app/routes.ts` (más allá de comentarios), ni en el gateo de `read` de `RequireAuth`/`SidebarNav`.
- [x] 5.5 Confirmar que las pantallas de los otros tres módulos siguen **exactamente como antes** (nada gateado todavía): el mecanismo es opt-in, así que montar el proveedor no debe cambiar Pacientes, Facturación ni Conductores.
- [x] 5.6 Documentar la firma pública del mecanismo compartido (contexto, `usePuedeEscribir()`, envoltorio de solo lectura, prop de `Button`, patrón del aviso) en un comentario de referencia, para que los otros 3 changes lo consuman sin re-derivarlo.
- [x] 5.7 Actualizar `CHANGES.md`: marcar este change como implementado en la nota de gateo de escritura bajo C-02, siguiendo el patrón de la nota de `auth-frontend-real`.
- [ ] 5.8 Commit(s) en Conventional Commits: uno para el mecanismo compartido (`feat(auth): …`) y uno para el cableado (`feat(obras-sociales): …`), para que el diff quede dentro del presupuesto de revisión de ~400 líneas por PR. **Pendiente a propósito**: el protocolo de git del agente exige pedido explícito del usuario antes de comitear; el working tree queda listo para revisar y comitear (o pedir los 2 commits) cuando la usuaria confirme.
- [ ] 5.9 **Verificación manual humana** (no automatizable con mocks) — a cargo de la usuaria: con una cuenta real de solo `read` sobre `obra_social`, confirmar que (a) *Crear*/*Editar*/*Guardar* están visibles pero bloqueados, (b) el aviso de solo lectura aparece, (c) *Cancelar* y *Volver al listado* funcionan, (d) las filas de checklist y de plantilla no se arrastran, (e) una cuenta con `write` no ve nada deshabilitado, y (f) una escritura forzada sigue siendo rechazada por la RLS. **Pendiente — requiere la usuaria y el proyecto Supabase real, no automatizable.**
- [x] 5.10 Reportar la tabla de evidencia del ciclo TDD (Tarea · archivo de test · capa · red de seguridad · RED · GREEN · TRIANGULATE · REFACTOR) exigida por el modo Strict TDD.
