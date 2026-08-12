import { Button, Chip, InlineIcon, SearchInput } from '../../design-system/components';
import { Alert, EmptyState, Pill } from '../../design-system/feedback';
import { Card } from '../../design-system/layout';
import { Paginador } from '../../design-system/paginador';
import { iconCredencial, iconDocumento } from '../../design-system/icons';
import type { ObraSocial } from '../../shared/types/obraSocial';

interface ObrasSocialesListProps {
  /** SOLO la página actual (paginacion-listados, Fase 3) — nunca el catálogo completo. */
  obrasSociales: ObraSocial[];
  loading: boolean;
  error: string | null;
  onSelect: (obraSocial: ObraSocial) => void;
  onCreateNew: () => void;
  /** Término de búsqueda (paginacion-listados §D6): controlado desde afuera — este componente ya
   * no filtra en memoria, solo refleja lo que le llega por `obrasSociales`/`total`. */
  busqueda: string;
  onBusquedaChange: (valor: string) => void;
  pagina: number;
  tamanio: number;
  /** Total de resultados que matchean el filtro aplicado (no `obrasSociales.length`, que es como
   * mucho `tamanio`) — lo que permite mostrar "Página N de M" sin una segunda consulta. */
  total: number;
  onCambiarPagina: (pagina: number) => void;
}

const CHECKLIST_PREVIEW_COUNT = 3;

// Pantalla de listado (tasks.md 4.1, US-300/RF-300; paginacion-listados Fase 3 tasks.md 17.3):
// estados de carga/vacío/error explícitos (frontend-ui-design — nunca una pantalla en blanco),
// presentacional puro (sin estado propio de filtrado ni de página, todo llega por props desde
// `useObrasSocialesPaginado` — mismo criterio que PacientesList 13.8/ConductoresList 16.3). Grid
// de tarjetas (no filas) para exponer de entrada la mayor cantidad de información del maestro sin
// entrar al detalle: cantidad de documentos del checklist, identificador usado en la factura,
// modalidad de facturación y preview del propio checklist.
export function ObrasSocialesList({
  obrasSociales,
  loading,
  error,
  onSelect,
  onCreateNew,
  busqueda,
  onBusquedaChange,
  pagina,
  tamanio,
  total,
  onCambiarPagina,
}: ObrasSocialesListProps) {
  // Tres estados distinguibles (mismo criterio que PacientesList 13.5/ConductoresList 16.3):
  // sin obras sociales cargadas en TODO el sistema / búsqueda sin coincidencias / carga inicial.
  const sinResultados = total === 0;
  const hayBusquedaActiva = busqueda.trim() !== '';
  const mostrarBuscador = total > 0 || hayBusquedaActiva;
  const totalPaginas = Math.ceil(total / tamanio);

  return (
    <div className="flex flex-col gap-lg py-xxl px-xl">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <h1 className="m-0 font-heading text-[21px] font-bold text-ink">Obras Sociales</h1>
        <Button variant="primary" requiereEscritura onClick={onCreateNew}>
          + Nueva obra social
        </Button>
      </div>

      {mostrarBuscador && (
        <SearchInput value={busqueda} onChange={onBusquedaChange} placeholder="Buscar obra social…" ariaLabel="Buscar obra social" />
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <p className="font-body text-sm text-muted">Cargando obras sociales…</p>
      ) : sinResultados && !hayBusquedaActiva ? (
        <EmptyState
          message="No hay obras sociales cargadas todavía."
          action={
            <Button variant="secondary" requiereEscritura onClick={onCreateNew}>
              + Crear la primera obra social
            </Button>
          }
        />
      ) : sinResultados ? (
        <p className="font-body text-sm text-muted">Ninguna obra social coincide con "{busqueda}".</p>
      ) : (
        <>
        <div className="grid grid-cols-1 gap-md md:grid-cols-3">
          {obrasSociales.map((obraSocial) => {
            const checklistVisible = obraSocial.checklist.slice(0, CHECKLIST_PREVIEW_COUNT);
            const checklistRestantes = obraSocial.checklist.length - checklistVisible.length;

            return (
              <Card key={obraSocial.id} radius="md" elevated interactive onClick={() => onSelect(obraSocial)}>
                <div className="flex items-start justify-between gap-sm">
                  <div className="flex flex-col">
                    <h2 className="m-0 font-heading text-[17px] font-bold text-ink">{obraSocial.nombre}</h2>
                    <span className="font-mono text-[12px] text-muted">CUIT: {obraSocial.cuit}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-sm border-y border-border py-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-xs font-body text-[11px] text-muted">
                      <InlineIcon>{iconDocumento}</InlineIcon>
                      Docs requeridos
                    </span>
                    <span className="font-body text-[13px] font-semibold text-ink">
                      {obraSocial.checklist.length === 0 ? 'Ninguno' : `${obraSocial.checklist.length} documentos`}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-xs font-body text-[11px] text-muted">
                      <InlineIcon>{iconCredencial}</InlineIcon>
                      Facturación
                    </span>
                    <span className="font-body text-[13px] font-semibold text-ink">
                      {obraSocial.plantillaFactura.identificadorOrigen === 'paciente.dni' ? 'DNI' : 'Nro. de afiliado'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-xs">
                  <Chip kind={obraSocial.modalidadFacturacion === 'general' ? 'warning' : 'secondary'}>
                    {obraSocial.modalidadFacturacion === 'general' ? 'Facturación general' : 'Por prestación'}
                  </Chip>
                  {obraSocial.admitePagosParciales && <Chip kind="info">Admite pagos parciales</Chip>}
                </div>

                {obraSocial.checklist.length > 0 && (
                  <div className="flex flex-wrap items-center gap-xs">
                    {checklistVisible.map((item) => (
                      <Pill key={item.id}>{item.nombre}</Pill>
                    ))}
                    {checklistRestantes > 0 && <Pill emphasis="strong">+{checklistRestantes} más</Pill>}
                  </div>
                )}

                <div className="mt-auto flex items-center justify-end gap-md pt-xs">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(obraSocial);
                    }}
                    className="cursor-pointer border-none bg-transparent p-0 font-body text-[13px] font-semibold text-primary"
                  >
                    Ver detalle
                  </button>
                  <Button
                    variant="secondary-accent"
                    size="sm"
                    requiereEscritura
                    ariaLabel={`Editar ${obraSocial.nombre}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(obraSocial);
                    }}
                  >
                    Editar
                  </Button>
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
