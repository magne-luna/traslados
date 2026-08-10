import { describe, expect, it } from 'vitest';
import { esErrorNotFound, mapearErrorVehiculo } from './edgeFunctionErrors';

function respuestaConBody(status: number, body: unknown): { context: Response } {
  return { context: new Response(JSON.stringify(body), { status }) };
}

describe('mapearErrorVehiculo', () => {
  it('sin Response en error.context (falla de red) devuelve mensaje de conexión', async () => {
    const err = await mapearErrorVehiculo(new Error('network down'), { operacion: 'listar' });
    expect(err.message).toBe('No se pudo conectar con el servidor.');
  });

  it('401 devuelve mensaje de sesión expirada', async () => {
    const err = await mapearErrorVehiculo(respuestaConBody(401, { error: 'token invalido' }), { operacion: 'obtener' });
    expect(err.message).toBe('Tu sesión expiró. Volvé a iniciar sesión.');
  });

  it('403 en una operación de escritura devuelve mensaje de permiso de escritura', async () => {
    const err = await mapearErrorVehiculo(respuestaConBody(403, { error: "no tenes permiso de 'write'" }), {
      operacion: 'crear',
    });
    expect(err.message).toBe('No tenés permiso para modificar vehículos.');
  });

  it('403 en listar/obtener devuelve mensaje de permiso de lectura', async () => {
    const err = await mapearErrorVehiculo(respuestaConBody(403, { error: "no tenes permiso de 'read'" }), {
      operacion: 'listar',
    });
    expect(err.message).toBe('No tenés permiso para ver vehículos.');
  });

  it('404 en actualizar devuelve "no existe" con el id', async () => {
    const err = await mapearErrorVehiculo(respuestaConBody(404, { error: 'vehiculo no encontrado' }), {
      operacion: 'actualizar',
      id: 'v1',
    });
    expect(err.message).toBe('No existe un vehículo con id "v1".');
  });

  it('400 con constraint de patente duplicada devuelve mensaje de patente existente', async () => {
    const err = await mapearErrorVehiculo(
      respuestaConBody(400, { error: 'duplicate key value violates unique constraint "vehiculo_patente_key"' }),
      { operacion: 'crear' },
    );
    expect(err.message).toBe('Ya existe un vehículo con esa patente.');
  });

  it('400 por campo requerido faltante devuelve mensaje de datos obligatorios', async () => {
    const err = await mapearErrorVehiculo(respuestaConBody(400, { error: 'falta el campo requerido: patente' }), {
      operacion: 'crear',
    });
    expect(err.message).toBe('Faltan datos obligatorios del vehículo.');
  });

  it('400 sin patrón reconocido cae al mensaje genérico de la operación', async () => {
    const err = await mapearErrorVehiculo(respuestaConBody(400, { error: 'algo raro paso en el server' }), {
      operacion: 'actualizar',
    });
    expect(err.message).toBe('No se pudo guardar el vehículo.');
  });

  it('body no parseable como JSON cae al mensaje genérico sin lanzar', async () => {
    const err = await mapearErrorVehiculo({ context: new Response('no-json', { status: 400 }) }, { operacion: 'listar' });
    expect(err.message).toBe('No se pudo cargar el listado de vehículos.');
  });

  it('status desconocido (ej. 500) cae al mensaje genérico de la operación', async () => {
    const err = await mapearErrorVehiculo(respuestaConBody(500, { error: 'boom' }), { operacion: 'obtener' });
    expect(err.message).toBe('No se pudo cargar el vehículo.');
  });
});

describe('esErrorNotFound', () => {
  it('true para un error con context Response status 404', () => {
    expect(esErrorNotFound(respuestaConBody(404, { error: 'vehiculo no encontrado' }))).toBe(true);
  });

  it('false para cualquier otro status', () => {
    expect(esErrorNotFound(respuestaConBody(400, { error: 'x' }))).toBe(false);
  });

  it('false cuando no hay Response en context', () => {
    expect(esErrorNotFound(new Error('network down'))).toBe(false);
  });
});
