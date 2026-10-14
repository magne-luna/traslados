## ADDED Requirements

### Requirement: Destinos habituales del año de la fecha de la hoja
Al sugerir los destinos habituales de un día para armar la hoja de ruta, el sistema SHALL usar
solo los destinos habituales del año de la fecha de la hoja que coinciden con su día de semana.

#### Scenario: Hoja del 2027-03-01
- **WHEN** se arma la hoja de ruta del lunes 2027-03-01 para un paciente con destinos de lunes en 2026 y en 2027
- **THEN** solo se sugieren los destinos de lunes del año 2027

#### Scenario: Año sin destinos cargados
- **WHEN** se arma una hoja de un año en el que el paciente no tiene destinos habituales
- **THEN** no se sugiere ningún destino para ese paciente y el armado manual sigue disponible
