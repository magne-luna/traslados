# Paciente Direcciones

## Purpose

Define the requirements for managing multiple addresses per patient, including the independent modeling of outbound and return trips (ida/vuelta) with separate data entry, type/category support (home, school, therapies, CISET, etc.), and days/hours of transport. Ensures traceability of addresses across the patient's record without auto-completion or implicit assumptions about symmetry.

---

## Requirements

### Requirement: Direcciones múltiples por paciente
El sistema SHALL permitir registrar múltiples direcciones por paciente (domicilio, escuela, terapias, CISET), cada una con su tipo/etiqueta y, opcionalmente, días y horarios de traslado (RF-113). Al renderizar la lista de direcciones, el sistema MUST usar un identificador estable por dirección como key (nunca el índice del array).

#### Scenario: Alta de varias direcciones de distinto tipo
- **WHEN** el usuario agrega un domicilio y una escuela al mismo paciente
- **THEN** ambas quedan registradas como direcciones independientes del paciente y se persisten vía `update()`

### Requirement: Ida y vuelta como registros independientes
El sistema SHALL modelar la dirección de ida y la de vuelta como registros independientes por tramo (RN-HR-02): cada dirección lleva su `tramo` (`ida | vuelta`) y no se asume que la vuelta es el trayecto inverso de la ida. El formulario MUST NOT autocompletar ni derivar la dirección de vuelta a partir de la de ida; ambos tramos se editan de forma explícita y separada.

#### Scenario: La vuelta no se autocompleta desde la ida
- **WHEN** el usuario carga la dirección de ida de un destino
- **THEN** el sistema NO copia esos datos al tramo de vuelta; la vuelta queda en blanco hasta que el usuario la complete manualmente

#### Scenario: Ida y vuelta pueden diferir
- **WHEN** un paciente tiene, para un mismo destino, una dirección de ida y una de vuelta con datos distintos
- **THEN** ambas se persisten y se releen sin fusionarse ni sobrescribirse entre sí

#### Scenario: Editar un tramo no altera el otro
- **WHEN** el usuario edita la dirección de vuelta
- **THEN** la dirección de ida correspondiente permanece sin cambios
