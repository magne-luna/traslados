import { useEffect, useState } from 'react';
import { CamposSoloLectura } from '../../design-system/components';
import { diasFacturables } from '../../shared/lib/facturacion/diasFacturables';

interface DiasFacturablesSelectorProps {
  /** 1-12. */
  mes: number;
  anio: number;
  /** Catálogo de feriados inyectado (ver feriadosFixture.ts) — nunca hardcodeado acá. */
  feriados: string[];
  facturaSabados: boolean;
  /** Se dispara con la pre-selección al montar/cambiar el período, y con cada toggle manual. */
  onChange: (dias: string[]) => void;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function cantidadDeDiasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

function isoDelDia(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

// Selector de días facturables del período (tasks.md 8.1, design.md Decisión 11, RN-FA-03):
// pre-selecciona la sugerencia de `diasFacturables`, marca los feriados de forma visual, y deja
// que la usuaria marque/desmarque cualquier día — la cantidad final es la que ella confirme
// (US-400: carga manual, la exclusión es solo una ayuda visual, nunca una imposición).
export function DiasFacturablesSelector({ mes, anio, feriados, facturaSabados, onChange }: DiasFacturablesSelectorProps) {
  const feriadosSet = new Set(feriados);
  const [seleccionados, setSeleccionados] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const preSeleccion = new Set(diasFacturables({ mes, anio, feriados, facturaSabados }));
    setSeleccionados(preSeleccion);
    onChange(Array.from(preSeleccion));
    // Se recalcula solo cuando cambia el período o la regla de sábados — `feriados` y `onChange`
    // se asumen estables por referencia desde el composition root (fixture/context), evitando un
    // loop de recálculo en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, anio, facturaSabados]);

  function toggle(fecha: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(fecha)) next.delete(fecha);
      else next.add(fecha);
      onChange(Array.from(next));
      return next;
    });
  }

  const cantidadDias = cantidadDeDiasDelMes(anio, mes);
  const dias = Array.from({ length: cantidadDias }, (_, index) => index + 1);
  const nombreMes = MESES[mes - 1] ?? '';

  return (
    // gateo-facturacion (design.md D2, tasks.md 5.5): seleccionar días facturables es una
    // escritura no-CRUD gateada al mismo nivel `write` — ninguna requiere `admin` (decisión 5).
    // La selección actual (checked) sigue siendo legible con solo `read`.
    <CamposSoloLectura>
    <div className="flex flex-wrap gap-xs">
      {dias.map((dia) => {
        const fecha = isoDelDia(anio, mes, dia);
        const esFeriado = feriadosSet.has(fecha);
        return (
          <label
            key={fecha}
            className={`flex items-center gap-xs rounded-sm border px-sm py-xs font-body text-[12px] ${
              esFeriado ? 'border-warning bg-warning-soft text-warning' : 'border-border bg-surface text-text'
            }`}
          >
            <input
              type="checkbox"
              checked={seleccionados.has(fecha)}
              onChange={() => toggle(fecha)}
              aria-label={`${dia} de ${nombreMes}`}
            />
            {dia}
            {esFeriado && <span className="font-semibold">Feriado</span>}
          </label>
        );
      })}
    </div>
    </CamposSoloLectura>
  );
}
