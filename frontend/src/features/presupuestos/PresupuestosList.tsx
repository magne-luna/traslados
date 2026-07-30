import { useMemo, useState } from 'react';
import { Button, CamposSoloLectura, Chip, InlineIcon, SearchInput } from '../../design-system/components';
import { Alert, EmptyState } from '../../design-system/feedback';
import { Card } from '../../design-system/layout';
import { iconCalendario, iconDocumento, iconMoneda } from '../../design-system/icons';
import { ESTADO_AUTORIZACION_CHIP_KIND, ESTADO_AUTORIZACION_LABEL } from '../../shared/lib/presupuestos/estadoAutorizacionCopy';
import type { EstadoAutorizacion, Presupuesto } from '../../shared/types/presupuesto';

interface PresupuestosListProps {
  presupuestos: Presupuesto[];
  loading: boolean;
  error: string | null;
  /** Resuelve el nombre a mostrar del paciente (inyectado, ver PresupuestosPage). */
  nombrePaciente: (pacienteId: string) => string;
  /** Resuelve el nombre a mostrar de la obra social (inyectada, ver PresupuestosPage). */
  nombreObraSocial: (obraSocialId: string) => string;
  /** Resuelve el estado de la autorización asociada, o null si todavía no se cargó ninguna. */
  estadoAutorizacion: (presupuestoId: string) => EstadoAutorizacion | null;
  onSelect: (presupuesto: Presupuesto) => void;
  onCreateNew: () => void;
}

// Pantalla de listado (tasks.md 5.1, US-200): mismo criterio de grid de tarjetas que
// ObrasSocialesList/VehiculosList/PacientesList (08_arquitectura_propuesta.md §Convenciones de
// UI) — reemplaza el listado de filas angostas original. Cada tarjeta muestra de entrada monto,
// fecha de emisión, archivo adjunto y el estado de la autorización de la obra social (si ya
// existe), presentacional puro salvo el filtro de búsqueda (estado local, no persiste).
export function PresupuestosList({
  presupuestos,
  loading,
  error,
  nombrePaciente,
  nombreObraSocial,
  estadoAutorizacion,
  onSelect,
  onCreateNew,
}: PresupuestosListProps) {
  const [busqueda, setBusqueda] = useState('');

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return presupuestos;
    return presupuestos.filter((presupuesto) => {
      const paciente = nombrePaciente(presupuesto.pacienteId).toLowerCase();
      const obraSocial = nombreObraSocial(presupuesto.obraSocialId).toLowerCase();
      return paciente.includes(termino) || obraSocial.includes(termino);
    });
  }, [busqueda, presupuestos, nombrePaciente, nombreObraSocial]);

  return (
    <div className="flex flex-col gap-lg py-xxl px-xl">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <h1 className="m-0 font-heading text-[21px] font-bold text-ink">Presupuestos</h1>
        <Button variant="primary" requiereEscritura onClick={onCreateNew}>
          + Nuevo presupuesto
        </Button>
      </div>

      {presupuestos.length > 0 && (
        <SearchInput
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por paciente u obra social…"
          ariaLabel="Buscar presupuesto"
        />
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <p className="font-body text-sm text-muted">Cargando presupuestos…</p>
      ) : presupuestos.length === 0 ? (
        <EmptyState
          message="No hay presupuestos cargados todavía."
          action={
            <Button variant="secondary" requiereEscritura onClick={onCreateNew}>
              Crear el primer presupuesto
            </Button>
          }
        />
      ) : filtrados.length === 0 ? (
        <p className="font-body text-sm text-muted">Ningún presupuesto coincide con "{busqueda}".</p>
      ) : (
        <div className="grid grid-cols-1 gap-md md:grid-cols-3">
          {filtrados.map((presupuesto) => {
            const nombre = nombrePaciente(presupuesto.pacienteId);
            const estado = estadoAutorizacion(presupuesto.id);

            return (
              <Card key={presupuesto.id} radius="md" elevated interactive onClick={() => onSelect(presupuesto)}>
                <div className="flex flex-wrap items-start justify-between gap-sm">
                  <div className="flex flex-col">
                    <span className="font-body text-[14px] font-semibold text-ink">{nombre}</span>
                    <span className="font-body text-[12px] text-muted">{nombreObraSocial(presupuesto.obraSocialId)}</span>
                  </div>
                  {estado ? (
                    <Chip kind={ESTADO_AUTORIZACION_CHIP_KIND[estado]}>{ESTADO_AUTORIZACION_LABEL[estado]}</Chip>
                  ) : (
                    <Chip kind="secondary">Sin autorización</Chip>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-sm border-y border-border py-sm">
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
                      Emitido
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

                {/* gateo-facturacion (design.md D1/D3, tasks.md 2.2): "Ver detalle" es un
                    <button> nativo, no un componente Button — el envoltorio de solo lectura lo
                    cubre igual que a "Editar" (mismo patrón que PacientesList/gateo-pacientes).
                    La fila (Card, más arriba) tiene su propio onClick por fuera de este
                    envoltorio y sigue navegando al detalle aunque los dos botones queden
                    inertes. */}
                <CamposSoloLectura>
                <div className="flex items-center justify-end gap-md pt-xs">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(presupuesto);
                    }}
                    className="cursor-pointer border-none bg-transparent p-0 font-body text-[13px] font-semibold text-primary"
                  >
                    Ver detalle
                  </button>
                  <Button
                    variant="secondary-accent"
                    size="sm"
                    ariaLabel={`Editar ${nombre}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(presupuesto);
                    }}
                  >
                    Editar
                  </Button>
                </div>
                </CamposSoloLectura>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
