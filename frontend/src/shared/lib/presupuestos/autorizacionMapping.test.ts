import { describe, expect, it } from 'vitest';
import type { NuevaAutorizacion } from '../../types/presupuesto';
import {
  parseAutorizacionApi,
  toActualizarAutorizacionPayload,
  toCrearAutorizacionPayload,
} from './autorizacionMapping';

// Mapeo puro API<->dominio de Autorizacion (design.md D1/D5/D6/D6b de integracion-presupuestos).
// Sin red, sin `any`, sin `as`. El contrato de referencia es el `toApi()` real de
// `supabase/functions/autorizaciones/index.ts` (ya camelCase), verificado en tasks.md 1.1.

function autorizacionApiCompleta(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'autorizacion-1',
    presupuestoId: 'presupuesto-1',
    estado: 'autorizada',
    fechaRespuesta: '2026-03-15',
    montoAutorizado: 140000,
    vigenciaDesde: '2026-03-01',
    cupoMensualDias: 20,
    cupoMensualKm: 500,
    archivoUrl: undefined,
    ...overrides,
  };
}

// -----------------------------------------------------------------------------------------------
// 2.5 — parseAutorizacionApi
// -----------------------------------------------------------------------------------------------

describe('parseAutorizacionApi (2.5)', () => {
  it('mapea un objeto completo', () => {
    const autorizacion = parseAutorizacionApi(autorizacionApiCompleta());

    expect(autorizacion).toEqual({
      id: 'autorizacion-1',
      presupuestoId: 'presupuesto-1',
      estado: 'autorizada',
      fechaRespuesta: '2026-03-15',
      montoAutorizado: 140000,
      vigenciaDesde: '2026-03-01',
      cupoMensualDias: 20,
      cupoMensualKm: 500,
      archivo: undefined,
    });
  });

  it('estado nulo cae al default "pendiente" (D6, es el default de la columna)', () => {
    const autorizacion = parseAutorizacionApi(autorizacionApiCompleta({ estado: null }));

    expect(autorizacion?.estado).toBe('pendiente');
  });

  it('estado fuera de la unión EstadoAutorizacion cae al default "pendiente"', () => {
    const autorizacion = parseAutorizacionApi(autorizacionApiCompleta({ estado: 'algo-raro' }));

    expect(autorizacion?.estado).toBe('pendiente');
  });

  it('montoAutorizado, vigenciaDesde, cupoMensualDias y cupoMensualKm ausentes quedan undefined', () => {
    const record = autorizacionApiCompleta();
    delete record.montoAutorizado;
    delete record.vigenciaDesde;
    delete record.cupoMensualDias;
    delete record.cupoMensualKm;

    const autorizacion = parseAutorizacionApi(record);

    expect(autorizacion?.montoAutorizado).toBeUndefined();
    expect(autorizacion?.vigenciaDesde).toBeUndefined();
    expect(autorizacion?.cupoMensualDias).toBeUndefined();
    expect(autorizacion?.cupoMensualKm).toBeUndefined();
  });

  it('sin presupuestoId devuelve null', () => {
    const record = autorizacionApiCompleta();
    delete record.presupuestoId;

    expect(parseAutorizacionApi(record)).toBeNull();
  });
});

// -----------------------------------------------------------------------------------------------
// 3.1 — parseAutorizacionApi: `archivo` se lee directo de archivoNombre/archivoCargadoEn (la EF los
// expone tal cual, tasks.md Fase 2), NUNCA derivado de archivoUrl+fechaRespuesta (integracion-
// documentos-autorizaciones, design.md D4 — fechaRespuesta es la fecha en que respondió la obra
// social, no la fecha real de carga del archivo, son conceptos distintos).
// -----------------------------------------------------------------------------------------------

