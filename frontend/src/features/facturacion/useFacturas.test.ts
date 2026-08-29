import { act, waitFor } from '@testing-library/react';
import { crearQueryClientDeTest, renderHookConQuery } from '../../shared/test/queryWrapper';
import { describe, expect, it, vi } from 'vitest';
import type { Factura } from '../../shared/types/factura';
import type { FacturaRepository } from '../../shared/lib/facturacion/FacturaRepository';
import { useFacturas } from './useFacturas';

const facturaMartina: Factura = {
  id: 'factura-martina-1',
  pacienteId: 'paciente-martina',
  descripcion: 'Descripción',
  dias: 10,
  valorKm: 300,
  monto: 3000,
  estado: 'a-facturar',
  fechaInicial: '2026-08-01',
  fechaTope: '2026-08-31',
  tipoComprobante: 'A',
  cantidadKm: 10,
  prestacion: 'Kinesiología',
  mesFacturado: 8,
  anioFacturado: 2026,
  dependenciaYRetorno: 'Escuela / domicilio',
  domicilioId: 'dir-1',
  asistencias: [],
};

function buildFakeRepository(overrides: Partial<FacturaRepository> = {}): FacturaRepository {
  return {
    list: vi.fn().mockResolvedValue([facturaMartina]),
    getById: vi.fn().mockResolvedValue(facturaMartina),
    listByPaciente: vi.fn().mockResolvedValue([facturaMartina]),
    create: vi.fn().mockResolvedValue(facturaMartina),
    update: vi.fn().mockResolvedValue(facturaMartina),
    ...overrides,
  };
}

describe('useFacturas', () => {
  it('arranca en loading y expone la lista una vez que list() resuelve', async () => {
    const repository = buildFakeRepository();

    const { result } = renderHookConQuery(() => useFacturas(repository));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.facturas).toEqual([facturaMartina]);
    expect(result.current.error).toBeNull();
  });

  it('expone un error legible cuando list() rechaza la promesa', async () => {
    const repository = buildFakeRepository({ list: vi.fn().mockRejectedValue(new Error('caído')) });

    const { result } = renderHookConQuery(() => useFacturas(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('caído');
    expect(result.current.facturas).toEqual([]);
  });

  it('crear() llama a repository.create() y recarga la lista', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHookConQuery(() => useFacturas(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.crear({
        pacienteId: 'paciente-facundo',
        descripcion: '',
        dias: 5,
        valorKm: 100,
        monto: 500,
        estado: 'a-facturar',
        fechaInicial: '2026-08-01',
        fechaTope: '2026-08-31',
        tipoComprobante: 'A',
        cantidadKm: 5,
        prestacion: 'Kinesiología',
        mesFacturado: 8,
        anioFacturado: 2026,
        dependenciaYRetorno: '',
        domicilioId: 'dir-1',
        asistencias: [],
      });
    });

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.list).toHaveBeenCalledTimes(2);
  });

  it('actualizar() llama a repository.update() y recarga la lista', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHookConQuery(() => useFacturas(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.actualizar('factura-martina-1', { monto: 999 });
    });

    expect(repository.update).toHaveBeenCalledWith('factura-martina-1', { monto: 999 });
    expect(repository.list).toHaveBeenCalledTimes(2);
  });

  // migracion-react-query, tasks.md 4.2/4.3 — REGLA DURA de la Fase 4 (riesgo R2).
  it('es TRANSACCIONAL: dos montajes sucesivos consultan al servidor las DOS veces', async () => {
    const repository = buildFakeRepository();
    const client = crearQueryClientDeTest();

    const primero = renderHookConQuery(() => useFacturas(repository), { client });
    await waitFor(() => expect(primero.result.current.loading).toBe(false));
    primero.unmount();

    const segundo = renderHookConQuery(() => useFacturas(repository), { client });
    await waitFor(() => expect(segundo.result.current.loading).toBe(false));

    // Si esto llegara a dar 1, alguien le puso FRESCURA.referencia a un dominio que es dinero.
    expect(repository.list).toHaveBeenCalledTimes(2);
  });
});
