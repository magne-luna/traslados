import { useMemo, useState } from 'react';
import { Button, Chip, InlineIcon, SearchInput } from '../../design-system/components';
import { Alert, EmptyState } from '../../design-system/feedback';
import { Card } from '../../design-system/layout';
import { iconCasa, iconCredencial, iconLlave, iconTelefono } from '../../design-system/icons';
import { semanaActualIso } from '../../shared/lib/conductores/semanaActualIso';
import type { Conductor } from '../../shared/types/conductor';
import { useVehiculoRepository } from '../vehiculos/VehiculoRepositoryContext';
import { useVehiculos } from '../vehiculos/useVehiculos';
import { RESTRICCION_CONDUCTOR_LABELS } from './restriccionConductorOptions';

interface ConductoresListProps {
  conductores: Conductor[];
  loading: boolean;
  error: string | null;
  onSelect: (conductor: Conductor) => void;
  onCreateNew: () => void;
  /** Fecha de referencia inyectable (tests); por defecto "ahora" real — mismo criterio que
   * VehiculosList/AsignacionSemanalTabla, nunca `new Date()` fuera del borde de la UI. */
  ahora?: Date;
}

// Pantalla de listado (tasks.md 5.1, US-600): estados de carga/vacío/error explícitos,
// presentacional puro salvo el filtro de búsqueda (estado local, no persiste). Grid de tarjetas
// para exponer de entrada la mayor cantidad de información del maestro (mismo criterio que
// VehiculosList/ObrasSocialesList): documento, CUIL, domicilio, teléfono, restricciones de
// perfil (RN-GL-03) y el vehículo asignado la semana actual (resuelto contra VehiculoRepository,
// mismo patrón de composición que AsignacionSemanalTabla — VehiculoRepositoryProvider ya está
// montado en ConductoresRoute).
export function ConductoresList({ conductores, loading, error, onSelect, onCreateNew, ahora = new Date() }: ConductoresListProps) {
  const [busqueda, setBusqueda] = useState('');
  const vehiculoRepository = useVehiculoRepository();
  const { vehiculos } = useVehiculos(vehiculoRepository);
  const semanaActual = semanaActualIso(ahora);

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return conductores;
    return conductores.filter(
      (conductor) =>
        conductor.apellido.toLowerCase().includes(termino) ||
        conductor.nombre.toLowerCase().includes(termino) ||
        conductor.documento.toLowerCase().includes(termino) ||
        conductor.cuil.toLowerCase().includes(termino),
    );
  }, [busqueda, conductores]);

  return (
    <div className="flex flex-col gap-lg py-xxl px-xl">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <h1 className="m-0 font-heading text-[21px] font-bold text-ink">Conductores</h1>
        <Button variant="primary" onClick={onCreateNew}>
          Nuevo conductor
        </Button>
      </div>

      {conductores.length > 0 && (
        <SearchInput
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por apellido, documento o CUIL…"
          ariaLabel="Buscar conductor"
        />
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <p className="font-body text-sm text-muted">Cargando conductores…</p>
      ) : conductores.length === 0 ? (
        <EmptyState
          message="No hay conductores cargados todavía."
          action={
            <Button variant="secondary" onClick={onCreateNew}>
              Crear el primer conductor
            </Button>
          }
        />
      ) : filtrados.length === 0 ? (
        <p className="font-body text-sm text-muted">Ningún conductor coincide con "{busqueda}".</p>
      ) : (
        <div className="grid grid-cols-1 gap-md md:grid-cols-3">
          {filtrados.map((conductor) => {
            const asignacionActual = conductor.asignaciones.find((asignacion) => asignacion.semana === semanaActual);
            const vehiculoAsignado = asignacionActual
              ? (vehiculos.find((vehiculo) => vehiculo.id === asignacionActual.vehiculoId) ?? null)
              : null;

            return (
              <Card key={conductor.id} radius="md" elevated interactive onClick={() => onSelect(conductor)}>
                <div className="flex flex-wrap items-start justify-between gap-sm">
                  <div className="flex items-center gap-sm">
                    <span className="font-body text-[16px] font-bold text-ink">{conductor.apellido}</span>
                    <span className="font-body text-[14px] text-muted">{conductor.nombre}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-xs">
                    {conductor.estado === 'fuera-de-servicio' ? (
                      <Chip kind="danger">⛔ Fuera de servicio</Chip>
                    ) : (
                      <Chip kind="success">✅ Operando</Chip>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-sm border-y border-border py-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-xs font-body text-[11px] text-muted">
                      <InlineIcon>{iconCredencial}</InlineIcon>
                      Documento
                    </span>
                    <span className="font-body text-[13px] font-semibold text-ink">{conductor.documento}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-xs font-body text-[11px] text-muted">
                      <InlineIcon>{iconCredencial}</InlineIcon>
                      CUIL
                    </span>
                    <span className="font-body text-[13px] font-semibold text-ink">{conductor.cuil}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-xs font-body text-[11px] text-muted">
                      <InlineIcon>{iconTelefono}</InlineIcon>
                      Teléfono
                    </span>
                    <span className="font-body text-[13px] font-semibold text-ink">{conductor.telefono || 'Sin datos'}</span>
                  </div>
                </div>

                <span className="flex items-center gap-xs font-body text-[12px] text-muted">
                  <InlineIcon>{iconCasa}</InlineIcon>
                  {conductor.domicilio || 'Sin datos'}
                </span>

                <div className="flex items-center gap-xs font-body text-[12px] text-muted">
                  <InlineIcon>{iconLlave}</InlineIcon>
                  Esta semana:{' '}
                  {vehiculoAsignado ? (
                    <Chip kind="info">{vehiculoAsignado.patente}</Chip>
                  ) : (
                    <span>Sin vehículo asignado</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-xs">
                  {conductor.restricciones.length === 0 ? (
                    <span className="font-body text-[12px] text-muted">Sin restricciones de perfil</span>
                  ) : (
                    conductor.restricciones.map((restriccion) => (
                      <Chip key={restriccion} kind="warning">
                        {RESTRICCION_CONDUCTOR_LABELS[restriccion]}
                      </Chip>
                    ))
                  )}
                </div>

                {conductor.observaciones && (
                  <p className="m-0 font-body text-[12px] italic text-muted">{conductor.observaciones}</p>
                )}

                <div className="flex items-center justify-end gap-md pt-xs">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(conductor);
                    }}
                    className="cursor-pointer border-none bg-transparent p-0 font-body text-[13px] font-semibold text-primary"
                  >
                    Ver detalle
                  </button>
                  <Button
                    variant="secondary-accent"
                    size="sm"
                    ariaLabel={`Editar ${conductor.apellido}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(conductor);
                    }}
                  >
                    Editar
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
