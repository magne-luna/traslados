import { describe, expect, it } from 'vitest';
import { componentesFecha, periodosDelRango } from './periodos';

// tasks.md 3.1/3.2, design.md Decisión 4 y Risks (zonas horarias): periodosDelRango arma el eje
// de meses del reporte (del más antiguo al más reciente, incluyendo el mes de `hoy`);
// componentesFecha es el helper de atribución por componentes de fecha (nunca aritmética de
// `Date`) que usan facturadoVsCobrado/resumenAnual para no correr el mes por zona horaria.

describe('periodosDelRango', () => {
  it('devuelve 3 meses terminando en el mes de la fecha de referencia', () => {
    const puntos = periodosDelRango({ hoy: '2026-06-15', meses: 3 });
    expect(puntos).toEqual([
      { mes: 4, anio: 2026 },
      { mes: 5, anio: 2026 },
      { mes: 6, anio: 2026 },
    ]);
  });

  it('devuelve 6 meses terminando en el mes de la fecha de referencia', () => {
    const puntos = periodosDelRango({ hoy: '2026-06-15', meses: 6 });
    expect(puntos).toEqual([
      { mes: 1, anio: 2026 },
      { mes: 2, anio: 2026 },
      { mes: 3, anio: 2026 },
      { mes: 4, anio: 2026 },
      { mes: 5, anio: 2026 },
      { mes: 6, anio: 2026 },
    ]);
  });

  it('devuelve 12 meses cruzando el límite de año (diciembre → enero)', () => {
    const puntos = periodosDelRango({ hoy: '2026-01-15', meses: 12 });
    expect(puntos[0]).toEqual({ mes: 2, anio: 2025 });
    expect(puntos.at(-1)).toEqual({ mes: 1, anio: 2026 });
    expect(puntos).toHaveLength(12);
  });

  it('la longitud del resultado siempre iguala la cantidad de meses solicitada', () => {
    expect(periodosDelRango({ hoy: '2026-06-15', meses: 3 })).toHaveLength(3);
    expect(periodosDelRango({ hoy: '2026-06-15', meses: 6 })).toHaveLength(6);
    expect(periodosDelRango({ hoy: '2026-06-15', meses: 12 })).toHaveLength(12);
  });
});

describe('componentesFecha', () => {
  it('parsea año/mes/día del primer día del mes sin desplazarse por zona horaria', () => {
    expect(componentesFecha('2026-03-01')).toEqual({ anio: 2026, mes: 3, dia: 1 });
  });

  it('parsea año/mes/día del último día del mes sin desplazarse por zona horaria', () => {
    expect(componentesFecha('2026-03-31')).toEqual({ anio: 2026, mes: 3, dia: 31 });
  });

  it('ignora la porción de hora si el ISO trae timestamp completo', () => {
    expect(componentesFecha('2026-12-01T00:00:00.000Z')).toEqual({ anio: 2026, mes: 12, dia: 1 });
  });
});
