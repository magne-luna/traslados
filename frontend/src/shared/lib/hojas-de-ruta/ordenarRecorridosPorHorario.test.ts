import { describe, expect, it } from 'vitest';
import type { ParadaRecorrido, Recorrido } from '../../types/hojaDeRuta';
import { ordenarRecorridosPorHorario } from './ordenarRecorridosPorHorario';

function parada(id: string, horaEstimada?: string): ParadaRecorrido {
  return {
    id,
    pacienteId: `paciente-${id}`,
    tramo: 'ida',
    direccionOrigenId: `dir-origen-${id}`,
    direccionDestinoId: `dir-destino-${id}`,
    orden: 0,
    horaEstimada,
  };
}

function recorrido(id: string, ...paradas: ParadaRecorrido[]): Recorrido {
  return { id, vehiculoId: `vehiculo-${id}`, conductorId: `conductor-${id}`, manual: false, paradas };
}

describe('ordenarRecorridosPorHorario', () => {
  it('ordena los recorridos por su horario más temprano', () => {
    const tarde = recorrido('vuelta', parada('a', '14:00'), parada('b', '16:00'));
    const temprano = recorrido('ida', parada('c', '06:30'));

    const resultado = ordenarRecorridosPorHorario([tarde, temprano]);

    expect(resultado.map((r) => r.id)).toEqual(['ida', 'vuelta']);
  });

  it('usa la parada con horario más temprano dentro de cada recorrido, no la primera de la lista (triangulación)', () => {
    const conHoraTardeYTemprano = recorrido('mixto', parada('a', '20:00'), parada('b', '05:00'));
    const soloIntermedio = recorrido('medio', parada('c', '10:00'));

    const resultado = ordenarRecorridosPorHorario([soloIntermedio, conHoraTardeYTemprano]);

    expect(resultado.map((r) => r.id)).toEqual(['mixto', 'medio']);
  });

  it('deja al final, en su orden relativo, los recorridos sin ninguna horaEstimada (borde, RN-HR-03)', () => {
    const sinHorario1 = recorrido('manual-1', parada('a'));
    const conHorario = recorrido('con-hora', parada('b', '09:00'));
    const sinHorario2 = recorrido('manual-2', parada('c'));

    const resultado = ordenarRecorridosPorHorario([sinHorario1, conHorario, sinHorario2]);

    expect(resultado.map((r) => r.id)).toEqual(['con-hora', 'manual-1', 'manual-2']);
  });

  it('no muta el array original (función pura)', () => {
    const recorridos = [recorrido('b', parada('x', '16:00')), recorrido('a', parada('y', '08:00'))];

    ordenarRecorridosPorHorario(recorridos);

    expect(recorridos.map((r) => r.id)).toEqual(['b', 'a']);
  });
});
