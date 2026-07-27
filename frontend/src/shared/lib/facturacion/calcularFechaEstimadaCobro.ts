import { PLAZO_COBRO_AMPARO_DIAS, PLAZO_COBRO_DEFAULT_DIAS } from './constantes';

// Función pura (tasks.md 3.6, design.md Decisión 7, RN-FA-04): calcula la fecha estimada de
// cobro contando desde `fechaFactura` (nunca desde la prestación ni la autorización). Precedencia
// explícita: amparo judicial > plazo propio de la obra social > default general — la parte más
// pendiente de confirmar con el cliente (design.md §Open Questions).
export interface CalcularFechaEstimadaCobroInput {
  /** ISO date. */
  fechaFactura: string;
  amparoJudicial: boolean;
  /** `ObraSocial.plazoCobroDias`, si está definido. */
  plazoObraSocial: number | undefined;
}

function plazoAplicable({ amparoJudicial, plazoObraSocial }: CalcularFechaEstimadaCobroInput): number {
  if (amparoJudicial) return PLAZO_COBRO_AMPARO_DIAS;
  if (plazoObraSocial !== undefined) return plazoObraSocial;
  return PLAZO_COBRO_DEFAULT_DIAS;
}

export function calcularFechaEstimadaCobro(input: CalcularFechaEstimadaCobroInput): string {
  const plazo = plazoAplicable(input);
  const fecha = new Date(`${input.fechaFactura}T00:00:00.000Z`);
  fecha.setUTCDate(fecha.getUTCDate() + plazo);
  return fecha.toISOString().slice(0, 10);
}
