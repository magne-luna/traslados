import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NuevoPaciente, Paciente } from '../../shared/types/paciente';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
import { crearQueryClientDeTest, renderHookConQuery } from '../../shared/test/queryWrapper';
import { usePacientes } from './usePacientes';
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

    const { result } = renderHookConQuery(() => usePacientesPaginado(repository));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(repository.listPage).toHaveBeenCalledWith({ pagina: 1, tamanio: 20, filtros: { busqueda: '' } });
    expect(result.current.items).toEqual([martina]);
    expect(result.current.total).toBe(1);
  });

  it('13.7 crear() llama a repository.create y recarga la página vigente', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHookConQuery(() => usePacientesPaginado(repository));
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
    const { result } = renderHookConQuery(() => usePacientesPaginado(repository));
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
    const { result } = renderHookConQuery(() => usePacientesPaginado(repository));
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
    const { result } = renderHookConQuery(() => usePacientesPaginado(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(repository.listPage).mockClear();

    await expect(result.current.crear(buildNuevoPaciente())).rejects.toThrow('No se pudo guardar.');
    expect(repository.listPage).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------------------------
  // migracion-react-query, tasks.md 3.7-3.9 — RIESGO #1, el riesgo alto del change.
  //
  // Las pantallas paginadas mutan por un camino distinto del de los selectores: recargan solo SU
  // página vía `listPage`. Si ese camino no invalida también el padrón completo (`list()`), un alta
  // hecha desde Pacientes NO aparece en los selectores de Presupuestos ni de Facturación.
  //
  // Falla en SILENCIO: no rompe nada, no tira error, solo muestra un dato viejo. Por eso tiene test
  // propio y por eso el test es de punta a punta entre los dos caminos.
  // ---------------------------------------------------------------------------------------------

  it('crear desde el camino paginado invalida el padrón completo, no solo la página (3.7)', async () => {
    const nuevo: Paciente = { ...martina, id: 'paciente-nuevo', apellido: 'Pérez' };
    const list = vi.fn().mockResolvedValue([martina]);
    const repository = buildFakeRepository({ list, create: vi.fn().mockResolvedValue(nuevo) });
    const client = crearQueryClientDeTest();

    // Un consumidor del padrón completo ya cargó y cacheó (rol: selector de Presupuestos).
    const selector = renderHookConQuery(() => usePacientes(repository), { client });
    await waitFor(() => expect(selector.result.current.loading).toBe(false));
    expect(list).toHaveBeenCalledTimes(1);

    // La pantalla paginada crea un paciente por SU camino.
    const paginado = renderHookConQuery(() => usePacientesPaginado(repository), { client });
    await waitFor(() => expect(paginado.result.current.loading).toBe(false));

    list.mockResolvedValue([martina, nuevo]);
    await act(async () => {
      await paginado.result.current.crear({} as NuevoPaciente);
    });

    // El padrón se vuelve a pedir aunque el alta no pasó por él.
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it('E2E de R1: el paciente creado desde el listado paginado aparece en el selector (3.9)', async () => {
    const nuevo: Paciente = { ...martina, id: 'paciente-nuevo', apellido: 'Pérez' };
    const list = vi.fn().mockResolvedValue([martina]);
    const repository = buildFakeRepository({ list, create: vi.fn().mockResolvedValue(nuevo) });
    const client = crearQueryClientDeTest();

    const paginado = renderHookConQuery(() => usePacientesPaginado(repository), { client });
    await waitFor(() => expect(paginado.result.current.loading).toBe(false));

    list.mockResolvedValue([martina, nuevo]);
    await act(async () => {
      await paginado.result.current.crear({} as NuevoPaciente);
    });
    paginado.unmount();

    // Otra pantalla monta su selector después: ve el alta.
    const selector = renderHookConQuery(() => usePacientes(repository), { client });
    await waitFor(() => expect(selector.result.current.pacientes).toEqual([martina, nuevo]));
  });

  it('actualizar desde el camino paginado también invalida el padrón', async () => {
    const editada: Paciente = { ...martina, apellido: 'Gómez Actualizado' };
    const list = vi.fn().mockResolvedValue([martina]);
    const repository = buildFakeRepository({ list, update: vi.fn().mockResolvedValue(editada) });
    const client = crearQueryClientDeTest();

    const selector = renderHookConQuery(() => usePacientes(repository), { client });
    await waitFor(() => expect(selector.result.current.loading).toBe(false));

    const paginado = renderHookConQuery(() => usePacientesPaginado(repository), { client });
    await waitFor(() => expect(paginado.result.current.loading).toBe(false));

    list.mockResolvedValue([editada]);
    await act(async () => {
      await paginado.result.current.actualizar('paciente-martina', { apellido: 'Gómez Actualizado' });
    });

    await waitFor(() => expect(selector.result.current.pacientes).toEqual([editada]));
  });
});
