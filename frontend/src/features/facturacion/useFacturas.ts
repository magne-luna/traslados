import { useCallback, useEffect, useState } from 'react';
import type { ActualizacionFactura, Factura, NuevaFactura } from '../../shared/types/factura';
import type { FacturaRepository } from '../../shared/lib/facturacion/FacturaRepository';

export interface UseFacturasResult {
  facturas: Factura[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  crear: (data: NuevaFactura) => Promise<Factura>;
  actualizar: (id: string, data: ActualizacionFactura) => Promise<Factura>;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado.';
}

// Wiring de estado entre las pantallas de Facturación y un FacturaRepository (mock hoy, Supabase
// el día de mañana — ver FacturaRepository.ts). Mismo patrón que usePresupuestos/useAutorizaciones
// (tasks.md 5.1): carga inicial vía efecto sobre un load imperativo, reutilizado tras cada mutación.
export function useFacturas(repository: FacturaRepository): UseFacturasResult {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await repository.list();
      setFacturas(data);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const crear = useCallback(
    async (data: NuevaFactura) => {
      try {
        const creada = await repository.create(data);
        await cargar();
        return creada;
      } catch (err) {
        setError(toErrorMessage(err));
        throw err;
      }
    },
    [repository, cargar],
  );

  const actualizar = useCallback(
    async (id: string, data: ActualizacionFactura) => {
      try {
        const actualizada = await repository.update(id, data);
        await cargar();
        return actualizada;
      } catch (err) {
        setError(toErrorMessage(err));
        throw err;
      }
    },
    [repository, cargar],
  );

  return { facturas, loading, error, recargar: cargar, crear, actualizar };
}
