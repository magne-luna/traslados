import { describe, expect, it } from 'vitest';
import type { Conductor } from './conductor';

// Test de tipos (tasks.md 2C.1, design.md D6 opción B, spec conductor-contract — escenario "El
// conductor no tiene campo de restricciones estructurado"): `Conductor.restricciones` y la unión
// `RestriccionConductor` se eliminan del dominio; `observaciones?: string` queda como único campo
// libre del perfil. Mismo patrón que `vehiculo.mantenimientoRegistro.types.test.ts` y
// `vehiculo.notas.types.test.ts`: lo que falla o pasa acá es la compilación misma vía
// `npx tsc -b --noEmit` — `vitest run` no type-checkea.

function buildConductorSinRestricciones(observaciones?: string): Conductor {
  return {
    id: 'conductor-1',
    apellido: 'Pérez',
    nombre: 'Carlos',
    documento: '15789456',
    domicilio: 'Calle 50 N° 1234, La Plata',
    cuil: '20-15789456-9',
    estado: 'operando',
    observaciones,
    asignaciones: [],
  };
}

describe('Conductor sin restricciones estructuradas (D6-B)', () => {
  it('un conductor sin restricciones compila: el campo ya no existe en el tipo', () => {
    const conductor = buildConductorSinRestricciones();
    expect(conductor.observaciones).toBeUndefined();
  });

  it('observaciones es el único campo libre del perfil y viaja como texto', () => {
    const conductor = buildConductorSinRestricciones('No traslada pacientes con carga física.');
    expect(conductor.observaciones).toBe('No traslada pacientes con carga física.');
  });
});
