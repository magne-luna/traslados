import { act, waitFor } from '@testing-library/react';
import { renderHookConQuery } from '../../shared/test/queryWrapper';
import { describe, expect, it, vi } from 'vitest';
import type { Paciente } from '../../shared/types/paciente';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
import { usePacientes } from './usePacientes';

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
    listPage: vi.fn(),
    getById: vi.fn().mockResolvedValue(martina),
    create: vi.fn().mockResolvedValue(martina),
    update: vi.fn().mockResolvedValue(martina),
    ...overrides,
  };
}

describe('usePacientes', () => {
  it('arranca en loading y expone la lista una vez que list() resuelve, como objeto (no array)', async () => {
    const repository = buildFakeRepository();

    const { result } = renderHookConQuery(() => usePacientes(repository));

    expect(result.current.loading).toBe(true);
    expect(Array.isArray(result.current)).toBe(false);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.pacientes).toEqual([martina]);
    expect(result.current.error).toBeNull();
  });

  it('expone un error legible cuando list() rechaza la promesa, sin dejar loading colgado (triangulación)', async () => {
    const repository = buildFakeRepository({ list: vi.fn().mockRejectedValue(new Error('caído')) });

    const { result } = renderHookConQuery(() => usePacientes(repository));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('caído');
    expect(result.current.pacientes).toEqual([]);
  });

  it('crear() llama a repository.create() y recarga la lista', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHookConQuery(() => usePacientes(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.crear({
        apellido: martina.apellido,
        nombre: martina.nombre,
        fechaNacimiento: martina.fechaNacimiento,
        dni: martina.dni,
        cuilTitular: martina.cuilTitular,
        diagnostico: martina.diagnostico,
        accesorioMovilidad: [],
        obraSocialId: null,
        numeroAfiliado: martina.numeroAfiliado,
        cud: null,
        direcciones: [],
        personasACargo: [],
        amparoJudicial: false,
      });
    });

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.list).toHaveBeenCalledTimes(2); // carga inicial + recarga tras crear
  });

  it('actualizar() llama a repository.update() y recarga la lista', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHookConQuery(() => usePacientes(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.actualizar('paciente-martina', { diagnostico: 'Actualizado' });
    });

    expect(repository.update).toHaveBeenCalledWith('paciente-martina', { diagnostico: 'Actualizado' });
    expect(repository.list).toHaveBeenCalledTimes(2);
  });

  it('crear() propaga el error del repository sin dejar loading colgado', async () => {
    const repository = buildFakeRepository({ create: vi.fn().mockRejectedValue(new Error('DNI duplicado')) });
    const { result } = renderHookConQuery(() => usePacientes(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(
        result.current.crear({
          apellido: martina.apellido,
          nombre: martina.nombre,
          fechaNacimiento: martina.fechaNacimiento,
          dni: martina.dni,
          cuilTitular: martina.cuilTitular,
          diagnostico: martina.diagnostico,
          accesorioMovilidad: [],
          obraSocialId: null,
          numeroAfiliado: martina.numeroAfiliado,
          cud: null,
          direcciones: [],
          personasACargo: [],
          amparoJudicial: false,
        }),
      ).rejects.toThrow('DNI duplicado');
    });

    expect(result.current.error).toBe('DNI duplicado');
    expect(result.current.loading).toBe(false);
  });
});
