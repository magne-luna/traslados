import { useAuth } from '../../auth/useAuth';
import type { CrearCanal } from './canal';
import { useSincronizacionRealtime } from './useSincronizacionRealtime';

interface Props {
  /** Constante de módulo (identidad estable): ver App.tsx. */
  crearCanal: CrearCanal;
}

/** Mantiene viva la escucha de Realtime mientras haya sesión (design.md §D7). No renderiza nada.
 * Kill switch: quitarlo de App.tsx (§D9). */
export function SincronizacionRealtime({ crearCanal }: Props) {
  const auth = useAuth();
  useSincronizacionRealtime({
    crearCanal,
    habilitado: auth.status === 'authenticated',
    usuarioId: auth.status === 'authenticated' ? auth.usuario.id : null,
  });
  return null;
}
