import { describe, expect, it } from 'vitest';
import type { Cobro, Factura } from '../../types/factura';
import { PLAZO_ALERTA_VENCIDA_DIAS } from '../facturacion/constantes';
import { facturasEnMora } from './facturasEnMora';

// tasks.md 4.3/4.4, design.md Decisión 5, spec dashboard-tarjetas-alertas: la mora se deriva
// invocando estadoVencimientoFactura + saldoFactura de shared/lib/facturacion/, nunca
// reimplementando la regla ni su umbral.

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

function fechaMenosDias(hoy: string, dias: number): string {
  const fecha = new Date(`${hoy}T00:00:00.000Z`);
  fecha.setUTCDate(fecha.getUTCDate() - dias);
  return fecha.toISOString().slice(0, 10);
}

describe('facturasEnMora', () => {
  it('una factura emitida, vencida y con saldo aparece con su saldo pendiente y días de atraso', () => {
    const hoy = '2026-06-15';
    const fechaFactura = fechaMenosDias(hoy, PLAZO_ALERTA_VENCIDA_DIAS + 5);
    const facturas = [factura({ id: 'f1', pacienteId: 'p1', monto: 10_000, estado: 'facturado', fechaFactura })];
    const resultado = facturasEnMora({ facturas, cobros: [], hoy });

    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({ facturaId: 'f1', pacienteId: 'p1', saldoPendiente: 10_000 });
    expect(resultado[0]?.diasDeAtraso).toBeGreaterThanOrEqual(PLAZO_ALERTA_VENCIDA_DIAS + 5 - 1);
  });

  it('una factura vencida pero ya saldada (estado cobrado) no aparece en la mora', () => {
    const hoy = '2026-06-15';
    const fechaFactura = fechaMenosDias(hoy, PLAZO_ALERTA_VENCIDA_DIAS + 5);
    const facturas = [factura({ id: 'f1', monto: 10_000, estado: 'cobrado', fechaFactura })];
    const cobros = [cobro({ id: 'c1', facturaId: 'f1', montoPagado: 10_000 })];
    expect(facturasEnMora({ facturas, cobros, hoy })).toEqual([]);
  });

  it('una factura vencida con cobro parcial informa el saldo pendiente, no el monto total', () => {
    const hoy = '2026-06-15';
    const fechaFactura = fechaMenosDias(hoy, PLAZO_ALERTA_VENCIDA_DIAS + 5);
    const facturas = [factura({ id: 'f1', monto: 10_000, estado: 'pagado-parcialmente', fechaFactura })];
    const cobros = [cobro({ id: 'c1', facturaId: 'f1', montoPagado: 4_000 })];
    const resultado = facturasEnMora({ facturas, cobros, hoy });
    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.saldoPendiente).toBe(6_000);
  });

  it('una factura en a-facturar (sin fechaFactura) no aparece y no rompe el cálculo', () => {
    const facturas = [factura({ id: 'f1', estado: 'a-facturar', fechaFactura: undefined })];
    expect(() => facturasEnMora({ facturas, cobros: [], hoy: '2026-06-15' })).not.toThrow();
    expect(facturasEnMora({ facturas, cobros: [], hoy: '2026-06-15' })).toEqual([]);
  });

  it('respeta el borde exacto de PLAZO_ALERTA_VENCIDA_DIAS heredado del módulo de facturación', () => {
    const hoy = '2026-06-15';
    const justoAntes = fechaMenosDias(hoy, PLAZO_ALERTA_VENCIDA_DIAS - 1);
    const justoEnElUmbral = fechaMenosDias(hoy, PLAZO_ALERTA_VENCIDA_DIAS);

    const facturaAntes = factura({ id: 'antes', estado: 'facturado', fechaFactura: justoAntes });
    const facturaUmbral = factura({ id: 'umbral', estado: 'facturado', fechaFactura: justoEnElUmbral });

    const resultado = facturasEnMora({ facturas: [facturaAntes, facturaUmbral], cobros: [], hoy });
    expect(resultado.map((r) => r.facturaId)).toEqual(['umbral']);
  });
});
