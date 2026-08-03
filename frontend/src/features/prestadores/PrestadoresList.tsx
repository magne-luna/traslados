import { useMemo, useState } from 'react';
import { Button, Chip, SearchInput } from '../../design-system/components';
import { Alert, EmptyState } from '../../design-system/feedback';
import { Card } from '../../design-system/layout';
import type { Prestador } from '../../shared/types/prestador';

interface PrestadoresListProps {
  prestadores: Prestador[];
  loading: boolean;
  error: string | null;
  onSelect: (prestador: Prestador) => void;
  onCreateNew: () => void;
}

// Pantalla de listado (tasks.md 4.5, spec prestador-crud): estados de carga/vacío/error
// explícitos, presentacional puro — recibe los datos del hook usePrestadores ya resueltos por
// PrestadoresPage. Grid de tarjetas (no filas), espejo de ObrasSocialesList.tsx. Cada tarjeta
// muestra al menos razón social, CUIT y tipo de comprobante (spec §Listado de Prestadores). La
// búsqueda es un filtro local por razón social/CUIT.
export function PrestadoresList({ prestadores, loading, error, onSelect, onCreateNew }: PrestadoresListProps) {
  const [busqueda, setBusqueda] = useState('');

  const filtrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return prestadores;
    return prestadores.filter(
      (prestador) =>
        prestador.razonSocial.toLowerCase().includes(termino) || prestador.cuit.includes(termino),
    );
  }, [busqueda, prestadores]);

  return (
    <div className="flex flex-col gap-lg py-xxl px-xl">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <h1 className="m-0 font-heading text-[21px] font-bold text-ink">Prestadores</h1>
        <Button variant="primary" requiereEscritura onClick={onCreateNew}>
          + Nuevo prestador
        </Button>
      </div>

      {prestadores.length > 0 && (
        <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar prestador…" ariaLabel="Buscar prestador" />
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      {loading ? (
        <p className="font-body text-sm text-muted">Cargando prestadores…</p>
      ) : prestadores.length === 0 ? (
        <EmptyState
          message="No hay prestadores cargados todavía."
          action={
            <Button variant="secondary" requiereEscritura onClick={onCreateNew}>
              + Crear el primer prestador
            </Button>
          }
        />
      ) : filtrados.length === 0 ? (
        <p className="font-body text-sm text-muted">Ningún prestador coincide con "{busqueda}".</p>
      ) : (
        <div className="grid grid-cols-1 gap-md md:grid-cols-3">
          {filtrados.map((prestador) => (
            <Card key={prestador.id} radius="md" elevated interactive onClick={() => onSelect(prestador)}>
              <div className="flex items-start justify-between gap-sm">
                <div className="flex flex-col">
                  <h2 className="m-0 font-heading text-[17px] font-bold text-ink">{prestador.razonSocial}</h2>
                  <span className="font-mono text-[12px] text-muted">CUIT: {prestador.cuit}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-sm border-y border-border py-sm">
                <div className="flex flex-col gap-0.5">
                  <span className="font-body text-[11px] text-muted">Plazo de cobro</span>
                  <span className="font-body text-[13px] font-semibold text-ink">{prestador.plazoCobroDias} días</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-body text-[11px] text-muted">Comprobante</span>
                  <Chip kind="secondary">{prestador.tipoComprobante}</Chip>
                </div>
              </div>

              <div className="mt-auto flex items-center justify-end gap-md pt-xs">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(prestador);
                  }}
                  className="cursor-pointer border-none bg-transparent p-0 font-body text-[13px] font-semibold text-primary"
                >
                  Ver detalle
                </button>
                <Button
                  variant="secondary-accent"
                  size="sm"
                  requiereEscritura
                  ariaLabel={`Editar ${prestador.razonSocial}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(prestador);
                  }}
                >
                  Editar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
