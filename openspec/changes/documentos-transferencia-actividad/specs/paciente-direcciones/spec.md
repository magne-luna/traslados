## ADDED Requirements

> **Nota de estado.** Depende del **Checkpoint (a)** de `design.md` (el del video pendiente de la
> clienta), sin veredicto (`tasks.md` §0). Redactado sobre el default elegido: una acción explícita por
> fila. Si el video muestra un modelo de selección persistente, esta acción cambia de forma.

### Requirement: Cada actividad listada ofrece llegar a su documentación

En el listado de direcciones del paciente, cada dirección que constituye una actividad —es decir, toda
dirección que no es el domicilio del paciente y que por lo tanto tiene checklist documental propio—
SHALL ofrecer una acción explícita para llegar a su documentación.

La acción SHALL ser hermana de las ya disponibles por fila (editar y quitar) y MUST NOT reemplazarlas
ni alterar su comportamiento.

El resultado de usarla se especifica en la capacidad `paciente-documentos` (requisito *"Navegación
dirigida desde una actividad hacia su documentación"*).

#### Scenario: La acción está disponible en cada actividad

- **GIVEN** un paciente con una escuela y dos terapias registradas
- **WHEN** el usuario consulta el listado de direcciones
- **THEN** cada una de esas tres actividades ofrece la acción de ver su documentación, junto a las de
  editar y quitar

#### Scenario: El domicilio del paciente no ofrece la acción

- **GIVEN** un paciente cuyo listado de direcciones incluye su domicilio particular
- **WHEN** el usuario consulta ese listado
- **THEN** la fila del domicilio no ofrece la acción de ver documentación, porque el domicilio no tiene
  checklist documental propio

#### Scenario: Las acciones existentes siguen funcionando igual

- **GIVEN** una actividad listada
- **WHEN** el usuario usa las acciones de editar o de quitar
- **THEN** se comportan exactamente como antes de este cambio, incluida la advertencia y confirmación
  al quitar una dirección con documentación cargada
