import type { MapaPermisos, Permiso, Rol } from '../../types/usuario';

// Patrón repositorio (design.md D1/D8/D9), igual que AuthRepository/ObraSocialRepository:
// CuentaRepository (interfaz) + SupabaseCuentaRepository (real — la ÚNICA implementación de
// producción, porque el backend de C-02 ya está desplegado, ver App.tsx-equivalente en
// CuentasRoute.tsx) + mockCuentaRepository (solo tests). Las lecturas van directo contra la RLS
// (D8: `usuarios.usuarios` + `modulos.permisos` × `modulos.modulos`); TODA escritura pasa por las
// Edge Functions `create-user`/`update-permisos` (D7) — el repositorio NUNCA hace
// insert/update/delete sobre `modulos.permisos` ni `usuarios.usuarios` (tasks.md 6.6,
// security-review), aunque la policy "admin FOR ALL" se lo permitiría a una cuenta admin.

export interface Cuenta {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: Rol;
  permisos: MapaPermisos;
}

export interface NuevaCuentaInput {
  email: string;
  /** Obligatoria en `create-user` (>= 8 caracteres, validado también en el cliente por
   * `validateCuentaForm`). */
  password: string;
  nombre: string;
  apellido: string;
  /** Permisos iniciales opcionales (tasks.md 6.5): mismo contrato que `actualizarPermisos` — el
   * conjunto completo deseado, no un diff. */
  permisos?: Permiso[];
}

// Mensajes de error de las Edge Functions (design.md D7) — exportados para que la UI (CuentasPage,
// tasks.md 7.7) pueda distinguir el caso 401 (cerrar sesión) del resto sin duplicar los literales.
export const MENSAJE_SESION_EXPIRADA = 'Tu sesión expiró. Volvé a ingresar.';
export const MENSAJE_SIN_PRIVILEGIOS = 'Solo la administradora puede realizar esta acción.';
export const MENSAJE_CUENTA_INEXISTENTE = 'La cuenta ya no existe.';

export interface CuentaRepository {
  listarCuentas(): Promise<Cuenta[]>;
  /** Invoca `create-user`. Rechaza con un Error cuyo `.message` es apto para mostrar en la UI
   * (ver los mensajes de arriba para 401/403/404; el 400 propaga el `error` del body tal cual). */
  crearCuenta(input: NuevaCuentaInput): Promise<void>;
  /** Invoca `update-permisos` con el conjunto COMPLETO de permisos deseado (reemplazo total,
   * tasks.md 6.5) — un array vacío revoca todos los accesos. Nunca se envía un diff contra el
   * estado anterior. */
  actualizarPermisos(usuarioId: string, permisos: Permiso[]): Promise<void>;
}
