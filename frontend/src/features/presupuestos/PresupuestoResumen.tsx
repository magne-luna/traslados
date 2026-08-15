import { AvisoModeloDatos, Button, Chip, InlineIcon } from '../../design-system/components';
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

/** `presupuesto.prestacionId` -> nombre, buscado en el catálogo del paciente (tasks.md 8.8,
 * design.md D1/D5/D9). Un presupuesto viejo puede apuntar a una prestación ya `activa: false`
 * (borrado lógico, D1) — sigue mostrándose igual, nunca "desconocida". */
function nombrePrestacion(paciente: Paciente | undefined, prestacionId: string): string {
  return paciente?.prestaciones?.find((prestacion) => prestacion.id === prestacionId)?.nombre ?? 'Prestación desconocida';
}

/** Corrección confirmada por la usuaria (2026-08-15): la modalidad del presupuesto (general vs.
 * por-prestación) no era visible de un vistazo — había que inferirla de la presencia o ausencia
 * del stat "Prestación". Reusa el mismo criterio de resolución que ese stat (`prestacionId` contra
 * `paciente.prestaciones`), expuesto acá como chip para que se vea sin tener que interpretar nada. */
function etiquetaModalidad(presupuesto: Presupuesto, paciente: Paciente | undefined): string {
  if (!presupuesto.prestacionId) return 'Presupuesto general';
  return `Presupuesto por prestación: ${nombrePrestacion(paciente, presupuesto.prestacionId)}`;
}

// Resumen de solo lectura del presupuesto, extraído de PresupuestoDetail (mismo criterio que
// PacienteResumen/VehiculoDetail — 08_arquitectura_propuesta.md §Convenciones de UI): grid de
// stats con todos los campos del form (obra social, monto, fecha de emisión, archivo) para no
// obligar a abrir "Editar datos" solo para consultar un dato.
export function PresupuestoResumen({ presupuesto, paciente, obraSocial, onEdit }: PresupuestoResumenProps) {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <span className="font-body text-[14px] font-semibold text-ink">{nombrePaciente(paciente)}</span>
        <Chip kind="info">{etiquetaModalidad(presupuesto, paciente)}</Chip>
      </div>

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

        {/* presupuesto-prestacion (tasks.md 8.8, design.md D1/D9): solo aparece cuando
            prestacionId está presente (modalidad por-prestacion) — sin cambios cuando está
            ausente (modalidad general, sin desglose persistido). */}
        {presupuesto.prestacionId && (
          <div className="flex flex-col gap-0.5">
            <span className="font-body text-[11px] text-muted">Prestación</span>
            <span className="font-body text-[13px] font-semibold text-ink">
              {nombrePrestacion(paciente, presupuesto.prestacionId)}
            </span>
          </div>
        )}
      </div>

      {/* design.md D5: NO reabre la discrepancia #13 — monto sigue siendo un importe único. Este
          cartel referencia la entrada nueva de la KB sin editar la #13. */}
      {presupuesto.prestacionId && (
        <AvisoModeloDatos>
          Este presupuesto está vinculado a una prestación puntual del catálogo del paciente
          (obra social con facturación <strong>por prestación</strong>). El campo <strong>monto</strong>{' '}
          sigue siendo un importe único de este presupuesto — no reabre la discrepancia #13 de la
          base de conocimiento (`04_modelo_de_datos.md`).
        </AvisoModeloDatos>
      )}

      <div className="flex justify-end">
        <Button variant="secondary" requiereEscritura onClick={onEdit}>
          Editar datos
        </Button>
      </div>
    </Card>
  );
}
