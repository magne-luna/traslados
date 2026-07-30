# Tareas — gateo-facturacion

> **Change 3 de 4** del split de gateo de escritura. **Consume** el mecanismo compartido que construyó `gateo-obrasocial`; no lo modifica.
> Módulo: `facturacion` · Rutas: `/presupuestos` **y** `/facturacion` (las dos bajo el mismo permiso, tal cual `seed_modulos.sql`)
>
> **Modo Strict TDD activo** (`openspec/config.yaml` → `testing.strict_tdd: true`).
> Runner: `cd frontend && npx vitest run` · Tipos: `cd frontend && npx tsc -b --noEmit` · Lint: `cd frontend && npx oxlint`
>
> Cada tarea de implementación es **un ciclo TDD completo** sobre **un solo comportamiento**:
> **RED** (test que falla primero) → **GREEN** (mínimo código para pasar) → **TRIANGULATE** (≥2 casos: camino feliz + borde) → **REFACTOR** (tests verdes tras cada paso).
> Ninguna tarea se marca `[x]` sin haber ejecutado el runner y visto pasar sus tests.
>
> **Decisiones ya cerradas por la usuaria** (no re-abrir): deshabilitar nunca ocultar · sí al aviso visible · 4 changes uno por módulo · el módulo `facturacion` gatea **las dos** rutas · **todas las acciones no-CRUD (emitir, cobrar, corregir estado, asistencias) al nivel `write`, ninguna requiere `admin`**.

## 0. Compuerta de gobernanza (bloqueante)

- [ ] 0.1 Obtener **aprobación humana explícita** para escribir código en este change (gobernanza CRÍTICO — dominio auth/permisos). Sin esto, ninguna tarea posterior arranca.
- [ ] 0.2 Confirmar que `gateo-obrasocial` está aplicado y que el mecanismo compartido está disponible: contexto en `RequireAuth`, `usePuedeEscribir()`, envoltorio de solo lectura, prop opt-in en `Button`, patrón del aviso con `Alert`. Si falta alguna pieza, **detenerse**: se completa allá, no acá.

## 1. Red de seguridad y línea base

- [ ] 1.1 Ejecutar `cd frontend && npx vitest run` y registrar el conteo exacto de tests que pasan. Es la línea base del change.
- [ ] 1.2 Si algún test falla en la línea base, **detenerse** y reportarlo como falla preexistente. No arreglarlo dentro de este change.
- [ ] 1.3 `npx tsc -b --noEmit` y `npx oxlint` limpios sobre el árbol intacto (o registrar el ruido preexistente).
- [ ] 1.4 Registrar la línea base específica de las dos features: ejecutar los tests de `features/facturacion/` y `features/presupuestos/` y anotar los conteos por separado (~2800 y ~2000 líneas de código). Al cierre deben estar intactos.
- [ ] 1.5 Verificar que `moduloDeRuta('/presupuestos')` y `moduloDeRuta('/facturacion')` devuelven **los dos** `facturacion` (`app/routes.ts`). Si no, el gateo de este change se resolvería contra el módulo equivocado y hay que corregir el mapeo antes de seguir.

## 2. Ruta `/presupuestos` — listado, resumen y formulario

> Spec: escenarios "Alta y edición de presupuestos", "Guardado del formulario de presupuesto".

