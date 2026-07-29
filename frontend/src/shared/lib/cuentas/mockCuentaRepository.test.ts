import { describe, expect, it } from 'vitest';
import { createMockCuentaRepository, CUENTAS_FIXTURE } from './mockCuentaRepository';

describe('createMockCuentaRepository', () => {
  it('listarCuentas() devuelve el fixture por defecto', async () => {
    const repository = createMockCuentaRepository();

    const cuentas = await repository.listarCuentas();

    expect(cuentas).toHaveLength(CUENTAS_FIXTURE.length);
    expect(cuentas[0]?.email).toBe(CUENTAS_FIXTURE[0]?.email);
  });

  it('acepta cuentasIniciales para declarar un escenario explícito (triangulación)', async () => {
    const repository = createMockCuentaRepository({
      cuentasIniciales: [
        { id: 'x', email: 'x@x.com', nombre: 'X', apellido: 'Y', rol: 'empleado', permisos: {} },
      ],
    });

    const cuentas = await repository.listarCuentas();

    expect(cuentas).toEqual([{ id: 'x', email: 'x@x.com', nombre: 'X', apellido: 'Y', rol: 'empleado', permisos: {} }]);
  });

  it('crearCuenta() agrega una cuenta nueva con rol empleado y los permisos iniciales', async () => {
    const repository = createMockCuentaRepository({ cuentasIniciales: [] });

    await repository.crearCuenta({
      email: 'nueva@x.com',
      password: 'password-12',
      nombre: 'Nueva',
      apellido: 'Cuenta',
      permisos: [{ modulo: 'pacientes', nivelAcceso: 'write' }],
    });

    const cuentas = await repository.listarCuentas();
    expect(cuentas).toHaveLength(1);
    expect(cuentas[0]).toMatchObject({
      email: 'nueva@x.com',
      nombre: 'Nueva',
      apellido: 'Cuenta',
      rol: 'empleado',
      permisos: { pacientes: 'write' },
    });
  });

  it('crearCuenta() sin permisos iniciales agrega la cuenta con un mapa de permisos vacío (triangulación)', async () => {
    const repository = createMockCuentaRepository({ cuentasIniciales: [] });

    await repository.crearCuenta({ email: 'sinpermisos@x.com', password: 'password-12', nombre: 'A', apellido: 'B' });

    const cuentas = await repository.listarCuentas();
    expect(cuentas[0]?.permisos).toEqual({});
  });

  it('actualizarPermisos() reemplaza el mapa de permisos de la cuenta indicada', async () => {
    const repository = createMockCuentaRepository({
      cuentasIniciales: [
        { id: 'u1', email: 'u1@x.com', nombre: 'U', apellido: 'Uno', rol: 'empleado', permisos: { pacientes: 'read' } },
      ],
    });

    await repository.actualizarPermisos('u1', [{ modulo: 'facturacion', nivelAcceso: 'write' }]);

    const cuentas = await repository.listarCuentas();
    expect(cuentas[0]?.permisos).toEqual({ facturacion: 'write' });
  });

  it('actualizarPermisos() con array vacío revoca todos los accesos (tasks.md 6.5)', async () => {
    const repository = createMockCuentaRepository({
      cuentasIniciales: [
        {
          id: 'u1',
          email: 'u1@x.com',
          nombre: 'U',
          apellido: 'Uno',
          rol: 'empleado',
          permisos: { pacientes: 'read', facturacion: 'admin' },
        },
      ],
    });

    await repository.actualizarPermisos('u1', []);

    const cuentas = await repository.listarCuentas();
    expect(cuentas[0]?.permisos).toEqual({});
  });

  it('actualizarPermisos() rechaza si la cuenta no existe', async () => {
    const repository = createMockCuentaRepository({ cuentasIniciales: [] });

    await expect(repository.actualizarPermisos('inexistente', [])).rejects.toThrow(/no existe/i);
  });
});
