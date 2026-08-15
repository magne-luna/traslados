import { describe, expect, it } from 'vitest';
import type { Cobro, Factura } from '../../types/factura';
import { calcularTotalFactura, saldoFactura } from './totalesFactura';

function factura(overrides: Partial<Factura> = {}): Factura {
  return {
    id: 'f1',
    pacienteId: 'p1',
    descripcion: '',
    dias: 10,
    valorKm: 100,
    monto: 5000,
    estado: 'facturado',
    fechaInicial: '2026-08-01',
    fechaTope: '2026-08-31',
    tipoComprobante: 'A',
    cantidadKm: 50,
    prestacion: 'Kinesiología',
    mesFacturado: 8,
    anioFacturado: 2026,
    dependenciaYRetorno: '',
    domicilioId: 'dir-1',
    asistencias: [],
    ...overrides,
  };
}

function cobro(overrides: Partial<Cobro> & Pick<Cobro, 'id' | 'facturaId' | 'montoPagado'>): Cobro {
  return { fecha: '2026-08-15', ...overrides };
}

describe('calcularTotalFactura', () => {
  it('devuelve el producto de dias por cantidadKm por valorKm', () => {
    expect(calcularTotalFactura({ valorKm: 350, cantidadKm: 12, dias: 20 })).toBe(84000);
  });

  it('devuelve otro total distinto para otra combinación de valores (TRIANGULATE)', () => {
    expect(calcularTotalFactura({ valorKm: 100, cantidadKm: 5, dias: 3 })).toBe(1500);
  });

  it('devuelve 0 cuando la cantidad de km es 0', () => {
    expect(calcularTotalFactura({ valorKm: 350, cantidadKm: 0, dias: 20 })).toBe(0);
  });

  it('devuelve 0 cuando los días son 0, sin dividir por cero ni romper', () => {
    expect(calcularTotalFactura({ valorKm: 350, cantidadKm: 12, dias: 0 })).toBe(0);
  });
});

describe('saldoFactura', () => {
  it('descuenta los cobros parciales del monto de la factura', () => {
    const f = factura({ monto: 5000 });
    const cobros = [cobro({ id: 'c1', facturaId: 'f1', montoPagado: 2000 })];
    expect(saldoFactura(f, cobros)).toBe(3000);
  });

  it('el saldo es cero cuando los cobros saldan exactamente el monto', () => {
    const f = factura({ monto: 5000 });
    const cobros = [
      cobro({ id: 'c1', facturaId: 'f1', montoPagado: 3000 }),
      cobro({ id: 'c2', facturaId: 'f1', montoPagado: 2000 }),
    ];
    expect(saldoFactura(f, cobros)).toBe(0);
  });

  it('sin cobros, el saldo es el monto total de la factura', () => {
    const f = factura({ monto: 5000 });
    expect(saldoFactura(f, [])).toBe(5000);
  });

  it('no cuenta cobros de otras facturas', () => {
    const f = factura({ id: 'f1', monto: 5000 });
    const cobros = [cobro({ id: 'c1', facturaId: 'f2', montoPagado: 1000 })];
    expect(saldoFactura(f, cobros)).toBe(5000);
  });
});
