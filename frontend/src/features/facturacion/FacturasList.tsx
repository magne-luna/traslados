import { useId, useMemo, useState } from 'react';
import { Button, Chip, InlineIcon } from '../../design-system/components';
import { Input, Label, Select } from '../../design-system/form';
import { Alert } from '../../design-system/feedback';
import { iconCalendario, iconMoneda, iconVelocimetro } from '../../design-system/icons';
import type { EstadoFactura, Factura } from '../../shared/types/factura';

interface FacturasListProps {
  facturas: Factura[];
  loading: boolean;
  error: string | null;
  nombrePaciente: (pacienteId: string) => string;
  onSelect: (factura: Factura) => void;
  onCreateNew: () => void;
  /** Opciones del filtro por paciente — se puebla desde PacienteRepository en el composition root. */
  pacientesDisponibles?: { id: string; nombre: string }[];
}

const ESTADO_LABEL: Record<EstadoFactura, string> = {
  'a-facturar': 'A facturar',
  facturado: 'Facturado',
  cobrado: 'Cobrado',
  'pagado-parcialmente': 'Pagado parcialmente',
};

const ESTADO_CHIP: Record<EstadoFactura, 'secondary' | 'warning' | 'success' | 'info'> = {
  'a-facturar': 'secondary',
  facturado: 'warning',
  cobrado: 'success',
  'pagado-parcialmente': 'info',
};

