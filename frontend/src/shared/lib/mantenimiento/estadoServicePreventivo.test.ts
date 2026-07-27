import { describe, expect, it } from 'vitest';
import { estadoServicePreventivo } from './estadoServicePreventivo';

// RN-VE-03: cambio de aceite cada 10.000 km o ~3 meses desde el último service, lo que ocurra
// primero, con alerta intermedia a los 5.000 km. Función pura parametrizada por "ahora" (design.md
// Risks/Trade-offs: evitar `new Date()` real en tests no deterministas).

describe('estadoServicePreventivo', () => {
  it('devuelve "ok" cuando hay menos de 5.000 km y menos de 3 meses desde el último service', () => {
    const estado = estadoServicePreventivo({
      kilometraje: 12_000,
      kilometrajeUltimoService: 10_000,
      fechaUltimoService: '2026-06-01',
      ahora: new Date('2026-07-01'),
    });

    expect(estado).toBe('ok');
  });

  it('devuelve "alerta-intermedia" a partir de los 5.000 km desde el último service', () => {
    const estado = estadoServicePreventivo({
      kilometraje: 15_000,
      kilometrajeUltimoService: 10_000,
      fechaUltimoService: '2026-07-01',
      ahora: new Date('2026-07-10'),
    });

    expect(estado).toBe('alerta-intermedia');
  });

  it('devuelve "vencido" cuando el kilometraje desde el último service llega a 10.000', () => {
    const estado = estadoServicePreventivo({
      kilometraje: 20_000,
      kilometrajeUltimoService: 10_000,
      fechaUltimoService: '2026-07-01',
      ahora: new Date('2026-07-10'),
    });

    expect(estado).toBe('vencido');
  });

  it('devuelve "vencido" por antigüedad aunque el kilometraje no haya llegado a 10.000 (lo que ocurra primero)', () => {
    const estado = estadoServicePreventivo({
      kilometraje: 10_500,
      kilometrajeUltimoService: 10_000,
      fechaUltimoService: '2026-01-01',
      ahora: new Date('2026-07-24'),
    });

    expect(estado).toBe('vencido');
  });

  it('el límite exacto de 5.000 km cuenta como alerta-intermedia (borde inclusivo)', () => {
    const estado = estadoServicePreventivo({
      kilometraje: 15_000,
      kilometrajeUltimoService: 10_000,
      fechaUltimoService: '2026-07-01',
      ahora: new Date('2026-07-02'),
    });

    expect(estado).toBe('alerta-intermedia');
  });
});
