import { waitFor } from '@testing-library/react';
import { crearQueryClientDeTest, renderHookConQuery } from '../../shared/test/queryWrapper';
import { describe, expect, it, vi } from 'vitest';
import type { Vehiculo } from '../../shared/types/vehiculo';
import type { VehiculoRepository } from '../../shared/lib/vehiculos/VehiculoRepository';
import { useAlertasMantenimiento } from './useAlertasMantenimiento';
import { useVehiculos } from '../vehiculos/useVehiculos';

// tasks.md 5.4: lee VehiculoRepository.list() con su propio estado de carga/error
// independiente. Hook de SOLO LECTURA — no expone crear/actualizar (design.md Non-Goals).

const vehiculo: Vehiculo = {
  id: 'v1',
  patente: 'AB123CD',
  modelo: 'Sprinter',
  tipo: 'combi',
  capacidad: 6,
  accesoriosCompatibles: [],
  estado: 'habilitado',
  kilometraje: 1000,
  kilometrajeUltimoService: 0,
  fechaUltimoService: '2026-01-01',
  habilitaciones: [],
  gastos: [],
  mantenimientos: [],
};

function buildRepository(overrides: Partial<VehiculoRepository> = {}): VehiculoRepository {
  return { list: vi.fn().mockResolvedValue([vehiculo]), getById: vi.fn(), create: vi.fn(), update: vi.fn(), ...overrides };
}

describe('useAlertasMantenimiento', () => {
  it('expone los vehículos una vez que list() resuelve', async () => {
    const repository = buildRepository();
    const { result } = renderHookConQuery(() => useAlertasMantenimiento(repository));

    expect(result.current.cargando).toBe(true);
    await waitFor(() => expect(result.current.cargando).toBe(false));

    expect(result.current.vehiculos).toEqual([vehiculo]);
    expect(result.current.error).toBeNull();
  });

  it('expone un error legible cuando falla la lectura', async () => {
    const repository = buildRepository({ list: vi.fn().mockRejectedValue(new Error('caído')) });
    const { result } = renderHookConQuery(() => useAlertasMantenimiento(repository));
    await waitFor(() => expect(result.current.cargando).toBe(false));

    expect(result.current.error).toBe('caído');
    expect(result.current.vehiculos).toEqual([]);
  });

  it('no expone ningún método de escritura', () => {
    const repository = buildRepository();
    const { result } = renderHookConQuery(() => useAlertasMantenimiento(repository));

    expect(result.current).not.toHaveProperty('crear');
    expect(result.current).not.toHaveProperty('actualizar');
  });

  // -------------------------------------------------------------------------------------------
  // migracion-react-query, tasks.md 5.1/5.6 — el beneficio cruzado, que es la razón de la Fase 5.
  // `/` es la ruta índice: se pasa por ella constantemente, y antes pagaba el padrón completo en
  // CADA visita aunque la usuaria viniera del módulo que ya lo había traído.
  // -------------------------------------------------------------------------------------------

  it('si el padrón ya está cacheado y fresco, el dashboard NO vuelve a pedirlo (5.1)', async () => {
    const repository = buildRepository();
    const client = crearQueryClientDeTest();

    // La usuaria pasó primero por el módulo de Vehículos.
    const modulo = renderHookConQuery(() => useVehiculos(repository), { client });
    await waitFor(() => expect(modulo.result.current.loading).toBe(false));
    expect(repository.list).toHaveBeenCalledTimes(1);
    modulo.unmount();

    // Y después vuelve al dashboard.
    const dashboard = renderHookConQuery(() => useAlertasMantenimiento(repository), { client });
    await waitFor(() => expect(dashboard.result.current.cargando).toBe(false));

    expect(repository.list).toHaveBeenCalledTimes(1);
  });

  it('y al revés: el dashboard primero deja el padrón listo para el módulo (5.6)', async () => {
    const repository = buildRepository();
    const client = crearQueryClientDeTest();

    const dashboard = renderHookConQuery(() => useAlertasMantenimiento(repository), { client });
    await waitFor(() => expect(dashboard.result.current.cargando).toBe(false));
    dashboard.unmount();

    const modulo = renderHookConQuery(() => useVehiculos(repository), { client });
    await waitFor(() => expect(modulo.result.current.vehiculos).toHaveLength(1));

    expect(repository.list).toHaveBeenCalledTimes(1);
  });
});
