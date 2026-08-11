import { describe, expect, it } from 'vitest';
import { agruparPorTipo, parseRequisitoActividadRow, toActualizarRequisitosActividadPayload } from './requisitosActividadMapping';

// documentos-checklist-items-por-actividad (tasks.md §4.1): mapeo puro fila<->dominio, mismo
// criterio que `obraSocialMapping.ts` — sin red, sin `any`, sin `as`. `SupabaseRequisitosActividadRepository.ts`
// es la única capa de I/O; acá solo se traduce.

describe('parseRequisitoActividadRow', () => {
  it('parsea una fila válida con su tipos_documento embebido', () => {
    const fila = { id: 'r-1', tipo_lugar: 'escuela', orden: 0, requerido: true, tipos_documento: { id: 't-1', tipo: 'Constancia' } };

    expect(parseRequisitoActividadRow(fila)).toEqual({
      tipoLugar: 'escuela',
      orden: 0,
      item: { id: 't-1', nombre: 'Constancia', requerido: true },
    });
  });

  it('descarta una fila sin el embed tipos_documento (null)', () => {
    const fila = { id: 'r-1', tipo_lugar: 'escuela', orden: 0, requerido: true, tipos_documento: null };

    expect(parseRequisitoActividadRow(fila)).toBeNull();
  });

  it('descarta una fila que no es un objeto', () => {
    expect(parseRequisitoActividadRow('no-es-un-objeto')).toBeNull();
    expect(parseRequisitoActividadRow(null)).toBeNull();
    expect(parseRequisitoActividadRow(undefined)).toBeNull();
  });

  it('descarta una fila con tipo_lugar que no es un string', () => {
    const fila = { id: 'r-1', tipo_lugar: 42, orden: 0, requerido: true, tipos_documento: { id: 't-1', tipo: 'Constancia' } };

    expect(parseRequisitoActividadRow(fila)).toBeNull();
  });

  it('requerido no-boolean cae a true (mismo criterio defensivo que parseRequisitoRow de obraSocialMapping)', () => {
    const fila = { id: 'r-1', tipo_lugar: 'escuela', orden: 0, requerido: 'sí', tipos_documento: { id: 't-1', tipo: 'Constancia' } };

    expect(parseRequisitoActividadRow(fila)?.item.requerido).toBe(true);
  });

  it('orden no-number cae a 0', () => {
    const fila = { id: 'r-1', tipo_lugar: 'escuela', orden: 'primero', requerido: true, tipos_documento: { id: 't-1', tipo: 'Constancia' } };

    expect(parseRequisitoActividadRow(fila)?.orden).toBe(0);
  });
});

describe('agruparPorTipo', () => {
  it('agrupa filas de varios tipos, cada una en su propia clave', () => {
    const filas = [
      { id: 'r-1', tipo_lugar: 'escuela', orden: 0, requerido: true, tipos_documento: { id: 't-1', tipo: 'Constancia' } },
      { id: 'r-2', tipo_lugar: 'terapia', orden: 0, requerido: true, tipos_documento: { id: 't-2', tipo: 'Orden médica' } },
    ];

    const resultado = agruparPorTipo(filas);

    expect(resultado.escuela).toEqual([{ id: 't-1', nombre: 'Constancia', requerido: true }]);
    expect(resultado.terapia).toEqual([{ id: 't-2', nombre: 'Orden médica', requerido: true }]);
  });

  it('ordena por orden asc dentro de cada tipo, desempatando por id (determinismo, mismo criterio que ordenarPorOrdenYId)', () => {
    const filas = [
      { id: 'r-2', tipo_lugar: 'escuela', orden: 1, requerido: true, tipos_documento: { id: 't-2', tipo: 'CBU' } },
      { id: 'r-1', tipo_lugar: 'escuela', orden: 0, requerido: true, tipos_documento: { id: 't-1', tipo: 'Constancia' } },
    ];

    expect(agruparPorTipo(filas).escuela?.map((item) => item.nombre)).toEqual(['Constancia', 'CBU']);
  });

  it('un tipo sin ninguna fila configurada no aparece como clave (Partial, nunca array vacío forzado)', () => {
    const filas = [{ id: 'r-1', tipo_lugar: 'escuela', orden: 0, requerido: true, tipos_documento: { id: 't-1', tipo: 'Constancia' } }];

    const resultado = agruparPorTipo(filas);

    expect(resultado.terapia).toBeUndefined();
    expect('terapia' in resultado).toBe(false);
  });

  it('un array vacío devuelve un objeto vacío', () => {
    expect(agruparPorTipo([])).toEqual({});
  });

  it('filas malformadas se descartan sin romper el resto de la colección', () => {
    const filas = [
      { id: 'r-1', tipo_lugar: 'escuela', orden: 0, requerido: true, tipos_documento: { id: 't-1', tipo: 'Constancia' } },
      { id: 'r-2', tipo_lugar: 'escuela', orden: 1, requerido: true, tipos_documento: null },
    ];

    expect(agruparPorTipo(filas).escuela).toHaveLength(1);
  });

  it('un valor que no es un array devuelve un objeto vacío (defensivo)', () => {
    expect(agruparPorTipo(null)).toEqual({});
    expect(agruparPorTipo(undefined)).toEqual({});
  });
});

describe('toActualizarRequisitosActividadPayload', () => {
  it('mapea nombre y requerido, derivando el orden del índice del array (mismo criterio que checklistAPayload de obraSocialMapping)', () => {
    const items = [
      { id: 't-1', nombre: 'Constancia', requerido: true },
      { id: 't-2', nombre: 'CBU', requerido: false },
    ];

    expect(toActualizarRequisitosActividadPayload(items)).toEqual([
      { nombre: 'Constancia', requerido: true },
      { nombre: 'CBU', requerido: false },
    ]);
  });

  it('una lista vacía produce un payload vacío', () => {
    expect(toActualizarRequisitosActividadPayload([])).toEqual([]);
  });
});
