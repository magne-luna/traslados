/** Estados que reporta un canal al suscribirse (subconjunto de los de supabase-js). */
export type EstadoCanal = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';

/** Puerto mínimo del canal de tiempo real (design.md §D4). Existe solo para poder testear sin
 * sockets. El aviso de cambio NO expone el payload: el hook solo necesita saber qué tabla cambió. */
export interface CanalRealtime {
  escuchar(schema: string, tabla: string, onCambio: () => void): void;
  suscribir(onEstado: (estado: EstadoCanal) => void): void;
  cerrar(): void;
}

export type CrearCanal = () => CanalRealtime;
