## ADDED Requirements

### Requirement: Documentación del paciente reutilizando el checklist de FE-1
El sistema SHALL mostrar una pestaña/sección de documentación del paciente reutilizando el componente `DocumentChecklist` (FE-1) y su wiring (`useDocumentChecklist` + `DocumentoRepository`/`mockDocumentoRepository`), con la entidad `paciente`. El sistema MUST NOT recrear el modelo de checklist ni un componente documental paralelo.

#### Scenario: Adjuntar y quitar documentos del paciente
- **WHEN** el usuario sube o quita un documento en la pestaña de documentación
- **THEN** el cambio se refleja usando el mismo mecanismo de FE-1 (subir/quitar sobre `DocumentoRepository`), asociado a la entidad `paciente` y al id del paciente

### Requirement: Ítems filtrados por la obra social del paciente
El sistema SHALL derivar los ítems del checklist documental del paciente del checklist configurado en su obra social asignada (leído vía `ObraSocialRepository` de FE-2), respetando el orden de los ítems tal como los exige esa obra social (RN-FA-08). El sistema MUST NOT usar una lista de documentos genérica única.

#### Scenario: El checklist depende de la obra social asignada
- **WHEN** el paciente tiene una obra social asignada con su checklist configurado
- **THEN** la pestaña de documentación muestra exactamente los ítems de ese checklist, en el orden configurado en la obra social

#### Scenario: Paciente sin obra social o sin checklist
- **WHEN** el paciente no tiene obra social asignada, o su obra social no tiene ítems de checklist
- **THEN** la pestaña muestra un estado vacío explícito en vez de un checklist genérico o una pantalla en blanco

#### Scenario: Estado de carga al resolver la obra social
- **WHEN** la pestaña está resolviendo la obra social y sus documentos
- **THEN** se muestra un estado de carga durante la latencia, sin pantalla en blanco ni loading infinito ante error
