import { describe, expect, it } from 'vitest';
import { esErrorNotFound, mapearErrorEdgeFunction, type ContextoErrorEdgeFunction } from './edgeFunctionErrors';

// Traducción HTTP -> Error de UI (design.md D7, tasks.md 3.1-3.3). Un test por rama de la tabla de
// D7, siguiendo el estilo de SupabaseCuentaRepository.test.ts (fakes tipados de `error.context`
// como `Response`, sin `any`, sin `as`).

const CONTEXTO_LEER_PRESUPUESTO: ContextoErrorEdgeFunction = { entidad: 'presupuesto', operacion: 'listar' };
const CONTEXTO_ESCRIBIR_PRESUPUESTO: ContextoErrorEdgeFunction = { entidad: 'presupuesto', operacion: 'crear' };

describe('mapearErrorEdgeFunction (3.1 — una rama por fila de la tabla D7)', () => {
  it('401 se traduce a "sesión expiró"', async () => {
    const error = { context: new Response(null, { status: 401 }) };

    const traducido = await mapearErrorEdgeFunction(error, CONTEXTO_LEER_PRESUPUESTO);

    expect(traducido.message).toBe('Tu sesión expiró. Volvé a iniciar sesión.');
  });

  it('403 en una operación de lectura se traduce a "no tenés permiso para ver"', async () => {
    const error = { context: new Response(null, { status: 403 }) };

    const traducido = await mapearErrorEdgeFunction(error, CONTEXTO_LEER_PRESUPUESTO);

    expect(traducido.message).toBe('No tenés permiso para ver presupuestos.');
  });

  it('403 en una operación de escritura se traduce a "no tenés permiso para modificar"', async () => {
    const error = { context: new Response(null, { status: 403 }) };

    const traducido = await mapearErrorEdgeFunction(error, CONTEXTO_ESCRIBIR_PRESUPUESTO);

    expect(traducido.message).toBe('No tenés permiso para modificar presupuestos.');
  });

  it('400 sin ninguna rama específica cae al mensaje genérico según la operación', async () => {
    const error = {
      context: new Response(JSON.stringify({ error: 'algo que no matchea ninguna rama conocida' }), { status: 400 }),
    };

    const traducido = await mapearErrorEdgeFunction(error, CONTEXTO_ESCRIBIR_PRESUPUESTO);

    expect(traducido.message).toBe('No se pudo guardar el presupuesto.');
  });

  it('un error sin "context" como Response (falla de red) cae a "no se pudo conectar con el servidor"', async () => {
    const error = new Error('network down');

    const traducido = await mapearErrorEdgeFunction(error, CONTEXTO_LEER_PRESUPUESTO);

    expect(traducido.message).toBe('No se pudo conectar con el servidor.');
  });

  it('un status HTTP no mapeado (500) cae al mensaje genérico de la operación ("Error no reconocido")', async () => {
    const error = { context: new Response(null, { status: 500 }) };

    const traducido = await mapearErrorEdgeFunction(error, CONTEXTO_LEER_PRESUPUESTO);

    expect(traducido.message).toBe('No se pudo cargar el listado de presupuestos.');
  });
});

describe('mapearErrorEdgeFunction (3.2 — el texto crudo de Postgres nunca llega a la UI)', () => {
  it('un 400 con un mensaje real del motor no propaga ese texto en el .message traducido', async () => {
    const mensajeCrudoDelMotor =
      'null value in column "monto" of relation "presupuesto" violates not-null constraint';
    const error = { context: new Response(JSON.stringify({ error: mensajeCrudoDelMotor }), { status: 400 }) };

    const traducido = await mapearErrorEdgeFunction(error, CONTEXTO_ESCRIBIR_PRESUPUESTO);

    expect(traducido.message).not.toContain(mensajeCrudoDelMotor);
    expect(traducido.message).not.toContain('relation "presupuesto"');
    expect(traducido.message).not.toContain('not-null constraint');
  });
});

