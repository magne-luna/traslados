import { useCallback, useState } from 'react';
import type { Factura } from '../../shared/types/factura';
import type { CupoAutorizado } from '../../shared/types/presupuesto';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';
import type { EmisionRepository } from '../../shared/lib/facturacion/EmisionRepository';
import { derivarCupoAutorizado } from '../../shared/lib/presupuestos/cupoAutorizado';
import { cupoConsumido } from '../../shared/lib/facturacion/cupoConsumido';
import { validarCupoFacturacion, type ValidarCupoFacturacionResultado } from '../../shared/lib/facturacion/validarCupoFacturacion';

interface UseEmisionFacturaArgs {
  factura: Factura | null;
  facturasExistentes: Factura[];
  autorizacionRepository: AutorizacionRepository;
  /** Emite el comprobante contra ARCA a través de la Edge Function `facturar` (change
   * `facturacion-electronica-arca`, design.md D2). */
  emisionRepository: EmisionRepository;
  /** Se llama tras una emisión exitosa para que la pantalla recargue la factura ya emitida. */
  onEmitida: () => void | Promise<void>;
  onError: (mensaje: string) => void;
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
}

// Acción de emitir (change `facturacion-electronica-arca`, §5 — el swap): "Emitir factura" deja de
// ser una edición local (`actualizar(id, { estado: 'facturado', …snapshots })`) y pasa a invocar la
// Edge Function `facturar`, que obtiene un CAE real de ARCA, congela los snapshots del lado del
// servidor (D8) y persiste el comprobante. Un rechazo de ARCA / identidad inválida / miniserver
// caído se propaga como `Error` con mensaje en castellano (design.md D9) y la factura queda en
// `a-facturar`.
//
// La validación de cupo (RN-FA-02) sigue **en el cliente**, antes de llamar a la EF (D10): misma
// `resolverCupoAutorizado` + `validarCupoFacturacion` + confirmación explícita no bloqueante ante
// exceso (design.md Decisión 6). La EF NO re-valida cupo.
export function useEmisionFactura({
  factura,
  facturasExistentes,
  autorizacionRepository,
  emisionRepository,
  onEmitida,
  onError,
}: UseEmisionFacturaArgs) {
  const [cupoParaConfirmar, setCupoParaConfirmar] = useState<ValidarCupoFacturacionResultado | null>(null);

  // Deriva el `CupoAutorizado` real de la autorización ELEGIDA en el Paso 2 del wizard
  // (`autorizacionId`), vía `getById` + `derivarCupoAutorizado`. Sin `autorizacionId` (facturas
  // anteriores a `facturacion-seleccion-autorizacion`) → `undefined`, camino ya tolerado por
  // `validarCupoFacturacion` (sin cupo, no alerta).
  const resolverCupoAutorizado = useCallback(
    async (pacienteId: string, autorizacionId: string | undefined): Promise<CupoAutorizado | undefined> => {
      if (!pacienteId || !autorizacionId) return undefined;
      const autorizacion = await autorizacionRepository.getById(autorizacionId);
      if (!autorizacion) return undefined;
      return derivarCupoAutorizado(autorizacion, pacienteId);
    },
    [autorizacionRepository],
  );

  async function emitirFactura() {
    if (!factura) return;
    try {
      await emisionRepository.emitir(factura.id);
      await onEmitida();
    } catch (err) {
      onError(toErrorMessage(err));
    }
  }

  async function handleEmitirClick() {
    if (!factura) return;
    const cupo = await resolverCupoAutorizado(factura.pacienteId, factura.autorizacionId);
    const consumido = cupoConsumido(facturasExistentes, factura.pacienteId, factura.mesFacturado, factura.anioFacturado, {
      excluirFacturaId: factura.id,
    });
    const resultado = validarCupoFacturacion({
      diasFacturados: consumido.dias + factura.dias,
      kmFacturados: consumido.km + factura.cantidadKm,
      cupo,
    });
    if (resultado.excedeDias || resultado.excedeKm) {
      setCupoParaConfirmar(resultado);
      return;
    }
    await emitirFactura();
  }

  async function handleConfirmarEmision() {
    setCupoParaConfirmar(null);
    await emitirFactura();
  }

  return { resolverCupoAutorizado, cupoParaConfirmar, handleEmitirClick, handleConfirmarEmision };
}
