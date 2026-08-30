import { useQuery } from '@tanstack/react-query';
import type { HojaDeRuta } from '../../shared/types/hojaDeRuta';
import type { HojaDeRutaRepository } from '../../shared/lib/hojas-de-ruta/HojaDeRutaRepository';
import { aMensaje } from '../../shared/lib/query/aMensaje';
import { claves } from '../../shared/lib/query/claves';
import { FRESCURA } from '../../shared/lib/query/frescura';

export interface UseHojaDeRutaDelDiaResult {
  hojaDeRuta: HojaDeRuta | null;
  cargando: boolean;
  error: string | null;
}

// tasks.md 5.3, spec dashboard-recorridos-del-dia (Requirement "Estados del panel del día"):
// `getByFecha` resolviendo `null` es un estado propio ("no hay hoja de ruta cargada para hoy"),
// nunca se lo trata como error. React Query respeta eso: `null` es un valor resuelto, no un fallo.
//
// migracion-react-query, Fase 5. **`UseHojaDeRutaDelDiaResult` NO cambió.** Comparte clave con
// `useHojasDeRuta` (`claves.hojasDeRuta.deFecha`), así que el dashboard y la pantalla de armado ya
// no piden dos veces la hoja del mismo día. Frescura CERO: es la agenda operativa.
//
// Solo lectura: no expone `crear` ni `actualizar` (design.md Non-Goals del change de dashboard).
export function useHojaDeRutaDelDia(repository: HojaDeRutaRepository, fecha: string): UseHojaDeRutaDelDiaResult {
  const { data, isPending, error } = useQuery({
    queryKey: claves.hojasDeRuta.deFecha(fecha),
    queryFn: () => repository.getByFecha(fecha),
    staleTime: FRESCURA.transaccional,
  });

  return { hojaDeRuta: data ?? null, cargando: isPending, error: aMensaje(error) };
}
