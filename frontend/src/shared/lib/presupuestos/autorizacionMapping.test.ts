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
