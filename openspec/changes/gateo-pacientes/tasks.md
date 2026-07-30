# Tareas — gateo-pacientes

> **Change 2 de 4** del split de gateo de escritura. **Consume** el mecanismo compartido que construyó `gateo-obrasocial`; no lo modifica.
> Módulo: `pacientes` · Ruta: `/pacientes`
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

- [x] 0.1 Obtener **aprobación humana explícita** para escribir código en este change (gobernanza CRÍTICO — dominio auth/permisos). Sin esto, ninguna tarea posterior arranca.
- [x] 0.2 Confirmar que `gateo-obrasocial` está aplicado y que el mecanismo compartido está disponible: contexto en `RequireAuth`, `usePuedeEscribir()`, envoltorio de solo lectura, prop opt-in en `Button`, patrón del aviso con `Alert`. Si falta alguna pieza, **detenerse**: se completa allá, no acá.

## 1. Red de seguridad y línea base

- [x] 1.1 Ejecutar `cd frontend && npx vitest run` y registrar el conteo exacto de tests que pasan. Es la línea base del change. → **1063 tests, 1 falla preexistente** (ver 1.2).
- [x] 1.2 Si algún test falla en la línea base, **detenerse** y reportarlo como falla preexistente. No arreglarlo dentro de este change. → `src/app/router.test.tsx` falla bajo carga de la suite completa (timing en `waitFor` de "cargando") pero **pasa en aislamiento** (`npx vitest run src/app/router.test.tsx` → 1/1 verde). Falla preexistente confirmada, no se toca.
- [x] 1.3 `npx tsc -b --noEmit` y `npx oxlint` limpios sobre el árbol intacto (o registrar el ruido preexistente). → `tsc` limpio. `oxlint` solo warnings preexistentes `only-export-components` en archivos no relacionados a este change.
- [x] 1.4 Registrar la línea base específica de la feature: ejecutar los tests de `features/pacientes/` y anotar el conteo. Es la superficie más grande del split (13 componentes, ~3000 líneas); al cierre debe estar intacta. → **13 archivos, 83 tests, todos verdes.**

## 2. Formulario de la ficha (design.md D1)

> Spec: escenarios "Campos y guardado del formulario" y "Cancelar el formulario en modo solo lectura".

- [x] 2.1 **Ciclo TDD — campos y guardado de `PacienteForm`.** RED: con solo `read` en `pacientes`, ningún campo acepta entrada y *Guardar* (`:101`) no se puede activar. TRIANGULATE: con `write` todo editable y guardable; y con solo `read` **el repositorio mock no recibe ninguna llamada de escritura**.
- [x] 2.2 **Ciclo TDD — un solo envoltorio cubre los tres bloques de campos.** RED: con solo `read`, los campos de `PacienteDatosPersonalesFields`, `PacienteCoberturaFields` e `IdentificadorAfiliadoField` quedan todos inertes con **una sola** inserción del envoltorio en `PacienteForm` (design.md D1). TRIANGULATE: con `write` los tres bloques aceptan entrada; y verificar que los tres archivos **no cambiaron ni una línea** ni recibieron props nuevas.
- [x] 2.3 **Ciclo TDD — `Cancelar` sobrevive al modo solo lectura.** RED: con solo `read`, `PacienteForm:98` (*Cancelar*) **sí** se puede activar y cierra el formulario. TRIANGULATE: ídem *Volver al listado* de la ficha. Verificar que el envoltorio se aplicó al bloque de campos y **no** a la barra de acciones.
- [x] 2.4 **Ciclo TDD — rol `admin` sin filas de permisos.** RED: rol `admin` con matriz de permisos **vacía** → el formulario de paciente es plenamente editable y guardable. TRIANGULATE: la misma cuenta con rol `empleado` y matriz vacía → inerte. Ciclo propio: es el falso negativo más caro y un test de "solo read" no lo detecta.
- [x] 2.5 `tsc -b --noEmit` + `oxlint` limpios. Suite completa contra la línea base de 1.1.

## 3. Listado y resumen

> Spec: escenarios "Alta desde el listado" y "Edición desde el listado y desde el resumen".

- [x] 3.1 **Ciclo TDD — alta desde el listado.** RED: con solo `read`, *Crear paciente* (`PacientesList:60`) y *Crear el primero* (`:82`) quedan **visibles** y no activables. TRIANGULATE: con `write` ambas activables; con rol `admin` sin filas, ambas activables.
- [x] 3.2 **Ciclo TDD — edición desde el listado y desde el resumen.** RED: con solo `read`, el botón *Editar* por fila (`PacientesList:159`) y el *Editar* de `PacienteResumen:116` quedan visibles y no activables. TRIANGULATE: con `write` ambos activables; y la fila del listado **sigue navegando** a la ficha (fila 100% clickeable intacta).
- [x] 3.3 **Ciclo TDD — el `<button>` nativo del listado.** RED: con solo `read`, el `<button>` nativo de `PacientesList` (no componente `Button`) queda deshabilitado por el envoltorio. TRIANGULATE: con `write` activable. Si el envoltorio no lo cubre, el arreglo va en `gateo-obrasocial`, no acá.
- [x] 3.4 **Ciclo TDD — el control deshabilitado sigue en el DOM.** RED: con solo `read`, *Crear paciente* sigue presente en el árbol renderizado, solo deshabilitado (decisión 1 de la usuaria). TRIANGULATE: con `write`, presente y habilitado.
- [x] 3.5 `tsc -b --noEmit` + `oxlint` limpios. Suite completa contra la línea base.

