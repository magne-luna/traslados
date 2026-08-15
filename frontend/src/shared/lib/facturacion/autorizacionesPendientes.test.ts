import { describe, expect, it } from 'vitest';
import type { ActualizacionAutorizacion, ActualizacionPresupuesto, Autorizacion, NuevaAutorizacion, NuevoPresupuesto, Presupuesto } from '../../types/presupuesto';
import type { PresupuestoRepository } from '../presupuestos/PresupuestoRepository';
import type { AutorizacionRepository } from '../presupuestos/AutorizacionRepository';
import { autorizacionesPendientes } from './autorizacionesPendientes';

// Derivación client-side de "autorizaciones pendientes de facturar" (design.md D3, tasks.md 2.6,
// capability `factura-autorizacion-seleccion`): mismo patrón O(N) que ya paga
// `useEmisionFactura.ts` -> `resolverCupoAutorizado` (`presupuestoRepository.list()` filtrado por
// paciente + N x `autorizacionRepository.getByPresupuestoId()`), reordenado — no agrega costo
// nuevo. Repositories fake tipados, sin red, cero `any`, cero `as` sobre datos externos.

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

function fakePresupuestoRepository(presupuestos: Presupuesto[]): PresupuestoRepository {
  return {
    list: () => Promise.resolve(presupuestos),
    getById: (id: string) => Promise.resolve(presupuestos.find((p) => p.id === id) ?? null),
    create: (_data: NuevoPresupuesto) => Promise.reject(new Error('no usado en este test')),
    createLote: (_nuevos: NuevoPresupuesto[]) => Promise.reject(new Error('no usado en este test')),
    update: (_id: string, _data: ActualizacionPresupuesto) => Promise.reject(new Error('no usado en este test')),
  };
}

function fakeAutorizacionRepository(autorizacionesPorPresupuesto: Map<string, Autorizacion>): AutorizacionRepository {
  return {
    list: () => Promise.resolve([...autorizacionesPorPresupuesto.values()]),
    getById: (id: string) => Promise.resolve([...autorizacionesPorPresupuesto.values()].find((a) => a.id === id) ?? null),
    getByPresupuestoId: (presupuestoId: string) => Promise.resolve(autorizacionesPorPresupuesto.get(presupuestoId) ?? null),
    create: (_data: NuevaAutorizacion) => Promise.reject(new Error('no usado en este test')),
    update: (_id: string, _data: ActualizacionAutorizacion) => Promise.reject(new Error('no usado en este test')),
  };
}

