import { describe, expect, it } from 'vitest';
import { subtiposDe, TIPOS_INTERVENCION_ALTA } from './mantenimientoCategoriaOptions';

// RED→GREEN (tasks.md 3.1/3.2): `subtiposDe` es la función pura que alimenta el selector en
// cascada nivel 1 → nivel 2 (design.md Decisión 7). Spec `vehiculo-mantenimiento-historial`,
// escenarios "Sub-tipos ofrecidos para una intervención preventiva/correctiva" y "Los sub-tipos
// de un nivel 1 no se ofrecen en el otro".
describe('subtiposDe', () => {
  it('devuelve exactamente los 3 sub-tipos preventivos', () => {
    expect(subtiposDe('preventivo')).toEqual(['cambio-aceite-filtros', 'vtv', 'rto']);
  });

  it('devuelve los 5 sub-tipos correctivos conocidos + "otro" al final', () => {
    expect(subtiposDe('correctivo')).toEqual(['alternador', 'bateria', 'frenos', 'embrague', 'cubiertas', 'otro']);
  });

  it('devuelve una lista vacía para "gasto" (sin nivel 2)', () => {
    expect(subtiposDe('gasto')).toEqual([]);
  });

  it('los sub-tipos de un nivel 1 no se ofrecen en el otro (triangulación)', () => {
    const preventivos = subtiposDe('preventivo');
    const correctivos = subtiposDe('correctivo');

    expect(preventivos.some((subtipo) => (correctivos as readonly string[]).includes(subtipo))).toBe(false);
  });
});

describe('TIPOS_INTERVENCION_ALTA', () => {
  it('solo ofrece preventivo y correctivo, nunca gasto (design.md Decisión 2)', () => {
    expect(TIPOS_INTERVENCION_ALTA).toEqual(['preventivo', 'correctivo']);
  });
});
