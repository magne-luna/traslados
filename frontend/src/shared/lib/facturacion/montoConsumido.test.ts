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

  // `autorizacion-mensual` (design.md D8, tasks.md 6b.4, firma G4): cero cambios de código en esta
  // función — estos 2 tests nominados prueban que las dos semánticas conviven en el MISMO filtro
  // `autorizacionId + anio`, sin bifurcar por `periodoMes` (que esta función ni siquiera recibe).
  it('fila legacy: sigue sumando el año (autorización sin periodoMes, modelo 1:1 anterior)', () => {
    // Autorización legacy única para todo el año: varias facturas de meses distintos apuntan a la
    // MISMA autorizacionId (nunca hay una fila por mes para este caso) -> sigue siendo un tope ANUAL.
    const facturas: Factura[] = [
      factura({ id: 'f-enero', pacienteId: 'p1', estado: 'facturado', autorizacionId: 'auth-legacy', monto: 1000, mesFacturado: 1, anioFacturado: 2026 }),
      factura({ id: 'f-junio', pacienteId: 'p1', estado: 'cobrado', autorizacionId: 'auth-legacy', monto: 2000, mesFacturado: 6, anioFacturado: 2026 }),
      factura({ id: 'f-diciembre', pacienteId: 'p1', estado: 'pagado-parcialmente', autorizacionId: 'auth-legacy', monto: 3000, mesFacturado: 12, anioFacturado: 2026 }),
    ];

    expect(montoConsumido(facturas, 'auth-legacy', 2026)).toBe(6000);
  });

  it('fila mensual: suma solo su mes (autorización con periodoMes, modelo 1:N de este change)', () => {
    // Con el modelo 1:N cada mes tiene SU PROPIA autorizacionId ("auth-marzo-2026" vs
    // "auth-abril-2026"): montoConsumido, sin cambiar una línea, filtra por esa autorizacionId
    // puntual -> la suma queda acotada al mes de esa fila, aunque existan facturas de otros meses
    // del mismo presupuesto contra OTRAS autorizaciones.
    const facturas: Factura[] = [
      factura({ id: 'f-marzo-1', pacienteId: 'p1', estado: 'facturado', autorizacionId: 'auth-marzo-2026', monto: 1000, mesFacturado: 3, anioFacturado: 2026 }),
      factura({ id: 'f-marzo-2', pacienteId: 'p1', estado: 'cobrado', autorizacionId: 'auth-marzo-2026', monto: 500, mesFacturado: 3, anioFacturado: 2026 }),
      factura({ id: 'f-abril', pacienteId: 'p1', estado: 'facturado', autorizacionId: 'auth-abril-2026', monto: 9999, mesFacturado: 4, anioFacturado: 2026 }),
    ];

    expect(montoConsumido(facturas, 'auth-marzo-2026', 2026)).toBe(1500);
  });
});
