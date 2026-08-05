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

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

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
  // Alineación de calendario (integración del prototipo "Plegable + calendario", 2026-08-05):
  // offset de celdas vacías para que el día 1 caiga bajo su columna real de la semana.
  // `getUTCDay()` da 0=domingo..6=sábado; la grilla arranca en lunes, así que domingo (0) va al
  // final (offset 6) y el resto se corre uno a la izquierda.
  const primerDiaSemana = new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay();
  const offsetInicial = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1;

  return (
    // gateo-facturacion (design.md D2, tasks.md 5.5): seleccionar días facturables es una
    // escritura no-CRUD gateada al mismo nivel `write` — ninguna requiere `admin` (decisión 5).
    // La selección actual (checked) sigue siendo legible con solo `read`.
    <CamposSoloLectura>
    <div className="grid grid-cols-7 gap-xs">
      {DIAS_SEMANA.map((letra, i) => (
        <span key={`${letra}-${i}`} className="text-center font-body text-[11px] font-semibold text-faint">{letra}</span>
      ))}
      {Array.from({ length: offsetInicial }, (_, i) => <span key={`offset-${i}`} aria-hidden="true" />)}
      {dias.map((dia) => {
        const fecha = isoDelDia(anio, mes, dia);
        const esFeriado = feriadosSet.has(fecha);
        const seleccionado = seleccionados.has(fecha);
        return (
          // Chips cuadrados (feedback de usuario 2026-08-05: "sacale el checkbox y hacelos más
          // cuadrados no tan rectangulares"): el color/borde ya comunica selección sin el ícono
          // de checkbox — el `<input type="checkbox">` sigue en el DOM como `sr-only`, el
          // `<label>` lo sigue exponiendo a lectores de pantalla y a los tests
          // (`getByRole('checkbox', {name})`), solo se le saca la representación visual. La
          // leyenda "Feriado" en cambio SÍ tiene que verse (mismo feedback: "los feriados si
          // quiero que digan feriado") — se acomoda como segunda línea chica adentro del mismo
          // cuadrado en vez de ensancharlo.
          <label
            key={fecha}
            className={`relative flex aspect-square cursor-pointer flex-col items-center justify-center gap-px rounded-sm border font-body text-[12px] transition-colors ${
              seleccionado
                ? 'border-primary bg-primary-softer/30 text-primary'
                : esFeriado
                  ? 'border-warning bg-warning-soft text-warning'
                  : 'border-border bg-surface text-text hover:border-border-strong'
            }`}
          >
            <span>{dia}</span>
            {esFeriado && <span className="font-body text-[8px] leading-none font-semibold uppercase tracking-tight">Feriado</span>}
            <input
              type="checkbox"
              className="sr-only"
              checked={seleccionado}
              onChange={() => toggle(fecha)}
              aria-label={`${dia} de ${nombreMes}`}
            />
          </label>
        );
      })}
    </div>
    </CamposSoloLectura>
  );
}
