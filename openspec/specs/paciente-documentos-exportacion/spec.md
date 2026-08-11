# Paciente Documentos Exportación

## Purpose

Permite sacar del sistema los **archivos reales** ya cargados de una actividad puntual del
paciente, empaquetados en un `.zip` listo para armar el legajo y entregarlo a un tercero (botón
"Exportar").

---

## Requirements

### Requirement: Los archivos reales de una actividad se pueden descargar en un solo paso

El sistema SHALL permitir descargar, en un solo paso, los documentos ya cargados de **una actividad
puntual** del paciente, empaquetados en un único archivo `.zip`, de forma independiente de las demás
actividades del mismo paciente.

La descarga SHALL abarcar exactamente los documentos de esa actividad, y MUST NOT incluir documentos
de otras actividades del paciente ni del bloque general.

El nombre del archivo `.zip` SHALL identificar sin ambigüedad al paciente, a la actividad y a la fecha
de la descarga.

#### Scenario: Descargar los archivos de una actividad

- **GIVEN** una actividad con varios documentos ya cargados
- **WHEN** el usuario hace clic en "Exportar"
- **THEN** el navegador descarga un `.zip` que contiene el contenido real de esos documentos, con un
  nombre que identifica al paciente y a la actividad

#### Scenario: Descargar los archivos de dos actividades da dos archivos distintos

- **GIVEN** un paciente con dos actividades, cada una con su propia documentación cargada
- **WHEN** el usuario exporta cada una por separado
- **THEN** cada `.zip` contiene únicamente los documentos de su propia actividad, y ninguno incluye
  documentos de la otra

### Requirement: La descarga de archivos reales tolera documentos individuales no disponibles

Un documento que no se pueda incluir (no previsualizable, o un fallo al obtener su contenido) MUST NOT
abortar la descarga completa: el resto de los documentos de la actividad SHALL incluirse igual, y el
`.zip` resultante SHALL dejar constancia legible de qué documento no se pudo incluir y por qué.

#### Scenario: Un documento no disponible no impide descargar el resto

- **GIVEN** una actividad con varios documentos cargados, uno de los cuales no tiene contenido
  disponible para incluir
- **WHEN** el usuario exporta esa actividad
- **THEN** el `.zip` se descarga igual, con el resto de los documentos, y deja registro de cuál
  quedó afuera y por qué

### Requirement: Descargar los archivos reales no modifica nada ni exige más permiso que verlos

La descarga SHALL ser una operación de solo lectura: MUST NOT crear, modificar, mover ni eliminar
ningún documento, y MUST NOT cambiar el estado documental del paciente.

El permiso de lectura sobre el módulo de pacientes SHALL ser suficiente para descargar los archivos;
no se SHALL exigir permiso de escritura.

#### Scenario: Descargar en modo solo lectura

- **GIVEN** un usuario con permiso de lectura pero no de escritura sobre el módulo de pacientes
- **WHEN** descarga los archivos reales de una actividad
- **THEN** la descarga se completa con normalidad
