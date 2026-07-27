import { describe, expect, it } from 'vitest';
import type { Cobro, Factura } from '../../types/factura';
import { aniosConDatos, resumenAnual } from './resumenAnual';

// tasks.md 3.7-3.9, design.md Decisiones 2 y 3: resumen del año calendario con las mismas
// reglas de atribución que facturadoVsCobrado, más aniosConDatos para el selector de año.

function factura(overrides: Partial<Factura> = {}): Factura {
  return {
    id: 'f1',
    pacienteId: 'p1',
    descripcion: '',
    dias: 10,
    valorKm: 100,
    monto: 100_000,
    estado: 'facturado',
    fechaInicial: '2026-03-01',
    fechaTope: '2026-03-31',
    tipoComprobante: 'A',
    cantidadKm: 50,
    prestacion: 'Kinesiología',
    mesFacturado: 3,
    anioFacturado: 2026,
    dependenciaYRetorno: '',
    domicilioId: 'dir-1',
    asistencias: [],
    ...overrides,
  };
}

function cobro(overrides: Partial<Cobro> & Pick<Cobro, 'id' | 'facturaId' | 'montoPagado'>): Cobro {
  return { fecha: '2026-03-15', ...overrides };
}

describe('resumenAnual', () => {
  it('calcula los totales del año aplicando las mismas reglas de atribución que la serie por período', () => {
    const facturas = [factura({ id: 'f1', monto: 100_000, mesFacturado: 3, anioFacturado: 2026 })];
    const cobros = [cobro({ id: 'c1', facturaId: 'f1', montoPagado: 40_000, fecha: '2026-04-10' })];
    const resumen = resumenAnual({ facturas, cobros, anio: 2026 });
    expect(resumen.totalFacturado).toBe(100_000);
    expect(resumen.totalCobrado).toBe(40_000);
    expect(resumen.totalDiferencia).toBe(60_000);
  });

  it('informa cuántas facturas del año fueron emitidas y cuántas quedaron saldadas', () => {
    const facturas = [
      factura({ id: 'f1', estado: 'facturado', anioFacturado: 2026 }),
      factura({ id: 'f2', estado: 'cobrado', anioFacturado: 2026 }),
      factura({ id: 'f3', estado: 'pagado-parcialmente', anioFacturado: 2026 }),
      factura({ id: 'f4', estado: 'a-facturar', anioFacturado: 2026 }),
    ];
    const resumen = resumenAnual({ facturas, cobros: [], anio: 2026 });
    expect(resumen.facturasEmitidas).toBe(3);
    expect(resumen.facturasSaldadas).toBe(1);
  });

  it('un año sin ninguna factura ni cobro devuelve todo en cero, sin lanzar error', () => {
    const resumen = resumenAnual({ facturas: [], cobros: [], anio: 2030 });
    expect(resumen.totalFacturado).toBe(0);
    expect(resumen.totalCobrado).toBe(0);
    expect(resumen.totalDiferencia).toBe(0);
    expect(resumen.facturasEmitidas).toBe(0);
    expect(resumen.facturasSaldadas).toBe(0);
    expect(resumen.meses).toHaveLength(12);
    expect(resumen.meses.every((m) => m.facturado === 0 && m.cobrado === 0)).toBe(true);
  });

  it('una factura de diciembre cobrada en enero del año siguiente suma facturado en el primer año y cobrado en el segundo', () => {
    const facturas = [factura({ id: 'f1', monto: 50_000, mesFacturado: 12, anioFacturado: 2025 })];
    const cobros = [cobro({ id: 'c1', facturaId: 'f1', montoPagado: 50_000, fecha: '2026-01-10' })];

    const resumen2025 = resumenAnual({ facturas, cobros, anio: 2025 });
    expect(resumen2025.totalFacturado).toBe(50_000);
    expect(resumen2025.totalCobrado).toBe(0);

    const resumen2026 = resumenAnual({ facturas, cobros, anio: 2026 });
    expect(resumen2026.totalFacturado).toBe(0);
    expect(resumen2026.totalCobrado).toBe(50_000);
  });

  it('el desglose siempre tiene doce entradas, de enero a diciembre', () => {
    const resumen = resumenAnual({ facturas: [], cobros: [], anio: 2026 });
    expect(resumen.meses.map((m) => m.mes)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('la suma de los doce meses del desglose coincide con los totales anuales', () => {
    const facturas = [
      factura({ id: 'f1', monto: 20_000, mesFacturado: 2, anioFacturado: 2026 }),
      factura({ id: 'f2', monto: 30_000, mesFacturado: 9, anioFacturado: 2026 }),
    ];
    const cobros = [cobro({ id: 'c1', facturaId: 'f1', montoPagado: 15_000, fecha: '2026-03-01' })];
    const resumen = resumenAnual({ facturas, cobros, anio: 2026 });

    const sumaFacturado = resumen.meses.reduce((acc, m) => acc + m.facturado, 0);
    const sumaCobrado = resumen.meses.reduce((acc, m) => acc + m.cobrado, 0);
    expect(resumen.totalFacturado).toBe(sumaFacturado);
    expect(resumen.totalCobrado).toBe(sumaCobrado);
  });
});

describe('aniosConDatos', () => {
  it('ofrece los años presentes en facturas y cobros más el año de la fecha de referencia', () => {
    const facturas = [factura({ id: 'f1', anioFacturado: 2025 })];
    const cobros = [cobro({ id: 'c1', facturaId: 'f1', montoPagado: 1000, fecha: '2026-02-01' })];
    const anios = aniosConDatos({ facturas, cobros, hoy: '2026-06-01' });
    expect(anios).toEqual([2025, 2026]);
  });

  it('sin datos cargados, devuelve solo el año de la fecha de referencia', () => {
    const anios = aniosConDatos({ facturas: [], cobros: [], hoy: '2026-06-01' });
    expect(anios).toEqual([2026]);
  });

  it('el orden es estable, ascendente y sin duplicados', () => {
    const facturas = [
      factura({ id: 'f1', anioFacturado: 2026 }),
      factura({ id: 'f2', anioFacturado: 2024 }),
      factura({ id: 'f3', anioFacturado: 2026 }),
    ];
    const anios = aniosConDatos({ facturas, cobros: [], hoy: '2025-06-01' });
    expect(anios).toEqual([2024, 2025, 2026]);
  });
});
