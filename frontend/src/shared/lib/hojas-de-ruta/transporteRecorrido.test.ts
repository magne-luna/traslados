import { describe, expect, it } from 'vitest';
import type { TransporteRecorrido } from '../../types/hojaDeRuta';
import { esPropio, etiquetaTransporte, validarTransporte } from './transporteRecorrido';

// viajes-tercerizados-hoja-de-ruta, tasks.md 3.2 (design.md D4).

const vehiculos = [{ id: 'v1', patente: 'AB123CD', modelo: 'Sprinter' }];
const conductores = [{ id: 'c1', apellido: 'Gómez', nombre: 'Luis' }];

describe('etiquetaTransporte', () => {
  it('propio: patente · modelo — Apellido, Nombre', () => {
    const t: TransporteRecorrido = { tipoTransporte: 'propio', vehiculoId: 'v1', conductorId: 'c1' };
    expect(etiquetaTransporte(t, vehiculos, conductores)).toBe('AB123CD · Sprinter — Gómez, Luis');
  });

  it('propio con referencias que no se pueden resolver', () => {
    const t: TransporteRecorrido = { tipoTransporte: 'propio', vehiculoId: 'vx', conductorId: 'cx' };
    expect(etiquetaTransporte(t, vehiculos, conductores)).toBe('Vehículo desconocido — Conductor desconocido');
  });

  it('aplicación: "Uber / aplicación"', () => {
    expect(etiquetaTransporte({ tipoTransporte: 'aplicacion' }, vehiculos, conductores)).toBe('Uber / aplicación');
  });

  it('remis: "Remis · <agencia>"', () => {
    expect(etiquetaTransporte({ tipoTransporte: 'remis', agenciaRemis: 'París' }, vehiculos, conductores)).toBe('Remis · París');
  });
});

describe('esPropio', () => {
  it('solo es true para propio', () => {
    expect(esPropio({ tipoTransporte: 'propio', vehiculoId: 'v1', conductorId: 'c1' })).toBe(true);
    expect(esPropio({ tipoTransporte: 'aplicacion' })).toBe(false);
    expect(esPropio({ tipoTransporte: 'remis', agenciaRemis: 'RSM' })).toBe(false);
  });
});

describe('validarTransporte', () => {
  it('remis con agencia vacía o solo espacios → pide la agencia', () => {
    expect(validarTransporte({ tipoTransporte: 'remis', agenciaRemis: '' })).toMatch(/agencia/i);
    expect(validarTransporte({ tipoTransporte: 'remis', agenciaRemis: '   ' })).toMatch(/agencia/i);
  });

  it('propio sin vehículo o sin conductor → mensaje', () => {
    expect(validarTransporte({ tipoTransporte: 'propio', vehiculoId: '', conductorId: 'c1' })).toMatch(/vehículo/i);
    expect(validarTransporte({ tipoTransporte: 'propio', vehiculoId: 'v1', conductorId: '' })).toMatch(/conductor/i);
  });

  it('aplicación y remis válido → null; propio completo → null', () => {
    expect(validarTransporte({ tipoTransporte: 'aplicacion' })).toBeNull();
    expect(validarTransporte({ tipoTransporte: 'remis', agenciaRemis: 'París' })).toBeNull();
    expect(validarTransporte({ tipoTransporte: 'propio', vehiculoId: 'v1', conductorId: 'c1' })).toBeNull();
  });
});
