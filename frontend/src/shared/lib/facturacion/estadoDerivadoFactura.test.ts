import { describe, expect, it } from 'vitest';
import type { Cobro, Factura } from '../../types/factura';
import { estadoDerivadoFactura } from './estadoDerivadoFactura';

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

function cobro(overrides: Partial<Cobro> & Pick<Cobro, 'id' | 'montoPagado'>): Cobro {
  return { facturaId: 'f1', fecha: '2026-08-15', ...overrides };
}

describe('estadoDerivadoFactura', () => {
  it('sin cobros registrados, el estado derivado es "facturado"', () => {
    expect(estadoDerivadoFactura(factura(), [])).toBe('facturado');
  });

  it('un primer cobro parcial deriva "pagado-parcialmente"', () => {
    const cobros = [cobro({ id: 'c1', montoPagado: 1000 })];
    expect(estadoDerivadoFactura(factura({ monto: 5000 }), cobros)).toBe('pagado-parcialmente');
  });

  it('cobros que saldan exactamente el monto derivan "cobrado"', () => {
    const cobros = [cobro({ id: 'c1', montoPagado: 3000 }), cobro({ id: 'c2', montoPagado: 2000 })];
    expect(estadoDerivadoFactura(factura({ monto: 5000 }), cobros)).toBe('cobrado');
  });

  it('la baja de un cobro que saldaba la factura reabre el saldo y vuelve a "pagado-parcialmente"', () => {
    const cobrosCompletos = [cobro({ id: 'c1', montoPagado: 3000 }), cobro({ id: 'c2', montoPagado: 2000 })];
    const f = factura({ monto: 5000 });
    expect(estadoDerivadoFactura(f, cobrosCompletos)).toBe('cobrado');

    const cobrosTrasBaja = cobrosCompletos.filter((c) => c.id !== 'c2');
    expect(estadoDerivadoFactura(f, cobrosTrasBaja)).toBe('pagado-parcialmente');
  });
});
