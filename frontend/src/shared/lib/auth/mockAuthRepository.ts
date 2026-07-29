import type { MapaPermisos, Usuario } from '../../types/usuario';
import type { AuthRepository, SesionUsuario } from './AuthRepository';

// Mock configurable de AuthRepository (design.md D1/D11): usado por renderConSesion() para que
// los ~190 tests de dominio existentes sigan pasando sin tocarlos (default: admin con todos los
// permisos, que es el comportamiento que hoy asumen implícitamente) y por los tests nuevos de
// auth/permisos, que declaran explícitamente su escenario (usuario/permisos/status).

export const CREDENCIALES_MOCK_PASSWORD = 'password-correcta-mock';

export const USUARIO_ADMIN_MOCK: Usuario = {
  id: 'mock-admin-1',
  nombre: 'Andrea',
  apellido: 'Pastor',
  email: 'andrea@traslados.mock',
  rol: 'admin',
};

export const PERMISOS_TOTALES_MOCK: MapaPermisos = {
  pacientes: 'admin',
  obra_social: 'admin',
  facturacion: 'admin',
  conductores: 'admin',
};

export interface MockAuthRepositoryOptions {
  usuario?: Usuario;
  permisos?: MapaPermisos;
  /** Estado con el que arranca el repositorio. Default: `'authenticated'` (preserva el
   * comportamiento que los tests existentes asumen hoy). */
  status?: 'authenticated' | 'anonymous';
}

export function createMockAuthRepository(options: MockAuthRepositoryOptions = {}): AuthRepository {
  const sesionConfigurada: SesionUsuario = {
    usuario: options.usuario ?? USUARIO_ADMIN_MOCK,
    permisos: options.permisos ?? PERMISOS_TOTALES_MOCK,
  };

  let sesionActual: SesionUsuario | null = options.status === 'anonymous' ? null : sesionConfigurada;
  const listeners = new Set<(sesion: SesionUsuario | null) => void>();

  function notificar(sesion: SesionUsuario | null): void {
    for (const listener of listeners) listener(sesion);
  }

  return {
    async getSesionActual() {
      return sesionActual;
    },

    async signIn(email, password) {
      if (email !== sesionConfigurada.usuario.email || password !== CREDENCIALES_MOCK_PASSWORD) {
        throw new Error('Credenciales inválidas.');
      }
      sesionActual = sesionConfigurada;
      notificar(sesionActual);
      return sesionActual;
    },

    async signOut() {
      sesionActual = null;
      notificar(null);
    },

    onCambioDeSesion(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
}

/** Instancia lista para usar cuando no hace falta configurar nada (admin con todos los
 * permisos). La mayoría de los tests debería preferir `createMockAuthRepository(...)` para
 * declarar su escenario explícitamente (ver design.md D11). */
export const mockAuthRepository: AuthRepository = createMockAuthRepository();
