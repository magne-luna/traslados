import { describe, expect, it } from 'vitest';
import type { Autorizacion, Presupuesto } from '../../types/presupuesto';
import type { Paciente } from '../../types/paciente';
import type { AutorizacionPendiente } from './autorizacionesPendientes';
import { etiquetaAutorizacion, prestacionRealAutorizacion } from './etiquetaAutorizacion';

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

// `prestacionRealAutorizacion` (feature `facturacion-derivar-prestacion`): mismo criterio de
// resolución que `etiquetaAutorizacion` (extraído para reusarse), pero devuelve la `Prestacion`
// real (o `undefined`) en vez de un string ya formateado — lo necesita `FacturaForm` para saber
// si tiene que derivar y bloquear el campo "Prestación" del Paso 3, sin reimplementar el criterio
// de resolución ni parsear el fallback.
describe('prestacionRealAutorizacion', () => {
  it('devuelve la Prestacion del catálogo del paciente cuando prestacionId resuelve', () => {
    const kinesiologia = { id: 'prestacion-1', pacienteId: 'paciente-martina', nombre: 'Kinesiología', activa: true };
    const item: AutorizacionPendiente = {
      autorizacion: autorizacion(),
      presupuesto: presupuesto({ prestacionId: 'prestacion-1' }),
    };

    expect(prestacionRealAutorizacion(item, paciente({ prestaciones: [kinesiologia] }))).toEqual(kinesiologia);
  });

  it('devuelve undefined cuando prestacionId está ausente (modalidad general)', () => {
    const item: AutorizacionPendiente = { autorizacion: autorizacion(), presupuesto: presupuesto({ prestacionId: undefined }) };

    expect(prestacionRealAutorizacion(item, paciente())).toBeUndefined();
  });

  it('devuelve undefined cuando prestacionId no se encuentra en el catálogo del paciente', () => {
    const item: AutorizacionPendiente = {
      autorizacion: autorizacion(),
      presupuesto: presupuesto({ prestacionId: 'prestacion-inexistente' }),
    };

    expect(prestacionRealAutorizacion(item, paciente({ prestaciones: [] }))).toBeUndefined();
  });

  it('devuelve undefined cuando no hay paciente resuelto todavía', () => {
    const item: AutorizacionPendiente = { autorizacion: autorizacion(), presupuesto: presupuesto({ prestacionId: 'prestacion-1' }) };

    expect(prestacionRealAutorizacion(item, undefined)).toBeUndefined();
  });
});
