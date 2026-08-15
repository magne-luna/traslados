import { useId, useMemo, useState } from 'react';
import { Button } from '../../design-system/components';
import { Field, Select, Input } from '../../design-system/form';
import type { Prestacion } from '../../shared/types/prestacion';
import { generateId } from '../../shared/lib/id';

/**
 * Línea `{ prestacionId, monto }` de la modalidad `general` (design.md D9/D10, tasks.md Fase 7).
 * REAPERTURA #13 (decisión usuaria 2026-08-16): el estado del formulario sigue viviendo acá,
 * pero `PresupuestoForm` ahora SÍ persiste las líneas — las suma para completar el `monto` único
 * (design.md D9) Y las envía en `values.lineas` (migración `20260816110000_presupuesto_lineas.sql`).
 * `id` es local del editor (generateId); el servidor asigna los ids reales de las filas.
 */
export interface LineaPresupuesto {
  id: string;
  prestacionId: string;
  monto: number;
}

interface PresupuestoLineasEditorProps {
  /** Catálogo de prestaciones del paciente elegido — inyectado por PresupuestoForm, nunca
   * consultado acá (sin red, tasks.md 7.3). */
  prestaciones: Prestacion[];
  lineas: LineaPresupuesto[];
  onChange: (lineas: LineaPresupuesto[]) => void;
}

function formatMonto(monto: number): string {
  return monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function nombrePrestacion(prestaciones: Prestacion[], prestacionId: string): string {
  return prestaciones.find((p) => p.id === prestacionId)?.nombre ?? 'Prestación desconocida';
}

// Componente controlado puro (tasks.md Fase 7, design.md D9/D10): mismo espíritu que
// AsistenciasEditor.tsx de Facturación — alta/baja de líneas { prestacionId, monto } con total
// calculado en vivo (useMemo/reduce). Sin red: no invoca ningún repository, no lee
// PresupuestoRepository/PrestacionRepository — recibe todo por props. `NUMERIC(10,2)`: el total se
// redondea a 2 decimales para evitar arrastre de errores de punto flotante; una línea sin monto
// (0 o no numérico) no rompe el cálculo, simplemente no suma.
export function PresupuestoLineasEditor({ prestaciones, lineas, onChange }: PresupuestoLineasEditorProps) {
  const [prestacionId, setPrestacionId] = useState('');
  const [monto, setMonto] = useState('');
  const formId = useId();

  const total = useMemo(() => {
    const suma = lineas.reduce((acc, linea) => acc + (Number.isFinite(linea.monto) ? linea.monto : 0), 0);
    return Math.round(suma * 100) / 100;
  }, [lineas]);

  function handleAgregar() {
    const montoNumerico = Number(monto);
    if (!prestacionId || !Number.isFinite(montoNumerico) || montoNumerico <= 0) return;
    const nuevaLinea: LineaPresupuesto = { id: generateId('linea-presupuesto'), prestacionId, monto: montoNumerico };
    onChange([...lineas, nuevaLinea]);
    setPrestacionId('');
    setMonto('');
  }

  function handleQuitar(id: string) {
    onChange(lineas.filter((linea) => linea.id !== id));
  }

  return (
    <div className="flex flex-col gap-md">
      {/* Corrección confirmada por la usuaria (2026-08-15): en modalidad `general` no quedaba
          claro que se puede cargar más de una línea — se leía como un único monto por prestación.
          Aclara que se admite una línea por cada prestación que compone el total. */}
      <p className="m-0 font-body text-xs text-muted">
        Podés cargar varias líneas: una por cada prestación que compone el total.
      </p>

      {lineas.length === 0 ? (
        <p className="m-0 font-body text-sm text-muted">No hay líneas cargadas todavía.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-xs p-0">
          {lineas.map((linea) => (
            <li
              key={linea.id}
              className="flex flex-wrap items-center justify-between gap-sm rounded-sm border border-border bg-surface-soft px-md py-xs"
            >
              <div className="flex flex-wrap items-center gap-sm font-body text-[13px] text-text">
                <span className="font-semibold">{nombrePrestacion(prestaciones, linea.prestacionId)}</span>
                <span className="font-mono text-muted">${formatMonto(linea.monto)}</span>
              </div>
              <button
                type="button"
                onClick={() => handleQuitar(linea.id)}
                className="cursor-pointer border-none bg-transparent p-0 font-body text-xs font-semibold text-danger"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-sm border-t border-border pt-sm">
        <span className="font-body text-[13px] font-semibold text-ink">Total</span>
        <span className="font-mono text-[14px] font-bold text-ink">${formatMonto(total)}</span>
      </div>

      <div className="grid grid-cols-1 gap-md md:grid-cols-[1fr_1fr_auto] md:items-end">
        <Field label="Prestación" htmlFor={`${formId}-prestacion`}>
          <Select
            id={`${formId}-prestacion`}
            density="comfortable"
            value={prestacionId}
            onChange={(event) => setPrestacionId(event.target.value)}
          >
            <option value="">Seleccionar prestación…</option>
            {prestaciones.map((prestacion) => (
              <option key={prestacion.id} value={prestacion.id}>
                {prestacion.nombre}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Monto de la línea" htmlFor={`${formId}-monto`}>
          <Input
            id={`${formId}-monto`}
            type="number"
            min={0}
            step="0.01"
            density="comfortable"
            value={monto}
            onChange={(event) => setMonto(event.target.value)}
          />
        </Field>

        <Button type="button" variant="primary" onClick={handleAgregar}>
          Agregar
        </Button>
      </div>
    </div>
  );
}
