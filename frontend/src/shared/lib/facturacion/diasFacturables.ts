// Función pura (tasks.md 3.3, design.md Decisión 11, RN-FA-03): devuelve la pre-selección
// sugerida de días facturables de un período, excluyendo feriados de un catálogo INYECTADO
// (nunca hardcodeado acá ni en el componente) y domingos, e incluyendo sábados solo si la
// prestación lo indica. Es una sugerencia editable — `Factura.dias` es el conteo final que
// confirma la usuaria (US-400: carga manual).

export interface DiasFacturablesInput {
  /** 1-12. */
  mes: number;
  anio: number;
  /** Catálogo de feriados como fechas ISO (`YYYY-MM-DD`), inyectado — ver feriadosFixture.ts. */
  feriados: string[];
  /** RN-FA-03: "según la prestación — regla configurable, no uniforme". */
  facturaSabados: boolean;
}

const DOMINGO = 0;
const SABADO = 6;

function isoDate(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function diasFacturables({ mes, anio, feriados, facturaSabados }: DiasFacturablesInput): string[] {
  const feriadosSet = new Set(feriados);
  const cantidadDias = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const resultado: string[] = [];

  for (let dia = 1; dia <= cantidadDias; dia++) {
    const fecha = isoDate(anio, mes, dia);

    // Un feriado se excluye siempre, sea cual sea el día de la semana (gana sobre facturaSabados).
    if (feriadosSet.has(fecha)) continue;

    const weekday = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
    if (weekday === DOMINGO) continue;
    if (weekday === SABADO && !facturaSabados) continue;

    resultado.push(fecha);
  }

  return resultado;
}
