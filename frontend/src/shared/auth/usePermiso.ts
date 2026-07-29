import { useAuth } from './useAuth';
import { tienePermiso } from '../lib/auth/permisos';
import type { Modulo, NivelAcceso } from '../types/usuario';

// Hook público para consumidores (permisos-modulo-frontend spec, Requirement "Hook de permisos
// para consumidores"): expone la misma lógica pura de tienePermiso sin que cada pantalla tenga
// que leer estado.usuario.rol/estado.permisos y armar la llamada a mano. Devuelve un único
// booleano (react-best-practices: un hook con >2 valores devuelve un objeto; acá alcanza con un
// valor primitivo).
//
// Fuera de una sesión autenticada (loading/anonymous) devuelve `false` en vez de lanzar: a
// diferencia de useAuth() (que exige estar dentro de un AuthProvider y sí lanza si no lo está),
// usePermiso está pensado para consumirse en pantallas que YA están detrás de RequireAuth, donde
// el estado 'authenticated' está garantizado en la práctica; el chequeo defensivo evita que un
// consumidor mal ubicado explote con un permiso indebidamente concedido.
export function usePermiso(modulo: Modulo, nivelMinimo: NivelAcceso): boolean {
  const estado = useAuth();

  if (estado.status !== 'authenticated') return false;

  return tienePermiso(estado.usuario.rol, estado.permisos, modulo, nivelMinimo);
}