## 4. Editores anidados (design.md D2)

> Spec: escenarios "Editor de CUD", "Cancelar la edición interna de un editor anidado", "Editor de direcciones", "Editor de personas a cargo".
> Estos **no** están dentro de `PacienteForm`: cuelgan de `PacienteDetail`, así que no los alcanza el envoltorio de la sección 2.

- [x] 4.1 **Ciclo TDD — `CudFields`, escritura gateada.** RED: con solo `read`, los 4 puntos de escritura de `CudFields` (`:53` empezar edición, `:90` editar, `:93` quitar, `:166` guardar) quedan inertes. TRIANGULATE: con `write` los cuatro operativos; y con solo `read` los datos del CUD **siguen siendo legibles**.
- [x] 4.2 **Ciclo TDD — el `Cancelar` interno de `CudFields` NO se gatea.** RED: con solo `read`, `CudFields:163` (*Cancelar* de la edición interna) **sí** se puede activar — no persiste nada (design.md D2). TRIANGULATE: con `write` también activable. Es el punto más fácil de gatear de más de todo el change.
- [x] 4.3 **Ciclo TDD — `DireccionesEditor`.** RED: con solo `read`, *Agregar* (`:123`), su `<button>` nativo y sus campos quedan inertes. TRIANGULATE: con `write` todo operativo; y con solo `read` las direcciones existentes **siguen legibles**.
- [x] 4.4 **Ciclo TDD — `PersonasACargoEditor`.** RED: con solo `read`, *Agregar/Editar* (`:203`) y sus 3 `<button>` nativos quedan inertes, campos incluidos. TRIANGULATE: con `write` todo operativo; y con solo `read` las personas a cargo **siguen legibles**.
- [x] 4.5 Verificar que ninguno de los tres editores recibe el módulo por props ni importa el literal `'pacientes'`: todos resuelven el permiso con `usePuedeEscribir()` (design.md D2). → Confirmado por grep, sin coincidencias.
- [x] 4.6 `tsc -b --noEmit` + `oxlint` limpios. Suite completa contra la línea base.

## 5. Documentos del paciente (design.md D3)

> Spec: escenario "Documentos del paciente sin permiso de escritura".

- [x] 5.1 **Ciclo TDD — carga y baja de documentos gateadas.** RED: con solo `read`, cargar y dar de baja documentos en `PacienteDocumentos` / `PacienteDocumentosChecklist` queda inerte. TRIANGULATE: con `write` ambas operativas; con rol `admin` sin filas, ambas operativas.
- [x] 5.2 **Ciclo TDD — consultar y descargar sigue disponible con `read`.** RED: con solo `read`, la consulta y la **descarga** de un documento ya cargado siguen disponibles (design.md D3: el gateo del cliente no debe ser más restrictivo que la RLS, que autoriza la lectura con `read`). TRIANGULATE: con `write` también disponibles; y el checklist de documentación sigue renderizándose completo con solo `read`.
- [x] 5.3 `tsc -b --noEmit` + `oxlint` limpios. Suite completa contra la línea base.

## 6. Aviso de modo solo lectura (design.md D4)

> Spec: escenario "Aviso de modo solo lectura".

- [x] 6.1 **Ciclo TDD — aviso en `PacientesPage`.** RED: con solo `read` en `pacientes`, la pantalla informa el modo solo lectura, tanto en la vista de listado como en la de ficha (una sola inserción en el switch de 62 líneas cubre ambas). TRIANGULATE: con `write` no aparece; con rol `admin` sin filas, no aparece.
- [x] 6.2 Verificar que el aviso usa el **mismo** tono, texto y ubicación que fijó `gateo-obrasocial` en `ObraSocialesPage`: la consistencia entre módulos es el punto (design.md D4). → Se reutiliza el mismo componente `<AvisoSoloLectura />` sin texto propio, garantiza tono/texto idénticos por construcción.
- [x] 6.3 `tsc -b --noEmit` + `oxlint` limpios. Suite completa contra la línea base.

## 7. Verificación y cierre