describe('parseAutorizacionApi — archivo (3.1, integracion-documentos-autorizaciones)', () => {
  it('archivoNombre y archivoCargadoEn presentes: arma un ArchivoAdjunto con clave = archivoUrl', () => {
    const autorizacion = parseAutorizacionApi(
      autorizacionApiCompleta({
        archivoUrl: 'autorizacion-1/9c1b-informe-final.pdf',
        archivoNombre: 'informe final.pdf',
        archivoCargadoEn: '2026-08-18T12:00:00.000Z',
      }),
    );

    expect(autorizacion?.archivo).toEqual({
      nombre: 'informe final.pdf',
      cargadoEn: '2026-08-18T12:00:00.000Z',
      clave: 'autorizacion-1/9c1b-informe-final.pdf',
    });
  });

  it('sin archivoNombre/archivoCargadoEn/archivoUrl: archivo queda undefined, incluso con fechaRespuesta presente (ya no se deriva)', () => {
    const autorizacion = parseAutorizacionApi(
      autorizacionApiCompleta({ fechaRespuesta: '2026-03-15', archivoUrl: undefined }),
    );

    expect(autorizacion?.archivo).toBeUndefined();
  });

  it('triangulación: archivoNombre presente pero archivoCargadoEn ausente no fabrica un archivo parcial', () => {
    const autorizacion = parseAutorizacionApi(
      autorizacionApiCompleta({
        archivoUrl: 'autorizacion-1/clave.pdf',
        archivoNombre: 'informe.pdf',
        archivoCargadoEn: undefined,
      }),
    );

    expect(autorizacion?.archivo).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------------------------
// 2.6 — toCrearAutorizacionPayload / toActualizarAutorizacionPayload
// -----------------------------------------------------------------------------------------------

function nuevaAutorizacionMinima(overrides: Partial<NuevaAutorizacion> = {}): NuevaAutorizacion {
  return {
    presupuestoId: 'presupuesto-1',
    estado: 'pendiente',
    ...overrides,
  };
}

describe('toCrearAutorizacionPayload (2.6)', () => {
  it('autorización mínima: body con solo presupuestoId y estado', () => {
    const payload = toCrearAutorizacionPayload(nuevaAutorizacionMinima());

    expect(payload).toEqual({ presupuestoId: 'presupuesto-1', estado: 'pendiente' });
  });

  it('autorización completa: todos los campos opcionales presentes viajan', () => {
    const payload = toCrearAutorizacionPayload(
      nuevaAutorizacionMinima({
        estado: 'autorizada',
        fechaRespuesta: '2026-03-15',
        montoAutorizado: 140000,
        vigenciaDesde: '2026-03-01',
        cupoMensualDias: 20,
        cupoMensualKm: 500,
      }),
    );

    expect(payload).toEqual({
      presupuestoId: 'presupuesto-1',
      estado: 'autorizada',
      fechaRespuesta: '2026-03-15',
      montoAutorizado: 140000,
      vigenciaDesde: '2026-03-01',
      cupoMensualDias: 20,
      cupoMensualKm: 500,
    });
  });
});

// -----------------------------------------------------------------------------------------------
// 5.2/5.6 — vigenciaHasta/conDependencia/archivo.tipoMime (design.md D1/D3/D6c de
// presupuestos-vigencia-datos-traslado-vista-previa)
// -----------------------------------------------------------------------------------------------

describe('parseAutorizacionApi — vigenciaHasta y conDependencia (5.6)', () => {
  it('vigenciaHasta/conDependencia presentes se mapean tal cual', () => {
    const autorizacion = parseAutorizacionApi(
      autorizacionApiCompleta({ vigenciaHasta: '2026-07-14', conDependencia: true }),
    );

    expect(autorizacion?.vigenciaHasta).toBe('2026-07-14');
    expect(autorizacion?.conDependencia).toBe(true);
  });

  it('conDependencia: false se preserva (SD decidido, desmarcado aunque el presupuesto lo pida)', () => {
    const autorizacion = parseAutorizacionApi(autorizacionApiCompleta({ conDependencia: false }));

    expect(autorizacion?.conDependencia).toBe(false);
  });

  it('vigenciaHasta/conDependencia ausentes quedan undefined', () => {
    const record = autorizacionApiCompleta();
    delete record.vigenciaHasta;
    delete record.conDependencia;

    const autorizacion = parseAutorizacionApi(record);

    expect(autorizacion?.vigenciaHasta).toBeUndefined();
    expect(autorizacion?.conDependencia).toBeUndefined();
  });
});

describe('parseAutorizacionApi — archivo.tipoMime (5.6, D6c)', () => {
  it('archivoTipoMime presente se mapea a archivo.tipoMime', () => {
    const autorizacion = parseAutorizacionApi(
      autorizacionApiCompleta({
        archivoUrl: 'autorizacion-1/9c1b-informe-final.pdf',
        archivoNombre: 'informe final.pdf',
        archivoCargadoEn: '2026-08-18T12:00:00.000Z',
        archivoTipoMime: 'application/pdf',
      }),
    );

    expect(autorizacion?.archivo?.tipoMime).toBe('application/pdf');
  });

  it('archivoTipoMime ausente (fila subida antes del 2026-08-18): tipoMime queda undefined, no descarta el archivo', () => {
    const autorizacion = parseAutorizacionApi(
      autorizacionApiCompleta({
        archivoUrl: 'autorizacion-1/9c1b-informe-final.pdf',
        archivoNombre: 'informe final.pdf',
        archivoCargadoEn: '2026-08-18T12:00:00.000Z',
      }),
    );

    expect(autorizacion?.archivo).toEqual({
      nombre: 'informe final.pdf',
      cargadoEn: '2026-08-18T12:00:00.000Z',
      clave: 'autorizacion-1/9c1b-informe-final.pdf',
      tipoMime: undefined,
    });
  });
});

describe('toCrearAutorizacionPayload — vigenciaHasta y conDependencia (5.6)', () => {
  it('vigenciaHasta/conDependencia presentes viajan en el body', () => {
    const payload = toCrearAutorizacionPayload(
      nuevaAutorizacionMinima({ vigenciaHasta: '2026-07-14', conDependencia: false }),
    );

    expect(payload.vigenciaHasta).toBe('2026-07-14');
    expect(payload.conDependencia).toBe(false);
  });

  it('vigenciaHasta/conDependencia ausentes: las claves no aparecen en el body', () => {
    const payload = toCrearAutorizacionPayload(nuevaAutorizacionMinima());

    expect('vigenciaHasta' in payload).toBe(false);
    expect('conDependencia' in payload).toBe(false);
  });
});

describe('toActualizarAutorizacionPayload — vigenciaHasta y conDependencia (5.6, D6b)', () => {
  it('solo vigenciaHasta seteada: el body tiene únicamente vigenciaHasta', () => {
    const payload = toActualizarAutorizacionPayload({ vigenciaHasta: '2026-07-14' });

    expect(payload).toEqual({ vigenciaHasta: '2026-07-14' });
  });

  it('conDependencia: false seteado explícitamente viaja (desmarcar CD/SD, no se confunde con ausente)', () => {
    const payload = toActualizarAutorizacionPayload({ conDependencia: false });

    expect(payload).toEqual({ conDependencia: false });
  });

  it('objeto vacío -> ninguna de las 2 claves viaja', () => {
    const payload = toActualizarAutorizacionPayload({});

    expect('vigenciaHasta' in payload).toBe(false);
    expect('conDependencia' in payload).toBe(false);
  });
});

// -----------------------------------------------------------------------------------------------
// 3.6 — periodoMes (autorizacion-mensual, design.md D2/D3) en las 3 direcciones + round-trip
// -----------------------------------------------------------------------------------------------

describe('parseAutorizacionApi — periodoMes (3.6, autorizacion-mensual)', () => {
  it('periodoMes presente se mapea tal cual', () => {
    const autorizacion = parseAutorizacionApi(autorizacionApiCompleta({ periodoMes: '2026-03-01' }));

    expect(autorizacion?.periodoMes).toBe('2026-03-01');
  });

  it('periodoMes ausente (fila legacy, D3) queda undefined, nunca inventado', () => {
    const record = autorizacionApiCompleta();
    delete record.periodoMes;

    const autorizacion = parseAutorizacionApi(record);

    expect(autorizacion?.periodoMes).toBeUndefined();
  });
});

describe('toCrearAutorizacionPayload — periodoMes (3.6)', () => {
  it('periodoMes presente viaja en el body', () => {
    const payload = toCrearAutorizacionPayload(nuevaAutorizacionMinima({ periodoMes: '2026-03-01' }));

    expect(payload.periodoMes).toBe('2026-03-01');
  });

  it('periodoMes ausente: la clave no aparece en el body (autorización legacy, mismo criterio !== undefined que el resto)', () => {
    const payload = toCrearAutorizacionPayload(nuevaAutorizacionMinima());

    expect('periodoMes' in payload).toBe(false);
  });
});

describe('toActualizarAutorizacionPayload — periodoMes (3.6, D6b)', () => {
  it('solo periodoMes seteado: el body tiene únicamente periodoMes (D11: editable en edición)', () => {
    const payload = toActualizarAutorizacionPayload({ periodoMes: '2026-04-01' });

    expect(payload).toEqual({ periodoMes: '2026-04-01' });
  });

  it('periodoMes ausente en el objeto de cambios: la clave no viaja, no pisa el mes ya cargado', () => {
    const payload = toActualizarAutorizacionPayload({ estado: 'autorizada' });

    expect('periodoMes' in payload).toBe(false);
  });
});

describe('round-trip periodoMes (3.6): API -> dominio -> payload de actualización conserva el valor', () => {
  it('un periodoMes que entra por parseAutorizacionApi sale idéntico en toActualizarAutorizacionPayload', () => {
    const autorizacion = parseAutorizacionApi(autorizacionApiCompleta({ periodoMes: '2026-05-01' }));
    expect(autorizacion).not.toBeNull();

    const payload = toActualizarAutorizacionPayload({ periodoMes: autorizacion?.periodoMes });

    expect(payload).toEqual({ periodoMes: '2026-05-01' });
  });

  it('una autorización legacy (periodoMes undefined) hace round-trip sin fabricar un mes', () => {
    const record = autorizacionApiCompleta();
    delete record.periodoMes;
    const autorizacion = parseAutorizacionApi(record);

    expect(autorizacion?.periodoMes).toBeUndefined();

    const payload = toActualizarAutorizacionPayload({ periodoMes: autorizacion?.periodoMes });
    expect('periodoMes' in payload).toBe(false);
  });
});

describe('toActualizarAutorizacionPayload (2.6) — clave ausente no viaja (D6b)', () => {
  it('solo estado seteado: el body tiene únicamente estado', () => {
    const payload = toActualizarAutorizacionPayload({ estado: 'rechazada' });

    expect(payload).toEqual({ estado: 'rechazada' });
    expect('montoAutorizado' in payload).toBe(false);
    expect('vigenciaDesde' in payload).toBe(false);
  });

  it('solo montoAutorizado seteado: el body tiene únicamente montoAutorizado', () => {
    const payload = toActualizarAutorizacionPayload({ montoAutorizado: 90000 });

    expect(payload).toEqual({ montoAutorizado: 90000 });
    expect('estado' in payload).toBe(false);
  });

  it('solo vigenciaDesde seteada: el body tiene únicamente vigenciaDesde', () => {
    const payload = toActualizarAutorizacionPayload({ vigenciaDesde: '2026-02-01' });

    expect(payload).toEqual({ vigenciaDesde: '2026-02-01' });
    expect('montoAutorizado' in payload).toBe(false);
  });

  it('objeto vacío -> body vacío: no pisa ningún campo que el usuario no tocó', () => {
    expect(toActualizarAutorizacionPayload({})).toEqual({});
  });
});
