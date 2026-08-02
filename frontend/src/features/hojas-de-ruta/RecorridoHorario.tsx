import { Fragment } from 'react';
import { InlineIcon } from '../../design-system/components';
import type { ParadaRecorrido } from '../../shared/types/hojaDeRuta';

interface RecorridoHorarioProps {
  paradas: ParadaRecorrido[];
}

const HORA_SIN_CARGAR = '--:--';

function etiqueta(indice: number, total: number): string {
  if (indice === 0) return 'Primera parada';
  if (indice === total - 1) return 'Hora de regreso';
  return `Parada ${indice + 1}`;
}

// Resumen visual del horario del recorrido, modo solo-lectura (feedback de usuario: "más
// énfasis en los horarios" + "que figuren todos los horarios"). Una sola parada → reloj grande +
// "Hora de salida". Dos o más → línea de tiempo con TODAS las paradas, primera y última con
// rótulo semántico, las del medio numeradas.
export function RecorridoHorario({ paradas }: RecorridoHorarioProps) {
  if (paradas.length === 0) return null;

  if (paradas.length === 1) {
    return (
      <div className="flex w-26 shrink-0 flex-col items-center justify-center gap-xs text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success-soft text-success">
          <InlineIcon size={22}>
            <circle cx="12" cy="12" r="9" />
            <polyline points="12 7 12 12 15.5 14" />
          </InlineIcon>
        </span>
        <span className="font-heading text-[19px] font-bold text-ink">{paradas[0]!.horaEstimada ?? HORA_SIN_CARGAR}</span>
        <span className="font-body text-[11px] text-muted">Hora de salida</span>
      </div>
    );
  }

  return (
    <div className="flex w-26 shrink-0 flex-col items-center justify-center gap-xs text-center">
      {paradas.map((parada, indice) => (
        <Fragment key={parada.id}>
          {indice > 0 && <span className="h-6 w-px shrink-0 bg-border-strong" />}
          <span className="h-3 w-3 shrink-0 rounded-full border-2 border-success" />
          <span className="font-heading text-[16px] font-bold text-ink">{parada.horaEstimada ?? HORA_SIN_CARGAR}</span>
          <span className="-mt-1 font-body text-[11px] text-muted">{etiqueta(indice, paradas.length)}</span>
        </Fragment>
      ))}
    </div>
  );
}
