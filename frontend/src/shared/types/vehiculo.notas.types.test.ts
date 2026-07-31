import { describe, expect, it } from 'vitest';
import type { Vehiculo } from './vehiculo';

// Test de tipos (tasks.md 2.1, spec vehiculo-contract — escenario "Vehiculo.notas es opcional y
// viaja con el resto de la ficha"): la columna real `conductores.vehiculo.notas` existe en la
// base desde antes de este change y hoy nace NULL para siempre porque el frontend no la modela
// (CHANGES.md §C-08). El campo es opcional (`notas?: string`), así que un vehículo sin notas
// también debe compilar. Mismo patrón que `vehiculo.mantenimientoRegistro.types.test.ts`: lo que
// falla o pasa acá es la compilación misma vía `npx tsc -b --noEmit` — `vitest run` no
// type-checkea, así que las aserciones en runtime son solo un complemento, no la señal RED/GREEN.

function buildVehiculoConNotas(notas?: string): Vehiculo {
  return {
    id: 'vehiculo-1',
    patente: 'AC123DE',
    modelo: 'Toyota Etios',
    tipo: 'sedan',
    capacidad: 4,
    accesoriosCompatibles: [],
    estado: 'habilitado',
    kilometraje: 0,
    kilometrajeUltimoService: 0,
    fechaUltimoService: '2026-01-01',
    habilitaciones: [],
    gastos: [],
    mantenimientos: [],
    notas,
  };
}

describe('Vehiculo.notas — campo opcional (C-08)', () => {
  it('el campo es opcional: un vehículo sin notas conserva undefined', () => {
    const vehiculo = buildVehiculoConNotas(undefined);
    expect(vehiculo.notas).toBeUndefined();
  });

  it('el campo viaja como texto libre cuando se completa', () => {
    const vehiculo = buildVehiculoConNotas('Aire acondicionado con pérdida.');
    expect(vehiculo.notas).toBe('Aire acondicionado con pérdida.');
  });
});
