import { describe, expect, it } from 'vitest';
import type { Factura } from '../../types/factura';
import { cupoConsumido } from './cupoConsumido';

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

describe('cupoConsumido', () => {
  it('las facturas en estado a-facturar no cuentan para el cupo consumido', () => {
    const facturas: Factura[] = [
      factura({ id: 'f1', pacienteId: 'p1', estado: 'a-facturar', dias: 20, cantidadKm: 500 }),
    ];

    const resultado = cupoConsumido(facturas, 'p1', 8, 2026);

    expect(resultado).toEqual({ dias: 0, km: 0 });
  });

  it('suma facturado, cobrado y pagado-parcialmente del mismo paciente y período', () => {
    const facturas: Factura[] = [
      factura({ id: 'f1', pacienteId: 'p1', estado: 'facturado', dias: 5, cantidadKm: 100 }),
      factura({ id: 'f2', pacienteId: 'p1', estado: 'cobrado', dias: 3, cantidadKm: 60 }),
      factura({ id: 'f3', pacienteId: 'p1', estado: 'pagado-parcialmente', dias: 2, cantidadKm: 40 }),
    ];

    const resultado = cupoConsumido(facturas, 'p1', 8, 2026);

    expect(resultado).toEqual({ dias: 10, km: 200 });
  });

  it('excluye la factura en edición cuando se pasa excluirFacturaId', () => {
    const facturas: Factura[] = [
      factura({ id: 'f1', pacienteId: 'p1', estado: 'facturado', dias: 5, cantidadKm: 100 }),
      factura({ id: 'f2', pacienteId: 'p1', estado: 'facturado', dias: 3, cantidadKm: 60 }),
    ];

    const resultado = cupoConsumido(facturas, 'p1', 8, 2026, { excluirFacturaId: 'f2' });

    expect(resultado).toEqual({ dias: 5, km: 100 });
  });

  it('aísla por paciente: no suma facturas de otro paciente en el mismo período', () => {
    const facturas: Factura[] = [
      factura({ id: 'f1', pacienteId: 'p1', estado: 'facturado', dias: 5, cantidadKm: 100 }),
      factura({ id: 'f2', pacienteId: 'p2', estado: 'facturado', dias: 100, cantidadKm: 1000 }),
    ];

    const resultado = cupoConsumido(facturas, 'p1', 8, 2026);

    expect(resultado).toEqual({ dias: 5, km: 100 });
  });

  it('aísla por mes: no suma facturas del mismo paciente en otro mes/año', () => {
    const facturas: Factura[] = [
      factura({ id: 'f1', pacienteId: 'p1', estado: 'facturado', dias: 5, cantidadKm: 100, mesFacturado: 8, anioFacturado: 2026 }),
      factura({ id: 'f2', pacienteId: 'p1', estado: 'facturado', dias: 9, cantidadKm: 900, mesFacturado: 7, anioFacturado: 2026 }),
      factura({ id: 'f3', pacienteId: 'p1', estado: 'facturado', dias: 9, cantidadKm: 900, mesFacturado: 8, anioFacturado: 2025 }),
    ];

    const resultado = cupoConsumido(facturas, 'p1', 8, 2026);

    expect(resultado).toEqual({ dias: 5, km: 100 });
  });
});
