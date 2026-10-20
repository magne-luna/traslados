import { describe, expect, it } from 'vitest';
import { claves } from '../query/claves';
import { dominiosDeTabla, TABLAS_REALTIME } from './tablas';

describe('dominiosDeTabla', () => {
  it('sub-tabla de la ficha invalida pacientes', () => {
    expect(dominiosDeTabla('pacientes', 'direcciones')).toEqual([claves.pacientes.todos()]);
  });

  it('conductores_vehiculos invalida conductores y vehiculos', () => {
    expect(dominiosDeTabla('conductores', 'conductores_vehiculos')).toEqual([
      claves.conductores.todos(),
      claves.vehiculos.todos(),
    ]);
  });

  it('autorizacion invalida autorizaciones y presupuestos', () => {
    expect(dominiosDeTabla('facturacion', 'autorizacion')).toEqual([
      claves.autorizaciones.todos(),
      claves.presupuestos.todos(),
    ]);
  });

  it.each([
    ['pacientes', 'hoja_de_ruta', claves.hojasDeRuta.todos()],
    ['pacientes', 'recorrido', claves.hojasDeRuta.todos()],
    ['pacientes', 'historial_recorridos', claves.hojasDeRuta.todos()],
    ['pacientes', 'recorridos', claves.recorridosHabituales.todos()],
    ['pacientes', 'paciente', claves.pacientes.todos()],
    ['pacientes', 'cud', claves.pacientes.todos()],
    ['pacientes', 'clinicos', claves.pacientes.todos()],
    ['pacientes', 'personas_a_cargo', claves.pacientes.todos()],
    ['pacientes', 'prestaciones', claves.pacientes.todos()],
    ['pacientes', 'accesorios_pacientes', claves.pacientes.todos()],
    ['obra_social', 'coberturas_paciente', claves.pacientes.todos()],
    ['conductores', 'vehiculo', claves.vehiculos.todos()],
    ['conductores', 'mantenimiento', claves.vehiculos.todos()],
    ['conductores', 'habilitaciones_vehiculo', claves.vehiculos.todos()],
    ['conductores', 'accesorios_vehiculo', claves.vehiculos.todos()],
    ['conductores', 'conductores', claves.conductores.todos()],
    ['facturacion', 'presupuesto', claves.presupuestos.todos()],
    ['facturacion', 'presupuesto_linea', claves.presupuestos.todos()],
  ])('%s.%s incluye su dominio', (schema, tabla, clave) => {
    expect(dominiosDeTabla(schema, tabla)).toContainEqual(clave);
  });

  it.each([
    ['auditoria', 'logs'],
    ['facturacion', 'facturas'],
    ['usuarios', 'usuarios'],
    ['nada', 'nada'],
  ])('%s.%s no está mapeada', (schema, tabla) => {
    expect(dominiosDeTabla(schema, tabla)).toEqual([]);
  });

  it('TABLAS_REALTIME tiene 21 tablas', () => {
    expect(Object.keys(TABLAS_REALTIME)).toHaveLength(21);
  });
});
