import { describe, expect, it } from 'vitest';
import { crearQueryClient } from './queryClient';

describe('crearQueryClient', () => {
  it('refresca al volver el foco: lo que carga otra computadora se ve sin F5 (pedido de la usuaria)', () => {
    expect(crearQueryClient().getDefaultOptions().queries?.refetchOnWindowFocus).toBe(true);
  });

  it('mantiene staleTime 0 como default (defensa contra mostrar plata desactualizada)', () => {
    expect(crearQueryClient().getDefaultOptions().queries?.staleTime).toBe(0);
  });
});
