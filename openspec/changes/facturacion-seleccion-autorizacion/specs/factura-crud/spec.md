## MODIFIED Requirements

### Requirement: Formulario de carga de factura
El sistema SHALL proveer un formulario de alta y edición de factura con: selector de paciente,
período estructurado (mes 1-12 y año), prestación, domicilio del paciente, dependencia y retorno,
**valor del km de carga manual** (RN-FA-05), cantidad de km, cantidad de días y total. El tipo de
comprobante MUST pre-cargarse con un valor por defecto fijo (`TIPO_COMPROBANTE_DEFAULT`) y
permanecer **siempre editable a mano** — MUST NOT derivarse ni bloquearse a partir de ninguna
fuente, porque no existe ninguna entidad `Prestador` en el sistema. El paso 2 del wizard MUST pedir
la selección obligatoria de una **autorización pendiente de facturar** del paciente elegido
(capability `factura-autorizacion-seleccion`) y MUST bloquear el avance al resto del formulario
mientras no haya una autorización elegida.

(Previously: en modalidad `por-prestacion` el paso 2 pedía dos campos de texto libre,
`prestadorNombre`/`prestadorDomicilio`, sin entidad ni repository detrás, y bloqueaba el avance
mientras alguno estuviera vacío. Ahora el paso 2 pide la selección de una autorización, obligatoria
en toda modalidad.)

#### Scenario: El valor del km se carga a mano, sin automatización
- **WHEN** el usuario completa el formulario
- **THEN** el valor del km es un campo de entrada manual, sin autocompletado desde ninguna tabla de tarifas ni servicio externo (RN-FA-05: el nomenclador lo fija el Estado, no se automatiza en Fase 1)

#### Scenario: Tipo de comprobante siempre manual, sin auto-completar ni bloquearse
- **WHEN** el usuario completa el formulario, con cualquier obra social
- **THEN** el campo de tipo de comprobante se pre-carga con `TIPO_COMPROBANTE_DEFAULT` y permanece editable en todo momento — el sistema no lo deriva de `obraSocial.tipoComprobante` ni de ningún prestador, y no existe ningún estado de solo-lectura para este campo

#### Scenario: Selección de autorización obligatoria en el alta
- **GIVEN** un paciente elegido en el paso 1 con al menos una autorización pendiente de facturar
- **WHEN** el usuario llega al paso 2 ("Autorización") del formulario
- **THEN** se muestra un selector de las autorizaciones pendientes de ese paciente, y el avance al resto del formulario queda bloqueado hasta que el usuario elige una

#### Scenario: Avance bloqueado sin autorizaciones pendientes
- **GIVEN** un paciente elegido sin ninguna autorización en estado `autorizada`
- **WHEN** el usuario llega al paso 2 del formulario
- **THEN** se muestra un estado vacío con mensaje y link a Presupuestos, y el botón "Siguiente" queda bloqueado hasta que el paciente tenga alguna autorización pendiente

#### Scenario: Autorización de solo lectura en edición
- **GIVEN** una factura existente con una `autorizacionId` ya persistida
- **WHEN** el usuario abre esa factura en modo edición
- **THEN** la autorización se muestra de solo lectura y no puede recambiarse — la edición no bifurca

#### Scenario: El domicilio se elige entre las direcciones del paciente
- **WHEN** el usuario elige el domicilio de la factura
- **THEN** las opciones provienen de `paciente.direcciones` (solo lectura, vía `PacienteRepository`) y se guarda solo el id de la dirección, sin embeber la dirección

#### Scenario: Total propuesto y editable
- **WHEN** el usuario carga valor del km y cantidad de km
- **THEN** el total se propone calculado como `valorKm × cantidadKm` y queda editable, porque el docx modela `Monto` como campo persistido propio de la factura

#### Scenario: Validación de campos obligatorios antes de guardar
- **WHEN** el usuario intenta guardar sin paciente, sin período, sin valor del km o sin cantidad de días
- **THEN** el formulario muestra el error correspondiente por campo y no invoca al repository

#### Scenario: Persistencia vía repository inyectado
- **WHEN** el usuario guarda una factura nueva o editada
- **THEN** el cambio se persiste llamando a `FacturaRepository.create()` / `update()` obtenido del context, sin que ningún componente importe la implementación mock directamente

> Nota: los escenarios "Nombre y domicilio del prestador en modalidad por-prestación", "Avance
> bloqueado sin completar ambos campos del prestador" y "Sin campos de prestador en modalidad
> general" del requirement "Formulario de carga de factura" se retiran como parte de este MODIFIED
> (no eran requirements independientes, sino escenarios de ese mismo requirement). Reason: los
> campos `prestadorNombre`/`prestadorDomicilio` eran dos strings libres sin entidad ni columna real
> detrás, remanente del change revertido `sacar-prestadores`. Migration: reemplazados por los
> escenarios de selección de autorización agregados arriba; no hay migración de datos porque esos
> campos no tenían columna real en producción.
