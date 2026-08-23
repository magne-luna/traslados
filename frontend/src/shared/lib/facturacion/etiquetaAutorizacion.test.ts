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
  // `autorizacion-mensual` (design.md D6b, tasks.md 5.3): el período entra en la etiqueta SIEMPRE
  // -- `{prestación o fallback} · {mes}`, con `'Sin mes cargado'` para autorizaciones legacy
  // (`periodoMes: undefined`). Las 4 autorizaciones de este describe no traen `periodoMes` ->
  // legacy -> el sufijo es literal `'Sin mes cargado'`.
  it('usa el nombre real de la prestación cuando presupuesto.prestacionId resuelve en el catálogo del paciente', () => {
    const item: AutorizacionPendiente = {
      autorizacion: autorizacion(),
      presupuesto: presupuesto({ prestacionId: 'prestacion-1' }),
    };
    const conCatalogo = paciente({ prestaciones: [{ id: 'prestacion-1', pacienteId: 'paciente-martina', nombre: 'Kinesiología', activa: true }] });

    expect(etiquetaAutorizacion(item, conCatalogo)).toBe('Kinesiología · Sin mes cargado');
  });

  it('cae al fallback (fecha + monto + cupos) cuando prestacionId está ausente', () => {
    const item: AutorizacionPendiente = {
      autorizacion: autorizacion({ cupoMensualDias: 10, cupoMensualKm: 200 }),
      presupuesto: presupuesto({ prestacionId: undefined }),
    };

    expect(etiquetaAutorizacion(item, paciente())).toBe('Presupuesto del 2026-03-01 · $45.000 · 10 días/mes · 200 km/mes · Sin mes cargado');
  });

  it('cae al fallback cuando prestacionId no se encuentra en el catálogo del paciente', () => {
    const item: AutorizacionPendiente = {
      autorizacion: autorizacion(),
      presupuesto: presupuesto({ prestacionId: 'prestacion-inexistente' }),
    };

    expect(etiquetaAutorizacion(item, paciente({ prestaciones: [] }))).toBe('Presupuesto del 2026-03-01 · $45.000 · Sin mes cargado');
  });

  it('cae al fallback cuando no hay paciente resuelto todavía', () => {
    const item: AutorizacionPendiente = { autorizacion: autorizacion(), presupuesto: presupuesto({ prestacionId: 'prestacion-1' }) };

    expect(etiquetaAutorizacion(item, undefined)).toBe('Presupuesto del 2026-03-01 · $45.000 · Sin mes cargado');
  });

  // `autorizacion-mensual` (design.md D2/D6b, tasks.md 5.3): cuando SÍ hay `periodoMes`, el sufijo
  // es `etiquetaPeriodoMes` (reusada de `periodoAutorizacion.ts`, no reimplementada) -- p.ej.
  // `'marzo 2026'`, nunca el ISO crudo.
  it('con periodoMes cargado, el sufijo es la etiqueta de mes en español, no el ISO crudo', () => {
    const item: AutorizacionPendiente = {
      autorizacion: autorizacion({ periodoMes: '2026-03-01' }),
      presupuesto: presupuesto({ prestacionId: 'prestacion-1' }),
    };
    const conCatalogo = paciente({ prestaciones: [{ id: 'prestacion-1', pacienteId: 'paciente-martina', nombre: 'Kinesiología', activa: true }] });

    expect(etiquetaAutorizacion(item, conCatalogo)).toBe('Kinesiología · marzo 2026');
  });

  // Test OBLIGATORIO de tasks.md 5.3: sin el período en la etiqueta, N meses del mismo
  // presupuesto con la misma prestación son N opciones IDÉNTICAS en el `<select>` del Paso 2 --
  // exactamente el problema "presupuestos indistinguibles entre sí" que design.md D6b señala.
  it('3 meses del mismo presupuesto y la misma prestación producen 3 etiquetas distintas (obligatorio, D6b)', () => {
    const catalogo = paciente({ prestaciones: [{ id: 'prestacion-1', pacienteId: 'paciente-martina', nombre: 'Kinesiología', activa: true }] });
    const mismoPresupuesto = presupuesto({ id: 'presupuesto-1', prestacionId: 'prestacion-1' });

    const mesEnero: AutorizacionPendiente = { autorizacion: autorizacion({ id: 'autorizacion-enero', periodoMes: '2026-01-01' }), presupuesto: mismoPresupuesto };
    const mesFebrero: AutorizacionPendiente = { autorizacion: autorizacion({ id: 'autorizacion-febrero', periodoMes: '2026-02-01' }), presupuesto: mismoPresupuesto };
    const mesMarzo: AutorizacionPendiente = { autorizacion: autorizacion({ id: 'autorizacion-marzo', periodoMes: '2026-03-01' }), presupuesto: mismoPresupuesto };

    const etiquetas = [mesEnero, mesFebrero, mesMarzo].map((item) => etiquetaAutorizacion(item, catalogo));

    expect(etiquetas).toEqual(['Kinesiología · enero 2026', 'Kinesiología · febrero 2026', 'Kinesiología · marzo 2026']);
    expect(new Set(etiquetas).size).toBe(3);
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
