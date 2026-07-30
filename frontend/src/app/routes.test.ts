import { describe, expect, it } from 'vitest';
import { moduloDeRuta } from './routes';

// tasks.md 3.1/3.3 (auth-frontend-real), design.md D4: mapeo declarativo ruta→módulo. Con
// permisos-modulos-granulares (tasks.md 5.3) las 8 rutas de módulo del frontend pasan a resolver
// 7 módulos reales, cada uno 1:1 con su ruta — ya no hay agrupación bajo un módulo padre. Más
// /cuentas y /design-system (sin módulo propio), más el caso de ruta no declarada.

describe('moduloDeRuta', () => {
  it.each([
    ['/pacientes', 'pacientes'],
    ['/obras-sociales', 'obra_social'],
    ['/conductores', 'conductores'],
    ['/facturacion', 'facturacion'],
    ['/hojas-de-ruta', 'hojas_de_ruta'],
    ['/presupuestos', 'presupuestos'],
    ['/vehiculos', 'vehiculos'],
  ])('%s → %s (mapeo 1:1, sin agrupación)', (path, modulo) => {
    expect(moduloDeRuta(path)).toBe(modulo);
  });

  it.each([
    ['/vehiculos', 'conductores'],
    ['/hojas-de-ruta', 'pacientes'],
    ['/presupuestos', 'facturacion'],
  ])(
    '%s ya NO comparte módulo con %s (triangulación: antes agrupadas, ahora independientes)',
    (path, moduloViejo) => {
      expect(moduloDeRuta(path)).not.toBe(moduloViejo);
    },
  );

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
