import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePuedeEscribirModulo } from './usePuedeEscribirModulo';
import { AuthProvider } from './AuthContext';
import { createMockAuthRepository, type MockAuthRepositoryOptions } from '../lib/auth/mockAuthRepository';
import type { Usuario } from '../types/usuario';

// recorridos-habituales-paciente (RF-110): gateo cruzado de módulo — una sección de Pacientes
// que escribe contra el permiso de Hojas de Ruta. Mismos casos que usePermiso.test.tsx, más el
// caso específico "sin AuthProvider no lanza" que es la razón de ser de este hook (a diferencia
// de usePermiso, que sí exige estar dentro de un AuthProvider vía useAuth()).

const EMPLEADO: Usuario = { id: 'u2', nombre: 'Juan', apellido: 'Pérez', email: 'juan@x.com', rol: 'empleado' };

function wrapperCon(opciones: MockAuthRepositoryOptions) {
  const repository = createMockAuthRepository(opciones);
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AuthProvider repository={repository}>{children}</AuthProvider>;
  };
}

describe('usePuedeEscribirModulo', () => {
  it('RED/GREEN: devuelve falso cuando la cuenta autenticada no tiene write sobre el módulo pedido', async () => {
    const { result } = renderHook(() => usePuedeEscribirModulo('hojas_de_ruta'), {
      wrapper: wrapperCon({ usuario: EMPLEADO, permisos: { hojas_de_ruta: 'read', pacientes: 'write' } }),
    });

    await waitFor(() => expect(result.current).toBe(false));
  });

  it('TRIANGULATE: devuelve verdadero cuando la cuenta autenticada tiene write sobre el módulo pedido', async () => {
    const { result } = renderHook(() => usePuedeEscribirModulo('hojas_de_ruta'), {
      wrapper: wrapperCon({ usuario: EMPLEADO, permisos: { hojas_de_ruta: 'write' } }),
    });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('TRIANGULATE: ignora el permiso de un módulo distinto (pacientes) al resolver hojas_de_ruta', async () => {
    const { result } = renderHook(() => usePuedeEscribirModulo('hojas_de_ruta'), {
      wrapper: wrapperCon({ usuario: EMPLEADO, permisos: { pacientes: 'write' } }),
    });

    await waitFor(() => expect(result.current).toBe(false));
  });

  it('TRIANGULATE: una cuenta admin obtiene verdadero aunque la matriz esté vacía (short-circuit)', async () => {
    const admin: Usuario = { id: 'u1', nombre: 'Andrea', apellido: 'Pastor', email: 'andrea@x.com', rol: 'admin' };
    const { result } = renderHook(() => usePuedeEscribirModulo('hojas_de_ruta'), {
      wrapper: wrapperCon({ usuario: admin, permisos: {} }),
    });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it('TRIANGULATE: devuelve verdadero mientras la sesión no está autenticada (loading/anonymous), sin lanzar', () => {
    const { result } = renderHook(() => usePuedeEscribirModulo('hojas_de_ruta'), {
      wrapper: wrapperCon({ status: 'anonymous' }),
    });

    expect(result.current).toBe(true);
  });

  it('CRÍTICO: fuera de un AuthProvider no lanza (a diferencia de usePermiso) y devuelve verdadero', () => {
    const { result } = renderHook(() => usePuedeEscribirModulo('hojas_de_ruta'));

    expect(result.current).toBe(true);
  });
});
