import { useCallback, useEffect, useState } from 'react';
import type { ActualizacionHojaDeRuta, HojaDeRuta, NuevaHojaDeRuta } from '../../shared/types/hojaDeRuta';
import type { HojaDeRutaRepository } from '../../shared/lib/hojas-de-ruta/HojaDeRutaRepository';

export interface UseHojasDeRutaResult {
  hojasDeRuta: HojaDeRuta[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  crear: (data: NuevaHojaDeRuta) => Promise<HojaDeRuta>;
  actualizar: (id: string, data: ActualizacionHojaDeRuta) => Promise<HojaDeRuta>;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado.';
}

// Wiring de estado entre las pantallas de Hojas de Ruta y un HojaDeRutaRepository (mock hoy,
// Supabase el día de mañana — ver HojaDeRutaRepository.ts). Mismo patrón que useVehiculos
// (tasks.md 4.1): la carga inicial la dispara un efecto sobre un load imperativo (`cargar`), y
// ese mismo load imperativo se reutiliza tras cada mutación.
export function useHojasDeRuta(repository: HojaDeRutaRepository): UseHojasDeRutaResult {
  const [hojasDeRuta, setHojasDeRuta] = useState<HojaDeRuta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // `silencioso` (fix "Sugerir orden no hace nada, se recarga la página", 2026-08-11): el
  // refetch que sigue a crear()/actualizar() reusaba este mismo `cargar()`, tildando `loading`
  // también ahí — HojaDeRutaPage reemplaza toda la vista de armado por "Cargando…" mientras
  // `loading` es true, así que cada mutación (Sugerir orden, subir/bajar, quitar parada, crear
  // recorrido) desmontaba todos los RecorridoCard, incluido el que estaba en modo "Editar", y los
  // volvía a montar en modo lectura. El cambio sí se guardaba — solo que la pantalla te sacaba de
  // edición antes de que lo vieras. La carga inicial (efecto de abajo) y `recargar()` (llamado
  // manual del consumidor) siguen mostrando el loading de pantalla completa como corresponde.
  const cargar = useCallback(
    async (opts: { silencioso?: boolean } = {}) => {
      if (!opts.silencioso) setLoading(true);
      setError(null);
      try {
        const data = await repository.list();
        setHojasDeRuta(data);
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        if (!opts.silencioso) setLoading(false);
      }
    },
    [repository],
  );

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const crear = useCallback(
    async (data: NuevaHojaDeRuta) => {
      try {
        const creada = await repository.create(data);
        await cargar({ silencioso: true });
        return creada;
      } catch (err) {
        setError(toErrorMessage(err));
        throw err;
      }
    },
    [repository, cargar],
  );

  const actualizar = useCallback(
    async (id: string, data: ActualizacionHojaDeRuta) => {
      try {
        const actualizada = await repository.update(id, data);
        await cargar({ silencioso: true });
        return actualizada;
      } catch (err) {
        setError(toErrorMessage(err));
        throw err;
      }
    },
    [repository, cargar],
  );

  return { hojasDeRuta, loading, error, recargar: cargar, crear, actualizar };
}
