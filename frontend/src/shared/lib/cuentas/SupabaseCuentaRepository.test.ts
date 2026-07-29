import { describe, expect, it, vi, beforeEach } from 'vitest';
// Import Vite `?raw` (declarado en vite/client.d.ts): trae el código fuente como string en build
// time, sin depender de tipos de Node (`fs`) que este proyecto no habilita en tsconfig.app.json.
import supabaseCuentaRepositorySource from './SupabaseCuentaRepository.ts?raw';

// Fakes tipados del cliente de Supabase (sin `any`), mismo criterio que
// SupabaseAuthRepository.test.ts: solo modelan la porción de la API que
// SupabaseCuentaRepository usa — schema().from().select()[.eq()] y functions.invoke().

interface FakeResult<T> {
  data: T;
  error: { message: string } | null;
}

function fakeListQuery<T>(result: FakeResult<T>) {
  return { select: () => Promise.resolve(result) };
}

const functionsInvoke = vi.fn();
const schemaMock = vi.fn();

vi.mock('../supabaseClient', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => functionsInvoke(...args) },
    schema: (name: string) => schemaMock(name),
  },
}));

const { supabaseCuentaRepository } = await import('./SupabaseCuentaRepository');
const {
  MENSAJE_SESION_EXPIRADA,
  MENSAJE_SIN_PRIVILEGIOS,
  MENSAJE_CUENTA_INEXISTENTE,
} = await import('./CuentaRepository');

function configurarSchema(options: { usuariosRows: unknown[]; permisosRows?: unknown[] }) {
  schemaMock.mockImplementation((schemaName: string) => {
    if (schemaName === 'usuarios') {
      return { from: () => fakeListQuery({ data: options.usuariosRows, error: null }) };
    }
    return { from: () => fakeListQuery({ data: options.permisosRows ?? [], error: null }) };
  });
}

describe('supabaseCuentaRepository.listarCuentas', () => {
  beforeEach(() => vi.clearAllMocks());

  it('combina usuarios.usuarios con modulos.permisos × modulos.modulos, agrupado por cuenta', async () => {
    configurarSchema({
      usuariosRows: [
        { id: 'u1', email: 'a@x.com', nombre: 'A', apellido: 'B', rol: 'empleado' },
        { id: 'u2', email: 'admin@x.com', nombre: 'Admin', apellido: 'X', rol: 'admin' },
      ],
      permisosRows: [
        { usuario_id: 'u1', nivel_acceso: 'read', modulos: { tipo_modulo: 'pacientes' } },
        { usuario_id: 'u1', nivel_acceso: 'write', modulos: { tipo_modulo: 'facturacion' } },
      ],
    });

    const cuentas = await supabaseCuentaRepository.listarCuentas();

    expect(cuentas).toEqual([
      { id: 'u1', email: 'a@x.com', nombre: 'A', apellido: 'B', rol: 'empleado', permisos: { pacientes: 'read', facturacion: 'write' } },
      { id: 'u2', email: 'admin@x.com', nombre: 'Admin', apellido: 'X', rol: 'admin', permisos: {} },
    ]);
  });

  it('cuenta sin ninguna fila en modulos.permisos expone un mapa vacío (triangulación)', async () => {
    configurarSchema({ usuariosRows: [{ id: 'u1', email: 'a@x.com', nombre: 'A', apellido: 'B', rol: 'empleado' }], permisosRows: [] });

    const cuentas = await supabaseCuentaRepository.listarCuentas();

    expect(cuentas).toEqual([{ id: 'u1', email: 'a@x.com', nombre: 'A', apellido: 'B', rol: 'empleado', permisos: {} }]);
  });

  it('descarta en silencio filas de usuarios que no tienen la forma esperada', async () => {
    configurarSchema({
      usuariosRows: [{ id: 'u1', email: 'a@x.com', nombre: 'A', apellido: 'B', rol: 'empleado' }, { id: 'raro' }],
      permisosRows: [],
    });

    const cuentas = await supabaseCuentaRepository.listarCuentas();

    expect(cuentas).toHaveLength(1);
  });
});

