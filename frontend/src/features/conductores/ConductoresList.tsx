import { Button, CamposSoloLectura, Chip, InlineIcon, SearchInput } from '../../design-system/components';
import { Alert, EmptyState } from '../../design-system/feedback';
import { Card } from '../../design-system/layout';
import { Paginador } from '../../design-system/paginador';
import { iconCasa, iconCredencial, iconLlave, iconTelefono } from '../../design-system/icons';
import { semanaActualIso } from '../../shared/lib/conductores/semanaActualIso';
import type { Conductor } from '../../shared/types/conductor';
import { useVehiculoRepository } from '../vehiculos/VehiculoRepositoryContext';
import { useVehiculos } from '../vehiculos/useVehiculos';

interface ConductoresListProps {
  /** SOLO la página actual (paginacion-listados, Fase 3) — nunca el padrón completo. */
  conductores: Conductor[];
  loading: boolean;
  error: string | null;
  onSelect: (conductor: Conductor) => void;
  onCreateNew: () => void;
  /** Fecha de referencia inyectable (tests); por defecto "ahora" real — mismo criterio que
   * VehiculosList/AsignacionSemanalTabla, nunca `new Date()` fuera del borde de la UI. */
  ahora?: Date;
  /** Término de búsqueda (paginacion-listados §D6): controlado desde afuera — este componente ya
   * no filtra en memoria, solo refleja lo que le llega por `conductores`/`total`. */
  busqueda: string;
  onBusquedaChange: (valor: string) => void;
  pagina: number;
  tamanio: number;
  /** Total de resultados que matchean el filtro aplicado (no `conductores.length`, que es como
   * mucho `tamanio`) — lo que permite mostrar "Página N de M" sin una segunda consulta. */
  total: number;
  onCambiarPagina: (pagina: number) => void;
}

// Pantalla de listado (tasks.md 5.1, US-600; paginacion-listados Fase 3 tasks.md 16.3): estados
// de carga/vacío/error explícitos, presentacional puro (sin estado propio de filtrado ni de
// página, todo llega por props desde `useConductoresPaginado` — mismo criterio que PacientesList
// 13.8). Grid de tarjetas para exponer de entrada la mayor cantidad de información del maestro
// (mismo criterio que VehiculosList/ObrasSocialesList): documento, CUIL, domicilio, teléfono,
// observaciones (D6-B: único campo libre del perfil, sin selector de restricciones estructurado)
// y el vehículo asignado la semana actual (resuelto contra VehiculoRepository, mismo patrón de
// composición que AsignacionSemanalTabla — VehiculoRepositoryProvider ya está montado en
// ConductoresRoute).
export function ConductoresList({
  conductores,
  loading,
  error,
  onSelect,
  onCreateNew,
  ahora = new Date(),
  busqueda,
  onBusquedaChange,
  pagina,
  tamanio,
  total,
  onCambiarPagina,
}: ConductoresListProps) {
  const vehiculoRepository = useVehiculoRepository();
  const { vehiculos } = useVehiculos(vehiculoRepository);
  const semanaActual = semanaActualIso(ahora);

  // Tres estados distinguibles (mismo criterio que PacientesList 13.5), nunca la misma pantalla
  // para los tres: sin conductores cargados en TODO el sistema / búsqueda sin coincidencias /
  // carga inicial en curso (se resuelve antes que los otros dos, más abajo).
  const sinResultados = total === 0;
  const hayBusquedaActiva = busqueda.trim() !== '';
  const mostrarBuscador = total > 0 || hayBusquedaActiva;
  const totalPaginas = Math.ceil(total / tamanio);

  return (
    <div className="flex flex-col gap-lg py-xxl px-xl">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <h1 className="m-0 font-heading text-[21px] font-bold text-ink">Conductores</h1>
        <Button variant="primary" requiereEscritura onClick={onCreateNew}>
          + Nuevo conductor
        </Button>
      </div>

      {mostrarBuscador && (
        <SearchInput
          value={busqueda}
          onChange={onBusquedaChange}
          placeholder="Buscar por apellido, documento o CUIL…"
          ariaLabel="Buscar conductor"
        />
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <p className="font-body text-sm text-muted">Cargando conductores…</p>
      ) : sinResultados && !hayBusquedaActiva ? (
        <EmptyState
          message="No hay conductores cargados todavía."
          action={
            <Button variant="secondary" requiereEscritura onClick={onCreateNew}>
              + Crear el primer conductor
            </Button>
          }
        />
      ) : sinResultados ? (
        <p className="font-body text-sm text-muted">Ningún conductor coincide con "{busqueda}".</p>
      ) : (
        <>
        <div className="grid grid-cols-1 gap-md md:grid-cols-3">
          {conductores.map((conductor) => {
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
                    {/* Prueba visual a pedido del usuario ("ponele los pills, quiero ver como
                        queda") — vuelve al Chip, sin el emoji que tenía antes (regla del
                        proyecto: nunca emojis como ícono). */}
                    {conductor.estado === 'fuera-de-servicio' ? (
                      <Chip kind="danger">Fuera de servicio</Chip>
                    ) : (
                      <Chip kind="success">Operando</Chip>
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

                {conductor.observaciones && (
                  <p className="m-0 font-body text-[12px] italic text-muted">{conductor.observaciones}</p>
                )}

                {/* gateo-conductores (design.md D2/riesgos, tasks.md 2.2): "Ver detalle" es un
                    <button> nativo, no un componente Button — el envoltorio de solo lectura lo
                    cubre igual que a "Editar", verificando que el <fieldset disabled> del
                    mecanismo compartido alcanza también a los <button> nativos (mismo criterio
                    ya verificado en ConductoresList/VehiculosList de gateo-pacientes). La fila
                    (Card, más arriba) tiene su propio onClick por fuera de este envoltorio y
                    sigue navegando al detalle aunque los dos botones queden inertes. */}
                <div className="mt-auto">
                <CamposSoloLectura>
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
                </CamposSoloLectura>
                </div>
              </Card>
            );
          })}
        </div>
        <Paginador pagina={pagina} totalPaginas={totalPaginas} total={total} onCambiarPagina={onCambiarPagina} />
        </>
      )}
    </div>
  );
}