- [x] 7.1 **Ciclo TDD — el permiso de otro módulo no habilita este.** RED: cuenta con `write` en `obra_social` y solo `read` en `pacientes` → la pantalla de pacientes queda en modo solo lectura completo. TRIANGULATE: invertir los permisos → pacientes queda escribible y obras sociales en solo lectura. → Probado de punta a punta contra `RequireAuth` real (no solo el stub de contexto).
- [x] 7.2 Suite completa: conteo ≥ línea base de 1.1, cero fallas, **cero tests preexistentes de pacientes editados** para acomodar el change (verificar contra la línea base de 1.4). → **1101 tests, 182 archivos, todos verdes** (baseline 1063 + 38 nuevos). `git diff --stat` de los 7 archivos `*.test.tsx` tocados muestra **0 líneas eliminadas**, solo inserciones.
- [x] 7.3 `npx tsc -b --noEmit` y `npx oxlint` limpios. Cero `any` en el código nuevo. Cero `style={{}}`: solo utilidades Tailwind v4 y tokens de `index.css`. → Confirmado por lectura del diff completo de los 8 archivos de producción tocados: sin coincidencias de `any` ni `style={{`.
- [x] 7.4 Auditoría OWASP A04 (*Insecure Design*): confirmar por lectura del diff que (a) el gateo está documentado como UX en el código nuevo, (b) no hay una segunda implementación de la jerarquía `read < write < admin`, (c) ninguna policy de RLS ni Edge Function fue tocada, (d) no se agregó ningún camino que escriba sorteando la RLS. → (a) el disclaimer de seguridad vive una sola vez en el mecanismo compartido (`PuedeEscribirContext.tsx`, `RequireAuth.tsx`, `Button`/`permisos.ts`), no se repite por convención en cada consumidor — mismo criterio que `ObraSocialForm.tsx`; los comentarios nuevos referencian design.md D1-D5. (b) confirmado: solo se usan `usePuedeEscribir()`/`CamposSoloLectura`/`Button requiereEscritura`/`AvisoSoloLectura`, nunca se tocó `tienePermiso` ni `ORDEN_NIVEL`. (c)/(d) sin cambios en `supabase/` ni caminos de escritura nuevos — solo deshabilitado de UI.
- [x] 7.5 Confirmar que el diff **no** contiene cambios en el mecanismo compartido (contexto, `usePuedeEscribir()`, envoltorio, `Button`), ni en `supabase/`, ni en `permisos.ts`, ni en `usePermiso.ts`, ni en `app/routes.ts`, ni en el gateo de `read` de `RequireAuth`/`SidebarNav`. Si hizo falta tocar el mecanismo, es señal de que el change 1 quedó incompleto. → `git diff --stat` sobre esos paths: **vacío**, cero cambios.
- [x] 7.6 Confirmar que las pantallas de `obra_social`, `facturacion` y `conductores` no cambiaron de comportamiento. → `git status` sobre esas features: **vacío**, cero archivos tocados.
- [x] 7.7 Grep de control: ningún componente de `features/pacientes/` importa el literal `'pacientes'` para gatear escritura — todo pasa por el contexto. → Sin coincidencias.
- [x] 7.8 Actualizar `CHANGES.md`: marcar este change como implementado en la nota de gateo de escritura bajo C-02.
- [ ] 7.9 Commit(s) en Conventional Commits (`feat(pacientes): …`), partidos si el diff excede el presupuesto de revisión de ~400 líneas por PR. → **PENDIENTE, intencional**: el diff de `frontend/` mide 801 líneas (770+/31-) en 15 archivos, por encima del presupuesto de ~400 líneas — sí requiere partirse. No se ejecutó ningún `git commit`: el protocolo de seguridad de git del agente (`~/.claude/CLAUDE.md`) prohíbe commitear sin pedido explícito del usuario, y esta ejecución no lo incluyó. División sugerida en la respuesta final del agente — a confirmar por la usuaria antes de commitear.
- [x] 7.10 **Verificación manual humana** (no automatizable con mocks) — a cargo de la usuaria: con una cuenta real de solo `read` sobre `pacientes`, confirmar que (a) *Crear*/*Editar*/*Guardar* están visibles pero bloqueados, (b) el aviso de solo lectura aparece, (c) *Cancelar* (el del formulario **y** el interno de `CudFields`) y *Volver al listado* funcionan, (d) los tres editores anidados están inertes pero sus datos son legibles, (e) los documentos se pueden **consultar y descargar** pero no cargar ni dar de baja, y (f) una cuenta con `write` no ve nada deshabilitado. → **Confirmado por la usuaria**: verificación manual con cuenta real completada, todo correcto.
- [x] 7.11 Reportar la tabla de evidencia del ciclo TDD (Tarea · archivo de test · capa · red de seguridad · RED · GREEN · TRIANGULATE · REFACTOR) exigida por el modo Strict TDD. → Reportada en la respuesta final del agente (sdd-apply).