- [ ] 2.1 **Ciclo TDD — alta desde el listado.** RED: con solo `read` en `facturacion`, *Crear presupuesto* (`PresupuestosList:54`) y *Crear el primero* (`:76`) quedan **visibles** y no activables. TRIANGULATE: con `write` ambas activables; con rol `admin` sin filas de permisos, ambas activables.
- [ ] 2.2 **Ciclo TDD — edición desde listado y resumen.** RED: con solo `read`, *Editar* por fila (`PresupuestosList:140`), su `<button>` nativo y el *Editar* de `PresupuestoResumen:59` quedan visibles y no activables. TRIANGULATE: con `write` todos activables; y la fila del listado **sigue navegando** al detalle.
- [ ] 2.3 **Ciclo TDD — campos y guardado de `PresupuestoForm`.** RED: con solo `read`, ningún campo acepta entrada y *Guardar* (`:158`) no se puede activar. TRIANGULATE: con `write` todo editable y guardable; y con solo `read` **el repositorio mock no recibe ninguna llamada de escritura**.
- [ ] 2.4 **Ciclo TDD — `Cancelar` sobrevive al modo solo lectura.** RED: con solo `read`, `PresupuestoForm:155` (*Cancelar*) **sí** se puede activar y cierra el formulario. TRIANGULATE: ídem *Volver al listado* del detalle. Verificar que el envoltorio se aplicó al bloque de campos y **no** a la barra de acciones.
- [ ] 2.5 `tsc -b --noEmit` + `oxlint` limpios. Suite completa contra la línea base de 1.1.

## 3. Ruta `/presupuestos` — autorización

> Spec: escenario "Autorización de un presupuesto".

- [ ] 3.1 **Ciclo TDD — entrada a la edición de autorización.** RED: con solo `read`, la entrada a editar autorización (`PresupuestoDetail:233`) queda visible y no activable. TRIANGULATE: con `write` activable; con rol `admin` sin filas, activable.
- [ ] 3.2 **Ciclo TDD — campos y guardado de `AutorizacionForm`.** RED: con solo `read`, ningún campo acepta entrada y *Guardar* (`:226`) no se puede activar, sin escrituras al repositorio. TRIANGULATE: con `write` todo operativo; y con solo `read` los datos de la autorización **siguen siendo legibles**.
- [ ] 3.3 **Ciclo TDD — `Cancelar` de `AutorizacionForm`.** RED: con solo `read`, `AutorizacionForm:223` (*Cancelar*) **sí** se puede activar. TRIANGULATE: con `write` también activable.
- [ ] 3.4 `tsc -b --noEmit` + `oxlint` limpios. Suite completa contra la línea base.

## 4. Ruta `/facturacion` — listado, detalle y formulario

> Spec: escenarios "Alta y edición de facturas", "Guardado del formulario de factura".

- [ ] 4.1 **Ciclo TDD — alta desde el listado.** RED: con solo `read`, *Nueva factura* (`FacturasList:72`) y *Crear la primera* (`:102`) quedan visibles y no activables. TRIANGULATE: con `write` ambas activables; con rol `admin` sin filas, ambas activables.
- [ ] 4.2 **Ciclo TDD — edición desde listado y detalle.** RED: con solo `read`, *Editar* por fila (`FacturasList:172`), su `<button>` nativo y el *Editar* de `FacturaDetail:172` quedan visibles y no activables. TRIANGULATE: con `write` todos activables; y la fila del listado **sigue navegando** al detalle.
- [ ] 4.3 **Ciclo TDD — un solo envoltorio cubre los dos bloques de campos.** RED: con solo `read`, los campos de `FacturaFormDatosBasicos` y `FacturaFormEconomicos` quedan inertes con **una sola** inserción del envoltorio en `FacturaForm` (design.md D3), y *Guardar* (`:197`) no se puede activar. TRIANGULATE: con `write` los dos bloques aceptan entrada y se guarda; verificar que los dos archivos de campos **no cambiaron ni una línea** ni recibieron props nuevas.
- [ ] 4.4 **Ciclo TDD — `Cancelar` sobrevive al modo solo lectura.** RED: con solo `read`, `FacturaForm:196` (*Cancelar*) **sí** se puede activar y cierra el formulario. TRIANGULATE: ídem *Volver al listado* del detalle.
- [ ] 4.5 `tsc -b --noEmit` + `oxlint` limpios. Suite completa contra la línea base.

## 5. Ruta `/facturacion` — acciones que no son CRUD (design.md D2)

> Spec: escenarios "Emisión de una factura", "Registro de un cobro", "Corrección de estado de cobro", "Edición de asistencias y días facturables", "Acciones no-CRUD con nivel write".
> **Todas al nivel `write`, ninguna requiere `admin`** (decisión 5 de la usuaria). Están dispersas en 5 componentes chicos y son fáciles de pasar por alto: un ciclo por acción.

