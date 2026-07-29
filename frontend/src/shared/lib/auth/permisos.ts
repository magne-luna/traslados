import type { MapaPermisos, Modulo, NivelAcceso, Rol } from '../../types/usuario';

// Espejo en el cliente de modulos.tiene_permiso() del servidor (design.md D5), con la misma
// regla de short-circuit: rol === 'admin' da acceso a cualquier módulo/nivel sin consultar la
// matriz. Jerarquía read < write < admin, así un nivel superior satisface cualquier requisito
// inferior.
//
// IMPORTANTE (security-review): esto es UX, no una frontera de seguridad. Solo evita mostrarle
// a la cuenta activa callejones sin salida (módulos que no puede abrir). La autorización
// efectiva la impone la RLS del servidor en cada tabla de dominio, vía modulos.tiene_permiso() —
// un cliente parcheado que sortee esta función no obtiene ni una fila más de las que la RLS
// permite.
const ORDEN_NIVEL: Record<NivelAcceso, number> = { read: 1, write: 2, admin: 3 };

export function tienePermiso(
  rol: Rol,
  permisos: MapaPermisos,
  modulo: Modulo,
  nivelMinimo: NivelAcceso,
): boolean {
  if (rol === 'admin') return true;

  const nivelActual = permisos[modulo];
  if (nivelActual === undefined) return false;

  return ORDEN_NIVEL[nivelActual] >= ORDEN_NIVEL[nivelMinimo];
}