describe('autorizacionesPendientes (D3, tasks.md 2.6)', () => {
  it('paciente sin presupuestos: devuelve lista vacía, no lanza', async () => {
    const resultado = await autorizacionesPendientes(
      'paciente-sin-presupuestos',
      fakePresupuestoRepository([]),
      fakeAutorizacionRepository(new Map()),
    );

    expect(resultado).toEqual([]);
  });

  it('paciente con presupuestos pero ninguna autorización "autorizada": devuelve lista vacía', async () => {
    const p1 = presupuesto({ id: 'presupuesto-1' });
    const p2 = presupuesto({ id: 'presupuesto-2' });
    const autorizaciones = new Map<string, Autorizacion>([
      ['presupuesto-1', autorizacion({ id: 'autorizacion-1', presupuestoId: 'presupuesto-1', estado: 'pendiente' })],
      ['presupuesto-2', autorizacion({ id: 'autorizacion-2', presupuestoId: 'presupuesto-2', estado: 'rechazada' })],
    ]);

    const resultado = await autorizacionesPendientes(
      'paciente-martina',
      fakePresupuestoRepository([p1, p2]),
      fakeAutorizacionRepository(autorizaciones),
    );

    expect(resultado).toEqual([]);
  });

  // Corrección confirmada por la usuaria (2026-08-15): "pendiente de facturar" también incluye
  // `judicializada` — una autorización judicializada sigue habilitando la facturación mientras se
  // resuelve el litigio. Solo `pendiente` y `rechazada` quedan excluidas.
  it('"autorizada" y "judicializada" cuentan como pendiente de facturar — "pendiente" y "rechazada" no', async () => {
    const pendiente = presupuesto({ id: 'presupuesto-pendiente' });
    const autorizada = presupuesto({ id: 'presupuesto-autorizada' });
    const judicializada = presupuesto({ id: 'presupuesto-judicializada' });
    const rechazada = presupuesto({ id: 'presupuesto-rechazada' });
    const autorizaciones = new Map<string, Autorizacion>([
      ['presupuesto-pendiente', autorizacion({ id: 'autorizacion-pendiente', presupuestoId: 'presupuesto-pendiente', estado: 'pendiente' })],
      ['presupuesto-autorizada', autorizacion({ id: 'autorizacion-autorizada', presupuestoId: 'presupuesto-autorizada', estado: 'autorizada' })],
      ['presupuesto-judicializada', autorizacion({ id: 'autorizacion-judicializada', presupuestoId: 'presupuesto-judicializada', estado: 'judicializada' })],
      ['presupuesto-rechazada', autorizacion({ id: 'autorizacion-rechazada', presupuestoId: 'presupuesto-rechazada', estado: 'rechazada' })],
    ]);

    const resultado = await autorizacionesPendientes(
      'paciente-martina',
      fakePresupuestoRepository([pendiente, autorizada, judicializada, rechazada]),
      fakeAutorizacionRepository(autorizaciones),
    );

    expect(resultado.map((r) => r.autorizacion.id).sort()).toEqual(['autorizacion-autorizada', 'autorizacion-judicializada']);
  });

  it('varias autorizaciones simultáneas del mismo paciente (caso por-prestacion): todas aparecen', async () => {
    const p1 = presupuesto({ id: 'presupuesto-1' });
    const p2 = presupuesto({ id: 'presupuesto-2' });
    const p3 = presupuesto({ id: 'presupuesto-3' });
    const autorizaciones = new Map<string, Autorizacion>([
      ['presupuesto-1', autorizacion({ id: 'autorizacion-1', presupuestoId: 'presupuesto-1', estado: 'autorizada' })],
      ['presupuesto-2', autorizacion({ id: 'autorizacion-2', presupuestoId: 'presupuesto-2', estado: 'autorizada' })],
      ['presupuesto-3', autorizacion({ id: 'autorizacion-3', presupuestoId: 'presupuesto-3', estado: 'autorizada' })],
    ]);

    const resultado = await autorizacionesPendientes(
      'paciente-martina',
      fakePresupuestoRepository([p1, p2, p3]),
      fakeAutorizacionRepository(autorizaciones),
    );

    expect(resultado.map((r) => r.autorizacion.id).sort()).toEqual(['autorizacion-1', 'autorizacion-2', 'autorizacion-3']);
    expect(resultado.every((r) => r.presupuesto.pacienteId === 'paciente-martina')).toBe(true);
  });

  it('filtra por pacienteId: presupuestos de otro paciente con autorización "autorizada" no aparecen', async () => {
    const propio = presupuesto({ id: 'presupuesto-1', pacienteId: 'paciente-martina' });
    const ajeno = presupuesto({ id: 'presupuesto-2', pacienteId: 'paciente-otro' });
    const autorizaciones = new Map<string, Autorizacion>([
      ['presupuesto-1', autorizacion({ id: 'autorizacion-1', presupuestoId: 'presupuesto-1', estado: 'autorizada' })],
      ['presupuesto-2', autorizacion({ id: 'autorizacion-2', presupuestoId: 'presupuesto-2', estado: 'autorizada' })],
    ]);

    const resultado = await autorizacionesPendientes(
      'paciente-martina',
      fakePresupuestoRepository([propio, ajeno]),
      fakeAutorizacionRepository(autorizaciones),
    );

    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.autorizacion.id).toBe('autorizacion-1');
  });

  it('presupuesto sin autorización todavía (getByPresupuestoId -> null) se descarta sin lanzar', async () => {
    const p1 = presupuesto({ id: 'presupuesto-1' });
    const p2 = presupuesto({ id: 'presupuesto-2' });
    const autorizaciones = new Map<string, Autorizacion>([
      ['presupuesto-1', autorizacion({ id: 'autorizacion-1', presupuestoId: 'presupuesto-1', estado: 'autorizada' })],
      // presupuesto-2 sin entrada -> getByPresupuestoId resuelve null
    ]);

    const resultado = await autorizacionesPendientes(
      'paciente-martina',
      fakePresupuestoRepository([p1, p2]),
      fakeAutorizacionRepository(autorizaciones),
    );

    expect(resultado).toHaveLength(1);
  });

  // ⚠️ Asunción de negocio explícita (design.md D3): "pendiente" = `estado === 'autorizada'`, SIN
  // filtrar por mes ya facturado. Una autorización que ya generó una factura en el período en
  // curso sigue apareciendo en el picker — el sistema NO lo impide ni lo detecta (riesgo aceptado,
  // no garantía). Esta función no recibe `facturasExistentes` ni ningún parámetro de período: no
  // hay forma de que filtre por historial de facturación, y este test lo deja explícito para que
  // no se lea como un bug a "corregir" más adelante.
  it('una autorización "autorizada" sigue apareciendo aunque ya se haya facturado ese mes (sin filtro por período, intencional)', async () => {
    const p1 = presupuesto({ id: 'presupuesto-1' });
    const autorizaciones = new Map<string, Autorizacion>([
      ['presupuesto-1', autorizacion({ id: 'autorizacion-1', presupuestoId: 'presupuesto-1', estado: 'autorizada' })],
    ]);

    // Simula "ya facturada este mes": no existe ningún argumento en la firma de la función para
    // pasarle facturas existentes ni un período — la función es agnóstica a eso por diseño (D3).
    const primeraLlamada = await autorizacionesPendientes('paciente-martina', fakePresupuestoRepository([p1]), fakeAutorizacionRepository(autorizaciones));
    const segundaLlamada = await autorizacionesPendientes('paciente-martina', fakePresupuestoRepository([p1]), fakeAutorizacionRepository(autorizaciones));

    expect(primeraLlamada).toHaveLength(1);
    expect(segundaLlamada).toHaveLength(1);
    expect(segundaLlamada[0]?.autorizacion.id).toBe('autorizacion-1');
  });
});
