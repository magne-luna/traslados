import { Button } from '../../design-system/components';
import type { Factura } from '../../shared/types/factura';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Paciente } from '../../shared/types/paciente';
import type { ValidarCupoFacturacionResultado } from '../../shared/lib/facturacion/validarCupoFacturacion';
import { AlertaCupo } from './AlertaCupo';
import { FacturaResumen } from './FacturaResumen';

interface FacturaAccionesEmisionProps {
  factura: Factura;
  paciente: Paciente | undefined;
  obraSocial: ObraSocial | undefined;
  submitting: boolean;
  onEmitir: () => void;
  cupoParaConfirmar: ValidarCupoFacturacionResultado | null;
  onConfirmarEmision: () => void;
}

// Resumen de solo lectura + acciones de la factura (tasks.md 6.3, 8.4, 9.1): botón "Emitir" (solo
// mientras `a-facturar`) y, si `validarCupoFacturacion` marcó exceso, el bloque de confirmación
// explícita no bloqueante (design.md Decisión 6). El botón "Editar" vive en la cabecera de
// FacturaDetail (redisño del resumen), no acá. Extraído de FacturaDetail para mantenerlo bajo las
// ~200 líneas (tasks.md 12.3).
export function FacturaAccionesEmision({
  factura,
  paciente,
  obraSocial,
  submitting,
  onEmitir,
  cupoParaConfirmar,
  onConfirmarEmision,
}: FacturaAccionesEmisionProps) {
  return (
    <div className="flex flex-col gap-md">
      <FacturaResumen factura={factura} paciente={paciente} obraSocial={obraSocial} />
      {factura.estado === 'a-facturar' && (
        <div className="flex flex-wrap items-center justify-end gap-sm">
          <Button variant="primary" onClick={onEmitir}>{submitting ? 'Emitiendo…' : 'Emitir factura'}</Button>
        </div>
      )}

      {cupoParaConfirmar && (
        <div className="flex flex-col gap-sm">
          <AlertaCupo resultado={cupoParaConfirmar} />
          <div>
            <Button variant="danger" onClick={onConfirmarEmision}>Confirmar emisión</Button>
          </div>
        </div>
      )}
    </div>
  );
}
