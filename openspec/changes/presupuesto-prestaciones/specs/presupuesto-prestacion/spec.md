# Presupuesto Prestacion Specification

## Purpose

Defines the optional link between a `Presupuesto` and a single `pacientes.prestaciones` row, the
`ObraSocial.modalidadFacturacion`-driven branching of the alta flow (`por-prestacion` vs.
`general`), the atomic batch RPC path, and the `SECURITY INVOKER` write contract. Does not reopen
KB discrepancy #13: `presupuesto.monto` remains a single value in every branch.

## Requirements

### Requirement: `prestacionId` opcional, poblado solo en `por-prestacion`

El sistema SHALL agregar `prestacion_id UUID NULL REFERENCES pacientes.prestaciones(id)` a
`facturacion.presupuesto`. El campo MUST estar poblado únicamente cuando la obra social del
presupuesto tiene `modalidadFacturacion === 'por-prestacion'`. En modalidad `general` el campo
MUST permanecer `NULL` siempre. `monto` MUST NOT cambiar de tipo, nullability ni semántica: sigue
siendo un importe único (KB discrepancia #13, no reabierta).

#### Scenario: Alta en modalidad `por-prestacion` puebla `prestacionId`

- GIVEN una obra social con `modalidadFacturacion = 'por-prestacion'`
- WHEN se crea un presupuesto para una prestación puntual del paciente
- THEN el presupuesto queda con `prestacionId` igual al id de esa prestación

#### Scenario: Alta en modalidad `general` deja `prestacionId` en null

- GIVEN una obra social con `modalidadFacturacion = 'general'`
- WHEN se crea un presupuesto con el total calculado desde líneas de prestación+monto
- THEN el presupuesto queda con `prestacionId = null`
- AND `monto` es un único valor numérico, no una colección

### Requirement: Selector de prestaciones filtra solo activas

El sistema SHALL, en el formulario de presupuesto en modalidad `por-prestacion`, listar únicamente
prestaciones del paciente seleccionado con `activa = true`. El sistema MUST NOT excluir del
detalle de un presupuesto ya emitido una prestación que luego pasó a `activa = false`.

#### Scenario: El selector de alta no ofrece prestaciones inactivas

- GIVEN un paciente con una prestación activa y otra inactiva
- WHEN se abre el multi-select de prestaciones en modalidad `por-prestacion`
- THEN solo aparece la prestación activa

#### Scenario: Paciente sin prestaciones activas bloquea el submit

- GIVEN una obra social `por-prestacion` y un paciente sin prestaciones activas cargadas
- WHEN se abre el formulario de presupuesto
- THEN se muestra un empty state con enlace a la ficha del paciente en lugar de un select vacío
- AND el submit queda bloqueado con un mensaje explícito

### Requirement: Alta atómica en lote para modalidad `por-prestacion`

El sistema SHALL exponer `PresupuestoRepository.createLote(nuevos: NuevoPresupuesto[]):
Promise<Presupuesto[]>` respaldado por la RPC `facturacion.crear_presupuestos_lote(jsonb) RETURNS
uuid[]`. Un submit con N prestaciones seleccionadas MUST crear exactamente N presupuestos, cada
uno con su propio `prestacionId` y su propio `monto`, dentro de una única transacción: o entran
todos, o no entra ninguno. `create()` (alta simple) MUST NOT cambiar de firma.

#### Scenario: Alta en lote exitosa

- GIVEN un multi-select con 3 prestaciones y un monto cargado para cada una
- WHEN se envía el formulario
- THEN se crean exactamente 3 presupuestos, uno por prestación, cada uno con su `monto` propio

#### Scenario: Falla parcial no deja presupuestos huérfanos

- GIVEN un lote de 3 presupuestos donde el tercero viola una restricción de la base
- WHEN se invoca `crear_presupuestos_lote`
- THEN no queda ningún presupuesto del lote persistido, ni siquiera los dos primeros

#### Scenario: N presupuestos generan N autorizaciones independientes

- GIVEN un lote de presupuestos creado en modalidad `por-prestacion`
- WHEN posteriormente se cargan las autorizaciones
- THEN cada presupuesto del lote requiere su propia autorización 1:1, sin agrupamiento

### Requirement: Modalidad `general` suma líneas en el formulario sin persistirlas

El sistema SHALL, en modalidad `general`, permitir cargar líneas `{ prestacionId, monto }` en un
componente controlado (`PresupuestoLineasEditor`) que calcula el total en vivo. El sistema MUST NOT
persistir esas líneas: el único alta es un presupuesto con `monto` igual a la suma, vía
`crear_presupuesto_completo`.

#### Scenario: El total se calcula en vivo y es lo único que se envía

- GIVEN tres líneas con montos 100, 200 y 50.50
- WHEN se envía el formulario en modalidad `general`
- THEN se crea un único presupuesto con `monto = 350.50`
- AND no se persiste ninguna fila con el desglose de las líneas

#### Scenario: Modalidad `general` sin líneas cargadas usa el campo simple

- GIVEN una obra social `general` y ninguna línea agregada
- WHEN el usuario carga el formulario
- THEN el formulario ofrece el campo `monto` simple existente como alternativa válida

### Requirement: Escritura vía RPC `SECURITY INVOKER`

El sistema SHALL escribir presupuestos exclusivamente a través de `facturacion.crear_presupuesto_completo`
y `facturacion.crear_presupuestos_lote`, ambas `SECURITY INVOKER` explícito. El sistema MUST NOT
usar `SECURITY DEFINER` en ninguna de las dos funciones nuevas. El Edge Function
`supabase/functions/presupuestos/index.ts` SHALL invocar la RPC en lugar de hacer
`.from('presupuesto').insert(...)` directo contra la tabla.

#### Scenario: Usuario sin permiso de escritura no puede crear presupuestos

- GIVEN un usuario con `presupuestos: read` pero sin `presupuestos: write`
- WHEN intenta invocar `crear_presupuesto_completo` o `crear_presupuestos_lote`
- THEN la operación es rechazada por RLS bajo la sesión del usuario invocante
- AND no se persiste ninguna fila

#### Scenario: Las funciones nuevas nunca son `SECURITY DEFINER`

- GIVEN el texto fuente de las dos migraciones de RPC
- WHEN se inspecciona la declaración de cada función
- THEN ambas están marcadas `SECURITY INVOKER` explícito
- AND ninguna contiene `SECURITY DEFINER` fuera de comentarios o literales

### Requirement: Cambiar de paciente u obra social resetea la selección de montos

El sistema SHALL resetear el bloque de montos (líneas o selección de prestaciones) cuando el
usuario cambia el paciente o la obra social después de haber cargado datos, con aviso explícito al
usuario, nunca en silencio.

#### Scenario: Cambio de paciente con selección cargada

- GIVEN un formulario en modalidad `por-prestacion` con 2 prestaciones ya seleccionadas
- WHEN el usuario cambia el paciente elegido
- THEN la selección de prestaciones se limpia
- AND se muestra un aviso indicando que la selección se reinició
