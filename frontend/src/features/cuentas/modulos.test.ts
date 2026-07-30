import { describe, expect, it } from 'vitest';
import { MODULO_COLOR, MODULOS, filasAPermisos, filasSonIguales, filasVacias, mapaAFilas } from './modulos';

// tasks.md 5.2 (permisos-modulos-granulares): el catálogo pasa de 4 a 7 módulos, alineado 1:1 con
// las 7 pantallas del sidebar (design.md, proposal.md) — pacientes/hojas_de_ruta,
// facturacion/presupuestos, conductores/vehiculos separados, obra_social sin cambios.
// SUBMODULOS_MODULO se elimina (design.md D4): con la separación 1:1 ya no hace falta aclarar
// "incluye X e Y", así que este archivo ya no la testea.

describe('MODULOS', () => {
  it('tiene exactamente los 7 módulos reales, en orden estable', () => {
    expect(MODULOS).toEqual([
      'pacientes',
      'hojas_de_ruta',
      'obra_social',
      'facturacion',
      'presupuestos',
      'conductores',
      'vehiculos',
    ]);
  });
});

describe('MODULO_COLOR', () => {
  it('define un color de identidad para cada uno de los 7 módulos reales', () => {
    for (const modulo of MODULOS) {
      expect(MODULO_COLOR[modulo]).toBeDefined();
    }
  });

  it('cada módulo hijo reutiliza el tono de su módulo padre (design.md D5)', () => {
    expect(MODULO_COLOR.hojas_de_ruta).toBe(MODULO_COLOR.pacientes);
    expect(MODULO_COLOR.presupuestos).toBe(MODULO_COLOR.facturacion);
    expect(MODULO_COLOR.vehiculos).toBe(MODULO_COLOR.conductores);
  });
});

describe('mapaAFilas', () => {
  it('mapea un MapaPermisos parcial a las 7 filas, con "sin_acceso" para los módulos ausentes', () => {
    const filas = mapaAFilas({ pacientes: 'write', vehiculos: 'read' });

    expect(filas).toEqual({
      pacientes: 'write',
      hojas_de_ruta: 'sin_acceso',
      obra_social: 'sin_acceso',
      facturacion: 'sin_acceso',
      presupuestos: 'sin_acceso',
      conductores: 'sin_acceso',
      vehiculos: 'read',
    });
  });

  it('un módulo padre y su módulo hijo se mapean de forma independiente (triangulación de desacople)', () => {
    const filas = mapaAFilas({ pacientes: 'write', hojas_de_ruta: 'read' });

    expect(filas.pacientes).toBe('write');
    expect(filas.hojas_de_ruta).toBe('read');
  });
});

describe('filasVacias', () => {
  it('devuelve las 7 filas en "sin_acceso"', () => {
    const filas = filasVacias();
    for (const modulo of MODULOS) {
      expect(filas[modulo]).toBe('sin_acceso');
    }
  });
});

describe('filasAPermisos', () => {
  it('convierte las filas con nivel real a Permiso[], excluyendo "sin_acceso"', () => {
    const filas = mapaAFilas({ facturacion: 'admin', presupuestos: 'read' });

    expect(filasAPermisos(filas)).toEqual(
      expect.arrayContaining([
        { modulo: 'facturacion', nivelAcceso: 'admin' },
        { modulo: 'presupuestos', nivelAcceso: 'read' },
      ]),
    );
    expect(filasAPermisos(filas)).toHaveLength(2);
  });

  it('un módulo hijo con nivel distinto al de su padre viaja como una entrada independiente (triangulación)', () => {
    const filas = mapaAFilas({ conductores: 'write', vehiculos: 'read' });
    const permisos = filasAPermisos(filas);

    expect(permisos).toContainEqual({ modulo: 'conductores', nivelAcceso: 'write' });
    expect(permisos).toContainEqual({ modulo: 'vehiculos', nivelAcceso: 'read' });
  });

  it('todas las filas en "sin_acceso" produce un array vacío', () => {
    expect(filasAPermisos(filasVacias())).toEqual([]);
  });
});

describe('filasSonIguales', () => {
  it('dos mapas de 7 filas con los mismos valores son iguales', () => {
    const a = mapaAFilas({ pacientes: 'read' });
    const b = mapaAFilas({ pacientes: 'read' });
    expect(filasSonIguales(a, b)).toBe(true);
  });

  it('diferir en un solo módulo (de los 7) alcanza para no ser iguales', () => {
    const a = mapaAFilas({ vehiculos: 'read' });
    const b = mapaAFilas({ vehiculos: 'write' });
    expect(filasSonIguales(a, b)).toBe(false);
  });
});
