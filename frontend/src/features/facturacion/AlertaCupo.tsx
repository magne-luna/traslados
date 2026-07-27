import { chipColors } from '../../design-system/components';
import type { ValidarCupoFacturacionResultado } from '../../shared/lib/facturacion/validarCupoFacturacion';

interface AlertaCupoProps {
  resultado: ValidarCupoFacturacionResultado;
}

// Muestra de forma PERSISTENTE (no un toast que se pierde) el resultado de
// validarCupoFacturacion (tasks.md 8.3, design.md Decisión 6, RN-FA-02): alerta con el mensaje
// comparativo cuando se excede el cupo, aviso explícito cuando no hay cupo cargado contra el cual
// validar, y confirmación visual de que está dentro del cupo en el resto de los casos.
//
// NO migrado a `Alert emphasis="accent"` (tasks.md 16.4, gobernanza MEDIO, reportado): este sitio
// usa `text-[13px]`, pero `Alert emphasis="accent"` fija `text-[12px]` (design.md Decisión 4, el
// molde es el de `AvisoModeloDatos`/`AvisoPendienteCliente`, que sí son 12px). No es el mismo
// conjunto de clases — migrarlo cambiaría el tamaño de fuente del texto, violando la Regla 0. Se
// deja tal cual, igual que el banner de `FacturaCobrosSection.tsx` (mismo caso).
export function AlertaCupo({ resultado }: AlertaCupoProps) {
  const excede = resultado.excedeDias || resultado.excedeKm;
  const tono = !resultado.cupoDisponible ? chipColors.secondary : excede ? chipColors.warning : chipColors.success;

  return (
    <div
      role="status"
      className={`rounded-sm border ${tono.border} border-l-4 ${tono.borderLeft} ${tono.bg} px-md py-sm font-body text-[13px] ${tono.fg}`}
    >
      {resultado.mensaje}
    </div>
  );
}
