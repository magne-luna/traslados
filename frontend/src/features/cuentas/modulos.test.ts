import { describe, expect, it } from 'vitest';
import { MODULO_COLOR, MODULOS, SUBMODULOS_MODULO } from './modulos';

describe('MODULO_COLOR', () => {
  it('define un color de identidad para cada uno de los 4 módulos reales', () => {
    for (const modulo of MODULOS) {
      expect(MODULO_COLOR[modulo]).toBeDefined();
    }
  });

  it('no repite el mismo color entre dos módulos (cada uno se distingue visualmente, triangulación)', () => {
    const colores = MODULOS.map((modulo) => MODULO_COLOR[modulo]);
    expect(new Set(colores).size).toBe(colores.length);
  });
});

describe('SUBMODULOS_MODULO', () => {
  it('define la aclaración de submódulos para cada uno de los 4 módulos reales', () => {
    for (const modulo of MODULOS) {
      expect(SUBMODULOS_MODULO[modulo]).toBeTruthy();
    }
  });

  it('aclara que Facturación también incluye la pantalla Presupuestos (moduloDeRuta en routes.ts)', () => {
    expect(SUBMODULOS_MODULO.facturacion).toMatch(/presupuestos/i);
  });

  it('aclara que Pacientes también incluye la pantalla Hojas de Ruta (moduloDeRuta en routes.ts)', () => {
    expect(SUBMODULOS_MODULO.pacientes).toMatch(/hojas de ruta/i);
  });

  it('aclara que Conductores también incluye la pantalla Vehículos (moduloDeRuta en routes.ts)', () => {
    expect(SUBMODULOS_MODULO.conductores).toMatch(/vehículos/i);
  });
});
