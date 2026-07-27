## ADDED Requirements

### Requirement: Vista imprimible de factura y asistencia
El sistema SHALL proveer una vista imprimible/exportable que muestre la factura junto con su asistencia (US-400: "se puede imprimir/exportar la factura y su asistencia para subirlas al portal o enviarlas por mail a la obra social"). La vista MUST usar utilidades de impresión de Tailwind v4, sin estilos inline y sin ninguna librería de generación de PDF.

#### Scenario: La vista incluye factura y asistencia
- **WHEN** el usuario abre la vista imprimible de una factura
- **THEN** se muestran los datos de la factura (paciente, identificador, descripción, período, días, valor del km, cantidad de km, total, tipo de comprobante, estado) y el detalle de las asistencias/prestaciones declaradas

#### Scenario: Descripción congelada en la impresión
- **WHEN** se imprime una factura ya emitida
- **THEN** se imprime la descripción persistida en la factura, no una descripción recalculada con la plantilla actual de la obra social

#### Scenario: Sin librería de PDF ni estilos inline
- **WHEN** se implementa la vista imprimible
- **THEN** no se agrega ninguna dependencia de generación de PDF al proyecto, y el estilo de impresión se resuelve exclusivamente con clases utilitarias de Tailwind

#### Scenario: Componente presentacional
- **WHEN** se renderiza la vista imprimible
- **THEN** recibe la factura, sus asistencias, el paciente y la obra social por props y no consulta repositorios por su cuenta, de modo que siempre refleja el estado que se le pasa

#### Scenario: Cobros incluidos cuando existen
- **WHEN** la factura tiene cobros registrados
- **THEN** la vista imprimible incluye el detalle de cobros y el saldo pendiente
