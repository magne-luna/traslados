import { supabase } from '../supabaseClient';
import type { MapaPermisos, Modulo, NivelAcceso, Rol } from '../../types/usuario';
import type { AuthRepository, SesionUsuario } from './AuthRepository';

// Implementación real de AuthRepository (design.md D1/D3/D9): envuelve supabase.auth para la
// sesión y lee usuarios.usuarios / modulos.permisos con el cliente anon (protegido por RLS) —
// NUNCA user_metadata/raw_user_meta_data del JWT (D3: son editables por el propio usuario;
// usarlos para autorización sería una escalada de privilegios trivial). Los datos que llegan de
// supabase-js sin un generic de esquema son `unknown` en la práctica: se narrowean con type
// guards explícitos en vez de castear con `any` (regla dura del proyecto).

const MENSAJE_CUENTA_NO_HABILITADA =
  'Tu cuenta no está habilitada. Contactá a la administradora para que te dé de alta.';

interface UsuarioRow {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: Rol;
}

function isRol(value: unknown): value is Rol {
  return value === 'admin' || value === 'empleado';
}

function isUsuarioRow(value: unknown): value is UsuarioRow {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.email === 'string' &&
    typeof v.nombre === 'string' &&
    typeof v.apellido === 'string' &&
    isRol(v.rol)
  );
}

function isNivelAcceso(value: unknown): value is NivelAcceso {
  return value === 'read' || value === 'write' || value === 'admin';
}

function isModulo(value: unknown): value is Modulo {
  return value === 'pacientes' || value === 'obra_social' || value === 'facturacion' || value === 'conductores';
}

/** Fila cruda de `modulos.permisos` × `modulos.modulos` (embed anidado de PostgREST). Devuelve
 * `null` si la fila no tiene la forma esperada o el módulo embebido no es uno de los 4 válidos —
 * se descarta en silencio en vez de reventar toda la carga de permisos por una fila rara. */
function parsePermisoRow(value: unknown): { nivelAcceso: NivelAcceso; modulo: Modulo } | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (!isNivelAcceso(v.nivel_acceso)) return null;

  const modulosEmbed = v.modulos;
  if (typeof modulosEmbed !== 'object' || modulosEmbed === null) return null;

  const tipoModulo = (modulosEmbed as Record<string, unknown>).tipo_modulo;
  if (!isModulo(tipoModulo)) return null;

  return { nivelAcceso: v.nivel_acceso, modulo: tipoModulo };
}

/** Lee usuarios.usuarios + modulos.permisos para un userId de Supabase Auth. Devuelve `null`
 * cuando no hay fila en usuarios.usuarios — sesión de Auth "huérfana" (tasks.md 4.7): el
 * trigger handle_new_user() de C-02 siempre crea la fila al alta, así que esto solo puede pasar
 * por una desincronización manual (ej. borrado directo en la tabla). */
async function cargarSesion(userId: string): Promise<SesionUsuario | null> {
  const { data: perfilData, error: errorPerfil } = await supabase
    .schema('usuarios')
    .from('usuarios')
    .select('id, email, nombre, apellido, rol')
    .eq('id', userId)
    .maybeSingle();

  if (errorPerfil || !isUsuarioRow(perfilData)) {
    return null;
  }

  const { data: permisosData, error: errorPermisos } = await supabase
    .schema('modulos')
    .from('permisos')
    .select('nivel_acceso, modulos(tipo_modulo)')
    .eq('usuario_id', userId);

  if (errorPermisos) {
    throw new Error('No se pudieron cargar los permisos de la cuenta.');
  }

  const permisos: MapaPermisos = {};
  for (const rawRow of (permisosData as unknown[] | null) ?? []) {
    const row = parsePermisoRow(rawRow);
    if (row) permisos[row.modulo] = row.nivelAcceso;
  }

  return {
    usuario: {
      id: perfilData.id,
      email: perfilData.email,
      nombre: perfilData.nombre,
      apellido: perfilData.apellido,
      rol: perfilData.rol,
    },
    permisos,
  };
}

export const supabaseAuthRepository: AuthRepository = {
  async getSesionActual() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return null;

    const sesion = await cargarSesion(session.user.id);
    if (!sesion) {
      // tasks.md 4.7: sesión de Auth válida pero sin perfil habilitado — se cierra acá para no
      // dejar al usuario en un estado "autenticado" que ninguna pantalla puede resolver.
      await supabase.auth.signOut();
      return null;
    }
    return sesion;
  },

  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      throw new Error(error?.message ?? 'No se pudo iniciar sesión.');
    }

    const sesion = await cargarSesion(data.user.id);
    if (!sesion) {
      await supabase.auth.signOut();
      throw new Error(MENSAJE_CUENTA_NO_HABILITADA);
    }
    return sesion;
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  onCambioDeSesion(callback) {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        callback(null);
        return;
      }
      cargarSesion(session.user.id).then(callback);
    });

    return () => subscription.unsubscribe();
  },
};
