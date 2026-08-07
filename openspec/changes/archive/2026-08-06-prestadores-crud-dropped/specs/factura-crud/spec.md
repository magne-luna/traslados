## MODIFIED Requirements

### Requirement: Formulario de carga de factura

El sistema SHALL proveer un formulario de alta y edición de factura con: selector de paciente,
período estructurado (mes 1-12 y año), prestación, domicilio del paciente, dependencia y retorno,
**valor del km de carga manual** (RN-FA-05), cantidad de km, cantidad de días y total.

El tipo de comprobante MUST pre-cargarse con un valor por defecto fijo y editable —
**`'A'`, marcado como provisorio y pendiente de confirmar** — porque `obraSocial.tipoComprobante`
(su fuente anterior, RN-FA-07) ya no existe: el campo se movió a `Prestador` (ver
`prestador-contract`) y esta rama **NO resuelve** todavía qué Prestador aplica cuando una ObraSocial
tiene varios vinculados (supuesto #5, ver `obra-social-prestador-vinculo` — bloqueante real para el
futuro change `desacople-prestacion-factura`, no para este change).
(Previously: el tipo de comprobante se pre-cargaba desde `obraSocial.tipoComprobante` del paciente
seleccionado, RN-FA-07.)

#### Scenario: El valor del km se carga a mano, sin automatización

- **WHEN** el usuario completa el formulario
- **THEN** el valor del km es un campo de entrada manual, sin autocompletado desde ninguna tabla de
  tarifas ni servicio externo (RN-FA-05: el nomenclador lo fija el Estado, no se automatiza en Fase 1)

#### Scenario: Tipo de comprobante con default fijo provisorio, no derivado de la obra social

- **GIVEN** que `plazoCobroDias`/`tipoComprobante` se movieron de `ObraSocial` a `Prestador`
  (supuesto #3) y que aún no está resuelto qué Prestador aplica en facturación general
  (supuesto #5)
- **WHEN** el usuario selecciona un paciente
- **THEN** el campo de tipo de comprobante se pre-carga con el default fijo `'A'`, documentado como
  provisorio, y permanece editable
- **AND** el formulario NO intenta derivar el valor desde ningún Prestador vinculado a la ObraSocial
  del paciente — esa selección automática queda explícitamente fuera de alcance de este change

#### Scenario: El domicilio se elige entre las direcciones del paciente

- **WHEN** el usuario elige el domicilio de la factura
- **THEN** las opciones provienen de `paciente.direcciones` (solo lectura, vía `PacienteRepository`)
  y se guarda solo el id de la dirección, sin embeber la dirección

#### Scenario: Total propuesto y editable

- **WHEN** el usuario carga valor del km y cantidad de km
- **THEN** el total se propone calculado como `valorKm × cantidadKm` y queda editable, porque el
  docx modela `Monto` como campo persistido propio de la factura

#### Scenario: Validación de campos obligatorios antes de guardar

- **WHEN** el usuario intenta guardar sin paciente, sin período, sin valor del km o sin cantidad de
  días
- **THEN** el formulario muestra el error correspondiente por campo y no invoca al repository

#### Scenario: Persistencia vía repository inyectado

- **WHEN** el usuario guarda una factura nueva o editada
- **THEN** el cambio se persiste llamando a `FacturaRepository.create()` / `update()` obtenido del
  context, sin que ningún componente importe la implementación mock directamente
