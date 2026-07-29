import { describe, expect, it, vi } from 'vitest';
import { createMockAuthRepository } from './mockAuthRepository';

// design.md D11: mockAuthRepository configurable con usuario/permisos/estado inicial, usado por
// renderConSesion() (tasks.md 5.1) para que los ~190 tests de dominio existentes sigan pasando
// sin tocarlos (default: admin con todos los permisos).

describe('createMockAuthRepository — default (admin con todos los permisos)', () => {
  it('getSesionActual() resuelve un usuario admin con permisos completos por defecto', async () => {
    const repo = createMockAuthRepository();

    const sesion = await repo.getSesionActual();

    expect(sesion?.usuario.rol).toBe('admin');
    expect(sesion?.permisos.pacientes).toBeDefined();
  });
});

describe('createMockAuthRepository — configuración explícita (triangulación)', () => {
  it('acepta un usuario y permisos parciales configurados por el test', async () => {
    const repo = createMockAuthRepository({
      usuario: { id: 'u-empleado', nombre: 'Juan', apellido: 'Pérez', email: 'juan@x.com', rol: 'empleado' },
      permisos: { pacientes: 'read' },
    });

    const sesion = await repo.getSesionActual();

    expect(sesion?.usuario.rol).toBe('empleado');
    expect(sesion?.permisos).toEqual({ pacientes: 'read' });
  });

  it('con status: "anonymous" arranca sin sesión', async () => {
    const repo = createMockAuthRepository({ status: 'anonymous' });

    expect(await repo.getSesionActual()).toBeNull();
  });
});

describe('createMockAuthRepository — signIn/signOut', () => {
  it('signIn con credenciales inválidas rechaza y no crea sesión', async () => {
    const repo = createMockAuthRepository({ status: 'anonymous' });

    await expect(repo.signIn('nadie@x.com', 'mala')).rejects.toThrow(/credenciales inválidas/i);
    expect(await repo.getSesionActual()).toBeNull();
  });

  it('signOut() deja la sesión en null', async () => {
    const repo = createMockAuthRepository();

    await repo.signOut();

    expect(await repo.getSesionActual()).toBeNull();
  });
});

describe('createMockAuthRepository — onCambioDeSesion', () => {
  it('notifica a los listeners en signOut() y devuelve una función que desuscribe', async () => {
    const repo = createMockAuthRepository();
    const listener = vi.fn();

    const unsubscribe = repo.onCambioDeSesion(listener);
    await repo.signOut();

    expect(listener).toHaveBeenCalledWith(null);

    unsubscribe();
    listener.mockClear();
    await repo.signOut();

    expect(listener).not.toHaveBeenCalled();
  });
});
