import { Button, InlineIcon } from '../../design-system/components';
import { Card } from '../../design-system/layout';
import { iconCalendario, iconDocumento, iconMoneda } from '../../design-system/icons';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Paciente } from '../../shared/types/paciente';
import type { Presupuesto } from '../../shared/types/presupuesto';

interface PresupuestoResumenProps {
  presupuesto: Presupuesto;
  paciente: Paciente | undefined;
  obraSocial: ObraSocial | undefined;
  onEdit: () => void;
}

function nombrePaciente(paciente: Paciente | undefined): string {
  return paciente ? `${paciente.apellido}, ${paciente.nombre}` : 'Paciente desconocido';
}

// Resumen de solo lectura del presupuesto, extraído de PresupuestoDetail (mismo criterio que
// PacienteResumen/VehiculoDetail — 08_arquitectura_propuesta.md §Convenciones de UI): grid de
// stats con todos los campos del form (obra social, monto, fecha de emisión, archivo) para no
// obligar a abrir "Editar datos" solo para consultar un dato.
export function PresupuestoResumen({ presupuesto, paciente, obraSocial, onEdit }: PresupuestoResumenProps) {
  return (
    <Card>
      <span className="font-body text-[14px] font-semibold text-ink">{nombrePaciente(paciente)}</span>

      <div className="grid grid-cols-2 gap-md border-y border-border py-md md:grid-cols-4">
        <div className="flex flex-col gap-0.5">
          <span className="font-body text-[11px] text-muted">Obra social</span>
          <span className="font-body text-[13px] font-semibold text-ink">{obraSocial?.nombre ?? 'Obra social desconocida'}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-xs font-body text-[11px] text-muted">
            <InlineIcon>{iconMoneda}</InlineIcon>
            Monto
          </span>
          <span className="font-mono text-[13px] font-semibold text-ink">${presupuesto.monto.toLocaleString('es-AR')}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-xs font-body text-[11px] text-muted">
            <InlineIcon>{iconCalendario}</InlineIcon>
            Fecha de emisión
          </span>
          <span className="font-body text-[13px] font-semibold text-ink">{presupuesto.fechaEmision}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-xs font-body text-[11px] text-muted">
            <InlineIcon>{iconDocumento}</InlineIcon>
            Archivo
          </span>
          <span className="font-body text-[13px] font-semibold text-ink">
            {presupuesto.archivo ? presupuesto.archivo.nombre : 'Sin archivo'}
          </span>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" requiereEscritura onClick={onEdit}>
          Editar datos
        </Button>
      </div>
    </Card>
  );
}
