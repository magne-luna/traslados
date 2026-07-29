import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePermiso } from './usePermiso';
import { AuthProvider } from './AuthContext';
import { createMockAuthRepository, type MockAuthRepositoryOptions } from '../lib/auth/mockAuthRepository';
import type { Usuario } from '../types/usuario';

// Hook faltante señalado en el gap de batches anteriores (permisos-modulo-frontend spec,
// Requirement "Hook de permisos para consumidores"): cualquier pantalla puede consultar
// usePermiso(modulo, nivelMinimo) sin reimplementar la lógica de niveles de tienePermiso.
// Se implementa acá (sección 8) porque es el primer consumidor real (AppShell) y porque
// necesita useAuth(), ya disponible desde el batch 1.

const EMPLEADO: Usuario = { id: 'u2', nombre: 'Juan', apellido: 'Pérez', email: 'juan@x.com', rol: 'empleado' };

function wrapperCon(opciones: MockAuthRepositoryOptions) {
  const repository = createMockAuthRepository(opciones);
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AuthProvider repository={repository}>{children}</AuthProvider>;
  };
}

describe('usePermiso', () => {
  it('RED/GREEN: devuelve falso cuando el nivel de la cuenta es insuficiente (spec: usePermiso("pacientes","write") con solo "read")', async () => {
    const { result } = renderHook(() => usePermiso('pacientes', 'write'), {
      wrapper: wrapperCon({ usuario: EMPLEADO, permisos: { pacientes: 'read' } }),
    });

    await waitFor(() => expect(result.current).toBe(false));
  });

  it('TRIANGULATE: devuelve verdadero cuando el nivel de la cuenta alcanza el mínimo pedido', async () => {
    const { result } = renderHook(() => usePermiso('pacientes', 'read'), {
      wrapper: wrapperCon({ usuario: EMPLEADO, permisos: { pacientes: 'write' } }),
    });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('TRIANGULATE: una cuenta admin obtiene verdadero aunque la matriz esté vacía (short-circuit)', async () => {
    const admin: Usuario = { id: 'u1', nombre: 'Andrea', apellido: 'Pastor', email: 'andrea@x.com', rol: 'admin' };
    const { result } = renderHook(() => usePermiso('facturacion', 'admin'), {
      wrapper: wrapperCon({ usuario: admin, permisos: {} }),
    });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('TRIANGULATE: devuelve falso mientras la sesión no está autenticada (loading/anonymous), sin lanzar', () => {
    const { result } = renderHook(() => usePermiso('pacientes', 'read'), {
      wrapper: wrapperCon({ status: 'anonymous' }),
    });

    expect(result.current).toBe(false);
  });
});
