import { useId, useState } from 'react';
import { Button } from '../../design-system/components';
import { Input } from '../../design-system/form';
import { ClockIcon } from './icons';

// Franja horaria del día, editable (Andrea, 2026-10-07): hay viajes programados al Garrahan a las
// 4-5 de la mañana y otros que salen a las 20 — la franja no puede quedar fija en la de creación.
// El backend ya la persiste (`franja_inicio`/`franja_fin`, RPC de update); solo faltaba la UI.
export function FranjaHorariaEditable({
  inicio,
  fin,
  onGuardar,
}: {
  inicio: string;
  fin: string;
  onGuardar: (inicio: string, fin: string) => Promise<unknown>;
}) {
  const id = useId();
  const [editando, setEditando] = useState(false);
  const [desde, setDesde] = useState(inicio);
  const [hasta, setHasta] = useState(fin);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  function empezar() {
    setDesde(inicio);
    setHasta(fin);
    setError(null);
    setEditando(true);
  }

  async function guardar() {
    // 'HH:MM' de 24 hs: la comparación de strings ordena igual que la de horarios.
    if (!desde || !hasta || desde >= hasta) {
      setError('El inicio tiene que ser anterior al fin.');
      return;
    }
    setGuardando(true);
    try {
      await onGuardar(desde, hasta);
      setEditando(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la franja.');
    } finally {
      setGuardando(false);
    }
  }

  if (!editando) {
    return (
      <div className="flex items-center gap-xs rounded-sm border border-border-strong bg-surface px-md py-2 text-muted">
        <ClockIcon />
        <span className="font-body text-[13px]">
          Franja {inicio} a {fin}
        </span>
        <Button variant="secondary" size="sm" requiereEscritura onClick={empezar} ariaLabel="Editar franja horaria">
          Editar
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-xs rounded-sm border border-border-strong bg-surface px-md py-2 text-muted">
      <ClockIcon />
      <label htmlFor={`${id}-desde`} className="font-body text-[13px]">
        Desde
      </label>
      <Input id={`${id}-desde`} type="time" value={desde} onChange={(e) => setDesde(e.target.value)} />
      <label htmlFor={`${id}-hasta`} className="font-body text-[13px]">
        Hasta
      </label>
      <Input id={`${id}-hasta`} type="time" value={hasta} onChange={(e) => setHasta(e.target.value)} />
      <Button variant="primary" size="sm" requiereEscritura disabled={guardando} onClick={() => void guardar()}>
        Guardar
      </Button>
      <Button variant="secondary" size="sm" onClick={() => setEditando(false)}>
        Cancelar
      </Button>
      {error && <span className="w-full font-body text-[12px] text-danger">{error}</span>}
    </div>
  );
}
