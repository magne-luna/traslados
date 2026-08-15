import { describe, expect, it } from 'vitest';
import { estadoVencimientoFactura } from './estadoVencimientoFactura';

// RF-406 (cambio confirmado con la usuaria 2026-08-12): "vencida" se compara contra la
// `fechaEstimadaCobro` puntual de la factura (ya calculada con precedencia amparo > obra social >
// default en `calcularFechaEstimadaCobro.ts`), nunca contra un plazo fijo de días desde
// `fechaFactura` — dos facturas con la misma `fechaFactura` pero plazos distintos (amparo vs. sin
// amparo) deben poder tener vencimientos muy distintos.

describe('estadoVencimientoFactura', () => {
  it('sin amparo (plazo 90 días): antes de la fecha estimada de cobro no está vencida', () => {
    const vencida = estadoVencimientoFactura({
      fechaEstimadaCobro: '2026-04-01',
      hoy: '2026-03-31',
      estado: 'facturado',
    });
    expect(vencida).toBe(false);
  });

  it('sin amparo (plazo 90 días): el mismo día de la fecha estimada de cobro no está vencida', () => {
    const vencida = estadoVencimientoFactura({
      fechaEstimadaCobro: '2026-04-01',
      hoy: '2026-04-01',
      estado: 'facturado',
    });
    expect(vencida).toBe(false);
  });

  it('sin amparo (plazo 90 días): después de la fecha estimada de cobro está vencida', () => {
    const vencida = estadoVencimientoFactura({
      fechaEstimadaCobro: '2026-04-01',
      hoy: '2026-04-02',
      estado: 'facturado',
    });
    expect(vencida).toBe(true);
  });

  it('corrección central: con amparo (45 días) vencida mucho antes que sin amparo (90 días) con la misma fechaFactura', () => {
    // Misma fechaFactura (2026-01-01) para ambas, pero fechaEstimadaCobro ya calculada distinta
    // según precedencia amparo > default (calcularFechaEstimadaCobro.ts, no reimplementado acá).
    const hoy = '2026-02-20'; // 50 días después de la fechaFactura

    const conAmparo = estadoVencimientoFactura({
      fechaEstimadaCobro: '2026-02-15', // fechaFactura + 45 días
      hoy,
      estado: 'facturado',
    });
    const sinAmparo = estadoVencimientoFactura({
      fechaEstimadaCobro: '2026-04-01', // fechaFactura + 90 días
      hoy,
      estado: 'facturado',
    });

    expect(conAmparo).toBe(true);
    expect(sinAmparo).toBe(false);
  });

  it('una factura "pagado-parcialmente" que superó su fecha estimada de cobro también está vencida', () => {
    const vencida = estadoVencimientoFactura({
      fechaEstimadaCobro: '2026-01-01',
      hoy: '2026-01-02',
      estado: 'pagado-parcialmente',
    });
    expect(vencida).toBe(true);
  });

  it('una factura "cobrado" nunca está vencida, aunque ya haya pasado la fecha estimada de cobro', () => {
    const vencida = estadoVencimientoFactura({
      fechaEstimadaCobro: '2026-01-01',
      hoy: '2027-01-01',
      estado: 'cobrado',
    });
    expect(vencida).toBe(false);
  });

  it('sin fechaEstimadaCobro (ej. todavía "a-facturar" o legacy) nunca está vencida', () => {
    const vencida = estadoVencimientoFactura({
      fechaEstimadaCobro: undefined,
      hoy: '2099-01-01',
      estado: 'facturado',
    });
    expect(vencida).toBe(false);
  });

  it('sin fechaEstimadaCobro y estado "a-facturar" tampoco está vencida', () => {
    const vencida = estadoVencimientoFactura({
      fechaEstimadaCobro: undefined,
      hoy: '2099-01-01',
      estado: 'a-facturar',
    });
    expect(vencida).toBe(false);
  });
});
