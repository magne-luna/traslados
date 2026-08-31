import { Alert } from '../../design-system/feedback';
import type { CondicionIvaArca } from '../../shared/types/obraSocial';
import { etiquetaCondicionIva } from '../obras-sociales/condicionIvaOptions';

interface AlertaTipoComprobanteProps {
  /** Condición frente al IVA de la obra social receptora — distinta de Responsable Inscripto. */
  condicion: CondicionIvaArca;
}

// Aviso NO bloqueante (mismo criterio que AlertaCupo, design.md Decisión 6) para cuando la factura
// es tipo A y la obra social receptora no es Responsable Inscripto: ARCA va a rechazar ese
// comprobante (RG 5616). Se calcula con `advertenciaTipoComprobante` y se muestra en la columna
// derecha del Paso 3 del wizard / modo edición de FacturaForm.
export function AlertaTipoComprobante({ condicion }: AlertaTipoComprobanteProps) {
  return (
    <Alert tone="warning" title="Factura A a un receptor no inscripto">
      La obra social figura como «{etiquetaCondicionIva(condicion)}». ARCA solo acepta Factura A
      cuando el receptor es Responsable Inscripto: si emitís así, la va a rechazar. Cambiá el tipo
      de comprobante de la obra social a B, o corregí su condición frente al IVA.
    </Alert>
  );
}
