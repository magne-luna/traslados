import { describe, expect, it } from 'vitest';
import type { ParadaRecorrido } from '../../types/hojaDeRuta';
import { pacienteDisponibleEnRecorrido } from './pacienteDisponibleEnRecorrido';

function parada(pacienteId: string, tramo: 'ida' | 'vuelta'): ParadaRecorrido {
  return { id: `${pacienteId}-${tramo}`, pacienteId, tramo, direccionOrigenId: 'x', direccionDestinoId: 'y', orden: 0 };
}

describe('pacienteDisponibleEnRecorrido', () => {
  it('un paciente sin ninguna parada en el recorrido está disponible', () => {
    expect(pacienteDisponibleEnRecorrido([], 'paciente-1')).toBe(true);
  });

  it('un paciente con solo la parada de ida sigue disponible, para agregarle la vuelta (RN-HR-02)', () => {
    const paradas = [parada('paciente-1', 'ida')];

    expect(pacienteDisponibleEnRecorrido(paradas, 'paciente-1')).toBe(true);
  });

  it('un paciente con solo la parada de vuelta sigue disponible, para agregarle la ida (triangulación)', () => {
    const paradas = [parada('paciente-1', 'vuelta')];

    expect(pacienteDisponibleEnRecorrido(paradas, 'paciente-1')).toBe(true);
  });

  it('un paciente con ida y vuelta ya cargadas deja de estar disponible (borde)', () => {
    const paradas = [parada('paciente-1', 'ida'), parada('paciente-1', 'vuelta')];

    expect(pacienteDisponibleEnRecorrido(paradas, 'paciente-1')).toBe(false);
  });

  it('las paradas de otros pacientes no afectan la disponibilidad de este (aislamiento)', () => {
    const paradas = [parada('paciente-2', 'ida'), parada('paciente-2', 'vuelta')];

    expect(pacienteDisponibleEnRecorrido(paradas, 'paciente-1')).toBe(true);
  });
});
