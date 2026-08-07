## ADDED Requirements

### Requirement: Relación N:N navegable entre ObraSocial y Prestador

El sistema SHALL permitir asociar y desasociar cero o más `Prestador` a cada `ObraSocial` (y
viceversa), persistido en una tabla de vínculo propia (`obra_social.obra_social_prestador`), sin
límite de cardinalidad de ningún lado.

**⚠️ Supuesto provisorio de la rama `feature/prestadores-crud`** (confirmado con Enzo el 2026-08-01,
**SIN confirmar con Andrea**): la relación entre `ObraSocial` y `Prestador` es N:N.

#### Scenario: Una ObraSocial con varios Prestadores

- **WHEN** el usuario asocia más de un Prestador a la misma ObraSocial
- **THEN** todos los vínculos quedan persistidos y son recuperables, sin que el alta de uno
  reemplace al anterior

#### Scenario: Un Prestador con varias ObrasSociales

- **WHEN** el usuario asocia el mismo Prestador a más de una ObraSocial
- **THEN** todos los vínculos quedan persistidos y son recuperables desde ambos lados de la relación

#### Scenario: Desasociar un vínculo no borra ninguna de las dos entidades

- **WHEN** el usuario quita un Prestador del selector de una ObraSocial (o viceversa)
- **THEN** solo se elimina el vínculo — ni la ObraSocial ni el Prestador se borran ni se modifican
  en sus demás campos

### Requirement: El vínculo es navegable desde ambos lados

El sistema SHALL permitir consultar, desde una `ObraSocial`, la lista de sus `Prestador` vinculados,
y desde un `Prestador`, la lista de sus `ObraSocial` vinculadas.

#### Scenario: Consulta desde ObraSocial

- **WHEN** se abre el detalle de una ObraSocial
- **THEN** se listan sus Prestadores vinculados, si tiene alguno

#### Scenario: Consulta desde Prestador

- **WHEN** se abre el detalle de un Prestador
- **THEN** se listan las ObrasSociales que lo tienen vinculado, si tiene alguna

### Requirement: Fuera de alcance — selección de Prestador al facturar

Esta capacidad MUST NOT resolver cuál Prestador aplica al generar una factura en modo general
cuando una ObraSocial tiene varios Prestadores vinculados (supuesto #5, **explícitamente abierto,
ni con Andrea ni completamente con Enzo**). Esa decisión queda fuera de alcance de este change y es
alcance del futuro change `desacople-prestacion-factura`, que MUST leer este supuesto como contexto
previo antes de proponer su solución.

#### Scenario: El vínculo no impone una resolución automática

- **WHEN** una ObraSocial con varios Prestadores vinculados participa de una factura general
- **THEN** esta capacidad no selecciona ni sugiere ningún Prestador — esa lógica no existe todavía y
  su ausencia está documentada, no es un bug pendiente de este change
