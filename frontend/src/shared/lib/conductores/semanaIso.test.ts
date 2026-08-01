import { describe, expect, it } from 'vitest';
import { semanaIsoADesdeHasta, desdeHastaASemanaIso } from './semanaIso';

// semanaIso.ts: módulo aritmético puro (tasks.md §6.1, design.md D7), sin nada de Postgres.
// `semanaIsoADesdeHasta('2026-W30')` -> { desde: lunes, hasta: domingo }.
// `desdeHastaASemanaIso(init, fin)` -> la semana ISO que contiene `init`.

describe('semanaIsoADesdeHasta', () => {
  it('devuelve el lunes y el domingo de una semana ISO común', () => {
    // 2026-W30: 2026-01-01 es jueves, así que la semana 1 arranca el 2025-12-29 (lunes).
    // W30 = 29 semanas después: lunes 2026-07-20, domingo 2026-07-26.
    expect(semanaIsoADesdeHasta('2026-W30')).toEqual({ desde: '2026-07-20', hasta: '2026-07-26' });
  });

  it('la semana 1 ISO es la que contiene el primer jueves del año, no la del 1 de enero', () => {
    // 2027-01-01 es viernes: el primer jueves de 2027 cae el 2027-01-07, así que la semana 1
    // arranca el lunes 2027-01-04, no el 2027-01-01.
    expect(semanaIsoADesdeHasta('2027-W01')).toEqual({ desde: '2027-01-04', hasta: '2027-01-10' });
  });

  it('resuelve un año de 53 semanas sin desbordar a la semana 1 del año siguiente', () => {
    // 2026 es un año ISO de 53 semanas (2026-01-01 es jueves): la semana 53 arranca el
    // 2026-12-28 y termina el 2027-01-03, dentro del año calendario 2027 pero de la MISMA semana
    // ISO 2026-W53 (no la 2027-W01).
    expect(semanaIsoADesdeHasta('2026-W53')).toEqual({ desde: '2026-12-28', hasta: '2027-01-03' });
  });

  it('una semana que cruza el cambio de año devuelve un lunes en diciembre y un domingo en enero', () => {
    const { desde, hasta } = semanaIsoADesdeHasta('2026-W53');
    expect(desde.startsWith('2026-12')).toBe(true);
    expect(hasta.startsWith('2027-01')).toBe(true);
  });
});

describe('desdeHastaASemanaIso', () => {
  it('reconstruye la etiqueta ISO desde el par de fechas de una semana común', () => {
    expect(desdeHastaASemanaIso('2026-07-20', '2026-07-26')).toBe('2026-W30');
  });

  it('parsea un DATE de Postgres como fecha local, sin corrimiento de zona horaria', () => {
    // 2026-07-27 es lunes; si se parseara con `new Date('2026-07-27')` (interpretado como UTC) y
    // el entorno estuviera en una zona con offset negativo, los componentes locales devolverían
    // el día anterior (26, domingo) y la semana calculada sería la incorrecta (W29). El resultado
    // correcto, parseando a componentes y construyendo la fecha local, es W31.
    expect(desdeHastaASemanaIso('2026-07-27', '2026-08-02')).toBe('2026-W31');
  });

  it('una fila incoherente (fecha_init que no es lunes) deriva la semana que la contiene, no la descarta', () => {
    // 2026-07-22 es miércoles, dentro de la semana 2026-W30 (lunes 2026-07-20 a domingo
    // 2026-07-26). fecha_fin_semana llega desalineada (no es domingo de esa semana) y NO
    // participa del cálculo: se deriva la semana que contiene fecha_init tal cual.
    expect(desdeHastaASemanaIso('2026-07-22', '2026-07-24')).toBe('2026-W30');
  });

  it('una semana que cruza el cambio de año se reconstruye igual en ambos sentidos', () => {
    const { desde, hasta } = semanaIsoADesdeHasta('2026-W53');
    expect(desdeHastaASemanaIso(desde, hasta)).toBe('2026-W53');
  });
});

describe('round-trip semanaIsoADesdeHasta <-> desdeHastaASemanaIso', () => {
  it('ida y vuelta para >= 10 semanas distintas repartidas en el año', () => {
    const semanas = [
      '2026-W01',
      '2026-W05',
      '2026-W10',
      '2026-W20',
      '2026-W26',
      '2026-W30',
      '2026-W35',
      '2026-W40',
      '2026-W48',
      '2026-W52',
      '2026-W53',
      '2027-W01',
    ];

    for (const semana of semanas) {
      const { desde, hasta } = semanaIsoADesdeHasta(semana);
      expect(desdeHastaASemanaIso(desde, hasta)).toBe(semana);
    }
  });
});
