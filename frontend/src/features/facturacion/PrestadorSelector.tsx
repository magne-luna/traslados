import { useEffect, useState } from 'react';
import { Alert, EmptyState } from '../../design-system/feedback';
import { Field, Select } from '../../design-system/form';
import type { Prestador } from '../../shared/types/prestador';
import { usePrestadorRepository } from '../prestadores/PrestadorRepositoryContext';

interface PrestadorSelectorProps {
  formId: string;
  obraSocialId: string;
  prestadorId: string;
  onChange: (prestador: Prestador | undefined) => void;
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
}

// Selector de Prestador para el alta de factura (change `factura-por-prestador`, tasks.md 2.1,
// design.md D1): mismo patrón de fetch que `features/prestadores/PrestadoresDeObraSocial.tsx`
// (`usePrestadorRepository()` + `listarPorObraSocial(obraSocialId)`), sin duplicar lógica de
// repository — segundo consumidor del mismo método de solo lectura. El padre (`FacturaForm.tsx`)
// decide CUÁNDO montar este componente (solo si `modalidadFacturacion === 'por-prestacion'`); acá
// adentro no se vuelve a chequear esa condición.
//
// `onChange` entrega el `Prestador` completo (no solo el id) porque el caller necesita también
// `prestador.tipoComprobante` para fijarlo en el mismo evento (design.md D3) — entrega
// `undefined` cuando el usuario vuelve a "Seleccionar…", para que el caller pueda desbloquear
// `tipoComprobante` sin tener que ir a buscar el Prestador de nuevo.
export function PrestadorSelector({ formId, obraSocialId, prestadorId, onChange }: PrestadorSelectorProps) {
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
    return <EmptyState message="Ningún prestador vinculado a esta obra social todavía." />;
  }

  return (
    <Field label="Prestador" htmlFor={`${formId}-prestador`}>
      <Select
        id={`${formId}-prestador`}
        value={prestadorId}
        onChange={(e) => onChange(prestadores.find((p) => p.id === e.target.value))}
      >
        <option value="">Seleccionar prestador…</option>
        {prestadores.map((prestador) => (
          <option key={prestador.id} value={prestador.id}>{prestador.razonSocial}</option>
        ))}
      </Select>
    </Field>
  );
}
