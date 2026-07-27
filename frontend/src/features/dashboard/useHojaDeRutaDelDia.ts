import { useEffect, useState } from 'react';
import type { HojaDeRuta } from '../../shared/types/hojaDeRuta';
import type { HojaDeRutaRepository } from '../../shared/lib/hojas-de-ruta/HojaDeRutaRepository';

export interface UseHojaDeRutaDelDiaResult {
  hojaDeRuta: HojaDeRuta | null;
  cargando: boolean;
  error: string | null;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado.';
}

// tasks.md 5.3, spec dashboard-recorridos-del-dia (Requirement "Estados del panel del día"):
// `getByFecha` resolviendo `null` es un estado propio ("no hay hoja de ruta cargada para hoy"),
// nunca se lo trata como error.
export function useHojaDeRutaDelDia(repository: HojaDeRutaRepository, fecha: string): UseHojaDeRutaDelDiaResult {
  const [hojaDeRuta, setHojaDeRuta] = useState<HojaDeRuta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const data = await repository.getByFecha(fecha);
        if (cancelado) return;
        setHojaDeRuta(data);
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
  }, [repository, fecha]);

  return { hojaDeRuta, cargando, error };
}
