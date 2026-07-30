// Tipos de auth-frontend-real (design.md D2/D3, C-02-usuarios-permisos-auditoria/design.md
// §"usuarios.usuarios row shape"). El docx manda estructura: rol fijo (`admin`/`empleado`) +
// matriz de permisos por módulo para `empleado` — no hay roles flexibles, contradiciendo la
// narrativa original de knowledge-base/03_actores_y_roles.md (contradicción ya resuelta y
// documentada en C-02/design.md).

/** Rol fijo de la cuenta (`usuarios.usuarios.rol`). `admin` short-circuitea cualquier chequeo de
 * permiso por módulo (ver `tienePermiso` en `shared/lib/auth/permisos.ts`). */
export type Rol = 'admin' | 'empleado';

/** Los 7 módulos reales seedeados por el backend (`modulos.modulos.tipo_modulo`) — 1:1 con las 7
 * pantallas del sidebar que hoy requieren permiso (mapeo ruta→módulo en `app/routes.ts`).
 * Ampliado de 4 a 7 por `openspec/changes/permisos-modulos-granulares/` (2026-07-30): separa
 * `pacientes`→`hojas_de_ruta`, `facturacion`→`presupuestos`, `conductores`→`vehiculos`. ⚠️ NO es
 * un pedido del cliente — el docx nombra 4 módulos de ejemplo; discrepancia documentada en
 * `knowledge-base/04_modelo_de_datos.md` §Discrepancias y señalizada en la UI con
 * `AvisoModeloDatos` en `CuentaDetail.tsx`. */
export type Modulo =
  | 'pacientes'
  | 'hojas_de_ruta'
  | 'obra_social'
  | 'facturacion'
  | 'presupuestos'
  | 'conductores'
  | 'vehiculos';

/** Jerarquía `read < write < admin` (design.md D5), espejo de `modulos.permisos.nivel_acceso`. */
export type NivelAcceso = 'read' | 'write' | 'admin';

/** Perfil derivado de `usuarios.usuarios` — NUNCA de `user_metadata`/`raw_user_meta_data` del
 * JWT (design.md D3: son editables por el propio usuario, usarlos para autorización sería una
 * escalada de privilegios trivial). */
export interface Usuario {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: Rol;
}

/** Una fila de `modulos.permisos` × `modulos.modulos`, ya resuelta a los tipos del frontend. */
export interface Permiso {
  modulo: Modulo;
  nivelAcceso: NivelAcceso;
}

/** Mapa de permisos de la cuenta activa. Parcial: un módulo ausente significa "sin acceso" (no
 * hay fila en `modulos.permisos` para ese módulo), no se rellena con un nivel por defecto. */
export type MapaPermisos = Partial<Record<Modulo, NivelAcceso>>;

/** Máquina de estados de 3 valores (design.md D2) — deliberadamente NO `session | null`. La
 * restauración de sesión con Supabase es asíncrona; sin el estado `loading`, `RequireAuth` vería
 * el equivalente de "sin sesión" en el primer render y expulsaría a `/login` en cada refresh de
 * página. Un `isLoading` booleano separado permitiría estados imposibles
 * (`isLoading && authenticated`), que el modo estricto de TS debería impedir. */
export type EstadoAuth =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; usuario: Usuario; permisos: MapaPermisos };
