import { describe, expect, it } from 'vitest';
import type { Autorizacion } from '../../types/presupuesto';
import { derivarCupoAutorizado } from './cupoAutorizado';

// Función pura (tasks.md 7.1, design.md Decisión 9): deriva la proyección CupoAutorizado
// consumible por FE-6 a partir de una Autorizacion + el pacienteId de su Presupuesto.

function autorizacion(overrides: Partial<Autorizacion> = {}): Autorizacion {
  return {
    id: 'autorizacion-facundo-1',
    presupuestoId: 'presupuesto-facundo-1',
    estado: 'autorizada',
    ...overrides,
  };
}

describe('derivarCupoAutorizado', () => {
  it('deriva el pacienteId y los cupos mensuales de días/km desde la autorización', () => {
    const cupo = derivarCupoAutorizado(
      autorizacion({ cupoMensualDias: 20, cupoMensualKm: 600, vigenciaDesde: '2026-03-01' }),
      'paciente-facundo',
    );

    expect(cupo).toEqual({
      pacienteId: 'paciente-facundo',
      cupoMensualDias: 20,
      cupoMensualKm: 600,
      vigenciaDesde: '2026-03-01',
    });
  });

  it('deja los cupos undefined cuando la autorización no los tiene todavía (ej. pendiente, triangulación)', () => {
    const cupo = derivarCupoAutorizado(autorizacion({ estado: 'pendiente' }), 'paciente-martina');

    expect(cupo).toEqual({ pacienteId: 'paciente-martina', cupoMensualDias: undefined, cupoMensualKm: undefined, vigenciaDesde: undefined });
  });

  it('el resultado depende solo de los argumentos (función pura, sin efectos)', () => {
    const input = autorizacion({ cupoMensualDias: 10, cupoMensualKm: 300 });
    const primero = derivarCupoAutorizado(input, 'paciente-brisa');
    const segundo = derivarCupoAutorizado(input, 'paciente-brisa');

    expect(primero).toEqual(segundo);
  });
});
