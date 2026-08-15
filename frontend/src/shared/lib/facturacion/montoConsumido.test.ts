import { describe, expect, it } from 'vitest';
import type { Factura } from '../../types/factura';
import { montoConsumido } from './montoConsumido';

function factura(overrides: Partial<Factura> & Pick<Factura, 'id' | 'pacienteId' | 'estado'>): Factura {
  return {
    descripcion: '',
    dias: 10,
    valorKm: 100,
    monto: 1000,
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

describe('montoConsumido', () => {
  it('las facturas en estado a-facturar no cuentan para el monto consumido', () => {
    const facturas: Factura[] = [
      factura({ id: 'f1', pacienteId: 'p1', estado: 'a-facturar', autorizacionId: 'auth-1', monto: 5000 }),
    ];

    expect(montoConsumido(facturas, 'auth-1', 2026)).toBe(0);
  });

  it('suma facturado, cobrado y pagado-parcialmente de la misma autorización y año', () => {
    const facturas: Factura[] = [
      factura({ id: 'f1', pacienteId: 'p1', estado: 'facturado', autorizacionId: 'auth-1', monto: 1000 }),
      factura({ id: 'f2', pacienteId: 'p1', estado: 'cobrado', autorizacionId: 'auth-1', monto: 2000 }),
      factura({ id: 'f3', pacienteId: 'p1', estado: 'pagado-parcialmente', autorizacionId: 'auth-1', monto: 500 }),
    ];

    expect(montoConsumido(facturas, 'auth-1', 2026)).toBe(3500);
  });

  it('excluye la factura en edición cuando se pasa excluirFacturaId', () => {
    const facturas: Factura[] = [
      factura({ id: 'f1', pacienteId: 'p1', estado: 'facturado', autorizacionId: 'auth-1', monto: 1000 }),
      factura({ id: 'f2', pacienteId: 'p1', estado: 'facturado', autorizacionId: 'auth-1', monto: 2000 }),
    ];

    expect(montoConsumido(facturas, 'auth-1', 2026, { excluirFacturaId: 'f2' })).toBe(1000);
  });

  it('aísla por autorización: no suma facturas de otra autorización', () => {
    const facturas: Factura[] = [
      factura({ id: 'f1', pacienteId: 'p1', estado: 'facturado', autorizacionId: 'auth-1', monto: 1000 }),
      factura({ id: 'f2', pacienteId: 'p1', estado: 'facturado', autorizacionId: 'auth-2', monto: 9999 }),
    ];

    expect(montoConsumido(facturas, 'auth-1', 2026)).toBe(1000);
  });

  it('aísla por año: no suma facturas de la misma autorización en otro año', () => {
    const facturas: Factura[] = [
      factura({ id: 'f1', pacienteId: 'p1', estado: 'facturado', autorizacionId: 'auth-1', monto: 1000, anioFacturado: 2026 }),
      factura({ id: 'f2', pacienteId: 'p1', estado: 'facturado', autorizacionId: 'auth-1', monto: 5000, anioFacturado: 2025 }),
    ];

    expect(montoConsumido(facturas, 'auth-1', 2026)).toBe(1000);
  });

  it('acumula facturas de meses distintos del mismo año (el bug original: NO son independientes por mes)', () => {
    const facturas: Factura[] = [
      factura({ id: 'f-enero', pacienteId: 'p1', estado: 'facturado', autorizacionId: 'auth-1', monto: 1000, mesFacturado: 1, anioFacturado: 2026 }),
      factura({ id: 'f-marzo', pacienteId: 'p1', estado: 'facturado', autorizacionId: 'auth-1', monto: 1500, mesFacturado: 3, anioFacturado: 2026 }),
    ];

    expect(montoConsumido(facturas, 'auth-1', 2026)).toBe(2500);
  });
});