- [ ] 5.1 **Ciclo TDD — emisión de factura.** RED: con solo `read`, *Emitir factura* (`FacturaAccionesEmision:38`) y *Confirmar emisión* (`:46`) quedan visibles y no activables. TRIANGULATE: con `write` **ambas activables** (no requieren `admin`); con rol `admin` sin filas, ambas activables.
- [ ] 5.2 **Ciclo TDD — registro de cobro.** RED: con solo `read`, *Registrar cobro* (`CobrosPanel:170`), su `<button>` nativo y sus campos quedan inertes. TRIANGULATE: con `write` operativo; y con solo `read` los cobros ya registrados **siguen legibles**.
- [ ] 5.3 **Ciclo TDD — corrección de estado.** RED: con solo `read`, *Aplicar* (`FacturaCobrosSection:59`) queda visible y no activable. TRIANGULATE: con `write` activable; con rol `admin` sin filas, activable.
- [ ] 5.4 **Ciclo TDD — edición de asistencias.** RED: con solo `read`, la edición de `AsistenciasEditor` (`:119`), su `<button>` nativo y sus campos quedan inertes. TRIANGULATE: con `write` operativo; y con solo `read` las asistencias **siguen legibles**.
- [ ] 5.5 **Ciclo TDD — días facturables.** RED: con solo `read`, la selección de `DiasFacturablesSelector` queda inerte. TRIANGULATE: con `write` operativa; y con solo `read` la selección actual **sigue legible**.
- [ ] 5.6 **Ciclo TDD — `write` alcanza para todas las acciones de dinero.** RED: cuenta con `write` sobre `facturacion` y **sin** rol `admin` → puede emitir, cobrar, corregir estado y editar asistencias. TRIANGULATE: la misma cuenta con solo `read` → las cuatro bloqueadas. Este ciclo es la verificación explícita de la decisión 5.
- [ ] 5.7 `tsc -b --noEmit` + `oxlint` limpios. Suite completa contra la línea base.

## 6. Lectura preservada y documentos (design.md D4)

> Spec: escenarios "Lectura preservada en modo solo lectura", "Documentos de la factura sin permiso de escritura".

- [ ] 6.1 **Ciclo TDD — vistas de solo lectura intactas.** RED: con solo `read`, `FacturaResumen`, `FacturaImprimible`, `AlertaCupo` y `FacturaAvisoDiscrepancias` se renderizan **completos**. TRIANGULATE: con `write` también; y verificar que los cuatro archivos **no cambiaron ni una línea**.
- [ ] 6.2 **Ciclo TDD — la vista imprimible no se bloquea.** RED: con solo `read`, la vista imprimible de una factura se renderiza completa y es utilizable — bloquearla sería una regresión muy visible (design.md D4). TRIANGULATE: con `write` ídem.
- [ ] 6.3 **Ciclo TDD — documentos: carga y baja gateadas, consulta y descarga no.** RED: con solo `read`, cargar y dar de baja documentos en `FacturaDocumentos` queda inerte, y consultar y **descargar** los ya cargados sigue disponible. TRIANGULATE: con `write` las cuatro operaciones disponibles; y verificar que el gateo del cliente no es más restrictivo que la RLS.
- [ ] 6.4 `tsc -b --noEmit` + `oxlint` limpios. Suite completa contra la línea base.

## 7. Aviso de solo lectura y coherencia entre rutas (design.md D1, D5)

> Spec: escenarios "Aviso de modo solo lectura en las dos rutas", "Coherencia del permiso entre las dos rutas".

