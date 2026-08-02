import { useEffect, useState } from 'react';
import { Card } from '../../design-system/layout';
import { Alert, EmptyState } from '../../design-system/feedback';
import type { Prestador } from '../../shared/types/prestador';
import { usePrestadorRepository } from './PrestadorRepositoryContext';

interface PrestadoresDeObraSocialProps {
  obraSocialId: string;
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
}

// Panel de solo lectura (design.md D2 de prestadores-crud, tasks.md 5.2): prestadores vinculados
// a esta ObraSocial, resueltos vía `PrestadorRepository.listarPorObraSocial()`. El multi-select de
// escritura vive del otro lado (`PrestadorForm.tsx`, D2) — este componente NUNCA edita el vínculo,
// solo lo muestra. Se monta dentro de `ObraSocialDetail.tsx`, que ya conoce el id de la obra
// social. Sin test dedicado: es la pieza de menor prioridad del change si hay que recortar la
// demo (design.md D2 lo dice explícito) — el smoke test de `update()` en §3.5 ya protege la
// aserción que importa del vínculo (diff no-op sin cambios reales).
export function PrestadoresDeObraSocial({ obraSocialId }: PrestadoresDeObraSocialProps) {
  const repository = usePrestadorRepository();
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);

    repository
      .listarPorObraSocial(obraSocialId)
      .then((data) => {
        if (!cancelado) setPrestadores(data);
      })
      .catch((err: unknown) => {
        if (!cancelado) setError(toErrorMessage(err));
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [repository, obraSocialId]);

  if (loading) return <p className="font-body text-sm text-muted">Cargando prestadores…</p>;
  if (error) return <Alert tone="danger">{error}</Alert>;
  if (prestadores.length === 0) {
    return <EmptyState message="Ningún prestador vinculado todavía." />;
  }

  return (
    <div className="grid grid-cols-1 gap-sm md:grid-cols-2">
      {prestadores.map((prestador) => (
        <Card key={prestador.id} radius="sm" gap="sm">
          <span className="font-body text-[13px] font-semibold text-ink">{prestador.razonSocial}</span>
          <span className="font-mono text-[12px] text-muted">CUIT: {prestador.cuit}</span>
        </Card>
      ))}
    </div>
  );
}
