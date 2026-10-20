import type { SupabaseClient } from '@supabase/supabase-js';
import type { CanalRealtime, EstadoCanal } from './canal';

const NOMBRE_CANAL = 'sincronizacion-realtime';

function aEstadoCanal(status: string): EstadoCanal {
  return status === 'SUBSCRIBED' || status === 'TIMED_OUT' || status === 'CLOSED' ? status : 'CHANNEL_ERROR';
}

/** Adaptador fino del puerto `CanalRealtime` sobre supabase-js: un canal con un binding
 * `postgres_changes` por tabla. El cliente es el de anon key; nunca service role. */
export function crearCanalSupabase(cliente: Pick<SupabaseClient, 'channel' | 'removeChannel'>): CanalRealtime {
  const canal = cliente.channel(NOMBRE_CANAL);
  return {
    escuchar(schema, tabla, onCambio) {
      canal.on('postgres_changes', { event: '*', schema, table: tabla }, () => onCambio());
    },
    suscribir(onEstado) {
      canal.subscribe((status) => onEstado(aEstadoCanal(status)));
    },
    cerrar() {
      void cliente.removeChannel(canal);
    },
  };
}
