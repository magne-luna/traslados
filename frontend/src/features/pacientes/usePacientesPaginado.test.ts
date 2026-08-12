import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NuevoPaciente, Paciente } from '../../shared/types/paciente';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
import { usePacientesPaginado } from './usePacientesPaginado';

// paginacion-listados, Fase 2 (tasks.md 13.x): hook exclusivo de la pantalla de listado, distinto
// de `usePacientes.ts` (FE-8, `list()` sin paginar — sigue existiendo tal cual para los
// selectores/dashboard). Cablea `usePaginaListado` contra `PacienteRepository.listPage` y expone
// `crear`/`actualizar` que además recargan la página vigente (13.7).

const martina: Paciente = {
  id: 'paciente-martina',
  apellido: 'Gómez',
  nombre: 'Martina',
  fechaNacimiento: '2015-03-12',
  dni: '45123456',
  cuilTitular: '27-30111222-4',
  diagnostico: 'Parálisis cerebral',
  accesorioMovilidad: [],
  obraSocialId: null,
  numeroAfiliado: { valor: '45123456' },
  cud: null,
  direcciones: [],
  personasACargo: [],
  amparoJudicial: false,
};

function buildFakeRepository(overrides: Partial<PacienteRepository> = {}): PacienteRepository {
  return {
    list: vi.fn().mockResolvedValue([martina]),
    listPage: vi.fn().mockResolvedValue({ items: [martina], total: 1, pagina: 1, tamanio: 20 }),
    getById: vi.fn().mockResolvedValue(martina),
    create: vi.fn().mockResolvedValue(martina),
    update: vi.fn().mockResolvedValue(martina),
    ...overrides,
  };
}

function buildNuevoPaciente(): NuevoPaciente {
  return {
    apellido: 'Suárez',
    nombre: 'Iván',
    fechaNacimiento: '',
    dni: '1',
    cuilTitular: '',
    diagnostico: '',
    accesorioMovilidad: [],
    obraSocialId: null,
    numeroAfiliado: { valor: '' },
    cud: null,
    direcciones: [],
    personasACargo: [],
    amparoJudicial: false,
  };
}

describe('usePacientesPaginado', () => {
  it('13.1/13.2 al montar invoca listPage con tamanio 20 y expone items/total', async () => {
    const repository = buildFakeRepository();

    const { result } = renderHook(() => usePacientesPaginado(repository));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(repository.listPage).toHaveBeenCalledWith({ pagina: 1, tamanio: 20, filtros: { busqueda: '' } });
    expect(result.current.items).toEqual([martina]);
    expect(result.current.total).toBe(1);
  });

  it('13.7 crear() llama a repository.create y recarga la página vigente', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHook(() => usePacientesPaginado(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(repository.listPage).mockClear();

    await act(async () => {
      await result.current.crear(buildNuevoPaciente());
    });

    expect(repository.create).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(repository.listPage).toHaveBeenCalledTimes(1));
  });

  it('13.7 actualizar() llama a repository.update y recarga la página vigente', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHook(() => usePacientesPaginado(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(repository.listPage).mockClear();

    await act(async () => {
      await result.current.actualizar('paciente-martina', { diagnostico: 'Nuevo' });
    });

    expect(repository.update).toHaveBeenCalledWith('paciente-martina', { diagnostico: 'Nuevo' });
    await waitFor(() => expect(repository.listPage).toHaveBeenCalledTimes(1));
  });

  it('13.7 recargar() tras actualizar() NO resetea la página a 1', async () => {
    const repository = buildFakeRepository({
      listPage: vi.fn().mockResolvedValue({ items: [], total: 50, pagina: 1, tamanio: 20 }),
    });
    const { result } = renderHook(() => usePacientesPaginado(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.irAPagina(3);
    });
    await waitFor(() => expect(result.current.pagina).toBe(3));

    await act(async () => {
      await result.current.actualizar('paciente-martina', { diagnostico: 'Nuevo' });
    });

    expect(result.current.pagina).toBe(3);
  });

  it('crear() propaga el error sin recargar si repository.create rechaza', async () => {
    const repository = buildFakeRepository({ create: vi.fn().mockRejectedValue(new Error('No se pudo guardar.')) });
    const { result } = renderHook(() => usePacientesPaginado(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(repository.listPage).mockClear();

    await expect(result.current.crear(buildNuevoPaciente())).rejects.toThrow('No se pudo guardar.');
    expect(repository.listPage).not.toHaveBeenCalled();
  });
});
