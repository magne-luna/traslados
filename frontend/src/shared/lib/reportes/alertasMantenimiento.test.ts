import { describe, expect, it } from 'vitest';
import type { Vehiculo } from '../../types/vehiculo';
import { alertasMantenimiento } from './alertasMantenimiento';

// tasks.md 4.6, design.md Decisión 5, spec dashboard-tarjetas-alertas: alertasMantenimiento
// reutiliza estadoServicePreventivo y estadoHabilitacion de shared/lib/mantenimiento/, nunca
// reimplementa esas reglas ni sus umbrales.

const AHORA = new Date('2026-07-24');

function vehiculo(overrides: Partial<Vehiculo> = {}): Vehiculo {
  return {
    id: 'v1',
    patente: 'AB123CD',
    modelo: 'Sprinter',
    tipo: 'combi',
    capacidad: 6,
    accesoriosCompatibles: [],
    estado: 'habilitado',
    kilometraje: 10_000,
    kilometrajeUltimoService: 9_000,
    fechaUltimoService: '2026-07-01',
    habilitaciones: [],
    gastos: [],
    mantenimientos: [],
    ...overrides,
  };
}

describe('alertasMantenimiento', () => {
  it('un vehículo con el service preventivo vencido aparece con ese motivo', () => {
    const vehiculos = [vehiculo({ id: 'v1', kilometraje: 20_000, kilometrajeUltimoService: 0, fechaUltimoService: '2020-01-01' })];
    const resultado = alertasMantenimiento({ vehiculos, ahora: AHORA });
    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.motivos).toEqual([{ tipo: 'service-preventivo', estado: 'vencido' }]);
  });

  it('un vehículo en alerta intermedia de service aparece diferenciado del vencido', () => {
    const vehiculos = [vehiculo({ id: 'v1', kilometraje: 6_000, kilometrajeUltimoService: 0, fechaUltimoService: '2026-07-01' })];
    const resultado = alertasMantenimiento({ vehiculos, ahora: AHORA });
    expect(resultado[0]?.motivos).toEqual([{ tipo: 'service-preventivo', estado: 'alerta-intermedia' }]);
  });

  it('evalúa VTV y RTO de forma independiente e indica cuál está vencida o por vencer', () => {
    const vehiculos = [
      vehiculo({
        id: 'v1',
        habilitaciones: [
          { tipo: 'vtv', fechaEmision: '2025-01-01', fechaVencimiento: '2026-01-01' },
          { tipo: 'rto', fechaEmision: '2026-01-01', fechaVencimiento: '2026-08-01' },
        ],
      }),
    ];
    const resultado = alertasMantenimiento({ vehiculos, ahora: AHORA });
    expect(resultado[0]?.motivos).toEqual(
      expect.arrayContaining([
        { tipo: 'habilitacion', habilitacion: 'vtv', estado: 'vencida' },
        { tipo: 'habilitacion', habilitacion: 'rto', estado: 'por-vencer' },
      ]),
    );
    expect(resultado[0]?.motivos).toHaveLength(2);
  });

  it('un vehículo con service vencido y una habilitación por vencer aparece una sola vez, con ambos motivos', () => {
    const vehiculos = [
      vehiculo({
        id: 'v1',
        kilometraje: 25_000,
        kilometrajeUltimoService: 0,
        fechaUltimoService: '2020-01-01',
        habilitaciones: [{ tipo: 'vtv', fechaEmision: '2026-01-01', fechaVencimiento: '2026-08-01' }],
      }),
    ];
    const resultado = alertasMantenimiento({ vehiculos, ahora: AHORA });
    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.motivos).toHaveLength(2);
  });

  it('un vehículo con el service al día y todas sus habilitaciones vigentes no aparece', () => {
    const vehiculos = [
      vehiculo({
        id: 'v1',
        kilometraje: 9_500,
        kilometrajeUltimoService: 9_000,
        fechaUltimoService: '2026-07-01',
        habilitaciones: [{ tipo: 'vtv', fechaEmision: '2026-01-01', fechaVencimiento: '2027-06-01' }],
      }),
    ];
    expect(alertasMantenimiento({ vehiculos, ahora: AHORA })).toEqual([]);
  });
});