// Listado de facturas (tasks.md 6.1, 6.2), rediseñado a grid de tarjetas siguiendo la convención
// de UI del proyecto (08_arquitectura_propuesta.md §Convenciones de UI — mismo criterio que
// VehiculosList/ConductoresList): cada tarjeta muestra días, km y monto como stats, más
// asistencias declaradas y fecha estimada de cobro. Filtros por paciente/mes/año (más específicos
// que un buscador de texto libre, dado que son campos estructurados) arriba del grid. Tarjeta
// clickeable en su totalidad + botón "Editar" con stopPropagation.
//
// Migrado a Input/Select/Label/Alert/Button (tasks.md 16.3): filtros son campos "sueltos" (no
// Field, mismo criterio que AsistenciasEditor) con `fullWidth={false}` porque el sitio original
// no tenía `w-full`; error → `Alert(tone="danger")` default (coincide byte a byte); botón
// "Editar" → `Button variant="secondary-accent" size="sm"` (design.md Decisión 8 — el mini botón
// secundario). "Ver detalle" NO migra: es el patrón `VolverAlListadoLink` (texto sin borde), no
// el "botón mini" con caja que Decisión 8 cubre. La tarjeta clickeable en sí (`rounded-md
// border … shadow-sm cursor-pointer …`), aunque coincide con `Card radius="md" elevated
// interactive`, y el `EmptyState` (que reproduce exacto el bloque "No hay facturas cargadas")
// NO se tocan: no están en el alcance textual de tasks.md 16.3 (solo "filtros", "error", "botón
// mini") y la sección es de gobernanza CRÍTICA — se documentan acá como candidatos limpios para
// una task de seguimiento, no se migran de paso.
export function FacturasList({ facturas, loading, error, nombrePaciente, onSelect, onCreateNew, pacientesDisponibles }: FacturasListProps) {
  const [pacienteFiltro, setPacienteFiltro] = useState('');
  const [mesFiltro, setMesFiltro] = useState('');
  const [anioFiltro, setAnioFiltro] = useState('');
  const formId = useId();

  const filtradas = useMemo(
    () =>
      facturas.filter((factura) => {
        if (pacienteFiltro && factura.pacienteId !== pacienteFiltro) return false;
        if (mesFiltro && factura.mesFacturado !== Number(mesFiltro)) return false;
        if (anioFiltro && factura.anioFacturado !== Number(anioFiltro)) return false;
        return true;
      }),
    [facturas, pacienteFiltro, mesFiltro, anioFiltro],
  );

  return (
    <div className="flex flex-col gap-lg py-xxl px-xl">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <h1 className="m-0 font-heading text-[21px] font-bold text-ink">Facturación</h1>
        <Button variant="primary" onClick={onCreateNew}>Nueva factura</Button>
      </div>

      <div className="flex flex-wrap items-end gap-md">
        {pacientesDisponibles && (
          <div className="flex flex-col gap-xs">
            <Label htmlFor={`${formId}-paciente`}>Filtrar por paciente</Label>
            <Select id={`${formId}-paciente`} fullWidth={false} value={pacienteFiltro} onChange={(e) => setPacienteFiltro(e.target.value)}>
              <option value="">Todos</option>
              {pacientesDisponibles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </Select>
          </div>
        )}
        <div className="flex flex-col gap-xs">
          <Label htmlFor={`${formId}-mes`}>Filtrar por mes</Label>
          <Input id={`${formId}-mes`} type="number" min={1} max={12} fullWidth={false} value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} />
        </div>
        <div className="flex flex-col gap-xs">
          <Label htmlFor={`${formId}-anio`}>Filtrar por año</Label>
          <Input id={`${formId}-anio`} type="number" fullWidth={false} value={anioFiltro} onChange={(e) => setAnioFiltro(e.target.value)} />
        </div>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <p className="font-body text-sm text-muted">Cargando facturas…</p>
      ) : facturas.length === 0 ? (
        <div className="flex flex-col items-start gap-md rounded-sm border border-border bg-surface-soft p-xl">
          <p className="m-0 font-body text-sm text-muted">No hay facturas cargadas todavía.</p>
          <Button variant="secondary" onClick={onCreateNew}>Crear la primera factura</Button>
        </div>
      ) : filtradas.length === 0 ? (
        <p className="font-body text-sm text-muted">Ninguna factura coincide con el filtro aplicado.</p>
      ) : (
        <div className="grid grid-cols-1 gap-md md:grid-cols-3">
          {filtradas.map((factura) => {
            const nombre = nombrePaciente(factura.pacienteId);
            return (
              <div
                key={factura.id}
                onClick={() => onSelect(factura)}
                className="flex flex-col gap-md rounded-md border border-border bg-surface p-lg shadow-sm cursor-pointer transition-colors hover:border-border-strong hover:bg-surface-soft"
              >
                <div className="flex flex-wrap items-start justify-between gap-sm">
                  <div className="flex flex-col">
                    <span className="font-body text-[14px] font-semibold text-ink">{nombre}</span>
                    <span className="font-body text-[12px] text-muted">
                      {factura.mesFacturado}/{factura.anioFacturado} · Comprobante {factura.tipoComprobante}
                    </span>
                  </div>
                  <Chip kind={ESTADO_CHIP[factura.estado]}>{ESTADO_LABEL[factura.estado]}</Chip>
                </div>

                <div className="grid grid-cols-3 gap-sm border-y border-border py-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-xs font-body text-[11px] text-muted">
                      <InlineIcon>{iconCalendario}</InlineIcon>
                      Días
                    </span>
                    <span className="font-body text-[13px] font-semibold text-ink">{factura.dias}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-xs font-body text-[11px] text-muted">
                      <InlineIcon>{iconVelocimetro}</InlineIcon>
                      Km
                    </span>
                    <span className="font-body text-[13px] font-semibold text-ink">{factura.cantidadKm.toLocaleString('es-AR')} km</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-xs font-body text-[11px] text-muted">
                      <InlineIcon>{iconMoneda}</InlineIcon>
                      Monto
                    </span>
                    <span className="font-body text-[13px] font-semibold text-ink">${factura.monto.toLocaleString('es-AR')}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-xs">
                  <span className="rounded-pill bg-surface-soft px-md py-xs font-body text-[11px] text-muted">
                    {factura.asistencias.length} {factura.asistencias.length === 1 ? 'asistencia' : 'asistencias'}
                  </span>
                  {factura.fechaEstimadaCobro && (
                    <span className="rounded-pill bg-surface-soft px-md py-xs font-body text-[11px] text-muted">
                      Cobro estimado: {factura.fechaEstimadaCobro}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-end gap-md pt-xs">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(factura);
                    }}
                    className="cursor-pointer border-none bg-transparent p-0 font-body text-[13px] font-semibold text-primary"
                  >
                    Ver detalle
                  </button>
                  <Button
                    variant="secondary-accent"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(factura);
                    }}
                    ariaLabel={`Editar factura de ${nombre}`}
                  >
                    Editar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
