import { describe, expect, it } from 'vitest';
import { calcularKmMensuales, calcularMontoMensualEstimado, calcularViajesMensuales } from './calculoViajes';

// Función pura (tasks.md 4.1-4.6, design.md D4): el cálculo de viajes/km mensuales no existía en el
// repo (`rg -i viaje` no devolvía lógica, solo prosa) — no es un fix de bug, es la primera
// implementación, y el motivo de existir del módulo es que 23 días hábiles con vuelta son 46 viajes
// (ida + vuelta), no 24 como decía el doc de referencia que usaba el equipo a mano.

describe('calcularViajesMensuales', () => {
  it('23 días hábiles con vuelta son 46 viajes (ida + vuelta)', () => {
    expect(calcularViajesMensuales({ diasMensuales: 23, tieneVuelta: true })).toBe(46);
  });

  it('23 días NO son 24 viajes (bug del doc de referencia)', () => {
    // Regresión nombrada a propósito (tasks.md 4.4): el doc de referencia que usaba el equipo a mano
    // calculaba 24 viajes para 23 días hábiles con vuelta. Es matemáticamente incorrecto — este test
    // existe para que nadie "corrija" el módulo de vuelta hacia ese valor.
    expect(calcularViajesMensuales({ diasMensuales: 23, tieneVuelta: true })).not.toBe(24);
  });

  it('sin vuelta, los viajes mensuales son iguales a los días mensuales', () => {
    expect(calcularViajesMensuales({ diasMensuales: 23, tieneVuelta: false })).toBe(23);
  });

  it('0 días mensuales son 0 viajes, con o sin vuelta', () => {
    expect(calcularViajesMensuales({ diasMensuales: 0, tieneVuelta: true })).toBe(0);
    expect(calcularViajesMensuales({ diasMensuales: 0, tieneVuelta: false })).toBe(0);
  });

  it('1 día con vuelta son 2 viajes', () => {
    expect(calcularViajesMensuales({ diasMensuales: 1, tieneVuelta: true })).toBe(2);
  });

  it('rechaza diasMensuales negativo (entrada inválida, no un caso de negocio válido)', () => {
    // Decisión (tasks.md 4.3): `diasMensuales` negativo no representa ningún escenario real de
    // "días hábiles del mes" — 0 ya cubre "no configurado todavía". Devolver 0 en silencio
    // enmascararía un dato corrupto (ej. un cálculo previo mal hecho aguas arriba); lanzar deja el
    // error visible en vez de propagar un número incorrecto al formulario.
    expect(() => calcularViajesMensuales({ diasMensuales: -1, tieneVuelta: true })).toThrow(RangeError);
  });
});

describe('calcularKmMensuales', () => {
  it('multiplica los días mensuales por la suma de km de ida y vuelta cuando hay vuelta', () => {
    expect(
      calcularKmMensuales({ diasMensuales: 23, tieneVuelta: true, kmIda: 10, kmVuelta: 12 }),
    ).toBe(506); // 23 * (10 + 12)
  });

  it('sin vuelta, solo cuenta el km de ida', () => {
    expect(
      calcularKmMensuales({ diasMensuales: 23, tieneVuelta: false, kmIda: 10, kmVuelta: 12 }),
    ).toBe(230); // 23 * 10, kmVuelta se ignora
  });

  it('soporta decimales en el km', () => {
    expect(
      calcularKmMensuales({ diasMensuales: 20, tieneVuelta: true, kmIda: 5.5, kmVuelta: 4.25 }),
    ).toBeCloseTo(195, 5); // 20 * (5.5 + 4.25)
  });

  it('km en 0 da 0 km mensuales', () => {
    expect(
      calcularKmMensuales({ diasMensuales: 23, tieneVuelta: true, kmIda: 0, kmVuelta: 0 }),
    ).toBe(0);
  });

  it('0 días mensuales dan 0 km mensuales aunque haya km cargado', () => {
    expect(
      calcularKmMensuales({ diasMensuales: 0, tieneVuelta: true, kmIda: 10, kmVuelta: 12 }),
    ).toBe(0);
  });

  it('rechaza diasMensuales negativo, igual que calcularViajesMensuales', () => {
    expect(() =>
      calcularKmMensuales({ diasMensuales: -5, tieneVuelta: true, kmIda: 10, kmVuelta: 12 }),
    ).toThrow(RangeError);
  });
});

// Andrea (2026-10-07): "mejor menos que más" — se trunca a 2 decimales, nunca se redondea para arriba.
describe('calcularMontoMensualEstimado', () => {
  it('km mensuales × valor del km', () => {
    expect(calcularMontoMensualEstimado({ kmMensuales: 264, valorKm: 1000 })).toBe(264000);
  });

  it('trunca a 2 decimales en vez de redondear', () => {
    // 12.5 × 905.31 = 11316.375 → 11316.37 (redondeando daría 11316.38)
    expect(calcularMontoMensualEstimado({ kmMensuales: 12.5, valorKm: 905.31 })).toBe(11316.37);
  });

  it('no se pasa por error de coma flotante (0.1 × 3 = 0.30000000000000004)', () => {
    expect(calcularMontoMensualEstimado({ kmMensuales: 3, valorKm: 0.1 })).toBe(0.3);
  });
});
