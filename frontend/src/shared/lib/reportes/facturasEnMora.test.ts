import { describe, expect, it } from 'vitest';
import type { Cobro, Factura } from '../../types/factura';
import { facturasEnMora } from './facturasEnMora';

// tasks.md 4.3/4.4, design.md Decisión 5, spec dashboard-tarjetas-alertas: la mora se deriva
// invocando estadoVencimientoFactura + saldoFactura de shared/lib/facturacion/, nunca
// reimplementando la regla. Desde el cambio confirmado con la usuaria (2026-08-12), "vencida" se
// compara contra `fechaEstimadaCobro`, no contra un plazo fijo desde `fechaFactura`.

function factura(overrides: Partial<Factura> = {}): Factura {
  return {
    id: 'f1',
    pacienteId: 'p1',
    descripcion: '',
    dias: 10,
    valorKm: 100,
    monto: 10_000,
    estado: 'facturado',
    fechaInicial: '2026-01-01',
    fechaTope: '2026-01-31',
    tipoComprobante: 'A',
    cantidadKm: 50,
    prestacion: 'Kinesiología',
    mesFacturado: 1,
    anioFacturado: 2026,
    dependenciaYRetorno: '',
    domicilioId: 'dir-1',
    asistencias: [],
    ...overrides,
  };
}

function cobro(overrides: Partial<Cobro> & Pick<Cobro, 'id' | 'facturaId' | 'montoPagado'>): Cobro {
  return { fecha: '2026-01-15', ...overrides };
}

describe('facturasEnMora', () => {
  it('una factura emitida, vencida (ya pasó fechaEstimadaCobro) y con saldo aparece con su saldo pendiente y días de atraso', () => {
    const hoy = '2026-06-15';
    const facturas = [
      factura({
        id: 'f1',
        pacienteId: 'p1',
        monto: 10_000,
        estado: 'facturado',
        fechaFactura: '2026-01-01',
        fechaEstimadaCobro: '2026-04-01',
      }),
    ];
    const resultado = facturasEnMora({ facturas, cobros: [], hoy });

    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({ facturaId: 'f1', pacienteId: 'p1', saldoPendiente: 10_000 });
    expect(resultado[0]?.diasDeAtraso).toBeGreaterThan(0);
  });

  it('una factura vencida pero ya saldada (estado cobrado) no aparece en la mora', () => {
    const hoy = '2026-06-15';
    const facturas = [
      factura({
        id: 'f1',
        monto: 10_000,
        estado: 'cobrado',
        fechaFactura: '2026-01-01',
        fechaEstimadaCobro: '2026-04-01',
      }),
    ];
    const cobros = [cobro({ id: 'c1', facturaId: 'f1', montoPagado: 10_000 })];
    expect(facturasEnMora({ facturas, cobros, hoy })).toEqual([]);
  });

  it('una factura vencida con cobro parcial informa el saldo pendiente, no el monto total', () => {
    const hoy = '2026-06-15';
    const facturas = [
      factura({
        id: 'f1',
        monto: 10_000,
        estado: 'pagado-parcialmente',
        fechaFactura: '2026-01-01',
        fechaEstimadaCobro: '2026-04-01',
      }),
    ];
    const cobros = [cobro({ id: 'c1', facturaId: 'f1', montoPagado: 4_000 })];
    const resultado = facturasEnMora({ facturas, cobros, hoy });
    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.saldoPendiente).toBe(6_000);
  });

  it('una factura en a-facturar (sin fechaFactura ni fechaEstimadaCobro) no aparece y no rompe el cálculo', () => {
    const facturas = [factura({ id: 'f1', estado: 'a-facturar', fechaFactura: undefined, fechaEstimadaCobro: undefined })];
    expect(() => facturasEnMora({ facturas, cobros: [], hoy: '2026-06-15' })).not.toThrow();
    expect(facturasEnMora({ facturas, cobros: [], hoy: '2026-06-15' })).toEqual([]);
  });

  it('respeta el borde exacto de fechaEstimadaCobro: el mismo día no está vencida, un día después sí', () => {
    const hoy = '2026-06-15';

    const facturaMismoDia = factura({
      id: 'mismo-dia',
      estado: 'facturado',
      fechaFactura: '2026-01-01',
      fechaEstimadaCobro: '2026-06-15',
    });
    const facturaUnDiaDespues = factura({
      id: 'un-dia-despues',
      estado: 'facturado',
      fechaFactura: '2026-01-01',
      fechaEstimadaCobro: '2026-06-14',
    });

    const resultado = facturasEnMora({ facturas: [facturaMismoDia, facturaUnDiaDespues], cobros: [], hoy });
    expect(resultado.map((r) => r.facturaId)).toEqual(['un-dia-despues']);
  });

  it('corrección central: con amparo (fechaEstimadaCobro más cercana) vencida antes que sin amparo con la misma fechaFactura', () => {
    const hoy = '2026-02-20';
    const conAmparo = factura({
      id: 'con-amparo',
      estado: 'facturado',
      fechaFactura: '2026-01-01',
      fechaEstimadaCobro: '2026-02-15', // fechaFactura + 45 días
    });
    const sinAmparo = factura({
      id: 'sin-amparo',
      estado: 'facturado',
      fechaFactura: '2026-01-01',
      fechaEstimadaCobro: '2026-04-01', // fechaFactura + 90 días
    });

    const resultado = facturasEnMora({ facturas: [conAmparo, sinAmparo], cobros: [], hoy });
    expect(resultado.map((r) => r.facturaId)).toEqual(['con-amparo']);
  });
});
