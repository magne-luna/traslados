// Función pura (feedback de usuario): si el paciente elegido ya tiene una parada en este
// recorrido (ej. la ida), sugiere origen/destino invertidos para prellenar el tramo que falta
// (la vuelta natural vuelve por donde vino la ida) — el operador puede corregirlo a mano, es una
// sugerencia, nunca un valor impuesto (mismo criterio que sugerirOrdenPorCercania, RN-HR-01).

import type { ParadaRecorrido } from '../../types/hojaDeRuta';

export function direccionesInvertidas(
  paradas: readonly ParadaRecorrido[],
  pacienteId: string,
): { direccionOrigenId: string; direccionDestinoId: string } | null {
  const existente = paradas.find((parada) => parada.pacienteId === pacienteId);
  if (!existente) return null;
  return { direccionOrigenId: existente.direccionDestinoId, direccionDestinoId: existente.direccionOrigenId };
}
