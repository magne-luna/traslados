import { AvisoModeloDatos, Button } from '../../design-system/components';
import type { Factura } from '../../shared/types/factura';
import type { Paciente } from '../../shared/types/paciente';
import type { ValidarCupoFacturacionResultado } from '../../shared/lib/facturacion/validarCupoFacturacion';
import { AlertaCupo } from './AlertaCupo';
import { FacturaResumen } from './FacturaResumen';

interface FacturaAccionesEmisionProps {
  factura: Factura;
  paciente: Paciente | undefined;
  submitting: boolean;
  onEmitir: () => void;
  cupoParaConfirmar: ValidarCupoFacturacionResultado | null;
  onConfirmarEmision: () => void;
  /** Abre el PDF del comprobante emitido (signed URL). */
  onVerComprobante?: () => void;
}

// Resumen de solo lectura + acciones de la factura (tasks.md 6.3, 8.4, 9.1): botón "Emitir" (solo
// mientras `a-facturar`) y, si `validarCupoFacturacion` marcó exceso, el bloque de confirmación
// explícita no bloqueante (design.md Decisión 6). El botón "Editar" vive en la cabecera de
// FacturaDetail (redisño del resumen), no acá. Extraído de FacturaDetail para mantenerlo bajo las
// ~200 líneas (tasks.md 12.3).
//
// facturacion-electronica-arca (§5): "Emitir factura" ahora invoca la Edge Function `facturar`
// (CAE real de ARCA). El comprobante C no se puede emitir electrónicamente (el miniserver solo
// admite A/B) — `AvisoModeloDatos` lo explica antes de que la operadora haga click.
export function FacturaAccionesEmision({
  factura,
  paciente,
  submitting,
  onEmitir,
  cupoParaConfirmar,
  onConfirmarEmision,
  onVerComprobante,
}: FacturaAccionesEmisionProps) {
  const esFacturaC = factura.tipoComprobante === 'C';

  return (
    <div className="flex flex-col gap-md">
      <FacturaResumen factura={factura} paciente={paciente} onVerComprobante={onVerComprobante} />
      {factura.estado === 'a-facturar' && (
        <>
          {esFacturaC && (
            <AvisoModeloDatos>
              La facturación electrónica solo admite comprobantes A y B. Esta factura es tipo C — se
              emite por fuera del sistema y se sube el PDF a mano.
            </AvisoModeloDatos>
          )}
          <div className="flex flex-wrap items-center justify-end gap-sm">
            {/* gateo-facturacion (design.md D2, tasks.md 5.1): emitir es una escritura no-CRUD,
                gateada al mismo nivel `write` que un Guardar — ninguna requiere `admin` (decisión
                5 de la usuaria). */}
            <Button variant="primary" requiereEscritura disabled={esFacturaC} onClick={onEmitir}>
              {submitting ? 'Emitiendo…' : 'Emitir factura'}
            </Button>
          </div>
        </>
      )}

      {cupoParaConfirmar && (
        <div className="flex flex-col gap-sm">
          <AlertaCupo resultado={cupoParaConfirmar} />
          <div>
            <Button variant="danger" requiereEscritura onClick={onConfirmarEmision}>Confirmar emisión</Button>
          </div>
        </div>
      )}
    </div>
  );
}
