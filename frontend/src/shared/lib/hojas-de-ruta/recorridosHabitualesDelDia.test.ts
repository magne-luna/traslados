import { describe, expect, it } from 'vitest';
import type { RecorridoHabitual } from '../../types/recorridoHabitual';
import { agruparRecorridosHabitualesPorDia, diaSemanaDeFechaIso } from './recorridosHabitualesDelDia';

// Funciones puras del selector "Destino habitual" de Hojas de Ruta: cruzan la FECHA de la hoja
// del día con el `diaSemana` de los `RecorridoHabitual` del paciente (RF-110) para ofrecer
// primero los que corresponden a ese día, sin esconder los demás. Sin efectos de red ni
// localStorage (mismo criterio que sugerirRecorridoExistente.ts).

function habitual(id: string, overrides: Partial<RecorridoHabitual> = {}): RecorridoHabitual {
  return {
    id,
    pacienteId: 'paciente-1',
    direccionInicialId: 'dir-casa',
    direccionFinalId: 'dir-escuela',
    diaSemana: 'lunes',
    hora: '08:00',
    ...overrides,
  };
}

describe('diaSemanaDeFechaIso', () => {
  it('resuelve el día de la semana de una fecha ISO', () => {
    // 2026-08-27 es un jueves.
    expect(diaSemanaDeFechaIso('2026-08-27')).toBe('jueves');
  });

  it('resuelve el domingo (índice 0 de Date.getDay) sin corrimiento', () => {
    // 2026-08-30 es un domingo.
    expect(diaSemanaDeFechaIso('2026-08-30')).toBe('domingo');
  });

  it('NO se corre un día por zona horaria negativa (UTC-3)', () => {
    // Gotcha real: `new Date('2026-08-24')` se parsea como medianoche UTC y `.getDay()` la lee en
    // hora local — en Argentina (UTC-3) eso cae el domingo 23 y devolvería el día anterior. La
    // fecha de la hoja de ruta es un día calendario, no un instante: se parsea a mano.
    expect(diaSemanaDeFechaIso('2026-08-24')).toBe('lunes');
  });

  it('devuelve undefined ante una fecha vacía o con formato inválido', () => {
    expect(diaSemanaDeFechaIso('')).toBeUndefined();
    expect(diaSemanaDeFechaIso('27/08/2026')).toBeUndefined();
    expect(diaSemanaDeFechaIso('2026-13-40')).toBeUndefined();
  });
});

describe('agruparRecorridosHabitualesPorDia', () => {
  it('separa los del día de la fecha de los del resto de la semana', () => {
    const lunes = habitual('h-lunes', { diaSemana: 'lunes' });
    const jueves = habitual('h-jueves', { diaSemana: 'jueves' });

    // 2026-08-27 es jueves.
    const agrupado = agruparRecorridosHabitualesPorDia([lunes, jueves], '2026-08-27');

    expect(agrupado.diaDeLaFecha).toBe('jueves');
    expect(agrupado.delDia.map((r) => r.id)).toEqual(['h-jueves']);
    expect(agrupado.otrosDias.map((r) => r.id)).toEqual(['h-lunes']);
  });

  it('ordena los del día por hora ascendente', () => {
    const tarde = habitual('h-tarde', { diaSemana: 'jueves', hora: '16:30' });
    const manana = habitual('h-manana', { diaSemana: 'jueves', hora: '08:00' });

    const agrupado = agruparRecorridosHabitualesPorDia([tarde, manana], '2026-08-27');

    expect(agrupado.delDia.map((r) => r.id)).toEqual(['h-manana', 'h-tarde']);
  });

  it('ordena los otros días por orden de semana (lunes primero) y después por hora', () => {
    const viernes = habitual('h-viernes', { diaSemana: 'viernes', hora: '09:00' });
    const lunesTarde = habitual('h-lunes-tarde', { diaSemana: 'lunes', hora: '17:00' });
    const lunesManana = habitual('h-lunes-manana', { diaSemana: 'lunes', hora: '07:00' });

    const agrupado = agruparRecorridosHabitualesPorDia([viernes, lunesTarde, lunesManana], '2026-08-27');

    expect(agrupado.otrosDias.map((r) => r.id)).toEqual(['h-lunes-manana', 'h-lunes-tarde', 'h-viernes']);
  });

  it('sin fecha válida deja todo en otrosDias, sin día resuelto', () => {
    const lunes = habitual('h-lunes', { diaSemana: 'lunes' });
    const jueves = habitual('h-jueves', { diaSemana: 'jueves' });

    const agrupado = agruparRecorridosHabitualesPorDia([lunes, jueves], '');

    expect(agrupado.diaDeLaFecha).toBeUndefined();
    expect(agrupado.delDia).toEqual([]);
    expect(agrupado.otrosDias.map((r) => r.id)).toEqual(['h-lunes', 'h-jueves']);
  });

  it('no muta el array recibido', () => {
    const entrada = [habitual('h-2', { diaSemana: 'jueves', hora: '16:00' }), habitual('h-1', { diaSemana: 'jueves', hora: '08:00' })];
    const copia = [...entrada];

    agruparRecorridosHabitualesPorDia(entrada, '2026-08-27');

    expect(entrada).toEqual(copia);
  });
});
