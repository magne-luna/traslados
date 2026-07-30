import { describe, expect, it, vi, beforeEach } from 'vitest';

// Fakes tipados del cliente de Supabase (sin `any` — regla dura del proyecto). Solo modelan la
// porción de la API que SupabaseAuthRepository usa: auth.signInWithPassword/signOut/getSession/
// onAuthStateChange, y el encadenado schema().from().select().eq()[.maybeSingle()].

interface FakeResult<T> {
  data: T;
  error: { message: string } | null;
}

function fakeSingleQuery<T>(result: FakeResult<T>) {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve(result),
      }),
    }),
  };
}

function fakeListQuery<T>(result: FakeResult<T>) {
  return {
    select: () => ({
      eq: () => Promise.resolve(result),
    }),
  };
}

const authMock = {
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
};

const schemaMock = vi.fn();

vi.mock('../supabaseClient', () => ({
  supabase: {
    auth: authMock,
    schema: (name: string) => schemaMock(name),
  },
}));

const USUARIO_ROW = { id: 'u1', email: 'andrea@x.com', nombre: 'Andrea', apellido: 'Pastor', rol: 'admin' as const };

function configurarSchema(options: { usuarioRow: unknown; permisosRows?: unknown[] }) {
  schemaMock.mockImplementation((schemaName: string) => {
    if (schemaName === 'usuarios') {
      return {
        from: () =>
          fakeSingleQuery({
            data: options.usuarioRow,
            error: options.usuarioRow ? null : { message: 'no rows' },
          }),
      };
    }
    return { from: () => fakeListQuery({ data: options.permisosRows ?? [], error: null }) };
  });
}

const { supabaseAuthRepository } = await import('./SupabaseAuthRepository');

describe('supabaseAuthRepository.signIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('con credenciales válidas y perfil existente arma la sesión con permisos', async () => {
    authMock.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    configurarSchema({
      usuarioRow: USUARIO_ROW,
      permisosRows: [{ nivel_acceso: 'read', modulos: { tipo_modulo: 'pacientes' } }],
    });

    const sesion = await supabaseAuthRepository.signIn('andrea@x.com', 'secreta123');

    expect(sesion.usuario.rol).toBe('admin');
    expect(sesion.usuario.email).toBe('andrea@x.com');
    expect(sesion.permisos.pacientes).toBe('read');
  });

  it('con credenciales inválidas rechaza con el mensaje que devuelve Supabase Auth', async () => {
    authMock.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    });

    await expect(supabaseAuthRepository.signIn('andrea@x.com', 'mala')).rejects.toThrow(
      /invalid login credentials/i,
    );
  });

  it('con sesión válida en Auth pero sin fila en usuarios.usuarios cierra sesión y rechaza con el mensaje de cuenta no habilitada (tasks.md 4.7)', async () => {
    authMock.signInWithPassword.mockResolvedValue({ data: { user: { id: 'u-huerfano' } }, error: null });
    configurarSchema({ usuarioRow: null });

    await expect(supabaseAuthRepository.signIn('nuevo@x.com', 'secreta123')).rejects.toThrow(/no está habilitada/i);
    expect(authMock.signOut).toHaveBeenCalledTimes(1);
  });
});

describe('supabaseAuthRepository.getSesionActual', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sin sesión persistida en Supabase devuelve null', async () => {
    authMock.getSession.mockResolvedValue({ data: { session: null } });

    expect(await supabaseAuthRepository.getSesionActual()).toBeNull();
  });

  it('con sesión persistida y perfil existente devuelve usuario y permisos', async () => {
    authMock.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    configurarSchema({ usuarioRow: USUARIO_ROW, permisosRows: [] });

    const sesion = await supabaseAuthRepository.getSesionActual();

    expect(sesion?.usuario.email).toBe('andrea@x.com');
    expect(sesion?.permisos).toEqual({});
  });

  it('con permisos sobre los módulos hijo nuevos (hojas_de_ruta, presupuestos, vehiculos) los incluye en la sesión', async () => {
    authMock.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    configurarSchema({
      usuarioRow: USUARIO_ROW,
      permisosRows: [
        { nivel_acceso: 'write', modulos: { tipo_modulo: 'hojas_de_ruta' } },
        { nivel_acceso: 'read', modulos: { tipo_modulo: 'presupuestos' } },
        { nivel_acceso: 'admin', modulos: { tipo_modulo: 'vehiculos' } },
      ],
    });

    const sesion = await supabaseAuthRepository.getSesionActual();

    expect(sesion?.permisos).toEqual({ hojas_de_ruta: 'write', presupuestos: 'read', vehiculos: 'admin' });
  });

  it('con sesión persistida pero sin fila en usuarios.usuarios cierra sesión y devuelve null (tasks.md 4.7)', async () => {
    authMock.getSession.mockResolvedValue({ data: { session: { user: { id: 'u-huerfano' } } } });
    configurarSchema({ usuarioRow: null });

    const sesion = await supabaseAuthRepository.getSesionActual();

    expect(sesion).toBeNull();
    expect(authMock.signOut).toHaveBeenCalledTimes(1);
  });
});

describe('supabaseAuthRepository.signOut', () => {
  it('invoca supabase.auth.signOut()', async () => {
    vi.clearAllMocks();
    authMock.signOut.mockResolvedValue({ error: null });

    await supabaseAuthRepository.signOut();

    expect(authMock.signOut).toHaveBeenCalledTimes(1);
  });
});

describe('supabaseAuthRepository.onCambioDeSesion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('se suscribe a onAuthStateChange y la desuscripción llama a unsubscribe()', () => {
    const unsubscribe = vi.fn();
    authMock.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } });

    const cancelar = supabaseAuthRepository.onCambioDeSesion(() => {});
    cancelar();

    expect(authMock.onAuthStateChange).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('notifica null cuando Supabase reporta que la sesión se cerró (ej. otra pestaña)', async () => {
    let capturado: ((event: string, session: unknown) => void) | undefined;
    authMock.onAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      capturado = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    const listener = vi.fn();
    supabaseAuthRepository.onCambioDeSesion(listener);
    capturado?.('SIGNED_OUT', null);

    await vi.waitFor(() => expect(listener).toHaveBeenCalledWith(null));
  });
});
