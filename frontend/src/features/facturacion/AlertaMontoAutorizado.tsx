import { chipColors } from '../../design-system/components';
import type { ValidarMontoAutorizadoResultado } from '../../shared/lib/facturacion/validarMontoAutorizado';

interface AlertaMontoAutorizadoProps {
  resultado: ValidarMontoAutorizadoResultado;
}

// Muestra de forma PERSISTENTE (mismo criterio que `AlertaCupo`, no un toast que se pierde) el
// resultado de `validarMontoAutorizado`: acumulado del año facturado contra la autorización
// (siempre informativo, aunque no se exceda), advertencia cuando SÍ se excede el monto autorizado
// ANUAL, y aviso explícito cuando la autorización no tiene monto autorizado cargado.
export function AlertaMontoAutorizado({ resultado }: AlertaMontoAutorizadoProps) {
  const tono = !resultado.montoAutorizadoDisponible ? chipColors.secondary : resultado.excede ? chipColors.warning : chipColors.success;

  return (
    <div className="flex flex-col gap-xs">
      <div
        role="status"
        className={`rounded-sm border ${tono.border} border-l-4 ${tono.borderLeft} ${tono.bg} px-md py-sm font-body text-[13px] ${tono.fg}`}
      >
        {resultado.mensaje}
      </div>
    </div>
  );
}
