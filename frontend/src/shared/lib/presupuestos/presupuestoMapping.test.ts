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
