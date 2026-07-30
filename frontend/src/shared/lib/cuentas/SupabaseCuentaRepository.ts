import { supabase } from '../supabaseClient';
import type { MapaPermisos, Modulo, NivelAcceso, Permiso, Rol } from '../../types/usuario';
import {
  MENSAJE_CUENTA_INEXISTENTE,
  MENSAJE_SESION_EXPIRADA,
  MENSAJE_SIN_PRIVILEGIOS,
  type Cuenta,
  type CuentaRepository,
  type NuevaCuentaInput,
} from './CuentaRepository';

// Implementación real de CuentaRepository (design.md D7/D8): lecturas directas por RLS
// (`usuarios.usuarios` + `modulos.permisos` × `modulos.modulos`, D8) y escrituras EXCLUSIVAMENTE
// vía las Edge Functions `create-user`/`update-permisos` (D7) — nunca insert/update/delete directo
// sobre esas tablas, aunque la policy "admin FOR ALL" de `modulos.permisos` se lo permitiría a una
// cuenta admin (tasks.md 6.6, security-review; verificado también por un test de código fuente).
// Igual que SupabaseAuthRepository: los datos que llegan de supabase-js sin un generic de esquema
// son `unknown` en la práctica — se narrowean con type guards explícitos, nunca `any`.

function isRol(value: unknown): value is Rol {
  return value === 'admin' || value === 'empleado';
}

interface UsuarioRow {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: Rol;
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
  return (
    value === 'pacientes' ||
    value === 'hojas_de_ruta' ||
    value === 'obra_social' ||
    value === 'facturacion' ||
    value === 'presupuestos' ||
    value === 'conductores' ||
    value === 'vehiculos'
  );
}

/** Fila cruda de `modulos.permisos` × `modulos.modulos` (embed anidado de PostgREST), con el
 * `usuario_id` que en SupabaseAuthRepository no hace falta (ahí siempre es la propia cuenta) pero
 * acá sí, porque el listado trae los permisos de todas las cuentas de una sola consulta. Devuelve
 * `null` si la fila no tiene la forma esperada — se descarta en silencio en vez de reventar todo
 * el listado por una fila rara. */
function parsePermisoRow(value: unknown): { usuarioId: string; nivelAcceso: NivelAcceso; modulo: Modulo } | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.usuario_id !== 'string') return null;
  if (!isNivelAcceso(v.nivel_acceso)) return null;

  const modulosEmbed = v.modulos;
  if (typeof modulosEmbed !== 'object' || modulosEmbed === null) return null;
  const tipoModulo = (modulosEmbed as Record<string, unknown>).tipo_modulo;
  if (!isModulo(tipoModulo)) return null;

  return { usuarioId: v.usuario_id, nivelAcceso: v.nivel_acceso, modulo: tipoModulo };
}

function toPermisoRow(permiso: Permiso): { modulo: Modulo; nivel_acceso: NivelAcceso } {
  return { modulo: permiso.modulo, nivel_acceso: permiso.nivelAcceso };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Traduce el error de `supabase.functions.invoke` a un Error con `.message` apto para UI, según
 * el mapeo de status de design.md D7. El 400 propaga el `error` del body tal cual (regla de
 * api-design: no inventar formas de error nuevas). Un error sin `.context` (ej. de red) cae a su
 * propio mensaje si es un Error, o a uno genérico si no lo es. */
async function mapearErrorEdgeFunction(error: unknown): Promise<Error> {
  if (isRecord(error) && 'context' in error) {
    const context = error.context;
    if (context instanceof Response) {
      if (context.status === 401) return new Error(MENSAJE_SESION_EXPIRADA);
      if (context.status === 403) return new Error(MENSAJE_SIN_PRIVILEGIOS);
      if (context.status === 404) return new Error(MENSAJE_CUENTA_INEXISTENTE);
      if (context.status === 400) {
        try {
          const body: unknown = await context.json();
          if (isRecord(body) && typeof body.error === 'string') {
            return new Error(body.error);
          }
        } catch {
          // Body no parseable como JSON: cae al mensaje genérico de abajo.
        }
      }
    }
  }
  return error instanceof Error ? error : new Error('No se pudo completar la operación.');
}

export const supabaseCuentaRepository: CuentaRepository = {
  async listarCuentas() {
    const { data: usuariosData, error: errorUsuarios } = await supabase
      .schema('usuarios')
      .from('usuarios')
      .select('id, email, nombre, apellido, rol');

    if (errorUsuarios) {
      throw new Error('No se pudo cargar el listado de cuentas.');
    }

    const { data: permisosData, error: errorPermisos } = await supabase
      .schema('modulos')
      .from('permisos')
      .select('usuario_id, nivel_acceso, modulos(tipo_modulo)');

    if (errorPermisos) {
      throw new Error('No se pudieron cargar los permisos de las cuentas.');
    }

    const permisosPorUsuario = new Map<string, MapaPermisos>();
    for (const rawRow of (permisosData as unknown[] | null) ?? []) {
      const row = parsePermisoRow(rawRow);
      if (!row) continue;
      const mapa = permisosPorUsuario.get(row.usuarioId) ?? {};
      mapa[row.modulo] = row.nivelAcceso;
      permisosPorUsuario.set(row.usuarioId, mapa);
    }

    const cuentas: Cuenta[] = [];
    for (const rawRow of (usuariosData as unknown[] | null) ?? []) {
      if (!isUsuarioRow(rawRow)) continue;
      cuentas.push({
        id: rawRow.id,
        email: rawRow.email,
        nombre: rawRow.nombre,
        apellido: rawRow.apellido,
        rol: rawRow.rol,
        permisos: permisosPorUsuario.get(rawRow.id) ?? {},
      });
    }
    return cuentas;
  },

  async crearCuenta(input: NuevaCuentaInput) {
    const { error } = await supabase.functions.invoke('create-user', {
      body: {
        email: input.email,
        password: input.password,
        nombre: input.nombre,
        apellido: input.apellido,
        permisos: (input.permisos ?? []).map(toPermisoRow),
      },
    });
    if (error) throw await mapearErrorEdgeFunction(error);
  },

  async actualizarPermisos(usuarioId: string, permisos: Permiso[]) {
    const { error } = await supabase.functions.invoke('update-permisos', {
      body: { usuario_id: usuarioId, permisos: permisos.map(toPermisoRow) },
    });
    if (error) throw await mapearErrorEdgeFunction(error);
  },
};
