## ADDED Requirements

### Requirement: Vista imprimible / exportación de la hoja de ruta
El sistema SHALL proveer una vista imprimible (print-friendly) de la hoja de ruta del día para entregar al conductor en papel o por WhatsApp (US-700, RF-706).

#### Scenario: Vista imprimible de un día
- **WHEN** la operadora elige exportar/imprimir la hoja de ruta de un día
- **THEN** se muestra una vista print-friendly con los recorridos del día agrupados por vehículo/conductor, el orden de recogida de cada parada, las direcciones de origen/destino por tramo y las notas al pie

#### Scenario: La exportación refleja las ediciones manuales
- **WHEN** se exporta la hoja después de editar recorridos manualmente
- **THEN** la vista imprimible refleja el orden y la composición actuales (incluidos los recorridos manuales), no un estado previo

#### Scenario: Estilo print sin inline styles
- **WHEN** se aplica el estilo de la vista imprimible
- **THEN** se usan clases utilitarias de Tailwind v4 (incluidas utilidades de print), sin `style={{}}` inline (regla dura del proyecto)
