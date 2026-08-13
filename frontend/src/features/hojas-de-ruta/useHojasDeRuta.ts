import { useCallback, useEffect, useState } from 'react';
import type { ActualizacionHojaDeRuta, HojaDeRuta, NuevaHojaDeRuta } from '../../shared/types/hojaDeRuta';
import type { HojaDeRutaRepository } from '../../shared/lib/hojas-de-ruta/HojaDeRutaRepository';

export interface UseHojasDeRutaResult {
  hojaDeRuta: HojaDeRuta | null;
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

// Wiring de estado entre HojaDeRutaPage y un HojaDeRutaRepository (mock hoy, Supabase el día de
// mañana — ver HojaDeRutaRepository.ts). Mismo patrón que useVehiculos (tasks.md 4.1): la carga
// inicial la dispara un efecto sobre un load imperativo (`cargar`), y ese mismo load imperativo
// se reutiliza tras cada mutación.
//
// paginacion-listados Fase 1 (design.md §D7, tasks.md 8.2): resuelve el día seleccionado con
// `getByFecha(fecha)` en vez de traer `list()` (la historia ENTERA de hojas de ruta, con el embed
// de tres niveles hoja→recorrido→historial_recorridos, que crece con cada día operado) para
// quedarse con uno solo vía `.find()`. La pantalla nunca mostró una lista — solo el día elegido —
// así que la lectura correcta es pedir ese día, no traer todo y filtrar en memoria. NO se
// reemplaza esto por `list()` "por comodidad": es la ganancia de payload más cara y más barata de
// todo el change (D7 "Por qué"), y `getByFecha` ya existe en el repository, no hay nada nuevo que
// escribir en la capa de datos.
export function useHojasDeRuta(repository: HojaDeRutaRepository, fecha: string): UseHojasDeRutaResult {
  const [hojaDeRuta, setHojaDeRuta] = useState<HojaDeRuta | null>(null);
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
  // ⚠️ Este comportamiento debe preservarse al migrar de `list()` a `getByFecha()` (design.md §D7
  // "Cuidado en el apply") — cambiar la fuente de datos sin preservar `{ silencioso: true }`
  // reintroduce el bug ya arreglado una vez. Cubierto por test de regresión explícito
  // (useHojasDeRuta.test.ts, tasks.md 8.6).
  const cargar = useCallback(
    async (opts: { silencioso?: boolean } = {}) => {
      if (!opts.silencioso) setLoading(true);
      setError(null);
      try {
        const data = await repository.getByFecha(fecha);
        setHojaDeRuta(data);
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        if (!opts.silencioso) setLoading(false);
      }
    },
    [repository, fecha],
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

  return { hojaDeRuta, loading, error, recargar: cargar, crear, actualizar };
}
