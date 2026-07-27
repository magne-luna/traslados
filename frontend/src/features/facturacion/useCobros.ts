import { useCallback, useEffect, useState } from 'react';
import type { Cobro, NuevoCobro } from '../../shared/types/factura';
import type { CobroRepository } from '../../shared/lib/facturacion/CobroRepository';

export interface UseCobrosResult {
  cobros: Cobro[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  registrar: (data: NuevoCobro) => Promise<Cobro>;
  eliminar: (id: string) => Promise<void>;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado.';
}

// Wiring de estado entre CobrosPanel y un CobroRepository, acotado a una factura puntual
// (tasks.md 5.2, design.md Decisión 1: Cobro tiene repository propio, con su propio ciclo de
// vida). Recarga tras cada alta/baja — mismo patrón que useFacturas/usePresupuestos.
export function useCobros(repository: CobroRepository, facturaId: string): UseCobrosResult {
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await repository.listByFactura(facturaId);
      setCobros(data);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [repository, facturaId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const registrar = useCallback(
    async (data: NuevoCobro) => {
      try {
        const creado = await repository.create(data);
        await cargar();
        return creado;
      } catch (err) {
        setError(toErrorMessage(err));
        throw err;
      }
    },
    [repository, cargar],
  );

  const eliminar = useCallback(
    async (id: string) => {
      try {
        await repository.remove(id);
        await cargar();
      } catch (err) {
        setError(toErrorMessage(err));
        throw err;
      }
    },
    [repository, cargar],
  );

  return { cobros, loading, error, recargar: cargar, registrar, eliminar };
}
