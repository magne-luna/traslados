import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Conductor } from '../../shared/types/conductor';
import type { ConductorRepository } from '../../shared/lib/conductores/ConductorRepository';
import { useConductoresDashboard } from './useConductoresDashboard';

// Gap detectado durante el apply (no cubierto por tasks.md 5.4, ver informe de la sub-agente):
// `RecorridosDelDiaPanel` (spec dashboard-recorridos-del-dia, Requirement "Detalle por
// recorrido") necesita resolver el nombre del conductor por id, lo que requiere leer
// ConductorRepository.list() — mismo patrón de solo lectura que useAlertasCud/
// useAlertasMantenimiento (sin `crear`/`actualizar`).

const conductor: Conductor = {
  id: 'c1',
  apellido: 'Gómez',
  nombre: 'Luis',
  documento: '30222333',
  domicilio: '',
  cuil: '20302223334',
  estado: 'operando',
  restricciones: [],
  asignaciones: [],
};

function buildRepository(overrides: Partial<ConductorRepository> = {}): ConductorRepository {
  return { list: vi.fn().mockResolvedValue([conductor]), getById: vi.fn(), create: vi.fn(), update: vi.fn(), ...overrides };
}

describe('useConductoresDashboard', () => {
  it('expone los conductores una vez que list() resuelve', async () => {
    const repository = buildRepository();
    const { result } = renderHook(() => useConductoresDashboard(repository));

    expect(result.current.cargando).toBe(true);
    await waitFor(() => expect(result.current.cargando).toBe(false));

    expect(result.current.conductores).toEqual([conductor]);
    expect(result.current.error).toBeNull();
  });

  it('no expone ningún método de escritura', async () => {
    const repository = buildRepository();
    const { result } = renderHook(() => useConductoresDashboard(repository));
    await waitFor(() => expect(result.current.cargando).toBe(false));

    expect(result.current).not.toHaveProperty('crear');
    expect(result.current).not.toHaveProperty('actualizar');
  });
});
