import { describe, expect, it } from 'vitest';
import type { Autorizacion, Presupuesto } from '../../types/presupuesto';
import type { Paciente } from '../../types/paciente';
import type { AutorizacionPendiente } from './autorizacionesPendientes';
import { etiquetaAutorizacion } from './etiquetaAutorizacion';

function presupuesto(overrides: Partial<Presupuesto> = {}): Presupuesto {
  return {
    id: 'presupuesto-1',
    pacienteId: 'paciente-martina',
    obraSocialId: 'osecac',
    monto: 45000,
    fechaEmision: '2026-03-01',
    ...overrides,
  };
}

function autorizacion(overrides: Partial<Autorizacion> = {}): Autorizacion {
  return {
    id: 'autorizacion-1',
    presupuestoId: 'presupuesto-1',
    estado: 'autorizada',
    ...overrides,
  };
}

function paciente(overrides: Partial<Paciente> = {}): Paciente {
  return {
    id: 'paciente-martina',
    apellido: 'Gómez',
    nombre: 'Martina',
    fechaNacimiento: '2015-03-12',
    dni: '45123456',
    cuilTitular: '27-30111222-4',
    diagnostico: 'Parálisis cerebral',
    accesorioMovilidad: [],
    obraSocialId: 'osecac',
    numeroAfiliado: { valor: '45123456' },
    cud: null,
    direcciones: [],
    personasACargo: [],
    amparoJudicial: false,
    ...overrides,
  };
}

describe('etiquetaAutorizacion (D4, tasks.md 3.2)', () => {
  it('usa el nombre real de la prestación cuando presupuesto.prestacionId resuelve en el catálogo del paciente', () => {
    const item: AutorizacionPendiente = {
      autorizacion: autorizacion(),
      presupuesto: presupuesto({ prestacionId: 'prestacion-1' }),
    };
    const conCatalogo = paciente({ prestaciones: [{ id: 'prestacion-1', pacienteId: 'paciente-martina', nombre: 'Kinesiología', activa: true }] });

    expect(etiquetaAutorizacion(item, conCatalogo)).toBe('Kinesiología');
  });

  it('cae al fallback (fecha + monto + cupos) cuando prestacionId está ausente', () => {
    const item: AutorizacionPendiente = {
      autorizacion: autorizacion({ cupoMensualDias: 10, cupoMensualKm: 200 }),
      presupuesto: presupuesto({ prestacionId: undefined }),
    };

    expect(etiquetaAutorizacion(item, paciente())).toBe('Presupuesto del 2026-03-01 · $45.000 · 10 días/mes · 200 km/mes');
  });

  it('cae al fallback cuando prestacionId no se encuentra en el catálogo del paciente', () => {
    const item: AutorizacionPendiente = {
      autorizacion: autorizacion(),
      presupuesto: presupuesto({ prestacionId: 'prestacion-inexistente' }),
    };

    expect(etiquetaAutorizacion(item, paciente({ prestaciones: [] }))).toBe('Presupuesto del 2026-03-01 · $45.000');
  });

  it('cae al fallback cuando no hay paciente resuelto todavía', () => {
    const item: AutorizacionPendiente = { autorizacion: autorizacion(), presupuesto: presupuesto({ prestacionId: 'prestacion-1' }) };

    expect(etiquetaAutorizacion(item, undefined)).toBe('Presupuesto del 2026-03-01 · $45.000');
  });
});
