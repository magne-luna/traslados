import type { MapaPermisos, Usuario } from '../../types/usuario';

// Patrón repositorio (design.md D1), igual que ObraSocialRepository/PacienteRepository y sus
// hermanos: AuthRepository (interfaz) + SupabaseAuthRepository (real) + mockAuthRepository
// (tests), inyectado en AuthProvider por prop. Descartado llamar supabase.auth.* directo desde
// AuthContext: obligaría a mockear @supabase/supabase-js con vi.mock en cada test que monte el
// router — frágil y contrario a la convención del repo.

/** Sesión resuelta: usuario autenticado + su mapa de permisos por módulo, ya derivados de la
 * base de datos (nunca de user_metadata/JWT — ver design.md D3). */
export interface SesionUsuario {
  usuario: Usuario;
  permisos: MapaPermisos;
}

export interface AuthRepository {
  /** `null` si no hay sesión persistida (o si dejó de ser válida). No rechaza nunca. */
  getSesionActual(): Promise<SesionUsuario | null>;
  /** Rechaza (throw) con un Error cuyo `.message` es apto para mostrar en la UI, ante
   * credenciales inválidas o cuenta no habilitada (sin fila en `usuarios.usuarios`). */
  signIn(email: string, password: string): Promise<SesionUsuario>;
  signOut(): Promise<void>;
  /** Se dispara ante cambios de sesión externos (refresh de token, logout en otra pestaña,
   * expiración). Devuelve una función de desuscripción — el caller MUST invocarla al
   * desmontarse, para no dejar listeners colgados (tasks.md 4.6). */
  onCambioDeSesion(callback: (sesion: SesionUsuario | null) => void): () => void;
}
