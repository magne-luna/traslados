import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Paciente } from '../../shared/types/paciente';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
import { useAlertasCud } from './useAlertasCud';

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
  return { list: vi.fn().mockResolvedValue([paciente]), getById: vi.fn(), create: vi.fn(), update: vi.fn(), ...overrides };
}

describe('useAlertasCud', () => {
  it('expone los pacientes una vez que list() resuelve', async () => {
    const repository = buildRepository();
    const { result } = renderHook(() => useAlertasCud(repository));

    expect(result.current.cargando).toBe(true);
    await waitFor(() => expect(result.current.cargando).toBe(false));

    expect(result.current.pacientes).toEqual([paciente]);
    expect(result.current.error).toBeNull();
  });

  it('expone un error legible cuando falla la lectura', async () => {
    const repository = buildRepository({ list: vi.fn().mockRejectedValue(new Error('caído')) });
    const { result } = renderHook(() => useAlertasCud(repository));
    await waitFor(() => expect(result.current.cargando).toBe(false));

    expect(result.current.error).toBe('caído');
    expect(result.current.pacientes).toEqual([]);
  });

  it('no expone ningún método de escritura', () => {
    const repository = buildRepository();
    const { result } = renderHook(() => useAlertasCud(repository));

    expect(result.current).not.toHaveProperty('crear');
    expect(result.current).not.toHaveProperty('actualizar');
  });
});
