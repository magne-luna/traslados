import { describe, expect, it } from 'vitest';
import {
  coincidePeriodoFacturado,
  etiquetaPeriodoMes,
  normalizarPeriodoMes,
  ordinalMes,
  PeriodoMesInvalidoError,
  validarCoherenciaPeriodo,
} from './periodoAutorizacion';

// Funciones puras de `autorizacion-mensual` (tasks.md 3.2-3.5, design.md D2/D7). Sin red, sin
// `any`, sin `as`. `periodoMes` se persiste como `DATE` día-1 absoluto en ISO `YYYY-MM-01`
// (design.md D2): estas funciones son las que garantizan esa forma antes de que el `CHECK` de la
// base la rechace.

// -----------------------------------------------------------------------------------------------
// 3.2 — normalizarPeriodoMes
// -----------------------------------------------------------------------------------------------

describe('normalizarPeriodoMes (3.2)', () => {
  it('"2026-03" (YYYY-MM) normaliza a día 1', () => {
    expect(normalizarPeriodoMes('2026-03')).toBe('2026-03-01');
  });

  it('"2026-03-15" (día distinto de 1) normaliza a día 1', () => {
    expect(normalizarPeriodoMes('2026-03-15')).toBe('2026-03-01');
  });

  it('"2026-03-01" (ya normalizado) se preserva', () => {
    expect(normalizarPeriodoMes('2026-03-01')).toBe('2026-03-01');
  });

  it('triangulación: diciembre no rompe el corrimiento de año', () => {
    expect(normalizarPeriodoMes('2026-12-31')).toBe('2026-12-01');
  });

  // Decisión (3.2, sin resolver en design.md): la firma de la tabla de contrato de D2 declara
  // `normalizarPeriodoMes(valor: string): string` — retorno NO opcional. Una entrada con formato
  // irreconocible no puede devolver un string inventado (violaría "nunca fabricar un dato
  // financiero", mismo criterio que D3 para `periodoMes` ausente) ni `undefined` (rompería la
  // firma declarada en el design). Se elige **throw** con un error de dominio nombrado
  // (`PeriodoMesInvalidoError`), para que el llamador (formulario, mapping) decida cómo mostrarlo,
  // en vez de devolver silenciosamente un período incorrecto.
  it('entrada con formato irreconocible: throw PeriodoMesInvalidoError', () => {
    expect(() => normalizarPeriodoMes('no-es-una-fecha')).toThrow(PeriodoMesInvalidoError);
  });

  it('triangulación de la entrada inválida: mes fuera de rango (13) también throw', () => {
    expect(() => normalizarPeriodoMes('2026-13')).toThrow(PeriodoMesInvalidoError);
  });

  it('triangulación de la entrada inválida: string vacío también throw', () => {
    expect(() => normalizarPeriodoMes('')).toThrow(PeriodoMesInvalidoError);
  });
});

// -----------------------------------------------------------------------------------------------
// 3.3 — ordinalMes
// -----------------------------------------------------------------------------------------------

describe('ordinalMes (3.3)', () => {
  it('orden normal: mes 1, mes 2, mes 3 por posición ascendente', () => {
    const periodos = ['2026-03-01', '2026-04-01', '2026-05-01'];

    expect(ordinalMes('2026-03-01', periodos)).toBe(1);
    expect(ordinalMes('2026-04-01', periodos)).toBe(2);
    expect(ordinalMes('2026-05-01', periodos)).toBe(3);
  });

  // Decisión (3.3): un mes salteado (marzo y mayo cargados, sin abril) NO corrompe el ordinal —
  // sigue siendo secuencial por POSICIÓN entre los períodos efectivamente cargados, nunca por
  // distancia calendario (design.md D2, motivo 1: "se corrompe si se saltea un mes" es
  // precisamente lo que un ordinal *persistido* haría mal; acá se deriva, así que no aplica).
  it('mes salteado: marzo y mayo cargados sin abril -> mayo es "mes 2", no "mes 3"', () => {
    const periodos = ['2026-03-01', '2026-05-01'];

    expect(ordinalMes('2026-03-01', periodos)).toBe(1);
    expect(ordinalMes('2026-05-01', periodos)).toBe(2);
  });

  // Decisión (3.3, RN-PA-02): carga fuera de orden -> el ordinal se recalcula por FECHA, no por
  // orden de inserción. `periodosDelPresupuesto` refleja el orden en que llegaron (mayo antes que
  // marzo), pero el resultado ordena por valor de `periodoMes`, no por posición en el array de
  // entrada (design.md D2, motivo 2).
  it('carga fuera de orden: mayo se carga antes que marzo, el ordinal igual sale por fecha', () => {
    const periodosOrdenDeCarga = ['2026-05-01', '2026-03-01'];

    expect(ordinalMes('2026-03-01', periodosOrdenDeCarga)).toBe(1);
    expect(ordinalMes('2026-05-01', periodosOrdenDeCarga)).toBe(2);
  });

  // Decisión (3.3): las filas legacy (`periodoMes: undefined`) NO tienen ordinal propio (siempre
  // `undefined` para ellas) y tampoco CUENTAN para la posición de las filas con mes: el ordinal es
  // "Mes N" entre los meses reales, no entre "todas las filas, incluida la que no tiene mes".
  it('lista con legacy (undefined) mezclada: legacy no tiene ordinal y no corre la numeración de las demás', () => {
    const periodos = [undefined, '2026-03-01', '2026-04-01'];

    expect(ordinalMes(undefined, periodos)).toBeUndefined();
    expect(ordinalMes('2026-03-01', periodos)).toBe(1);
    expect(ordinalMes('2026-04-01', periodos)).toBe(2);
  });

  it('periodoMes no está entre los períodos provistos: undefined (defensivo, no debería pasar con datos reales)', () => {
    expect(ordinalMes('2026-09-01', ['2026-03-01'])).toBeUndefined();
  });
});

