import { describe, expect, it } from 'vitest';
import { calcularFechaEstimadaCobro } from './calcularFechaEstimadaCobro';
import { PLAZO_COBRO_AMPARO_DIAS, PLAZO_COBRO_DEFAULT_DIAS } from './constantes';

describe('calcularFechaEstimadaCobro', () => {
  it('con amparo judicial usa el plazo de amparo, aunque la obra social tenga uno propio (gana sobre todo)', () => {
    const resultado = calcularFechaEstimadaCobro({
      fechaFactura: '2026-01-01',
      amparoJudicial: true,
      plazoObraSocial: 30,
    });

    expect(resultado).toBe(addDiasIso('2026-01-01', PLAZO_COBRO_AMPARO_DIAS));
  });

  it('sin amparo, usa el plazo propio de la obra social si está definido', () => {
    const resultado = calcularFechaEstimadaCobro({
      fechaFactura: '2026-01-01',
      amparoJudicial: false,
      plazoObraSocial: 30,
    });

    expect(resultado).toBe(addDiasIso('2026-01-01', 30));
  });

  it('sin amparo y sin plazo de obra social, usa el default', () => {
    const resultado = calcularFechaEstimadaCobro({
      fechaFactura: '2026-01-01',
      amparoJudicial: false,
      plazoObraSocial: undefined,
    });

    expect(resultado).toBe(addDiasIso('2026-01-01', PLAZO_COBRO_DEFAULT_DIAS));
  });

  it('cuenta los días desde la fecha de factura (día cero = fecha de factura)', () => {
    const fechaFactura = '2026-03-10';
    const resultado = calcularFechaEstimadaCobro({ fechaFactura, amparoJudicial: false, plazoObraSocial: 5 });

    const dias = (new Date(resultado).getTime() - new Date(fechaFactura).getTime()) / (24 * 60 * 60 * 1000);
    expect(dias).toBe(5);
  });
});

function addDiasIso(fechaIso: string, dias: number): string {
  const fecha = new Date(`${fechaIso}T00:00:00.000Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}