describe('supabaseCuentaRepository.crearCuenta', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invoca create-user con email, password, nombre, apellido y los permisos iniciales mapeados a snake_case', async () => {
    functionsInvoke.mockResolvedValue({ data: { id: 'nueva', email: 'x@x.com' }, error: null });

    await supabaseCuentaRepository.crearCuenta({
      email: 'x@x.com',
      password: 'password-12',
      nombre: 'X',
      apellido: 'Y',
      permisos: [{ modulo: 'pacientes', nivelAcceso: 'write' }],
    });

    expect(functionsInvoke).toHaveBeenCalledWith('create-user', {
      body: {
        email: 'x@x.com',
        password: 'password-12',
        nombre: 'X',
        apellido: 'Y',
        permisos: [{ modulo: 'pacientes', nivel_acceso: 'write' }],
      },
    });
  });

  it('sin permisos iniciales envía un array vacío, no undefined (triangulación)', async () => {
    functionsInvoke.mockResolvedValue({ data: { id: 'nueva', email: 'x@x.com' }, error: null });

    await supabaseCuentaRepository.crearCuenta({ email: 'x@x.com', password: 'password-12', nombre: 'X', apellido: 'Y' });

    expect(functionsInvoke).toHaveBeenCalledWith(
      'create-user',
      expect.objectContaining({ body: expect.objectContaining({ permisos: [] }) }),
    );
  });
});

describe('supabaseCuentaRepository.actualizarPermisos', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invoca update-permisos con usuario_id y el conjunto completo de permisos', async () => {
    functionsInvoke.mockResolvedValue({ data: { usuario_id: 'u1', permisos: [] }, error: null });

    await supabaseCuentaRepository.actualizarPermisos('u1', [{ modulo: 'conductores', nivelAcceso: 'admin' }]);

    expect(functionsInvoke).toHaveBeenCalledWith('update-permisos', {
      body: { usuario_id: 'u1', permisos: [{ modulo: 'conductores', nivel_acceso: 'admin' }] },
    });
  });

  it('con un array vacío igual invoca update-permisos con permisos: [] — revoca todo (tasks.md 6.5)', async () => {
    functionsInvoke.mockResolvedValue({ data: { usuario_id: 'u1', permisos: [] }, error: null });

    await supabaseCuentaRepository.actualizarPermisos('u1', []);

    expect(functionsInvoke).toHaveBeenCalledWith('update-permisos', { body: { usuario_id: 'u1', permisos: [] } });
  });
});

describe('mapeo de errores de las Edge Functions (design.md D7, tasks.md 6.3)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('401 se traduce al mensaje de sesión expirada', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 401 }) } });

    await expect(
      supabaseCuentaRepository.crearCuenta({ email: 'x@x.com', password: 'password-12', nombre: 'X', apellido: 'Y' }),
    ).rejects.toThrow(MENSAJE_SESION_EXPIRADA);
  });

  it('403 se traduce al mensaje de falta de privilegios', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 403 }) } });

    await expect(supabaseCuentaRepository.actualizarPermisos('u1', [])).rejects.toThrow(MENSAJE_SIN_PRIVILEGIOS);
  });

  it('404 se traduce al mensaje de cuenta inexistente', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 404 }) } });

    await expect(supabaseCuentaRepository.actualizarPermisos('inexistente', [])).rejects.toThrow(MENSAJE_CUENTA_INEXISTENTE);
  });

  it('400 propaga el mensaje del campo error del body tal cual (triangulación)', async () => {
    functionsInvoke.mockResolvedValue({
      data: null,
      error: { context: new Response(JSON.stringify({ error: 'La contraseña debe tener 8 caracteres o más.' }), { status: 400 }) },
    });

    await expect(
      supabaseCuentaRepository.crearCuenta({ email: 'x@x.com', password: 'corta', nombre: 'X', apellido: 'Y' }),
    ).rejects.toThrow('La contraseña debe tener 8 caracteres o más.');
  });

  it('un error de red (sin context) cae a un mensaje genérico, sin romper', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: new Error('network down') });

    await expect(supabaseCuentaRepository.actualizarPermisos('u1', [])).rejects.toThrow('network down');
  });
});

describe('tasks.md 6.6 — ninguna escritura directa sobre modulos.permisos ni usuarios.usuarios', () => {
  it('el código fuente no contiene .insert(/.update(/.delete( — toda escritura es functions.invoke', () => {
    expect(supabaseCuentaRepositorySource).not.toMatch(/\.(insert|update|delete)\(/);
    expect(supabaseCuentaRepositorySource).toContain("functions.invoke('create-user'");
    expect(supabaseCuentaRepositorySource).toContain("functions.invoke('update-permisos'");
  });
});