// -----------------------------------------------------------------------------------------------
// 3.4 — etiquetaPeriodoMes
// -----------------------------------------------------------------------------------------------

describe('etiquetaPeriodoMes (3.4)', () => {
  it('"2026-03-01" -> "marzo 2026" (design.md D2, tabla de contrato)', () => {
    expect(etiquetaPeriodoMes('2026-03-01')).toBe('marzo 2026');
  });

  it('triangulación: diciembre no se corre de año ("2026-12-01" -> "diciembre 2026")', () => {
    expect(etiquetaPeriodoMes('2026-12-01')).toBe('diciembre 2026');
  });

  // Decisión (3.4): `undefined` -> 'Sin mes cargado', NUNCA un mes inventado (design.md D2 y D3,
  // textual). Es el mismo criterio que `presupuestos-vigencia-…` usa para vigencia ausente.
  it('undefined -> "Sin mes cargado", nunca un mes inventado', () => {
    expect(etiquetaPeriodoMes(undefined)).toBe('Sin mes cargado');
  });
});

// -----------------------------------------------------------------------------------------------
// 3.5 — coincidePeriodoFacturado / validarCoherenciaPeriodo (D7)
// -----------------------------------------------------------------------------------------------

describe('coincidePeriodoFacturado (3.5, D2/D7 — booleano simple, insumo de la preselección)', () => {
  it('coincide: mismo mes/año', () => {
    expect(
      coincidePeriodoFacturado({ periodoMes: '2026-03-01', mesFacturado: 3, anioFacturado: 2026 }),
    ).toBe(true);
  });

  it('no coincide: mes distinto', () => {
    expect(
      coincidePeriodoFacturado({ periodoMes: '2026-03-01', mesFacturado: 4, anioFacturado: 2026 }),
    ).toBe(false);
  });

  it('no coincide: año distinto (mismo número de mes)', () => {
    expect(
      coincidePeriodoFacturado({ periodoMes: '2026-03-01', mesFacturado: 3, anioFacturado: 2027 }),
    ).toBe(false);
  });

  it('autorización legacy sin período: nunca coincide (no hay con qué comparar)', () => {
    expect(
      coincidePeriodoFacturado({ periodoMes: undefined, mesFacturado: 3, anioFacturado: 2026 }),
    ).toBe(false);
  });
});

// Decisión (3.5): `coincidePeriodoFacturado` respeta la firma booleana de la tabla de contrato de
// D2 (es el insumo "¿preselecciono o no?"). Pero D7 exige que el AVISO de coherencia distinga
// "no coincide" de "autorización legacy sin período" — un booleano plano fusionaría ambos casos en
// `false` y el aviso mostraría el mismo mensaje para dos situaciones de negocio distintas (una es
// "elegiste mal el mes", la otra es "esta fila es de antes de este change y no tiene mes que
// comparar"). Por eso `validarCoherenciaPeriodo` devuelve una unión de 3 literales, no un booleano.
describe('validarCoherenciaPeriodo (3.5, D7 — distingue 3 estados, no un booleano plano)', () => {
  it('coincide', () => {
    expect(
      validarCoherenciaPeriodo({ periodoMes: '2026-03-01', mesFacturado: 3, anioFacturado: 2026 }),
    ).toBe('coincide');
  });

  it('no-coincide', () => {
    expect(
      validarCoherenciaPeriodo({ periodoMes: '2026-04-01', mesFacturado: 3, anioFacturado: 2026 }),
    ).toBe('no-coincide');
  });

  it('legacy-sin-periodo: autorización sin periodoMes, nunca "no-coincide"', () => {
    expect(
      validarCoherenciaPeriodo({ periodoMes: undefined, mesFacturado: 3, anioFacturado: 2026 }),
    ).toBe('legacy-sin-periodo');
  });
});
