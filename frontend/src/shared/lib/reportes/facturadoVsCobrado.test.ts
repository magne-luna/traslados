import { describe, expect, it } from 'vitest';
import type { Cobro, Factura } from '../../types/factura';
import { facturadoVsCobrado } from './facturadoVsCobrado';

// tasks.md 3.3-3.6, design.md Decisiones 2 y 3: serie mensual de facturado/cobrado/diferencia
// sobre un rango de meses, con las dos reglas de atribución testeadas por separado
// (facturado por período estructurado de facturas emitidas; cobrado por fecha del cobro).

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

describe('facturadoVsCobrado', () => {
  it('devuelve exactamente 6 puntos ordenados del más antiguo al más reciente para meses=6', () => {
    const serie = facturadoVsCobrado({ facturas: [], cobros: [], hoy: '2026-06-15', meses: 6 });
    expect(serie.puntos).toHaveLength(6);
    expect(serie.puntos[0]).toMatchObject({ mes: 1, anio: 2026 });
    expect(serie.puntos.at(-1)).toMatchObject({ mes: 6, anio: 2026 });
  });

  it('un mes sin ninguna factura ni cobro aparece igual en la serie, en cero', () => {
    const serie = facturadoVsCobrado({ facturas: [], cobros: [], hoy: '2026-06-15', meses: 3 });
    expect(serie.puntos).toEqual([
      { mes: 4, anio: 2026, facturado: 0, cobrado: 0, diferencia: 0 },
      { mes: 5, anio: 2026, facturado: 0, cobrado: 0, diferencia: 0 },
      { mes: 6, anio: 2026, facturado: 0, cobrado: 0, diferencia: 0 },
    ]);
  });

  it('la diferencia es facturado menos cobrado, y puede ser negativa', () => {
    const facturas = [factura({ id: 'f1', monto: 100_000, mesFacturado: 6, anioFacturado: 2026 })];
    const cobros = [cobro({ id: 'c1', facturaId: 'f-vieja', montoPagado: 130_000, fecha: '2026-06-10' })];
    // meses siempre 3 | 6 | 12 (PeriodoMeses, nunca un número libre) — se usa 3 como mínimo
    // válido y se busca el punto de interés en vez de asumir la posición 0.
    const serie = facturadoVsCobrado({ facturas, cobros, hoy: '2026-06-15', meses: 3 });
    expect(serie.puntos.find((p) => p.mes === 6 && p.anio === 2026)).toEqual({
      mes: 6,
      anio: 2026,
      facturado: 100_000,
      cobrado: 130_000,
      diferencia: -30_000,
    });
  });

  it('los totales del rango coinciden con la suma de los puntos de la serie', () => {
    const facturas = [
      factura({ id: 'f1', monto: 50_000, mesFacturado: 4, anioFacturado: 2026 }),
      factura({ id: 'f2', monto: 70_000, mesFacturado: 5, anioFacturado: 2026 }),
    ];
    const cobros = [cobro({ id: 'c1', facturaId: 'f1', montoPagado: 20_000, fecha: '2026-06-01' })];
    const serie = facturadoVsCobrado({ facturas, cobros, hoy: '2026-06-15', meses: 3 });

    const sumaFacturado = serie.puntos.reduce((acc, p) => acc + p.facturado, 0);
    const sumaCobrado = serie.puntos.reduce((acc, p) => acc + p.cobrado, 0);
    expect(serie.totalFacturado).toBe(sumaFacturado);
    expect(serie.totalCobrado).toBe(sumaCobrado);
    expect(serie.totalDiferencia).toBe(sumaFacturado - sumaCobrado);
  });

  it('atribuye el facturado al período estructurado (mesFacturado/anioFacturado), no a fechaFactura', () => {
    const facturas = [
      factura({ id: 'f1', monto: 100_000, mesFacturado: 3, anioFacturado: 2026, fechaFactura: '2026-04-05' }),
    ];
    const serie = facturadoVsCobrado({ facturas, cobros: [], hoy: '2026-04-15', meses: 3 });
    expect(serie.puntos.find((p) => p.mes === 3)?.facturado).toBe(100_000);
    expect(serie.puntos.find((p) => p.mes === 4)?.facturado).toBe(0);
  });

  it('una factura con período fuera del rango no suma en ningún punto ni en los totales', () => {
    const facturas = [factura({ id: 'f1', monto: 100_000, mesFacturado: 1, anioFacturado: 2026 })];
    const serie = facturadoVsCobrado({ facturas, cobros: [], hoy: '2026-06-15', meses: 3 });
    expect(serie.puntos.every((p) => p.facturado === 0)).toBe(true);
    expect(serie.totalFacturado).toBe(0);
  });

  it('una factura en a-facturar no suma en el facturado de ningún mes', () => {
    const facturas = [factura({ id: 'f1', monto: 100_000, estado: 'a-facturar', mesFacturado: 6, anioFacturado: 2026 })];
    const serie = facturadoVsCobrado({ facturas, cobros: [], hoy: '2026-06-15', meses: 3 });
    expect(serie.puntos.find((p) => p.mes === 6)?.facturado).toBe(0);
  });

  it('facturado, cobrado y pagado-parcialmente suman las tres su monto completo en el mismo mes', () => {
    const facturas = [
      factura({ id: 'f1', monto: 10_000, estado: 'facturado', mesFacturado: 6, anioFacturado: 2026 }),
      factura({ id: 'f2', monto: 20_000, estado: 'cobrado', mesFacturado: 6, anioFacturado: 2026 }),
      factura({ id: 'f3', monto: 30_000, estado: 'pagado-parcialmente', mesFacturado: 6, anioFacturado: 2026 }),
    ];
    const serie = facturadoVsCobrado({ facturas, cobros: [], hoy: '2026-06-15', meses: 3 });
    expect(serie.puntos.find((p) => p.mes === 6)?.facturado).toBe(60_000);
  });

  it('un cobro de abril de una factura de enero suma en el cobrado de abril, no en el de enero', () => {
    const facturas = [factura({ id: 'f1', monto: 100_000, mesFacturado: 1, anioFacturado: 2026 })];
    const cobros = [cobro({ id: 'c1', facturaId: 'f1', montoPagado: 100_000, fecha: '2026-04-10' })];
    // meses=6 (en vez de 4, que no es un PeriodoMeses válido) para que enero siga presente en
    // el rango junto con abril.
    const serie = facturadoVsCobrado({ facturas, cobros, hoy: '2026-04-15', meses: 6 });
    expect(serie.puntos.find((p) => p.mes === 1)?.cobrado).toBe(0);
    expect(serie.puntos.find((p) => p.mes === 4)?.cobrado).toBe(100_000);
  });

  it('dos cobros parciales de la misma factura en meses distintos suman cada uno en su mes, sin duplicarse', () => {
    const cobros = [
      cobro({ id: 'c1', facturaId: 'f1', montoPagado: 30_000, fecha: '2026-04-05' }),
      cobro({ id: 'c2', facturaId: 'f1', montoPagado: 20_000, fecha: '2026-05-05' }),
    ];
    const serie = facturadoVsCobrado({ facturas: [], cobros, hoy: '2026-05-15', meses: 3 });
    expect(serie.puntos.find((p) => p.mes === 4)?.cobrado).toBe(30_000);
    expect(serie.puntos.find((p) => p.mes === 5)?.cobrado).toBe(20_000);
  });

  it('un cobro con fecha en el primer día o en el último día del mes se atribuye a ese mes sin desplazarse', () => {
    const cobros = [
      cobro({ id: 'c1', facturaId: 'f1', montoPagado: 1_000, fecha: '2026-03-01' }),
      cobro({ id: 'c2', facturaId: 'f2', montoPagado: 2_000, fecha: '2026-03-31' }),
    ];
    const serie = facturadoVsCobrado({ facturas: [], cobros, hoy: '2026-03-15', meses: 3 });
    expect(serie.puntos.find((p) => p.mes === 3)?.cobrado).toBe(3_000);
  });
});
