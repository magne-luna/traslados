import type { PeriodoMeses } from '../../types/reportes';

/**
 * Componentes de una fecha ISO (año/mes/día), parseados directamente del string — sin pasar
 * por `new Date(...)` (design.md Risks/Trade-offs, "Zonas horarias en la atribución por
 * fecha"): construir un `Date` a partir de `'2026-03-01'` da medianoche UTC, que en
 * `America/Argentina/Buenos_Aires` (UTC-3) puede leerse como el día/mes anterior. Parsear el
 * string evita ese corrimiento por completo, con el mismo cuidado que ya toma
 * `estadoVencimientoFactura` al normalizar con `T00:00:00.000Z`.
 */
export interface ComponentesFecha {
  anio: number;
  mes: number;
  dia: number;
}

export function componentesFecha(iso: string): ComponentesFecha {
  const partes = iso.slice(0, 10).split('-');
  const anio = Number(partes[0]);
  const mes = Number(partes[1]);
  const dia = Number(partes[2]);
  if (partes.length !== 3 || Number.isNaN(anio) || Number.isNaN(mes) || Number.isNaN(dia)) {
    throw new Error(`componentesFecha: fecha ISO inválida: "${iso}"`);
  }
  return { anio, mes, dia };
}

export interface PeriodosDelRangoInput {
  /** ISO date de referencia ("hoy"), inyectada — nunca un reloj implícito acá. */
  hoy: string;
  meses: PeriodoMeses;
}

export interface PeriodoDelRango {
  mes: number;
  anio: number;
}

/**
 * Eje de meses del reporte (design.md Decisión 1 y 4, tasks.md 3.1): del más antiguo al más
 * reciente, incluyendo siempre el mes de `hoy`. La longitud del resultado es siempre `meses`.
 */
export function periodosDelRango({ hoy, meses }: PeriodosDelRangoInput): PeriodoDelRango[] {
  const { anio: anioHoy, mes: mesHoy } = componentesFecha(hoy);

  const puntos: PeriodoDelRango[] = [];
  for (let offset = meses - 1; offset >= 0; offset--) {
    let mes = mesHoy - offset;
    let anio = anioHoy;
    while (mes <= 0) {
      mes += 12;
      anio -= 1;
    }
    puntos.push({ mes, anio });
  }
  return puntos;
}
