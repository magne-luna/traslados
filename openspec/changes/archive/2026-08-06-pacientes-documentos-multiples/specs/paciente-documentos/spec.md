## ADDED Requirements

### Requirement: Cardinalidad múltiple sin sobrescritura por tipo de documento

El sistema SHALL permitir que un mismo ítem del checklist documental del paciente tenga más de un documento adjunto simultáneamente. Subir un documento nuevo para un ítem que ya tiene uno o más documentos cargados MUST NOT reemplazar ni eliminar los documentos anteriores del mismo ítem — se acumulan. El sistema MUST NOT imponer un tope de cantidad de documentos por ítem.

Cuando un ítem tiene más de un documento cargado, el sistema SHALL distinguir visualmente cuál es el documento vigente (el de `vigenciaDesde` más reciente que no sea futuro, con fallback a la fecha de carga si ningún documento indica `vigenciaDesde`) del resto, que se muestran como historial/continuidad.

Quitar un documento puntual de la colección MUST NOT afectar a los demás documentos del mismo ítem.

#### Scenario: Dos documentos del mismo tipo conviven sin sobrescribirse

- **GIVEN** un paciente con un documento ya cargado para un ítem del checklist (ej. un presupuesto vigente agosto-julio)
- **WHEN** el usuario sube un segundo documento para el mismo ítem (ej. el presupuesto de la renovación agosto-julio del año siguiente)
- **THEN** ambos documentos quedan visibles y consultables, ninguno se sobrescribe ni se pierde

#### Scenario: Sin tope de cantidad por ítem

- **GIVEN** un ítem del checklist con documentos ya cargados
- **WHEN** el usuario sigue subiendo documentos adicionales del mismo ítem
- **THEN** el sistema los acumula sin rechazar la carga por haber alcanzado una cantidad máxima

#### Scenario: Distinción visual entre el documento vigente y el siguiente

- **GIVEN** un ítem con dos documentos cargados, uno con `vigenciaDesde` pasada o presente y otro con `vigenciaDesde` futura
- **WHEN** se muestra el checklist documental
- **THEN** el documento con la `vigenciaDesde` más reciente que no sea futura se marca como vigente, y el otro se muestra como continuidad/historial

#### Scenario: Quitar un documento puntual no afecta a los demás del mismo ítem

- **GIVEN** un ítem con dos o más documentos cargados
- **WHEN** el usuario quita uno de esos documentos puntualmente
- **THEN** los demás documentos del mismo ítem permanecen cargados y visibles