describe('mapearErrorEdgeFunction (3.3 — rama RN-PA-01)', () => {
  it('un 400 cuyo error empieza con el prefijo literal del RAISE EXCEPTION del trigger se traduce al mensaje de UI', async () => {
    // Texto literal copiado en tasks.md 1.4 desde
    // supabase/migrations/20260729130000_schema_autorizacion_monto_vigencia.sql línea 24.
    const textoCrudoDelTrigger = 'RN-PA-01: monto_autorizado (500) no puede superar el presupuesto (300)';
    const error = { context: new Response(JSON.stringify({ error: textoCrudoDelTrigger }), { status: 400 }) };

    const traducido = await mapearErrorEdgeFunction(error, {
      entidad: 'autorizacion',
      operacion: 'crear',
    });

    expect(traducido.message).toBe('La autorización no puede superar el monto del presupuesto.');
    expect(traducido.message).not.toContain('RN-PA-01');
    expect(traducido.message).not.toContain('500');
  });
});

describe('esErrorNotFound (helper compartido por getById/getByPresupuestoId, tasks.md 3.5/3.9)', () => {
  it('true cuando el context es un Response con status 404', () => {
    const error = { context: new Response(null, { status: 404 }) };

    expect(esErrorNotFound(error)).toBe(true);
  });

  it('false para cualquier otro status (triangulación)', () => {
    const error = { context: new Response(null, { status: 403 }) };

    expect(esErrorNotFound(error)).toBe(false);
  });

  it('false cuando no hay context como Response (error de red)', () => {
    expect(esErrorNotFound(new Error('network down'))).toBe(false);
  });
});

describe('mapearErrorEdgeFunction (3.11 — ramas de cobertura no ejercitadas por 3.1-3.9)', () => {
  it('400 genérico en una operación "obtener" usa el mensaje singular ("no se pudo cargar la autorización")', async () => {
    const error = { context: new Response(JSON.stringify({ error: 'algo sin rama conocida' }), { status: 400 }) };

    const traducido = await mapearErrorEdgeFunction(error, { entidad: 'autorizacion', operacion: 'obtener' });

    expect(traducido.message).toBe('No se pudo cargar la autorización.');
  });

  it('un 400 con body que no es JSON parseable cae al mensaje genérico sin romper (catch de mapear400)', async () => {
    const error = { context: new Response('esto no es JSON', { status: 400 }) };

    const traducido = await mapearErrorEdgeFunction(error, CONTEXTO_ESCRIBIR_PRESUPUESTO);

    expect(traducido.message).toBe('No se pudo guardar el presupuesto.');
  });

  it('un error que no es ni Record ni Response (ej. un string) cae igual a "no se pudo conectar"', async () => {
    const traducido = await mapearErrorEdgeFunction('esto no es ni un objeto', CONTEXTO_LEER_PRESUPUESTO);

    expect(traducido.message).toBe('No se pudo conectar con el servidor.');
  });

  it('esErrorNotFound: false cuando error no es un Record en absoluto (triangulación adicional)', () => {
    expect(esErrorNotFound('tampoco acá')).toBe(false);
  });

  it('un 400 cuyo body es JSON válido pero sin una clave "error" de tipo string cae al mensaje genérico', async () => {
    const error = { context: new Response(JSON.stringify({ status: 'bad', otraCosa: 42 }), { status: 400 }) };

    const traducido = await mapearErrorEdgeFunction(error, CONTEXTO_ESCRIBIR_PRESUPUESTO);

    expect(traducido.message).toBe('No se pudo guardar el presupuesto.');
  });

  it('un 404 sin contexto.id (defensivo, no debería ocurrir en la práctica) igual arma un mensaje sin romper', async () => {
    const error = { context: new Response(null, { status: 404 }) };

    const traducido = await mapearErrorEdgeFunction(error, { entidad: 'presupuesto', operacion: 'actualizar' });

    expect(traducido.message).toBe('No existe un presupuesto con id "".');
  });
});
