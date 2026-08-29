import { waitFor } from '@testing-library/react';
import { renderHookConQuery } from '../../shared/test/queryWrapper';
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
  asignaciones: [],
};

function buildRepository(overrides: Partial<ConductorRepository> = {}): ConductorRepository {
  return {
    list: vi.fn().mockResolvedValue([conductor]),
    listPage: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    ...overrides,
  };
}

describe('useConductoresDashboard', () => {
  it('expone los conductores una vez que list() resuelve', async () => {
    const repository = buildRepository();
    const { result } = renderHookConQuery(() => useConductoresDashboard(repository));

    expect(result.current.cargando).toBe(true);
    await waitFor(() => expect(result.current.cargando).toBe(false));

    expect(result.current.conductores).toEqual([conductor]);
    expect(result.current.error).toBeNull();
  });

  it('no expone ningún método de escritura', async () => {
    const repository = buildRepository();
    const { result } = renderHookConQuery(() => useConductoresDashboard(repository));
    await waitFor(() => expect(result.current.cargando).toBe(false));

    expect(result.current).not.toHaveProperty('crear');
    expect(result.current).not.toHaveProperty('actualizar');
  });

  // paginacion-listados, Fase 3 (tasks.md 16.4): el dashboard sigue calculando sobre el universo
  // completo — nunca sobre una página. Paginar acá dejaría de resolver conductores fuera de la
  // primera página en silencio (mismo modo de falla que 14.2 de la Fase 2, dato falso sin error).
  it('no-regresión: sigue usando list() completo, nunca listPage()', async () => {
    const repository = buildRepository();
    const { result } = renderHookConQuery(() => useConductoresDashboard(repository));
    await waitFor(() => expect(result.current.cargando).toBe(false));

    expect(repository.list).toHaveBeenCalled();
    expect(repository.listPage).not.toHaveBeenCalled();
  });
});
