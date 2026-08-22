# Spec: Datos del formulario de la obra social en el presupuesto

## ADDED Requirements

### Requirement: Bloque de datos de traslado propio del presupuesto

El sistema SHALL registrar en `Presupuesto` un bloque `datosTraslado` que replica el formulario de la
obra social: `origenIda`, `destinoIda`, `origenVuelta`, `destinoVuelta` (texto), `horarioEntrada` y
`horarioSalida` (formato `'HH:MM'`), `kmIda` y `kmVuelta` (numéricos), `diasSemana` (arreglo de la
unión cerrada `DiaSemana`) y `diasMensuales` (entero). Todos los campos MUST ser opcionales salvo
`diasSemana`, que MUST tener `[]` como valor vacío y nunca `undefined` en la base.

Estos datos MUST persistirse como columnas propias de `facturacion.presupuesto`. El sistema MUST NOT
referenciar `pacientes.recorridos` (`RecorridoHabitual`) mediante clave foránea ni reusar esa entidad
para persistirlos, porque son una declaración congelada presentada a la obra social y no el estado
actual del paciente.

#### Scenario: Los datos del presupuesto no cambian cuando cambia la rutina del paciente

- **GIVEN** un presupuesto ya presentado con `horarioEntrada = '08:00'` copiado de los destinos
  habituales del paciente
- **WHEN** después se edita el `RecorridoHabitual` del paciente a `'09:30'`
- **THEN** el presupuesto sigue mostrando `'08:00'`
- **AND** ninguna autorización ni factura asociada cambia de contenido

#### Scenario: Ida y vuelta se registran por separado

- **WHEN** se cargan `kmIda = 12.5` y `kmVuelta = 14`
- **THEN** ambos se persisten como valores distintos
- **AND** el sistema MUST NOT colapsarlos en un único valor de kilómetros

#### Scenario: Días de la semana como conjunto tipado

- **WHEN** se cargan los días `lunes`, `miércoles` y `viernes`
- **THEN** `diasSemana` es `['lunes', 'miercoles', 'viernes']`, tipado con la unión cerrada `DiaSemana`
- **AND** un valor desconocido que llegue del servidor se descarta en el mapeo, sin `any` ni `as`

#### Scenario: Días mensuales es un dato declarado, no calculado

- **GIVEN** que `diasMensuales` es el número negociado con la obra social que figura en su formulario
- **WHEN** se guarda un presupuesto
- **THEN** el sistema MUST NOT derivar `diasMensuales` del calendario ni de la cantidad de días de
  semana marcados
- **AND** el valor cargado por la usuaria se persiste tal cual

#### Scenario: Presupuesto sin datos de traslado

- **GIVEN** un presupuesto creado antes de este cambio
- **WHEN** se lo muestra
- **THEN** el detalle indica "Sin datos de traslado" en vez de campos vacíos o valores inventados

### Requirement: Prefill opt-in desde los destinos habituales, por copia

El sistema SHALL ofrecer, en el alta de un presupuesto, una acción explícita para **copiar** los
`RecorridoHabitual` vigentes del paciente a los campos del bloque de datos de traslado. La copia MUST
ser de una sola vez y los campos MUST quedar editables. El sistema MUST NOT establecer ninguna
referencia viva ni clave foránea entre el presupuesto y `pacientes.recorridos`.

#### Scenario: Copiar y luego editar

- **GIVEN** un paciente con destinos habituales cargados
- **WHEN** se usa la acción de traer esos datos y luego se edita el horario en el formulario
- **THEN** el presupuesto guarda el valor editado
- **AND** los destinos habituales del paciente quedan intactos

#### Scenario: Paciente sin destinos habituales

- **GIVEN** un paciente sin ningún `RecorridoHabitual`
- **WHEN** se abre el formulario de presupuesto
- **THEN** la acción de copiar aparece deshabilitada con el motivo visible
- **AND** no se oculta, para que la usuaria sepa que la función existe
