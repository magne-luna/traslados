# Factura-Autorizacion-Seleccion Specification

## Purpose

Derivar, para un paciente dado, el conjunto de autorizaciones pendientes de facturar y ofrecerlas
como selección obligatoria en el paso 2 del wizard de alta de factura, de modo que cada factura
quede vinculada a la autorización explícita que la habilitó (`facturas.autorizacion_id`), en vez de
un prestador tipeado a mano o de una heurística que adivine la autorización correcta.

## Requirements

### Requirement: Derivación client-side de autorizaciones pendientes de facturar

El sistema SHALL derivar las autorizaciones pendientes de facturar de un paciente combinando
`PresupuestoRepository.list()` (filtrado por `pacienteId`) con `AutorizacionRepository.getByPresupuestoId(presupuestoId)` por cada presupuesto resultante, sin agregar ningún método nuevo a
ninguno de los dos repositories y sin ninguna RPC ni endpoint de lectura nuevo. "Pendiente de
facturar" MUST significar `autorizacion.estado === 'autorizada'`. El sistema MUST NOT filtrar por
período ya facturado: la responsabilidad de no elegir la misma autorización dos veces para el mismo
mes queda del lado del usuario, no del sistema.

#### Scenario: Solo las autorizaciones en estado `autorizada` aparecen como pendientes
- **GIVEN** un paciente con presupuestos cuyas autorizaciones están en distintos estados
- **WHEN** se derivan las autorizaciones pendientes de facturar de ese paciente
- **THEN** solo se incluyen las autorizaciones con `estado === 'autorizada'`, excluyendo cualquier
  otro estado y cualquier presupuesto sin autorización (`getByPresupuestoId` resuelve `null`)

#### Scenario: Paciente sin ninguna autorización pendiente
- **GIVEN** un paciente cuyos presupuestos no tienen ninguna autorización en estado `autorizada`
- **WHEN** se derivan sus autorizaciones pendientes de facturar
- **THEN** el resultado es una lista vacía, sin lanzar ni devolver `null`

#### Scenario: Varias autorizaciones simultáneas del mismo paciente
- **GIVEN** un paciente con más de un presupuesto, cada uno con su propia autorización en estado
  `autorizada`
- **WHEN** se derivan sus autorizaciones pendientes de facturar
- **THEN** el resultado incluye todas ellas, cada una junto con el presupuesto que la originó, sin
  descartar ninguna por existir otra simultánea

#### Scenario: Sin control de doble facturación del mismo período
- **GIVEN** una autorización que ya generó una factura para el mes en curso
- **WHEN** se derivan las autorizaciones pendientes de facturar de ese paciente
- **THEN** esa autorización sigue apareciendo como pendiente (el sistema no filtra ni advierte por
  período ya facturado) — riesgo de negocio aceptado y documentado, no una garantía del sistema

### Requirement: Selección de autorización en el paso 2 del wizard

El sistema SHALL presentar las autorizaciones pendientes de facturar del paciente elegido como un
selector en el paso 2 ("Autorización") del wizard de alta de factura. En modalidad
`por-prestacion`, donde un paciente puede tener varias autorizaciones simultáneas, cada opción del
selector MUST distinguirse mediante datos reales de la autorización y su presupuesto (por ejemplo
fecha de emisión, monto y cupos mensuales), sin inventar ningún campo que no exista en el dominio.
La selección MUST persistirse como `Factura.autorizacionId`.

#### Scenario: Selector poblado con las autorizaciones pendientes del paciente
- **GIVEN** un paciente elegido en el paso 1 con autorizaciones pendientes de facturar
- **WHEN** el usuario llega al paso 2 del wizard
- **THEN** el selector muestra cada autorización pendiente como una opción distinguible, sin
  duplicados y sin mezclar autorizaciones de otro paciente

#### Scenario: Elegir una autorización la vincula a la factura
- **WHEN** el usuario elige una autorización del selector
- **THEN** `values.autorizacionId` queda con el id de esa autorización, y ese valor es el que se
  persiste al guardar la factura

### Requirement: Persistencia N:1 sin control de unicidad

El sistema SHALL permitir que una misma autorización habilite más de una factura (relación N:1,
coherente con que el cupo mensual de la autorización es recurrente mes a mes). El sistema MUST NOT
imponer unicidad sobre `facturas.autorizacion_id`.

#### Scenario: Una autorización habilita facturas de distintos meses
- **GIVEN** una autorización ya vinculada a una factura de un mes anterior
- **WHEN** el usuario la elige nuevamente para una factura de un mes distinto
- **THEN** la nueva factura se persiste con éxito, vinculada a la misma autorización, sin que el
  sistema lo rechace por unicidad
