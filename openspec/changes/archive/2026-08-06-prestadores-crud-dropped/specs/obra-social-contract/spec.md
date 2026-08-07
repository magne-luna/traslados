## MODIFIED Requirements

### Requirement: Tipo de dominio ObraSocial

El sistema SHALL definir un tipo TypeScript `ObraSocial` en `frontend/src/shared/types/` que modele:
identificador, nombre, CUIT del prestador (campo distinto del CUIL del paciente, RN-ID-01), modalidad
de facturación (`'por-prestacion' | 'general'`), flag de si admite pagos parciales/por lote,
checklist documental configurable y plantilla de descripción de factura. El tipo MUST estar en modo
strict sin uso de `any`.

`plazoCobroDias` y `tipoComprobante` YA NO son campos de `ObraSocial` — pasan a `Prestador` (ver
`prestador-contract`), como **supuesto provisorio de la rama `feature/prestadores-crud`, SIN
confirmar con Andrea** (lectura literal de US-300).
(Previously: incluía además `plazoCobroDias` (configurable) y `tipoComprobante` (`'A' | 'B' | 'C'`,
RN-FA-07) como campos propios de `ObraSocial`.)

#### Scenario: El CUIT del prestador es distinto del CUIL del paciente

- **WHEN** se modela una `ObraSocial`
- **THEN** el campo fiscal de la obra social es `cuit` (prestador) y NO reutiliza ni se unifica con
  el `cuil` del titular/paciente (RN-ID-01)

#### Scenario: Las condiciones fiscales por prestador se movieron a Prestador

- **GIVEN** que antes `ObraSocial` incluía `plazoCobroDias` y `tipoComprobante` con default
  configurable sin confirmar con el cliente
- **WHEN** se modela `ObraSocial` en esta rama
- **THEN** esos dos campos, junto con su default sin confirmar, pasan a `Prestador` (ver
  `prestador-contract`)
- **AND** `ObraSocial` retiene únicamente `modalidadFacturacion`/`admitePagosParciales` como
  condiciones propias de la obra social pagadora, sin duplicarlas en `Prestador`
