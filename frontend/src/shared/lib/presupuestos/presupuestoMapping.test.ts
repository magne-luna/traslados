import { describe, expect, it } from 'vitest';
import type { NuevoPresupuesto } from '../../types/presupuesto';
import {
  mapArchivoUrl,
  parsePresupuestoApi,
  toActualizarPresupuestoPayload,
  toCrearPresupuestoPayload,
} from './presupuestoMapping';

// Mapeo puro API<->dominio de Presupuesto (design.md D1/D5/D6/D6b de integracion-presupuestos).
// Sin red, sin `any`, sin `as`. El contrato de referencia es el `toApi()` real de
// `supabase/functions/presupuestos/index.ts` (ya camelCase), verificado en tasks.md 1.1 —
// NO nombres inventados por este documento.

function presupuestoApiCompleto(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'presupuesto-1',
    pacienteId: 'paciente-1',
    obraSocialId: 'obra-social-1',
    monto: 150000,
    fechaEmision: '2026-03-10',
    archivoUrl: undefined,
    ...overrides,
  };
}

// -----------------------------------------------------------------------------------------------
// 2.1 — parsePresupuestoApi
// -----------------------------------------------------------------------------------------------

describe('parsePresupuestoApi (2.1)', () => {
  it('mapea un objeto completo', () => {
    const presupuesto = parsePresupuestoApi(presupuestoApiCompleto());

    expect(presupuesto).toEqual({
      id: 'presupuesto-1',
      pacienteId: 'paciente-1',
      obraSocialId: 'obra-social-1',
      monto: 150000,
      fechaEmision: '2026-03-10',
      archivo: undefined,
    });
  });

  it('monto nulo se descarta la fila entera (D6): devuelve null', () => {
    expect(parsePresupuestoApi(presupuestoApiCompleto({ monto: null }))).toBeNull();
  });

  it('fechaEmision nula se descarta la fila entera (D6): devuelve null', () => {
    expect(parsePresupuestoApi(presupuestoApiCompleto({ fechaEmision: null }))).toBeNull();
  });

  it('archivoUrl ausente -> archivo queda undefined, no se descarta la fila', () => {
    const record = presupuestoApiCompleto();
    delete record.archivoUrl;

    const presupuesto = parsePresupuestoApi(record);

    expect(presupuesto).not.toBeNull();
    expect(presupuesto?.archivo).toBeUndefined();
  });

  it('un valor que no es objeto devuelve null', () => {
    expect(parsePresupuestoApi('no soy un objeto')).toBeNull();
    expect(parsePresupuestoApi(null)).toBeNull();
    expect(parsePresupuestoApi(undefined)).toBeNull();
    expect(parsePresupuestoApi(42)).toBeNull();
  });

  // -----------------------------------------------------------------------------------------------
  // 2.4 — prestacionId (presupuesto-prestaciones PR 2, D9)
  // -----------------------------------------------------------------------------------------------

  it('prestacionId presente (string) se mapea tal cual (modalidad por-prestacion)', () => {
    const presupuesto = parsePresupuestoApi(presupuestoApiCompleto({ prestacionId: 'prestacion-1' }));

    expect(presupuesto?.prestacionId).toBe('prestacion-1');
  });

  it('prestacionId null (fila con la columna vacía) se mapea a undefined, nunca null (modalidad general)', () => {
    const presupuesto = parsePresupuestoApi(presupuestoApiCompleto({ prestacionId: null }));

    expect(presupuesto).not.toBeNull();
    expect(presupuesto?.prestacionId).toBeUndefined();
  });

  it('prestacionId ausente del todo se mapea a undefined', () => {
    const record = presupuestoApiCompleto();
    delete record.prestacionId;

    const presupuesto = parsePresupuestoApi(record);

    expect(presupuesto?.prestacionId).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------------------------
// 2.2 — mapArchivoUrl (archivoUrl -> ArchivoAdjunto, D5 opción A)
// -----------------------------------------------------------------------------------------------

describe('mapArchivoUrl (2.2)', () => {
  it('URL simple: nombre es el último segmento del path, cargadoEn es la fecha de la entidad', () => {
    const archivo = mapArchivoUrl(
      'https://proyecto.supabase.co/storage/v1/object/public/presupuesto-facundo-abril.pdf',
      '2026-04-05',
    );

    expect(archivo).toEqual({ nombre: 'presupuesto-facundo-abril.pdf', cargadoEn: '2026-04-05' });
  });

  it('URL con querystring: el token no contamina el nombre', () => {
    const archivo = mapArchivoUrl(
      'https://proyecto.supabase.co/storage/v1/object/public/presupuesto.pdf?token=abc123&exp=999',
      '2026-04-05',
    );

    expect(archivo?.nombre).toBe('presupuesto.pdf');
  });

  it('nombre percent-encoded se decodifica', () => {
    const archivo = mapArchivoUrl(
      'https://proyecto.supabase.co/storage/v1/object/public/presupuesto%20abril.pdf',
      '2026-04-05',
    );

    expect(archivo?.nombre).toBe('presupuesto abril.pdf');
  });

  it('string vacío -> undefined', () => {
    expect(mapArchivoUrl('', '2026-04-05')).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------------------------
// 2.3 — toCrearPresupuestoPayload
// -----------------------------------------------------------------------------------------------

function nuevoPresupuestoMinimo(overrides: Partial<NuevoPresupuesto> = {}): NuevoPresupuesto {
  return {
    pacienteId: 'paciente-1',
    obraSocialId: 'obra-social-1',
    monto: 200000,
    fechaEmision: '2026-05-01',
    ...overrides,
  };
}

describe('toCrearPresupuestoPayload (2.3)', () => {
  it('presupuesto mínimo: body con exactamente las 4 claves, sin archivoUrl', () => {
    const payload = toCrearPresupuestoPayload(nuevoPresupuestoMinimo());

    expect(payload).toEqual({
      pacienteId: 'paciente-1',
      obraSocialId: 'obra-social-1',
      monto: 200000,
      fechaEmision: '2026-05-01',
    });
    expect('archivoUrl' in payload).toBe(false);
  });

  it('con archivo de round-trip (viene de una lectura previa): archivoUrl NO viaja (D5)', () => {
    const payload = toCrearPresupuestoPayload(
      nuevoPresupuestoMinimo({ archivo: { nombre: 'presupuesto-facundo-abril.pdf', cargadoEn: '2026-04-05' } }),
    );

    expect('archivoUrl' in payload).toBe(false);
  });

  it('con archivo recién elegido en el input: tampoco viaja, porque no existe archivoUrl para él (D5)', () => {
    const payload = toCrearPresupuestoPayload(
      nuevoPresupuestoMinimo({ archivo: { nombre: 'nuevo.pdf', cargadoEn: '2026-05-01' } }),
    );

    expect('archivoUrl' in payload).toBe(false);
  });

  // -----------------------------------------------------------------------------------------------
  // 2.5 — prestacionId (presupuesto-prestaciones PR 2, D9): presente cuando está, ausente cuando no
  // -----------------------------------------------------------------------------------------------

  it('prestacionId presente (modalidad por-prestacion): viaja en el body', () => {
    const payload = toCrearPresupuestoPayload(nuevoPresupuestoMinimo({ prestacionId: 'prestacion-1' }));

    expect(payload.prestacionId).toBe('prestacion-1');
  });

  it('prestacionId ausente (modalidad general): la clave no aparece en el body', () => {
    const payload = toCrearPresupuestoPayload(nuevoPresupuestoMinimo());

    expect('prestacionId' in payload).toBe(false);
  });
});

// -----------------------------------------------------------------------------------------------
// 2.4 — toActualizarPresupuestoPayload (semántica parcial, D6b — la trampa más fácil del change)
// -----------------------------------------------------------------------------------------------

// -----------------------------------------------------------------------------------------------
// 5.1/5.4 — vigenciaDesde/vigenciaHasta/conDependencia (design.md D1/D3 de
// presupuestos-vigencia-datos-traslado-vista-previa)
// -----------------------------------------------------------------------------------------------

describe('parsePresupuestoApi — vigencia y conDependencia (5.4)', () => {
  it('vigenciaDesde/vigenciaHasta/conDependencia presentes se mapean tal cual', () => {
    const presupuesto = parsePresupuestoApi(
      presupuestoApiCompleto({ vigenciaDesde: '2026-02-01', vigenciaHasta: '2026-07-14', conDependencia: true }),
    );

    expect(presupuesto?.vigenciaDesde).toBe('2026-02-01');
    expect(presupuesto?.vigenciaHasta).toBe('2026-07-14');
    expect(presupuesto?.conDependencia).toBe(true);
  });

  it('conDependencia: false se preserva (SD decidido explícitamente, no se confunde con ausente)', () => {
    const presupuesto = parsePresupuestoApi(presupuestoApiCompleto({ conDependencia: false }));

    expect(presupuesto?.conDependencia).toBe(false);
  });

  it('vigenciaDesde/vigenciaHasta/conDependencia ausentes quedan undefined, no se descarta la fila', () => {
    const presupuesto = parsePresupuestoApi(presupuestoApiCompleto());

    expect(presupuesto).not.toBeNull();
    expect(presupuesto?.vigenciaDesde).toBeUndefined();
    expect(presupuesto?.vigenciaHasta).toBeUndefined();
    expect(presupuesto?.conDependencia).toBeUndefined();
  });
});

describe('toCrearPresupuestoPayload — vigencia y conDependencia (5.4)', () => {
  it('vigenciaDesde/vigenciaHasta/conDependencia presentes viajan en el body', () => {
    const payload = toCrearPresupuestoPayload(
      nuevoPresupuestoMinimo({ vigenciaDesde: '2026-02-01', vigenciaHasta: '2026-07-14', conDependencia: false }),
    );

    expect(payload.vigenciaDesde).toBe('2026-02-01');
    expect(payload.vigenciaHasta).toBe('2026-07-14');
    expect(payload.conDependencia).toBe(false);
  });

  it('vigenciaDesde/vigenciaHasta/conDependencia ausentes: las claves no aparecen en el body', () => {
    const payload = toCrearPresupuestoPayload(nuevoPresupuestoMinimo());

    expect('vigenciaDesde' in payload).toBe(false);
    expect('vigenciaHasta' in payload).toBe(false);
    expect('conDependencia' in payload).toBe(false);
  });
});

describe('toActualizarPresupuestoPayload — vigencia y conDependencia (5.4, D6b)', () => {
  it('solo vigenciaHasta seteada: el body tiene únicamente vigenciaHasta', () => {
    const payload = toActualizarPresupuestoPayload({ vigenciaHasta: '2026-07-14' });

    expect(payload).toEqual({ vigenciaHasta: '2026-07-14' });
    expect('vigenciaDesde' in payload).toBe(false);
    expect('conDependencia' in payload).toBe(false);
  });

  it('conDependencia: false seteado explícitamente viaja (no se confunde con ausente, D6b)', () => {
    const payload = toActualizarPresupuestoPayload({ conDependencia: false });

    expect(payload).toEqual({ conDependencia: false });
  });

  it('objeto vacío -> ninguna de las 3 claves viaja', () => {
    const payload = toActualizarPresupuestoPayload({});

    expect('vigenciaDesde' in payload).toBe(false);
    expect('vigenciaHasta' in payload).toBe(false);
    expect('conDependencia' in payload).toBe(false);
  });
});

// -----------------------------------------------------------------------------------------------
// 5.5 — dias_semana: `unknown` -> `DiaSemana[]` con type guard, sin `as`, sin `any` (TDD real)
// -----------------------------------------------------------------------------------------------

describe('parsePresupuestoApi — datosTraslado.diasSemana (5.5, type guard)', () => {
  it('arreglo con valores válidos de la unión DiaSemana se preserva tal cual', () => {
    const presupuesto = parsePresupuestoApi(
      presupuestoApiCompleto({ diasSemana: ['lunes', 'miercoles', 'viernes'] }),
    );

    expect(presupuesto?.datosTraslado?.diasSemana).toEqual(['lunes', 'miercoles', 'viernes']);
  });

  it('valores fuera de la unión se descartan uno por uno, los válidos sobreviven', () => {
    const presupuesto = parsePresupuestoApi(
      presupuestoApiCompleto({ diasSemana: ['lunes', 'marzo', 'viernes', 'domingo!', 42, null] }),
    );

    expect(presupuesto?.datosTraslado?.diasSemana).toEqual(['lunes', 'viernes']);
  });

  it('arreglo vacío se preserva como [] (sin días cargados, no undefined)', () => {
    const presupuesto = parsePresupuestoApi(presupuestoApiCompleto({ diasSemana: [] }));

    expect(presupuesto?.datosTraslado?.diasSemana).toEqual([]);
  });

  it('un valor que no es arreglo (contrato roto) se normaliza a [], no tumba la fila', () => {
    const presupuesto = parsePresupuestoApi(presupuestoApiCompleto({ diasSemana: 'lunes' }));

    expect(presupuesto).not.toBeNull();
    expect(presupuesto?.datosTraslado?.diasSemana).toEqual([]);
  });

  it('los 7 valores válidos de la unión se aceptan todos', () => {
    const todos = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
    const presupuesto = parsePresupuestoApi(presupuestoApiCompleto({ diasSemana: todos }));

    expect(presupuesto?.datosTraslado?.diasSemana).toEqual(todos);
  });
});

// -----------------------------------------------------------------------------------------------
// 5.4/5.5 — datosTraslado (bloque completo, design.md D2)
// -----------------------------------------------------------------------------------------------

describe('parsePresupuestoApi — datosTraslado (5.4, bloque completo)', () => {
  it('las 10 claves planas presentes se mapean al bloque anidado', () => {
    const presupuesto = parsePresupuestoApi(
      presupuestoApiCompleto({
        origenIda: 'Casa',
        destinoIda: 'Escuela',
        origenVuelta: 'Escuela',
        destinoVuelta: 'Casa',
        horarioEntrada: '08:00',
        horarioSalida: '12:00',
        kmIda: 5.5,
        kmVuelta: 5.5,
        diasSemana: ['lunes', 'martes'],
        diasMensuales: 20,
      }),
    );

    expect(presupuesto?.datosTraslado).toEqual({
      origenIda: 'Casa',
      destinoIda: 'Escuela',
      origenVuelta: 'Escuela',
      destinoVuelta: 'Casa',
      horarioEntrada: '08:00',
      horarioSalida: '12:00',
      kmIda: 5.5,
      kmVuelta: 5.5,
      diasSemana: ['lunes', 'martes'],
      diasMensuales: 20,
    });
  });

  it('sin la clave diasSemana (EF vieja o presupuesto sin datos de traslado): datosTraslado queda undefined', () => {
    const presupuesto = parsePresupuestoApi(presupuestoApiCompleto());

    expect(presupuesto).not.toBeNull();
    expect(presupuesto?.datosTraslado).toBeUndefined();
  });

  it('solo diasSemana presente (resto sin cargar): datosTraslado se arma con las demás sub-claves undefined', () => {
    const presupuesto = parsePresupuestoApi(presupuestoApiCompleto({ diasSemana: [] }));

    expect(presupuesto?.datosTraslado).toEqual({
      origenIda: undefined,
      destinoIda: undefined,
      origenVuelta: undefined,
      destinoVuelta: undefined,
      horarioEntrada: undefined,
      horarioSalida: undefined,
      kmIda: undefined,
      kmVuelta: undefined,
      diasSemana: [],
      diasMensuales: undefined,
    });
  });
});

describe('toCrearPresupuestoPayload — datosTraslado (5.4)', () => {
  it('datosTraslado presente se aplana a las 10 claves planas del body', () => {
    const payload = toCrearPresupuestoPayload(
      nuevoPresupuestoMinimo({
        datosTraslado: {
          origenIda: 'Casa',
          destinoIda: 'Escuela',
          horarioEntrada: '08:00',
          kmIda: 5.5,
          diasSemana: ['lunes', 'martes'],
        },
      }),
    );

    expect(payload.origenIda).toBe('Casa');
    expect(payload.destinoIda).toBe('Escuela');
    expect(payload.horarioEntrada).toBe('08:00');
    expect(payload.kmIda).toBe(5.5);
    expect(payload.diasSemana).toEqual(['lunes', 'martes']);
    expect('origenVuelta' in payload).toBe(false);
    expect('kmVuelta' in payload).toBe(false);
  });

  it('datosTraslado ausente: ninguna de las 10 claves aparece en el body', () => {
    const payload = toCrearPresupuestoPayload(nuevoPresupuestoMinimo());

    for (const clave of [
      'origenIda', 'destinoIda', 'origenVuelta', 'destinoVuelta',
      'horarioEntrada', 'horarioSalida', 'kmIda', 'kmVuelta', 'diasSemana', 'diasMensuales',
    ]) {
      expect(clave in payload).toBe(false);
    }
  });

  it('datosTraslado con diasSemana vacío igual manda la clave (diasSemana no es opcional en el bloque)', () => {
    const payload = toCrearPresupuestoPayload(
      nuevoPresupuestoMinimo({ datosTraslado: { diasSemana: [] } }),
    );

    expect(payload.diasSemana).toEqual([]);
  });
});

describe('toActualizarPresupuestoPayload — datosTraslado (5.4, D6b)', () => {
  it('datosTraslado presente en cambios se aplana entero, reemplazando el bloque', () => {
    const payload = toActualizarPresupuestoPayload({
      datosTraslado: { origenIda: 'Casa nueva', diasSemana: ['viernes'] },
    });

    expect(payload).toEqual({ origenIda: 'Casa nueva', diasSemana: ['viernes'] });
  });

  it('datosTraslado ausente en cambios (ej. editar solo el monto): ninguna de las 10 claves viaja', () => {
    const payload = toActualizarPresupuestoPayload({ monto: 1000 });

    for (const clave of [
      'origenIda', 'destinoIda', 'origenVuelta', 'destinoVuelta',
      'horarioEntrada', 'horarioSalida', 'kmIda', 'kmVuelta', 'diasSemana', 'diasMensuales',
    ]) {
      expect(clave in payload).toBe(false);
    }
  });
});

describe('toActualizarPresupuestoPayload (2.4) — clave ausente no viaja', () => {
  it('solo monto seteado: el body tiene únicamente monto', () => {
    const payload = toActualizarPresupuestoPayload({ monto: 300000 });

    expect(payload).toEqual({ monto: 300000 });
    expect('fechaEmision' in payload).toBe(false);
    expect('pacienteId' in payload).toBe(false);
    expect('obraSocialId' in payload).toBe(false);
  });

  it('solo fechaEmision seteada: el body tiene únicamente fechaEmision', () => {
    const payload = toActualizarPresupuestoPayload({ fechaEmision: '2026-06-01' });

    expect(payload).toEqual({ fechaEmision: '2026-06-01' });
    expect('monto' in payload).toBe(false);
  });

  it('objeto vacío -> body vacío: no pisa ningún campo que el usuario no tocó', () => {
    expect(toActualizarPresupuestoPayload({})).toEqual({});
  });

  it('prestacionId presente (incluso reasignando a otra prestación): viaja en el body (2.6)', () => {
    const payload = toActualizarPresupuestoPayload({ prestacionId: 'prestacion-2' });

    expect(payload).toEqual({ prestacionId: 'prestacion-2' });
  });

  it('prestacionId ausente en cambios (ej. editar solo el monto): la clave no viaja, nunca se manda undefined (2.6, la trampa de D6b)', () => {
    const payload = toActualizarPresupuestoPayload({ monto: 1000 });

    expect('prestacionId' in payload).toBe(false);
  });
});

// -----------------------------------------------------------------------------------------------
// 2.7 — lineas (REAPERTURA #13, decisión usuaria 2026-08-16): la modalidad `general` ahora SÍ
// persiste su desglose por prestación (`facturacion.presupuesto_linea`, migración
// `20260816110000_presupuesto_lineas.sql`) — antes el desglose vivía solo en el estado del
// formulario. El contrato de la EF `presupuestos` expone `lineas: [{ id, prestacionId, monto,
// orden }]` (camelCase, mismo criterio que prestacionId); `id` es el id de la fila real de la
// tabla, `prestacionId` la referencia al catálogo del paciente (el nombre se resuelve client-side
// contra `paciente.prestaciones`, igual que prestacionId hoy).
// -----------------------------------------------------------------------------------------------

describe('parsePresupuestoApi — lineas (2.7)', () => {
  it('lineas presentes (modalidad general): se mapean a PresupuestoLinea[]', () => {
    const presupuesto = parsePresupuestoApi(
      presupuestoApiCompleto({
        lineas: [
          { id: 'linea-1', prestacionId: 'prestacion-kine', monto: 100, orden: 1 },
          { id: 'linea-2', prestacionId: 'prestacion-fono', monto: 200, orden: 2 },
        ],
      }),
    );

    expect(presupuesto?.lineas).toEqual([
      { id: 'linea-1', prestacionId: 'prestacion-kine', monto: 100, orden: 1 },
      { id: 'linea-2', prestacionId: 'prestacion-fono', monto: 200, orden: 2 },
    ]);
  });

  it('lineas ausentes (modalidad por-prestacion o presupuesto viejo): lineas queda undefined, no se descarta la fila', () => {
    const record = presupuestoApiCompleto();
    delete record.lineas;

    const presupuesto = parsePresupuestoApi(record);

    expect(presupuesto).not.toBeNull();
    expect(presupuesto?.lineas).toBeUndefined();
  });

  it('lineas con filas malformadas: se descartan solo esas filas, las válidas sobreviven', () => {
    const presupuesto = parsePresupuestoApi(
      presupuestoApiCompleto({
        lineas: [
          { id: 'linea-1', prestacionId: 'prestacion-kine', monto: 100, orden: 1 },
          { id: 'linea-rota', monto: 50, orden: 2 },
          'no soy una línea',
        ],
      }),
    );

    expect(presupuesto?.lineas).toEqual([{ id: 'linea-1', prestacionId: 'prestacion-kine', monto: 100, orden: 1 }]);
  });

  it('lineas que no es un arreglo (contrato del servidor roto): lineas queda undefined, sin descartar la fila', () => {
    const presupuesto = parsePresupuestoApi(presupuestoApiCompleto({ lineas: { algo: 'raro' } }));

    expect(presupuesto).not.toBeNull();
    expect(presupuesto?.lineas).toBeUndefined();
  });
});

describe('toCrearPresupuestoPayload — lineas (2.7)', () => {
  it('lineas presentes (modalidad general): viajan como [{ prestacionId, monto, orden }] SIN el id local de la línea', () => {
    const payload = toCrearPresupuestoPayload(
      nuevoPresupuestoMinimo({
        lineas: [
          { id: 'linea-local-1', prestacionId: 'prestacion-kine', monto: 100, orden: 1 },
          { id: 'linea-local-2', prestacionId: 'prestacion-fono', monto: 200, orden: 2 },
        ],
      }),
    );

    expect(payload.lineas).toEqual([
      { prestacionId: 'prestacion-kine', monto: 100, orden: 1 },
      { prestacionId: 'prestacion-fono', monto: 200, orden: 2 },
    ]);
  });

  it('lineas ausentes (modalidad simple/por-prestacion): la clave no aparece en el body', () => {
    const payload = toCrearPresupuestoPayload(nuevoPresupuestoMinimo());

    expect('lineas' in payload).toBe(false);
  });
});

describe('toActualizarPresupuestoPayload — lineas (2.7)', () => {
  it('lineas nunca viajan en una actualización: la edición no toca el desglose persistido (D9, "la edición no bifurca")', () => {
    const payload = toActualizarPresupuestoPayload({
      monto: 999,
      lineas: [{ id: 'linea-1', prestacionId: 'prestacion-kine', monto: 999, orden: 1 }],
    });

    expect(payload).toEqual({ monto: 999 });
    expect('lineas' in payload).toBe(false);
  });
});
