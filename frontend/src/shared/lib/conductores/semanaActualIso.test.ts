import { describe, expect, it } from 'vitest';
import { semanaActualIso } from './semanaActualIso';

// Función pura (tasks.md 2.1, design.md Decisión 4): deriva la etiqueta ISO-8601 de semana
// ('YYYY-Www', lunes como inicio de semana) a partir de una fecha de referencia recibida como
// parámetro — nunca un `new Date()` incrustado, para que el test sea determinista (design.md
// Risks/Trade-offs).

describe('semanaActualIso', () => {
  it('deriva la semana ISO de una fecha de referencia mid-week (viernes)', () => {
    expect(semanaActualIso(new Date(2026, 6, 24))).toBe('2026-W30');
  });

  it('el lunes y el domingo de la misma semana calendario devuelven la misma etiqueta (triangulación)', () => {
    expect(semanaActualIso(new Date(2026, 6, 20))).toBe('2026-W30'); // lunes
    expect(semanaActualIso(new Date(2026, 6, 26))).toBe('2026-W30'); // domingo
  });

  it('un 1° de enero que cae entre semana puede pertenecer a la última semana ISO del año anterior (borde)', () => {
    expect(semanaActualIso(new Date(2027, 0, 1))).toBe('2026-W53');
  });

  it('un lunes de fin de diciembre puede pertenecer a la semana 1 del año siguiente (borde)', () => {
    expect(semanaActualIso(new Date(2025, 11, 29))).toBe('2026-W01');
  });
});
