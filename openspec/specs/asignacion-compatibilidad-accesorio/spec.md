## ADDED Requirements

### Requirement: Validación RN-VE-01 como función pura (accesorio de movilidad compatible)
El sistema SHALL implementar una función pura `validarCompatibilidadAccesorio` que reciba los accesorios de movilidad del paciente y los accesorios compatibles del vehículo, y devuelva un resultado ok/error, rechazando la asignación cuando el paciente requiere un accesorio que el vehículo no soporta (RN-VE-01). Es un espejo en UI de la regla; el backend `C-10` la re-valida.

#### Scenario: Paciente con accesorio incompatible se rechaza
- **WHEN** el paciente tiene un `AccesorioMovilidad` que no está en `accesoriosCompatibles` del vehículo
- **THEN** `validarCompatibilidadAccesorio` devuelve un error (RN-VE-01) y la UI bloquea/alerta la asignación con un mensaje visible que nombra el accesorio incompatible

#### Scenario: Paciente compatible se acepta
- **WHEN** todos los accesorios de movilidad del paciente están en `accesoriosCompatibles` del vehículo
- **THEN** `validarCompatibilidadAccesorio` devuelve ok y la asignación procede

#### Scenario: Paciente sin accesorios de movilidad
- **WHEN** el array `accesorioMovilidad` del paciente está vacío
- **THEN** `validarCompatibilidadAccesorio` devuelve ok para cualquier vehículo (no hay restricción de accesorio que verificar)

#### Scenario: La validación es una función pura testeable
- **WHEN** se invoca `validarCompatibilidadAccesorio` con distintas combinaciones de accesorios
- **THEN** el resultado depende solo de sus argumentos (sin efectos de red ni de `localStorage`), permitiendo tests deterministas de RN-VE-01

### Requirement: Bloqueo de la asignación incompatible en la UI
El sistema SHALL bloquear en la pantalla de hoja de ruta la asignación de un paciente a un vehículo incompatible, sin persistir la asignación inválida.

#### Scenario: Intento de asignación incompatible no se persiste
- **WHEN** la operadora intenta arrastrar/asignar un paciente incompatible a un recorrido de un vehículo
- **THEN** la asignación no se agrega al recorrido ni se guarda en el repository, y se muestra el motivo (accesorio incompatible, RN-VE-01)
