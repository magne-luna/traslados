import { describe, expect, it } from 'vitest';
import { diasFacturables } from './diasFacturables';

// Agosto 2026: 1 y 8 y 15 y 22 y 29 son sábados; 2, 9, 16, 23, 30 son domingos; 17 es lunes.
const MES = 8;
const ANIO = 2026;

describe('diasFacturables', () => {
  it('excluye los feriados del catálogo recibido (día de semana)', () => {
    const dias = diasFacturables({ mes: MES, anio: ANIO, feriados: ['2026-08-17'], facturaSabados: false });
    expect(dias).not.toContain('2026-08-17');
    // El resto de los lunes de semana sí quedan.
    expect(dias).toContain('2026-08-03');
  });

  it('excluye siempre los domingos', () => {
    const dias = diasFacturables({ mes: MES, anio: ANIO, feriados: [], facturaSabados: true });
    expect(dias).not.toContain('2026-08-02');
    expect(dias).not.toContain('2026-08-09');
  });

  it('incluye los sábados solo si facturaSabados es true', () => {
    const conSabados = diasFacturables({ mes: MES, anio: ANIO, feriados: [], facturaSabados: true });
    const sinSabados = diasFacturables({ mes: MES, anio: ANIO, feriados: [], facturaSabados: false });

    expect(conSabados).toContain('2026-08-01');
    expect(sinSabados).not.toContain('2026-08-01');
  });

  it('un sábado feriado queda excluido aunque facturaSabados sea true (gana la exclusión)', () => {
    const dias = diasFacturables({ mes: MES, anio: ANIO, feriados: ['2026-08-08'], facturaSabados: true });
    expect(dias).not.toContain('2026-08-08');
    // Otro sábado del mismo mes, no feriado, sigue incluido.
    expect(dias).toContain('2026-08-01');
  });

  it('con catálogo de feriados vacío, solo excluye domingos (y sábados si no se facturan)', () => {
    const dias = diasFacturables({ mes: MES, anio: ANIO, feriados: [], facturaSabados: false });
    expect(dias).toContain('2026-08-03');
    expect(dias).not.toContain('2026-08-02');
    expect(dias).not.toContain('2026-08-01');
  });

  it('devuelve fechas ISO ordenadas del mes/año pedido, sin fechas de otro mes', () => {
    const dias = diasFacturables({ mes: MES, anio: ANIO, feriados: [], facturaSabados: true });
    expect(dias.every((fecha) => fecha.startsWith('2026-08-'))).toBe(true);
    expect(dias).toEqual([...dias].sort());
  });
});
