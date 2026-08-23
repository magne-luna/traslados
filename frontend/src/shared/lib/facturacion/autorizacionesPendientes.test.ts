import { describe, expect, it } from 'vitest';
import type { ActualizacionAutorizacion, ActualizacionPresupuesto, Autorizacion, NuevaAutorizacion, NuevoPresupuesto, Presupuesto } from '../../types/presupuesto';
import type { PresupuestoRepository } from '../presupuestos/PresupuestoRepository';
import type { AutorizacionRepository } from '../presupuestos/AutorizacionRepository';
import { autorizacionesPendientes } from './autorizacionesPendientes';

// Derivación client-side de "autorizaciones pendientes de facturar" (design.md D3, tasks.md 2.6,
// capability `factura-autorizacion-seleccion`): mismo patrón O(N) que ya paga
// `useEmisionFactura.ts` -> `resolverCupoAutorizado` (`presupuestoRepository.list()` filtrado por
// paciente + N x `autorizacionRepository.listByPresupuestoId()`), reordenado — no agrega costo
// nuevo. Repositories fake tipados, sin red, cero `any`, cero `as` sobre datos externos.
//
// `autorizacion-mensual` (design.md D5, tasks.md Fase 4): el fake de abajo sigue modelando "un
// presupuesto -> una autorización" (`Map<string, Autorizacion>`) para no romper los tests
// existentes que asumían el modelo 1:1 — se envuelve en un array de 0 o 1 elemento. El nuevo test
// de la sección "múltiples meses" al final de este archivo usa un fake propio con
// `Map<string, Autorizacion[]>` para cubrir el caso real de esta fase (N filas por presupuesto).

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
    listByPresupuestoId: (presupuestoId: string) => {
      const encontrada = autorizacionesPorPresupuesto.get(presupuestoId);
      return Promise.resolve(encontrada ? [encontrada] : []);
    },
    create: (_data: NuevaAutorizacion) => Promise.reject(new Error('no usado en este test')),
    update: (_id: string, _data: ActualizacionAutorizacion) => Promise.reject(new Error('no usado en este test')),
    uploadArchivo: (_id: string, _file: File) => Promise.reject(new Error('no usado en este test')),
    removeArchivo: (_id: string) => Promise.reject(new Error('no usado en este test')),
    getUrlArchivo: (_id: string, _modo: 'inline' | 'descarga') => Promise.reject(new Error('no usado en este test')),
  };
}

// autorizacion-mensual (design.md D5, tasks.md Fase 4): fake propio con varias filas por
// presupuesto — el caso real que `listByPresupuestoId` agrega y que el fake de arriba (1:1) no
// puede ejercitar.
function fakeAutorizacionRepositoryMultiMes(autorizacionesPorPresupuesto: Map<string, Autorizacion[]>): AutorizacionRepository {
  const todas = [...autorizacionesPorPresupuesto.values()].flat();
  return {
    list: () => Promise.resolve(todas),
    getById: (id: string) => Promise.resolve(todas.find((a) => a.id === id) ?? null),
    listByPresupuestoId: (presupuestoId: string) => Promise.resolve(autorizacionesPorPresupuesto.get(presupuestoId) ?? []),
    create: (_data: NuevaAutorizacion) => Promise.reject(new Error('no usado en este test')),
    update: (_id: string, _data: ActualizacionAutorizacion) => Promise.reject(new Error('no usado en este test')),
    uploadArchivo: (_id: string, _file: File) => Promise.reject(new Error('no usado en este test')),
    removeArchivo: (_id: string) => Promise.reject(new Error('no usado en este test')),
    getUrlArchivo: (_id: string, _modo: 'inline' | 'descarga') => Promise.reject(new Error('no usado en este test')),
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

  it('presupuesto sin autorización todavía (listByPresupuestoId -> []) se descarta sin lanzar', async () => {
    const p1 = presupuesto({ id: 'presupuesto-1' });
    const p2 = presupuesto({ id: 'presupuesto-2' });
    const autorizaciones = new Map<string, Autorizacion>([
      ['presupuesto-1', autorizacion({ id: 'autorizacion-1', presupuestoId: 'presupuesto-1', estado: 'autorizada' })],
      // presupuesto-2 sin entrada -> listByPresupuestoId resuelve []
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

  // -----------------------------------------------------------------------------------------
  // autorizacion-mensual (design.md D5, tasks.md Fase 4): un presupuesto con varias filas por mes
  // — la adaptación mínima de esta fase (`flatMap`, sin ordenar por período todavía, TODO Fase 5)
  // no puede descartar en silencio los meses ya respondidos.
  // -----------------------------------------------------------------------------------------

  it('un presupuesto con varios meses "autorizada" aporta UNA entrada por mes, ninguno se descarta (D5, no silenciar meses)', async () => {
    const p1 = presupuesto({ id: 'presupuesto-1' });
    const autorizaciones = new Map<string, Autorizacion[]>([
      [
        'presupuesto-1',
        [
          autorizacion({ id: 'autorizacion-mes-1', presupuestoId: 'presupuesto-1', estado: 'autorizada', periodoMes: '2026-01-01' }),
          autorizacion({ id: 'autorizacion-mes-2', presupuestoId: 'presupuesto-1', estado: 'autorizada', periodoMes: '2026-02-01' }),
          autorizacion({ id: 'autorizacion-mes-3', presupuestoId: 'presupuesto-1', estado: 'pendiente', periodoMes: '2026-03-01' }),
        ],
      ],
    ]);

    const resultado = await autorizacionesPendientes(
      'paciente-martina',
      fakePresupuestoRepository([p1]),
      fakeAutorizacionRepositoryMultiMes(autorizaciones),
    );

    // Los 2 meses "autorizada" aparecen, cada uno como su propia entrada -- el mes "pendiente"
    // (mes-3, todavía sin respuesta) queda excluido, mismo filtro de estado de siempre.
    expect(resultado.map((r) => r.autorizacion.id).sort()).toEqual(['autorizacion-mes-1', 'autorizacion-mes-2']);
    expect(resultado.every((r) => r.presupuesto.id === 'presupuesto-1')).toBe(true);
  });

  // Triangulación: varios presupuestos, cada uno con varios meses -- todas las combinaciones
  // válidas aparecen, no solo la primera de cada presupuesto.
  it('varios presupuestos con varios meses cada uno: todas las combinaciones válidas aparecen', async () => {
    const p1 = presupuesto({ id: 'presupuesto-1' });
    const p2 = presupuesto({ id: 'presupuesto-2' });
    const autorizaciones = new Map<string, Autorizacion[]>([
      [
        'presupuesto-1',
        [
          autorizacion({ id: 'autorizacion-1-mes-1', presupuestoId: 'presupuesto-1', estado: 'autorizada', periodoMes: '2026-01-01' }),
          autorizacion({ id: 'autorizacion-1-mes-2', presupuestoId: 'presupuesto-1', estado: 'judicializada', periodoMes: '2026-02-01' }),
        ],
      ],
      [
        'presupuesto-2',
        [autorizacion({ id: 'autorizacion-2-mes-1', presupuestoId: 'presupuesto-2', estado: 'autorizada', periodoMes: '2026-01-01' })],
      ],
    ]);

    const resultado = await autorizacionesPendientes(
      'paciente-martina',
      fakePresupuestoRepository([p1, p2]),
      fakeAutorizacionRepositoryMultiMes(autorizaciones),
    );

    expect(resultado.map((r) => r.autorizacion.id).sort()).toEqual([
      'autorizacion-1-mes-1',
      'autorizacion-1-mes-2',
      'autorizacion-2-mes-1',
    ]);
  });
});
