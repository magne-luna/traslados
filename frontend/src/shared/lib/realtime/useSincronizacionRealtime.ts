import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CrearCanal, EstadoCanal } from './canal';
import { dominiosDeTabla, TABLAS_REALTIME, type ClaveDominio } from './tablas';

/** Ventana de coalescencia (design.md §D5): una ficha de paciente toca ~6 tablas y debe producir
 * una sola relectura. */
export const INTERVALO_COALESCENCIA_MS = 300;

interface Opciones {
  /** Debe ser estable entre renders (constante de módulo): cambiarla re-suscribe. */
  crearCanal: CrearCanal;
  habilitado: boolean;
  usuarioId: string | null;
}

/** Escucha cambios de Postgres y los traduce a `invalidateQueries`. Nunca lee ni cachea el payload
 * del evento (design.md §D1): lo que se muestra sale siempre del SELECT normal, con RLS. */
export function useSincronizacionRealtime({ crearCanal, habilitado, usuarioId }: Opciones): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!habilitado) return;

    const canal = crearCanal();
    const pendientes = new Map<string, ClaveDominio>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cerrado = false;
    let huboCorte = false;

    function vaciar() {
      timer = null;
      for (const queryKey of pendientes.values()) void queryClient.invalidateQueries({ queryKey });
      pendientes.clear();
    }

    for (const clave of Object.keys(TABLAS_REALTIME)) {
      const [schema = '', tabla = ''] = clave.split('.');
      canal.escuchar(schema, tabla, () => {
        if (cerrado) return;
        for (const queryKey of dominiosDeTabla(schema, tabla)) pendientes.set(queryKey[0], queryKey);
        timer ??= setTimeout(vaciar, INTERVALO_COALESCENCIA_MS);
      });
    }

    canal.suscribir((estado: EstadoCanal) => {
      if (cerrado) return;
      if (estado !== 'SUBSCRIBED') {
        huboCorte = true;
      } else if (huboCorte) {
        // Sin replay: lo ocurrido durante el corte solo se recupera releyendo todo (§D6).
        huboCorte = false;
        void queryClient.invalidateQueries();
      }
    });

    return () => {
      cerrado = true;
      if (timer !== null) clearTimeout(timer);
      pendientes.clear();
      canal.cerrar();
    };
  }, [crearCanal, habilitado, usuarioId, queryClient]);
}
