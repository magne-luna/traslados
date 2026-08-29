import { waitFor } from '@testing-library/react';
import { renderHookConQuery } from '../../shared/test/queryWrapper';
import { describe, expect, it, vi } from 'vitest';
import type { Cobro, Factura } from '../../shared/types/factura';
import type { CobroRepository } from '../../shared/lib/facturacion/CobroRepository';
import type { FacturaRepository } from '../../shared/lib/facturacion/FacturaRepository';
import { useDatosFinancieros } from './useDatosFinancieros';

// tasks.md 5.2, design.md Decisión 7 (nota de eficiencia): facturadoVsCobrado, resumenAnual y
// facturasEnMora consumen las mismas dos colecciones — se cargan una sola vez en este hook
// compartido, nunca tres lecturas del mismo repositorio.

const factura: Factura = {
  id: 'f1',
  pacienteId: 'p1',
  descripcion: '',
  dias: 10,
  valorKm: 100,
  monto: 1000,
  estado: 'facturado',
  fechaInicial: '2026-01-01',
  fechaTope: '2026-01-31',
  tipoComprobante: 'A',
  cantidadKm: 10,
  prestacion: 'Kinesiología',
  mesFacturado: 1,
  anioFacturado: 2026,
  dependenciaYRetorno: '',
  domicilioId: 'd1',
  asistencias: [],
};

const cobro: Cobro = { id: 'c1', facturaId: 'f1', fecha: '2026-01-15', montoPagado: 500 };

function buildFacturaRepository(overrides: Partial<FacturaRepository> = {}): FacturaRepository {
  return {
    list: vi.fn().mockResolvedValue([factura]),
    getById: vi.fn(),
    listByPaciente: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    ...overrides,
  };
}

function buildCobroRepository(overrides: Partial<CobroRepository> = {}): CobroRepository {
  return {
    list: vi.fn().mockResolvedValue([cobro]),
    listByFactura: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
    ...overrides,
  };
}

describe('useDatosFinancieros', () => {
  it('arranca cargando y expone facturas y cobros una vez que ambas promesas resuelven', async () => {
    const facturaRepository = buildFacturaRepository();
    const cobroRepository = buildCobroRepository();

    const { result } = renderHookConQuery(() => useDatosFinancieros(facturaRepository, cobroRepository));

    expect(result.current.cargando).toBe(true);
    await waitFor(() => expect(result.current.cargando).toBe(false));

    expect(result.current.facturas).toEqual([factura]);
    expect(result.current.cobros).toEqual([cobro]);
    expect(result.current.error).toBeNull();
  });

  it('invoca list() una sola vez en cada repositorio, sin importar cuántas veces se re-renderiza', async () => {
    const facturaRepository = buildFacturaRepository();
    const cobroRepository = buildCobroRepository();

    const { result, rerender } = renderHookConQuery(() => useDatosFinancieros(facturaRepository, cobroRepository));
    await waitFor(() => expect(result.current.cargando).toBe(false));

    rerender();
    rerender();

    expect(facturaRepository.list).toHaveBeenCalledTimes(1);
    expect(cobroRepository.list).toHaveBeenCalledTimes(1);
  });

  it('expone un error legible y acotado cuando falla la lectura de facturas o cobros', async () => {
    const facturaRepository = buildFacturaRepository({ list: vi.fn().mockRejectedValue(new Error('caído')) });
    const cobroRepository = buildCobroRepository();

    const { result } = renderHookConQuery(() => useDatosFinancieros(facturaRepository, cobroRepository));
    await waitFor(() => expect(result.current.cargando).toBe(false));

    expect(result.current.error).toBe('caído');
    expect(result.current.facturas).toEqual([]);
  });
});
