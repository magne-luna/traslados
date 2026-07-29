import { describe, expect, it } from 'vitest';
import { moduloDeRuta } from './routes';

// tasks.md 3.1/3.3 (auth-frontend-real), design.md D4: mapeo declarativo ruta→módulo. 8 rutas de
// módulo del frontend contra los 4 módulos reales seedeados por el backend, más /cuentas y
// /design-system (sin módulo propio), más el caso de ruta no declarada.

describe('moduloDeRuta', () => {
  it.each([
    ['/pacientes', 'pacientes'],
    ['/obras-sociales', 'obra_social'],
    ['/conductores', 'conductores'],
    ['/facturacion', 'facturacion'],
  ])('%s → %s (mapeo 1:1)', (path, modulo) => {
    expect(moduloDeRuta(path)).toBe(modulo);
  });

  it.each([
    ['/vehiculos', 'conductores'],
    ['/hojas-de-ruta', 'pacientes'],
    ['/presupuestos', 'facturacion'],
  ])('%s → %s (rutas agrupadas bajo un mismo módulo, ver design.md D4)', (path, modulo) => {
    expect(moduloDeRuta(path)).toBe(modulo);
  });

  it.each(['/', '/cuentas', '/design-system'])(
    '%s no tiene módulo propio: devuelve null (ruta declarada, sin gate de módulo)',
    (path) => {
      expect(moduloDeRuta(path)).toBeNull();
    },
  );

  it('una ruta no declarada en ningún punto de verdad devuelve undefined (distinto de null: TRATAR COMO SIN ACCESO)', () => {
    expect(moduloDeRuta('/esta-ruta-no-existe')).toBeUndefined();
  });
});
