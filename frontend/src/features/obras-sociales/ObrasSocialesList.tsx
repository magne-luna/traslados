import { useMemo, useState } from 'react';
import { Button, Chip, InlineIcon, SearchInput } from '../../design-system/components';
import { Alert, EmptyState, Pill } from '../../design-system/feedback';
import { Card } from '../../design-system/layout';
import { iconCredencial, iconDocumento, iconReloj } from '../../design-system/icons';
import type { ObraSocial } from '../../shared/types/obraSocial';

interface ObrasSocialesListProps {
  obrasSociales: ObraSocial[];
  loading: boolean;
  error: string | null;
  onSelect: (obraSocial: ObraSocial) => void;
  onCreateNew: () => void;
}

const CHECKLIST_PREVIEW_COUNT = 3;

// Pantalla de listado (tasks.md 4.1, US-300/RF-300): estados de carga/vacío/error explícitos
// (frontend-ui-design — nunca una pantalla en blanco), presentacional puro: recibe los datos
// del hook useObrasSociales ya resueltos por ObraSocialesPage. Grid de tarjetas (no filas) para
// exponer de entrada la mayor cantidad de información del maestro sin entrar al detalle: plazo
// de cobro, cantidad de documentos del checklist, identificador usado en la factura, modalidad
// de facturación y preview del propio checklist. La búsqueda es un filtro local por
// nombre/CUIT — no hay concepto de "estado" de obra social en el modelo (ObraSocial no lo
// define), así que no se agregó ese filtro para no inventar un campo que no existe.
export function ObrasSocialesList({ obrasSociales, loading, error, onSelect, onCreateNew }: ObrasSocialesListProps) {
  const [busqueda, setBusqueda] = useState('');

  const filtradas = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return obrasSociales;
    return obrasSociales.filter(
      (obraSocial) => obraSocial.nombre.toLowerCase().includes(termino) || obraSocial.cuit.includes(termino),
    );
  }, [busqueda, obrasSociales]);

  return (
    <div className="flex flex-col gap-lg py-xxl px-xl">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <h1 className="m-0 font-heading text-[21px] font-bold text-ink">Obras Sociales</h1>
        <Button variant="primary" onClick={onCreateNew}>
          + Nueva obra social
        </Button>
      </div>

      {obrasSociales.length > 0 && (
        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar obra social…" ariaLabel="Buscar obra social" />
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <p className="font-body text-sm text-muted">Cargando obras sociales…</p>
      ) : obrasSociales.length === 0 ? (
        <EmptyState
          message="No hay obras sociales cargadas todavía."
          action={
            <Button variant="secondary" onClick={onCreateNew}>
              Crear la primera obra social
            </Button>
          }
        />
      ) : filtradas.length === 0 ? (
        <p className="font-body text-sm text-muted">Ninguna obra social coincide con "{busqueda}".</p>
      ) : (
        <div className="grid grid-cols-1 gap-md md:grid-cols-3">
          {filtradas.map((obraSocial) => {
            const checklistVisible = obraSocial.checklist.slice(0, CHECKLIST_PREVIEW_COUNT);
            const checklistRestantes = obraSocial.checklist.length - checklistVisible.length;

            return (
              <Card key={obraSocial.id} radius="md" elevated interactive onClick={() => onSelect(obraSocial)}>
                <div className="flex items-start justify-between gap-sm">
                  <div className="flex flex-col">
                    <h2 className="m-0 font-heading text-[17px] font-bold text-ink">{obraSocial.nombre}</h2>
                    <span className="font-mono text-[12px] text-muted">CUIT: {obraSocial.cuit}</span>
                  </div>
                  <Chip kind="success">Comprobante {obraSocial.tipoComprobante}</Chip>
                </div>

                <div className="grid grid-cols-3 gap-sm border-y border-border py-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-xs font-body text-[11px] text-muted">
                      <InlineIcon>{iconReloj}</InlineIcon>
                      Plazo de cobro
                    </span>
                    <span className="font-body text-[13px] font-semibold text-ink">{obraSocial.plazoCobroDias} días</span>
                  </div>
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

                <div className="flex items-center justify-end gap-md pt-xs">
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
      )}
    </div>
  );
}
