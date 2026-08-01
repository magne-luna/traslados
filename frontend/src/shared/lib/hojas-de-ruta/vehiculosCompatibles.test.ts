import { describe, expect, it } from 'vitest';
import type { Paciente } from '../../types/paciente';
import type { Vehiculo } from '../../types/vehiculo';
import { accesoriosRequeridos, vehiculosCompatibles } from './vehiculosCompatibles';

// Flujo pacientes-primero (feedback de usuario, FE-5): el grupo de pacientes elegido filtra qué
// vehículos se ofrecen, en vez de descubrir la incompatibilidad recién al intentar asignar.
// Combina RN-VE-01 (accesorios) y capacidad (tasks.md 2.3) sobre el GRUPO completo, no un
// paciente a la vez.

function buildVehiculo(overrides: Partial<Vehiculo> = {}): Vehiculo {
  return {
    id: 'v-1',
    patente: 'AA111AA',
    modelo: 'Etios',
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
    ...overrides,
  };
}

function buildPaciente(overrides: Partial<Paciente> = {}): Paciente {
  return {
    id: 'p-1',
    apellido: 'Gómez',
    nombre: 'Martina',
    fechaNacimiento: '2015-01-01',
    dni: '1',
    cuilTitular: '20-1-1',
    diagnostico: 'Test',
    accesorioMovilidad: [],
    obraSocialId: null,
    numeroAfiliado: { valor: '1' },
    cud: null,
    direcciones: [],
    personasACargo: [],
    amparoJudicial: false,
    ...overrides,
  };
}

describe('accesoriosRequeridos', () => {
  it('devuelve la unión sin duplicados de los accesorios de todos los pacientes', () => {
    const pacientes = [
      buildPaciente({ id: 'p-1', accesorioMovilidad: ['silla-plegable', 'andador'] }),
      buildPaciente({ id: 'p-2', accesorioMovilidad: ['andador'] }),
    ];

    expect(accesoriosRequeridos(pacientes)).toEqual(['silla-plegable', 'andador']);
  });

  it('devuelve vacío si ningún paciente tiene accesorios (borde)', () => {
    expect(accesoriosRequeridos([buildPaciente({ accesorioMovilidad: [] })])).toEqual([]);
  });
});

describe('vehiculosCompatibles', () => {
  it('excluye vehículos sin capacidad suficiente para el grupo', () => {
    const chico = buildVehiculo({ id: 'v-chico', capacidad: 1 });
    const grande = buildVehiculo({ id: 'v-grande', capacidad: 4 });
    const grupo = [buildPaciente({ id: 'p-1' }), buildPaciente({ id: 'p-2' })];

    const resultado = vehiculosCompatibles([chico, grande], grupo);

    expect(resultado.map((v) => v.id)).toEqual(['v-grande']);
  });

  it('excluye vehículos que no soportan un accesorio requerido por algún paciente del grupo (RN-VE-01)', () => {
    const sinAccesorio = buildVehiculo({ id: 'v-sin', accesoriosCompatibles: [] });
    const conAccesorio = buildVehiculo({ id: 'v-con', accesoriosCompatibles: ['silla-rigida'] });
    const grupo = [buildPaciente({ accesorioMovilidad: ['silla-rigida'] })];

    const resultado = vehiculosCompatibles([sinAccesorio, conAccesorio], grupo);

    expect(resultado.map((v) => v.id)).toEqual(['v-con']);
  });

  it('exige que el vehículo soporte la unión de accesorios de TODO el grupo, no solo uno', () => {
    const soloSillaRigida = buildVehiculo({ id: 'v-parcial', accesoriosCompatibles: ['silla-rigida'] });
    const ambos = buildVehiculo({ id: 'v-completo', accesoriosCompatibles: ['silla-rigida', 'andador'], capacidad: 4 });
    const grupo = [
      buildPaciente({ id: 'p-1', accesorioMovilidad: ['silla-rigida'] }),
      buildPaciente({ id: 'p-2', accesorioMovilidad: ['andador'] }),
    ];

    const resultado = vehiculosCompatibles([soloSillaRigida, ambos], grupo);

    expect(resultado.map((v) => v.id)).toEqual(['v-completo']);
  });

  it('sin pacientes seleccionados, devuelve todos los vehículos recibidos (borde — nada que filtrar todavía)', () => {
    const vehiculos = [buildVehiculo({ id: 'v-1' }), buildVehiculo({ id: 'v-2' })];

    expect(vehiculosCompatibles(vehiculos, [])).toEqual(vehiculos);
  });
});
