import { describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { crearQueryClientDeTest, renderHookConQuery } from './queryWrapper';

// tasks.md 1.11-1.12. Estos tests no prueban código de producción: prueban que la INFRAESTRUCTURA
// de tests previene las dos trampas de design.md §D7. Si alguien los borra o los debilita, las
// suites empiezan a fallar según el orden de ejecución y nadie entiende por qué.

const CLAVE = ['dominio-de-prueba'] as const;

function useConsulta(cargar: () => Promise<string[]>) {
  return useQuery({ queryKey: CLAVE, queryFn: cargar });
}

describe('aislamiento del QueryClient entre tests (R3)', () => {
  it('dos renders con clientes propios NO comparten caché: el segundo consulta igual', async () => {
    const cargar = vi.fn().mockResolvedValue(['dato']);

    const primero = renderHookConQuery(() => useConsulta(cargar));
    await waitFor(() => expect(primero.result.current.isSuccess).toBe(true));
    expect(cargar).toHaveBeenCalledTimes(1);
    primero.unmount();

    // Cliente nuevo (el default de renderHookConQuery): la caché arranca vacía.
    const segundo = renderHookConQuery(() => useConsulta(cargar));
    await waitFor(() => expect(segundo.result.current.isSuccess).toBe(true));

    expect(cargar).toHaveBeenCalledTimes(2);
  });

  it('demuestra la fuga: compartiendo un cliente, el segundo render arranca CON dato en vez de vacío', async () => {
    const cargar = vi.fn().mockResolvedValue(['dato']);
    const compartido = crearQueryClientDeTest();

    const primero = renderHookConQuery(() => useConsulta(cargar), { client: compartido });
    await waitFor(() => expect(primero.result.current.isSuccess).toBe(true));

    const segundo = renderHookConQuery(() => useConsulta(cargar), { client: compartido });

    // El síntoma real de la contaminación NO es "no consulta" —con staleTime 0 igual revalida—
    // sino que el segundo montaje NUNCA pasa por el estado vacío: ve el dato del anterior en su
    // PRIMER render. Un test que afirme "arranca cargando" pasaría o fallaría según qué test
    // corrió antes. Eso es lo que un cliente por test elimina.
    expect(segundo.result.current.data).toEqual(['dato']);
    expect(segundo.result.current.isPending).toBe(false);
  });

  it('con cliente propio, el segundo render SÍ arranca vacío (el comportamiento correcto)', async () => {
    const cargar = vi.fn().mockResolvedValue(['dato']);

    const primero = renderHookConQuery(() => useConsulta(cargar));
    await waitFor(() => expect(primero.result.current.isSuccess).toBe(true));
    primero.unmount();

    const segundo = renderHookConQuery(() => useConsulta(cargar));

    expect(segundo.result.current.data).toBeUndefined();
    expect(segundo.result.current.isPending).toBe(true);
  });
});

describe('retry desactivado en tests (trampa 2 de §D7)', () => {
  it('una consulta que rechaza llega a estado de error tras UN solo intento', async () => {
    const cargar = vi.fn().mockRejectedValue(new Error('falló la consulta'));

    const { result } = renderHookConQuery(() => useConsulta(cargar));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cargar).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('una mutación que rechaza tampoco reintenta', async () => {
    const mutar = vi.fn().mockRejectedValue(new Error('falló la mutación'));
    const client = crearQueryClientDeTest();

    await expect(
      client.getMutationCache().build(client, { mutationFn: mutar }).execute(undefined),
    ).rejects.toThrow('falló la mutación');

    expect(mutar).toHaveBeenCalledTimes(1);
  });
});