- [ ] 7.1 **Ciclo TDD — aviso en `PresupuestosPage`.** RED: con solo `read` en `facturacion`, la pantalla de presupuestos informa el modo solo lectura, en la vista de listado y en la de detalle. TRIANGULATE: con `write` no aparece.
- [ ] 7.2 **Ciclo TDD — aviso en `FacturacionPage`.** RED: con solo `read`, la pantalla de facturación informa el modo solo lectura, en listado y en detalle. TRIANGULATE: con `write` no aparece.
- [ ] 7.3 Verificar que los dos avisos usan el **mismo** tono, texto y ubicación que fijó `gateo-obrasocial` en `ObraSocialesPage` (design.md D5).
- [ ] 7.4 **Ciclo TDD — coherencia entre las dos rutas.** RED: una **única** cuenta con solo `read` en `facturacion` queda en solo lectura en `/presupuestos` **y** en `/facturacion`. TRIANGULATE: la misma cuenta con `write` en `facturacion` tiene escritura en las dos; y una cuenta con `write` solo en `pacientes` sigue en solo lectura en las dos. Un gateo que funcione en una ruta y no en la otra es un fallo silencioso (design.md D1).
- [ ] 7.5 `tsc -b --noEmit` + `oxlint` limpios. Suite completa contra la línea base.

## 8. Verificación y cierre

- [ ] 8.1 Suite completa: conteo ≥ línea base de 1.1, cero fallas, **cero tests preexistentes de facturación ni de presupuestos editados** para acomodar el change (verificar contra la línea base de 1.4).
- [ ] 8.2 `npx tsc -b --noEmit` y `npx oxlint` limpios. Cero `any` en el código nuevo. Cero `style={{}}`: solo utilidades Tailwind v4 y tokens de `index.css`.
- [ ] 8.3 Auditoría OWASP A04 (*Insecure Design*): confirmar por lectura del diff que (a) el gateo está documentado como UX en el código nuevo, (b) no hay una segunda implementación de la jerarquía `read < write < admin`, (c) ninguna policy de RLS ni Edge Function fue tocada, (d) no se agregó ningún camino que escriba sorteando la RLS, (e) el cliente **no es más restrictivo** que la RLS en ninguna acción (ninguna exige `admin` donde el servidor pide `write`).
- [ ] 8.4 Confirmar que el diff **no** contiene cambios en el mecanismo compartido (contexto, `usePuedeEscribir()`, envoltorio, `Button`), ni en `supabase/`, ni en `permisos.ts`, ni en `usePermiso.ts`, ni en `app/routes.ts`, ni en el gateo de `read` de `RequireAuth`/`SidebarNav`. Si hizo falta tocar el mecanismo, es señal de que el change 1 quedó incompleto.
- [ ] 8.5 Confirmar que las pantallas de `pacientes`, `obra_social` y `conductores` no cambiaron de comportamiento.
- [ ] 8.6 Grep de control: ningún componente de `features/facturacion/` ni de `features/presupuestos/` importa el literal `'facturacion'` para gatear escritura — todo pasa por el contexto.
- [ ] 8.7 Actualizar `CHANGES.md`: marcar este change como implementado en la nota de gateo de escritura bajo C-02.
- [ ] 8.8 Commit(s) en Conventional Commits, separados por ruta (`feat(presupuestos): …` y `feat(facturacion): …`) para que cada diff quede dentro del presupuesto de revisión de ~400 líneas por PR.
- [ ] 8.9 **Verificación manual humana** (no automatizable con mocks) — a cargo de la usuaria: con una cuenta real de solo `read` sobre `facturacion`, confirmar que (a) en **las dos** rutas las acciones de escritura están visibles pero bloqueadas, (b) el aviso de solo lectura aparece en las dos, (c) *Cancelar* y *Volver al listado* funcionan, (d) *Emitir factura*, *Registrar cobro*, *Aplicar* corrección de estado y la edición de asistencias están bloqueados, (e) el resumen y la **vista imprimible** se renderizan completos y los documentos se pueden consultar y descargar, y (f) una cuenta con `write` (sin `admin`) puede hacer todo, incluidas las acciones de dinero.
- [ ] 8.10 Reportar la tabla de evidencia del ciclo TDD (Tarea · archivo de test · capa · red de seguridad · RED · GREEN · TRIANGULATE · REFACTOR) exigida por el modo Strict TDD.
