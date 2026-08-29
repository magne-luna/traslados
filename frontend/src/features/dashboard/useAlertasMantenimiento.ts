import { useQuery } from '@tanstack/react-query';
import type { Vehiculo } from '../../shared/types/vehiculo';
import type { VehiculoRepository } from '../../shared/lib/vehiculos/VehiculoRepository';
import { aMensaje } from '../../shared/lib/query/aMensaje';
import { claves } from '../../shared/lib/query/claves';
import { FRESCURA } from '../../shared/lib/query/frescura';

export interface UseAlertasMantenimientoResult {
  vehiculos: Vehiculo[];
  cargando: boolean;
  error: string | null;
}

// tasks.md 5.4, design.md Decisión 7/9: lectura para la tarjeta de mantenimiento.
//
// migracion-react-query, Fase 5. **`UseAlertasMantenimientoResult` NO cambió** (sigue exponiendo `cargando`, no
// `loading`). Lo que cambia es de dónde sale el dato: usa **la misma clave** que
// `useVehiculos` (`claves.vehiculos.lista()`), así que si la usuaria ya pasó por ese módulo el
// dashboard NO vuelve a pedir el padrón — y viceversa. `/` es la ruta índice y se la visita
// constantemente: ese round-trip repetido era uno de los tres desperdicios que motivaron el change.
//
// Sigue siendo de SOLO LECTURA: no expone `crear` ni `actualizar`, para que sea estructuralmente
// imposible que el dashboard escriba (design.md Non-Goals del change de dashboard).
export function useAlertasMantenimiento(repository: VehiculoRepository): UseAlertasMantenimientoResult {
  const { data, isPending, error } = useQuery({
    queryKey: claves.vehiculos.lista(),
    queryFn: () => repository.list(),
    staleTime: FRESCURA.referencia,
  });

  return { vehiculos: data ?? [], cargando: isPending, error: aMensaje(error) };
}
