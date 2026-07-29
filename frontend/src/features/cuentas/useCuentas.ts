import { useCallback, useEffect, useState } from 'react';
import type { Cuenta, CuentaRepository, NuevaCuentaInput } from '../../shared/lib/cuentas/CuentaRepository';
import type { Permiso } from '../../shared/types/usuario';

export interface UseCuentasResult {
  cuentas: Cuenta[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  crearCuenta: (input: NuevaCuentaInput) => Promise<void>;
  actualizarPermisos: (usuarioId: string, permisos: Permiso[]) => Promise<void>;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado.';
}

// Wiring de estado entre las pantallas de cuentas y un CuentaRepository (mismo patrón que
// useObrasSociales — tasks.md 7.7): la carga inicial la dispara un efecto sobre un load
// imperativo (`cargar`), reutilizado tras cada mutación exitosa. A diferencia de
// useObrasSociales, si `crearCuenta`/`actualizarPermisos` rechazan NO se recarga el listado — el
// estado remoto no cambió, y CuentasPage/CuentaDetail necesitan el error crudo para mostrarlo en
// el formulario/matriz (D7: 401/403/404/400 con mensajes distintos), no solo un string genérico
// de "error de carga".
export function useCuentas(repository: CuentaRepository): UseCuentasResult {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await repository.listarCuentas();
      setCuentas(data);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const crearCuenta = useCallback(
    async (input: NuevaCuentaInput) => {
      await repository.crearCuenta(input);
      await cargar();
    },
    [repository, cargar],
  );

  const actualizarPermisos = useCallback(
    async (usuarioId: string, permisos: Permiso[]) => {
      await repository.actualizarPermisos(usuarioId, permisos);
      await cargar();
    },
    [repository, cargar],
  );

  return { cuentas, loading, error, recargar: cargar, crearCuenta, actualizarPermisos };
}
