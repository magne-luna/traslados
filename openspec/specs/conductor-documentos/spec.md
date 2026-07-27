## ADDED Requirements

### Requirement: Checklist documental del conductor reutilizando DocumentChecklist
El sistema SHALL presentar los documentos del conductor (licencia de conducir, etc.) reutilizando el renderer `DocumentChecklist` de FE-1 con `EntidadDocumental = 'conductor'` y el `DocumentoRepository` mock existente, sin definir un modelo documental paralelo (US-600, `04_modelo_de_datos.md §Conductor`).

#### Scenario: Lista fija de ítems documentales del conductor
- **WHEN** se renderiza la sección de documentos de un conductor
- **THEN** se usa una lista fija de `ChecklistItem[]` (que incluye la licencia de conducir como requerida) tipada con `ChecklistItem` de `shared/types/documento.ts`, sin duplicar el tipo

#### Scenario: Reutilización del renderer y del repository de documentos
- **WHEN** se muestra el estado subido/faltante de cada documento del conductor
- **THEN** se usa el componente `DocumentChecklist` con `entidad = 'conductor'` y el `DocumentoRepository` mock existente, sin crear un renderer ni un mock documental propios
