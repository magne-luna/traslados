import { describe, expect, it } from 'vitest';
import { parseCuentasDePrueba } from './testAccounts';

describe('parseCuentasDePrueba', () => {
  it('parsea un JSON válido con una cuenta', () => {
    const raw = JSON.stringify([{ label: 'Admin', email: 'andrea.test@gmail.com', password: '123456' }]);

    expect(parseCuentasDePrueba(raw)).toEqual([
      { label: 'Admin', email: 'andrea.test@gmail.com', password: '123456' },
    ]);
  });

  it('parsea un JSON válido con varias cuentas, preservando el orden', () => {
    const raw = JSON.stringify([
      { label: 'Admin', email: 'andrea.test@gmail.com', password: '123456' },
      { label: 'Facturación', email: 'facturacion@pastor.com', password: 'facturacion' },
      { label: 'Operación', email: 'rominaop@pastor.com', password: 'operacion' },
    ]);

    expect(parseCuentasDePrueba(raw)).toHaveLength(3);
    expect(parseCuentasDePrueba(raw)[1]).toEqual({
      label: 'Facturación',
      email: 'facturacion@pastor.com',
      password: 'facturacion',
    });
  });

  it('devuelve un array vacío si la variable no está definida', () => {
    expect(parseCuentasDePrueba(undefined)).toEqual([]);
  });

  it('devuelve un array vacío ante un JSON inválido, sin lanzar', () => {
    expect(parseCuentasDePrueba('{ esto no es json')).toEqual([]);
  });

  it('devuelve un array vacío si el JSON es válido pero no es un array', () => {
    expect(parseCuentasDePrueba(JSON.stringify({ label: 'Admin' }))).toEqual([]);
  });

  it('descarta las entradas que no tienen label/email/password como string', () => {
    const raw = JSON.stringify([
      { label: 'Admin', email: 'andrea.test@gmail.com', password: '123456' },
      { label: 'Incompleta', email: 'sin-password@pastor.com' },
      { label: 123, email: 'mal-tipado@pastor.com', password: 'x' },
    ]);

    expect(parseCuentasDePrueba(raw)).toEqual([
      { label: 'Admin', email: 'andrea.test@gmail.com', password: '123456' },
    ]);
  });
});
