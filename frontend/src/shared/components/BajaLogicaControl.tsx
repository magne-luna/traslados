import { useState } from 'react';
import { Button, Chip } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';

type Entidad = 'paciente' | 'obra social';

const INACTIVO: Record<Entidad, string> = { paciente: 'Inactivo', 'obra social': 'Inactiva' };

// Baja lógica (reunión con Andrea, 2026-10-07): nada se borra, se inactiva — el historial
// (presupuestos, facturas) sigue apuntando a la fila. Inactivar pide confirmación porque saca a la
// entidad del listado y de los selectores; reactivar no, porque no oculta nada.
export function BajaLogicaControl({
  activo,
  entidad,
  onCambiar,
}: {
  activo: boolean;
  entidad: Entidad;
  onCambiar: (activo: boolean) => Promise<unknown>;
}) {
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cambiar() {
    if (activo && !window.confirm(`¿Inactivar ${entidad}? Deja de aparecer en el listado y al cargar presupuestos, facturas u hojas de ruta. Se puede reactivar cuando quieras.`)) return;
    setGuardando(true);
    setError(null);
    try {
      await onCambiar(!activo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el cambio.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-col gap-sm">
      <div className="flex flex-wrap items-center justify-end gap-sm">
        {!activo && <Chip kind="secondary">{INACTIVO[entidad]}</Chip>}
        <Button variant="secondary" size="sm" requiereEscritura disabled={guardando} onClick={() => void cambiar()} ariaLabel={`${activo ? 'Inactivar' : 'Reactivar'} ${entidad}`}>
          {activo ? 'Inactivar' : 'Reactivar'}
        </Button>
      </div>
      {error && <Alert tone="danger">{error}</Alert>}
    </div>
  );
}

/** Tilde "Mostrar inactivos/as" de los listados. Siempre visible: si todo está inactivo, es la
 * única forma de volver a verlo. */
export function MostrarInactivos({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-xs self-start font-body text-[13px] text-muted">
      <input type="checkbox" className="h-4 w-4 accent-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
