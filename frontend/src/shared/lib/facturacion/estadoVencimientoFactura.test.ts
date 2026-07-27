import { describe, expect, it } from 'vitest';
import { estadoVencimientoFactura } from './estadoVencimientoFactura';
import { PLAZO_ALERTA_VENCIDA_DIAS } from './constantes';

describe('estadoVencimientoFactura', () => {
  it('una factura "facturado" que superó el plazo de alerta está vencida', () => {
    const vencida = estadoVencimientoFactura({
      fechaFactura: '2026-01-01',
      hoy: sumarDias('2026-01-01', PLAZO_ALERTA_VENCIDA_DIAS + 1),
      estado: 'facturado',
    });
    expect(vencida).toBe(true);
  });

  it('una factura "pagado-parcialmente" que superó el plazo también está vencida', () => {
    const vencida = estadoVencimientoFactura({
      fechaFactura: '2026-01-01',
      hoy: sumarDias('2026-01-01', PLAZO_ALERTA_VENCIDA_DIAS + 1),
      estado: 'pagado-parcialmente',
    });
    expect(vencida).toBe(true);
  });

  it('una factura "cobrado" nunca está vencida, sin importar el tiempo transcurrido', () => {
    const vencida = estadoVencimientoFactura({
      fechaFactura: '2026-01-01',
      hoy: sumarDias('2026-01-01', PLAZO_ALERTA_VENCIDA_DIAS + 365),
      estado: 'cobrado',
    });
    expect(vencida).toBe(false);
  });

  it('dentro del plazo (sin llegar al umbral) no está vencida', () => {
    const vencida = estadoVencimientoFactura({
      fechaFactura: '2026-01-01',
      hoy: sumarDias('2026-01-01', PLAZO_ALERTA_VENCIDA_DIAS - 1),
      estado: 'facturado',
    });
    expect(vencida).toBe(false);
  });
});

function sumarDias(fechaIso: string, dias: number): string {
  const fecha = new Date(`${fechaIso}T00:00:00.000Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}
