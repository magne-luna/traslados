import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Cuenta, CuentaRepository, NuevaCuentaInput } from '../../shared/lib/cuentas/CuentaRepository';
import type { Permiso } from '../../shared/types/usuario';
import { aMensaje } from '../../shared/lib/query/aMensaje';
import { claves } from '../../shared/lib/query/claves';
import { FRESCURA } from '../../shared/lib/query/frescura';

export interface UseCuentasResult {
  cuentas: Cuenta[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  crearCuenta: (input: NuevaCuentaInput) => Promise<void>;
  actualizarPermisos: (usuarioId: string, permisos: Permiso[]) => Promise<void>;
}

// migracion-react-query, Fase 4 (dominio SENSIBLE). **`UseCuentasResult` NO cambió.**
//
// ⚠️ A diferencia del resto de los dominios migrados, este hook NO lleva el `errorMutacion` en
// estado. Es deliberado y viene de antes del change: si `crearCuenta`/`actualizarPermisos` rechazan
// NO se recarga el listado —el estado remoto no cambió— y `CuentasPage`/`CuentaDetail` necesitan el
// error CRUDO para mostrarlo en el formulario/matriz (D7 de auth: 401/403/404/400 con mensajes
// distintos), no un string genérico de "error de carga". `mutateAsync` propaga el rechazo tal cual;
// el campo `error` queda reservado para fallos de LECTURA, como antes.
//
// Que la invalidación viva en `onSuccess` (no en un `finally`) es justamente lo que garantiza que
// una mutación fallida no dispare recarga.
//
// ⚠️ `FRESCURA.sensible` es CERO: son cuentas y permisos. Servir permisos viejos desde memoria es
// un problema de seguridad, no de frescura.
export function useCuentas(repository: CuentaRepository): UseCuentasResult {
  const queryClient = useQueryClient();

  const { data, isPending, error, refetch } = useQuery({
    queryKey: claves.cuentas.lista(),
    queryFn: () => repository.listarCuentas(),
    staleTime: FRESCURA.sensible,
  });

  const invalidar = useCallback(
    () => queryClient.invalidateQueries({ queryKey: claves.cuentas.todos() }),
    [queryClient],
  );

  const mutacionCrear = useMutation({
    mutationFn: (input: NuevaCuentaInput) => repository.crearCuenta(input),
    onSuccess: invalidar,
  });

  const mutacionPermisos = useMutation({
    mutationFn: ({ usuarioId, permisos }: { usuarioId: string; permisos: Permiso[] }) =>
      repository.actualizarPermisos(usuarioId, permisos),
    onSuccess: invalidar,
  });

  return {
    cuentas: data ?? [],
    loading: isPending,
    error: aMensaje(error),
    recargar: useCallback(async () => {
      await refetch();
    }, [refetch]),
    crearCuenta: useCallback(
      async (input: NuevaCuentaInput) => {
        await mutacionCrear.mutateAsync(input);
      },
      [mutacionCrear],
    ),
    actualizarPermisos: useCallback(
      async (usuarioId: string, permisos: Permiso[]) => {
        await mutacionPermisos.mutateAsync({ usuarioId, permisos });
      },
      [mutacionPermisos],
    ),
  };
}
