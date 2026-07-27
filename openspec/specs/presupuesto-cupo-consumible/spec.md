# Presupuesto Cupo Consumible

## Purpose
Defines the CupoAutorizado projection for consumption by billing features, exposing authorized quotas without implementing billing control.

## Requirements

### Requirement: Cupo autorizado expuesto como dato consumible por Facturación (FE-6)
El sistema SHALL exponer una proyección `CupoAutorizado` (`{ pacienteId, cupoMensualDias?, cupoMensualKm?, vigenciaDesde? }`) derivable de una `Autorizacion` autorizada y su `Presupuesto`, como el dato que FE-6 (`C-07`) consumirá para el control de facturación (RN-PA-03, RN-FA-02), sin implementar dicho control en este change.

#### Scenario: Derivación del cupo desde una autorización
- **WHEN** existe una autorización con `cupoMensualDias`/`cupoMensualKm` para el presupuesto de un paciente
- **THEN** se puede obtener un `CupoAutorizado` con el `pacienteId` del presupuesto y los cupos mensuales de la autorización, disponible como dato consultable

#### Scenario: El control de facturación no se implementa aquí
- **WHEN** se define `presupuesto-cupo-consumible`
- **THEN** solo se deja el `CupoAutorizado` consultable; la alerta por exceder el cupo al facturar (RN-FA-02) se aplica en FE-6 (`C-07`), no en este change
