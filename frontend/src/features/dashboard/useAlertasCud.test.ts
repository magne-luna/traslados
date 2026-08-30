import { waitFor } from '@testing-library/react';
import { crearQueryClientDeTest, renderHookConQuery } from '../../shared/test/queryWrapper';
import { describe, expect, it, vi } from 'vitest';
import type { Paciente } from '../../shared/types/paciente';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
import { useAlertasCud } from './useAlertasCud';
import { usePacientes } from '../pacientes/usePacientes';

// tasks.md 5.4: lee PacienteRepository.list() con su propio estado de carga/error
// independiente. Hook de SOLO LECTURA — no expone crear/actualizar (design.md Non-Goals).

const paciente: Paciente = {
  id: 'p1',
  apellido: 'Pérez',
  nombre: 'Juana',
  fechaNacimiento: '2000-01-01',
  dni: '30111222',
  cuilTitular: '27301112223',
  diagnostico: '',
  accesorioMovilidad: [],
  obraSocialId: null,
  numeroAfiliado: { valor: '30111222' },
  cud: null,
  direcciones: [],
  personasACargo: [],
  amparoJudicial: false,
};

function buildRepository(overrides: Partial<PacienteRepository> = {}): PacienteRepository {
  return { list: vi.fn().mockResolvedValue([paciente]), listCompleto: vi.fn().mockResolvedValue([]), listPage: vi.fn(), getById: vi.fn(), create: vi.fn(), update: vi.fn(), ...overrides };
}

describe('useAlertasCud', () => {
  it('expone los pacientes una vez que list() resuelve', async () => {
    const repository = buildRepository();
    const { result } = renderHookConQuery(() => useAlertasCud(repository));

    expect(result.current.cargando).toBe(true);
    await waitFor(() => expect(result.current.cargando).toBe(false));

    expect(result.current.pacientes).toEqual([paciente]);
    expect(result.current.error).toBeNull();
  });

  // paginacion-listados, Fase 2 (tasks.md 14.2): no-regresión de alertas clínicas. Una alerta de
  // CUD vencido calculada sobre 1/20 del padrón (por usar `listPage` en vez de `list()`) es un
  // DATO CLÍNICO FALSO sin ningún error visible — la peor forma de fallo posible acá.
  it('14.2 usa list() completo, nunca listPage() (dato clínico falso si paginara)', async () => {
    const repository = buildRepository();
    const { result } = renderHookConQuery(() => useAlertasCud(repository));

    await waitFor(() => expect(result.current.cargando).toBe(false));

    expect(repository.list).toHaveBeenCalled();
    expect(repository.listPage).not.toHaveBeenCalled();
  });

  it('expone un error legible cuando falla la lectura', async () => {
    const repository = buildRepository({ list: vi.fn().mockRejectedValue(new Error('caído')) });
    const { result } = renderHookConQuery(() => useAlertasCud(repository));
    await waitFor(() => expect(result.current.cargando).toBe(false));

    expect(result.current.error).toBe('caído');
    expect(result.current.pacientes).toEqual([]);
  });

  it('no expone ningún método de escritura', () => {
    const repository = buildRepository();
    const { result } = renderHookConQuery(() => useAlertasCud(repository));

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

    // La usuaria pasó primero por el módulo de Pacientes.
    const modulo = renderHookConQuery(() => usePacientes(repository), { client });
    await waitFor(() => expect(modulo.result.current.loading).toBe(false));
    expect(repository.list).toHaveBeenCalledTimes(1);
    modulo.unmount();

    // Y después vuelve al dashboard.
    const dashboard = renderHookConQuery(() => useAlertasCud(repository), { client });
    await waitFor(() => expect(dashboard.result.current.cargando).toBe(false));

    expect(repository.list).toHaveBeenCalledTimes(1);
  });

  it('y al revés: el dashboard primero deja el padrón listo para el módulo (5.6)', async () => {
    const repository = buildRepository();
    const client = crearQueryClientDeTest();

    const dashboard = renderHookConQuery(() => useAlertasCud(repository), { client });
    await waitFor(() => expect(dashboard.result.current.cargando).toBe(false));
    dashboard.unmount();

    const modulo = renderHookConQuery(() => usePacientes(repository), { client });
    await waitFor(() => expect(modulo.result.current.pacientes).toHaveLength(1));

    expect(repository.list).toHaveBeenCalledTimes(1);
  });
});
