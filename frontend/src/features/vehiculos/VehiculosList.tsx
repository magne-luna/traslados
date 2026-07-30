import { useMemo, useState } from 'react';
import { Button, CamposSoloLectura, Chip, InlineIcon, SearchInput } from '../../design-system/components';
import { Alert, EmptyState, Pill } from '../../design-system/feedback';
import { Card } from '../../design-system/layout';
import { iconLlave, iconMoneda, iconVelocimetro } from '../../design-system/icons';
import { estadoHabilitacion } from '../../shared/lib/mantenimiento/estadoHabilitacion';
import { estadoServicePreventivo } from '../../shared/lib/mantenimiento/estadoServicePreventivo';
import type { Vehiculo } from '../../shared/types/vehiculo';
import { ACCESORIO_MOVILIDAD_LABELS } from './accesorioMovilidadOptions';
import { HABILITACION_COPY, SERVICE_COPY, TIPO_HABILITACION_LABELS } from './mantenimientoCopy';

interface VehiculosListProps {
  vehiculos: Vehiculo[];
  loading: boolean;
  error: string | null;
  onSelect: (vehiculo: Vehiculo) => void;
  onCreateNew: () => void;
  /** Fecha de referencia inyectable (tests); por defecto "ahora" real — nunca `new Date()` en las
   * funciones puras de shared/lib/mantenimiento/, solo acá en el borde de la UI. */
  ahora?: Date;
}

function formatearKm(km: number): string {
  return `${km.toLocaleString('es-AR')} km`;
}

function totalGastos(vehiculo: Vehiculo): number {
  return vehiculo.gastos.reduce((total, gasto) => total + gasto.monto, 0);
}

// Pantalla de listado (tasks.md 5.1, US-500/RF-500): estados de carga/vacío/error explícitos,
// presentacional puro salvo el filtro de búsqueda (estado local, no persiste). Grid de tarjetas
// (no filas) para exponer de entrada la mayor cantidad de información del maestro: kilometraje,
// estado del service preventivo (RN-VE-03), vigencia de VTV/RTO (RN-VE-04), accesorios de
// movilidad compatibles (RN-VE-01) y gastos acumulados — mismo criterio que ObrasSocialesList.
export function VehiculosList({ vehiculos, loading, error, onSelect, onCreateNew, ahora = new Date() }: VehiculosListProps) {
  const [busqueda, setBusqueda] = useState('');

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return vehiculos;
    return vehiculos.filter(
      (vehiculo) => vehiculo.patente.toLowerCase().includes(termino) || vehiculo.modelo.toLowerCase().includes(termino),
    );
  }, [busqueda, vehiculos]);

  return (
    <div className="flex flex-col gap-lg py-xxl px-xl">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <h1 className="m-0 font-heading text-[21px] font-bold text-ink">Vehículos</h1>
        <Button variant="primary" requiereEscritura onClick={onCreateNew}>
          + Nuevo vehículo
        </Button>
      </div>

      {vehiculos.length > 0 && (
        <SearchInput
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por patente o modelo…"
          ariaLabel="Buscar vehículo"
        />
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <p className="font-body text-sm text-muted">Cargando vehículos…</p>
      ) : vehiculos.length === 0 ? (
        <EmptyState
          message="No hay vehículos cargados todavía."
          action={
            <Button variant="secondary" requiereEscritura onClick={onCreateNew}>
              Crear el primer vehículo
            </Button>
          }
        />
      ) : filtrados.length === 0 ? (
        <p className="font-body text-sm text-muted">Ningún vehículo coincide con "{busqueda}".</p>
      ) : (
        <div className="grid grid-cols-1 gap-md md:grid-cols-3">
          {filtrados.map((vehiculo) => {
            const service = SERVICE_COPY[
              estadoServicePreventivo({
                kilometraje: vehiculo.kilometraje,
                kilometrajeUltimoService: vehiculo.kilometrajeUltimoService,
                fechaUltimoService: vehiculo.fechaUltimoService,
                ahora,
              })
            ];
            const gastos = totalGastos(vehiculo);

            return (
              <Card key={vehiculo.id} radius="md" elevated interactive onClick={() => onSelect(vehiculo)}>
                <div className="flex flex-wrap items-start justify-between gap-sm">
                  <div className="flex flex-col">
                    <span className="font-mono text-[16px] font-bold text-ink">{vehiculo.patente}</span>
                    <span className="flex items-center gap-xs font-body text-[12px] text-muted">
                      <span>{vehiculo.modelo}</span>
                      <span aria-hidden="true">·</span>
                      <span>{vehiculo.tipo}</span>
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-xs">
                    <Chip kind="info">Capacidad {vehiculo.capacidad}</Chip>
                    {vehiculo.estado === 'fuera-de-servicio' ? (
                      <Chip kind="danger">Fuera de servicio</Chip>
                    ) : (
                      <Chip kind="success">Habilitado</Chip>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-sm border-y border-border py-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-xs font-body text-[11px] text-muted">
                      <InlineIcon>{iconVelocimetro}</InlineIcon>
                      Kilometraje
                    </span>
                    <span className="font-body text-[13px] font-semibold text-ink">{formatearKm(vehiculo.kilometraje)}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-xs font-body text-[11px] text-muted">
                      <InlineIcon>{iconLlave}</InlineIcon>
                      Service
                    </span>
                    <Chip kind={service.kind}>{service.texto}</Chip>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-xs font-body text-[11px] text-muted">
                      <InlineIcon>{iconMoneda}</InlineIcon>
                      Gastos
                    </span>
                    <span className="font-body text-[13px] font-semibold text-ink">
                      {vehiculo.gastos.length === 0 ? 'Sin registrar' : `$${gastos.toLocaleString('es-AR')}`}
                    </span>
                  </div>
                </div>

                {vehiculo.habilitaciones.length > 0 && (
                  <div className="flex flex-wrap items-center gap-sm">
                    {vehiculo.habilitaciones.map((habilitacion) => {
                      const copy = HABILITACION_COPY[estadoHabilitacion({ fechaVencimiento: habilitacion.fechaVencimiento, ahora })];
                      return (
                        <span key={habilitacion.tipo} className="flex items-center gap-xs font-body text-[12px] text-muted">
                          {TIPO_HABILITACION_LABELS[habilitacion.tipo]}
                          <Chip kind={copy.kind}>{copy.texto}</Chip>
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-xs">
                  {vehiculo.accesoriosCompatibles.length === 0 ? (
                    <span className="font-body text-[12px] text-muted">Sin accesorios de movilidad compatibles</span>
                  ) : (
                    vehiculo.accesoriosCompatibles.map((accesorio) => (
                      <Pill key={accesorio}>{ACCESORIO_MOVILIDAD_LABELS[accesorio]}</Pill>
                    ))
                  )}
                </div>

                {/* gateo-conductores (design.md D2/riesgos, tasks.md 3.2): mismo criterio que
                    ConductoresList — "Ver detalle" es un <button> nativo, cubierto por el
                    mismo envoltorio que "Editar". La fila (Card, más arriba) sigue navegando
                    al detalle por fuera de este envoltorio. */}
                <CamposSoloLectura>
                <div className="flex items-center justify-end gap-md pt-xs">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(vehiculo);
                    }}
                    className="cursor-pointer border-none bg-transparent p-0 font-body text-[13px] font-semibold text-primary"
                  >
                    Ver detalle
                  </button>
                  <Button
                    variant="secondary-accent"
                    size="sm"
                    ariaLabel={`Editar ${vehiculo.patente}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(vehiculo);
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
