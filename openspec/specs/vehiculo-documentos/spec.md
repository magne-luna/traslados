## ADDED Requirements

### Requirement: Checklist documental del vehículo
El sistema SHALL mostrar el checklist de documentación del vehículo (cédula, VTV, RTO, seguro, fotos) reutilizando el renderer `DocumentChecklist` de FE-1 con `EntidadDocumental = 'vehiculo'`, sin duplicar el modelo documental (US-500, RF-506).

#### Scenario: Render del checklist de documentos del vehículo
- **WHEN** el usuario abre la sección de documentos de un vehículo
- **THEN** se muestra la lista de ítems documentales del vehículo (cédula, VTV, RTO, seguro, fotos) usando el componente `DocumentChecklist` compartido

#### Scenario: Estado de documento subido vs. faltante
- **WHEN** un documento del checklist tiene un adjunto cargado y otro no
- **THEN** el renderer distingue visualmente el ítem subido del faltante, con texto además de color

### Requirement: Reutilización del modelo documental compartido
El sistema SHALL usar el tipo `ChecklistItem` de `shared/types/documento.ts` para los ítems del checklist del vehículo y el `DocumentoRepository` existente para la (des)carga, sin crear un modelo documental paralelo.

#### Scenario: Sin modelo documental duplicado
- **WHEN** se implementa la sección de documentos del vehículo
- **THEN** no se define un tipo de checklist/documento propio de vehículos: se reutilizan `ChecklistItem` y `DocumentoAdjunto` de FE-1
