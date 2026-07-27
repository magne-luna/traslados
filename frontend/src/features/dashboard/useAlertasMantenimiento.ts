import { useEffect, useState } from 'react';
import type { Vehiculo } from '../../shared/types/vehiculo';
import type { VehiculoRepository } from '../../shared/lib/vehiculos/VehiculoRepository';

export interface UseAlertasMantenimientoResult {
  vehiculos: Vehiculo[];
  cargando: boolean;
  error: string | null;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado.';
}

// tasks.md 5.4, design.md Decisión 7/9: lectura de solo lectura de VehiculoRepository.list()
// para la tarjeta de mantenimiento, con su propio estado de carga/error independiente. A
// propósito NO expone `crear` ni `actualizar` (ver useAlertasCud) — solo lectura estructural.
export function useAlertasMantenimiento(repository: VehiculoRepository): UseAlertasMantenimientoResult {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const data = await repository.list();
        if (cancelado) return;
        setVehiculos(data);
      } catch (err) {
        if (cancelado) return;
        setError(toErrorMessage(err));
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    void cargar();

    return () => {
      cancelado = true;
    };
  }, [repository]);

  return { vehiculos, cargando, error };
}
