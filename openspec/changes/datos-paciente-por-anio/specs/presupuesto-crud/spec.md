## ADDED Requirements

### Requirement: El presupuesto usa los datos del año de su vigencia
El formulario de presupuesto SHALL determinar el año de referencia a partir de `vigenciaDesde`
(o de `fechaEmision` si no hay vigencia) y SHALL ofrecer solo las prestaciones activas de ese año
y armar los datos de traslado con los destinos habituales de ese año. Si cambia la fecha de
vigencia a otro año, las prestaciones ya elegidas que no pertenezcan al nuevo año SHALL quitarse
con un aviso visible.

#### Scenario: Presupuesto 2027 cargado en octubre 2026
- **WHEN** la operadora crea un presupuesto con vigencia desde 2027-01-01 para un paciente con prestaciones en 2026 y 2027
- **THEN** el formulario solo ofrece las prestaciones de 2027

#### Scenario: Año sin prestaciones
- **WHEN** el año de la vigencia no tiene prestaciones activas para el paciente
- **THEN** el formulario muestra el estado vacío con enlace a la ficha del paciente en esa pestaña de año y no permite guardar un presupuesto por prestación

### Requirement: La obra social del presupuesto sale de la cobertura vigente
El formulario SHALL completar la obra social con la cobertura del paciente vigente en
`vigenciaDesde`. Si no hay cobertura vigente en esa fecha, SHALL bloquear el guardado con un
mensaje que remite a la ficha del paciente. Los presupuestos ya guardados SHALL conservar su obra
social aunque la cobertura del paciente cambie después.

#### Scenario: Cambio de obra social a mitad de año
- **WHEN** el paciente tiene OS A hasta 2027-07-31 y OS B desde 2027-08-01, y se crea un presupuesto con vigencia desde 2027-08-01
- **THEN** el presupuesto queda con OS B

#### Scenario: Presupuesto viejo tras cambio de cobertura
- **WHEN** un presupuesto 2025 con OS A se abre después de que el paciente pasó a OS B
- **THEN** el presupuesto sigue mostrando OS A
