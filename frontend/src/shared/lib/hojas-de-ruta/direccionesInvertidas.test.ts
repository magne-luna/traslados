import { describe, expect, it } from 'vitest';
import type { ParadaRecorrido } from '../../types/hojaDeRuta';
import { direccionesInvertidas } from './direccionesInvertidas';

function parada(pacienteId: string, direccionOrigenId: string, direccionDestinoId: string): ParadaRecorrido {
  return { id: `${pacienteId}-p`, pacienteId, tramo: 'ida', direccionOrigenId, direccionDestinoId, orden: 0 };
}

describe('direccionesInvertidas', () => {
  it('sin ninguna parada previa del paciente, no hay nada que invertir (null)', () => {
    expect(direccionesInvertidas([], 'paciente-1')).toBeNull();
  });

  it('con una parada de ida existente, sugiere origen/destino invertidos para la vuelta', () => {
    const paradas = [parada('paciente-1', 'dir-escuela', 'dir-casa')];

    expect(direccionesInvertidas(paradas, 'paciente-1')).toEqual({
      direccionOrigenId: 'dir-casa',
      direccionDestinoId: 'dir-escuela',
    });
  });

  it('las paradas de otros pacientes no afectan la sugerencia de este (aislamiento, triangulación)', () => {
    const paradas = [parada('paciente-2', 'dir-x', 'dir-y')];

    expect(direccionesInvertidas(paradas, 'paciente-1')).toBeNull();
  });
});
