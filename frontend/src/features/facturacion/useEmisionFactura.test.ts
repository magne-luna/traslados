import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Autorizacion, Presupuesto } from '../../shared/types/presupuesto';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';
import type { PresupuestoRepository } from '../../shared/lib/presupuestos/PresupuestoRepository';
import type { Factura } from '../../shared/types/factura';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Paciente } from '../../shared/types/paciente';
import { useEmisionFactura } from './useEmisionFactura';

// `resolverCupoAutorizado` deja de adivinar (change `facturacion-seleccion-autorizacion`,
// design.md D6, tasks.md 3.6): recibe la autorización ELEGIDA y deriva el `CupoAutorizado` de ESA
// vía `AutorizacionRepository.getById` + `derivarCupoAutorizado` (reusada sin cambios). Repository
// fake tipado, sin red, cero `any`.

function autorizacion(overrides: Partial<Autorizacion> = {}): Autorizacion {
  return {
    id: 'autorizacion-1',
    presupuestoId: 'presupuesto-1',
    estado: 'autorizada',
    cupoMensualDias: 10,
    cupoMensualKm: 200,
    ...overrides,
  };
}

function fakeAutorizacionRepository(autorizaciones: Map<string, Autorizacion>): AutorizacionRepository {
  return {
    list: () => Promise.resolve([...autorizaciones.values()]),
    getById: (id: string) => Promise.resolve(autorizaciones.get(id) ?? null),
    getByPresupuestoId: () => Promise.reject(new Error('no usado en este test')),
    create: () => Promise.reject(new Error('no usado en este test')),
    update: () => Promise.reject(new Error('no usado en este test')),
  };
}

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

function fakePresupuestoRepository(presupuestos: Map<string, Presupuesto>): PresupuestoRepository {
  return {
    list: () => Promise.resolve([...presupuestos.values()]),
    getById: (id: string) => Promise.resolve(presupuestos.get(id) ?? null),
    create: () => Promise.reject(new Error('no usado en este test')),
    createLote: () => Promise.reject(new Error('no usado en este test')),
    update: () => Promise.reject(new Error('no usado en este test')),
  };
}

function factura(overrides: Partial<Factura> = {}): Factura {
  return {
    id: 'factura-1',
    pacienteId: 'paciente-martina',
    descripcion: '',
    dias: 5,
    valorKm: 300,
    monto: 1500,
    estado: 'a-facturar',
    fechaInicial: '2026-08-01',
    fechaTope: '2026-08-31',
    tipoComprobante: 'A',
    cantidadKm: 5,
    prestacion: '',
    mesFacturado: 8,
    anioFacturado: 2026,
    dependenciaYRetorno: '',
    domicilioId: '',
    asistencias: [],
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

function obraSocial(overrides: Partial<ObraSocial> = {}): ObraSocial {
  return {
    id: 'osecac',
    nombre: 'OSECAC',
    cuit: '30-54155200-6',
    modalidadFacturacion: 'por-prestacion',
    admitePagosParciales: true,
    formatoAfiliado: 'numero-documento',
    checklist: [],
    plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
    ...overrides,
  };
}

function setup(autorizaciones: Map<string, Autorizacion>, presupuestos: Map<string, Presupuesto> = new Map()) {
  return renderHook(() =>
    useEmisionFactura({
      factura: factura(),
      paciente: undefined,
      obraSocial: undefined,
      facturasExistentes: [],
      autorizacionRepository: fakeAutorizacionRepository(autorizaciones),
      presupuestoRepository: fakePresupuestoRepository(presupuestos),
      actualizar: vi.fn(),
      onError: vi.fn(),
    }),
  );
}

describe('useEmisionFactura — resolverCupoAutorizado (D6, tasks.md 3.6)', () => {
  it('sin autorizacionId (factura anterior al change, autorizacion_id NULL): resuelve undefined', async () => {
    const { result } = setup(new Map());

    const cupo = await result.current.resolverCupoAutorizado('paciente-martina', undefined);
    expect(cupo).toBeUndefined();
  });

  it('con autorizacionId: deriva el CupoAutorizado de ESA autorización, no de otra', async () => {
    const autorizaciones = new Map<string, Autorizacion>([
      ['autorizacion-elegida', autorizacion({ id: 'autorizacion-elegida', cupoMensualDias: 10, cupoMensualKm: 200 })],
      ['autorizacion-otra', autorizacion({ id: 'autorizacion-otra', cupoMensualDias: 999, cupoMensualKm: 999 })],
    ]);
    const { result } = setup(autorizaciones);

    const cupo = await result.current.resolverCupoAutorizado('paciente-martina', 'autorizacion-elegida');

    expect(cupo).toEqual({ pacienteId: 'paciente-martina', cupoMensualDias: 10, cupoMensualKm: 200, vigenciaDesde: undefined });
  });

  it('autorizacionId que ya no existe (getById -> null): resuelve undefined sin lanzar', async () => {
    const { result } = setup(new Map());

    const cupo = await result.current.resolverCupoAutorizado('paciente-martina', 'autorizacion-inexistente');
    expect(cupo).toBeUndefined();
  });

  it('sin pacienteId: resuelve undefined sin llamar al repository', async () => {
    const autorizaciones = new Map<string, Autorizacion>([['autorizacion-1', autorizacion()]]);
    const { result } = setup(autorizaciones);

    const cupo = await result.current.resolverCupoAutorizado('', 'autorizacion-1');
    expect(cupo).toBeUndefined();
  });

  it('handleEmitirClick resuelve el cupo contra factura.autorizacionId, no adivina', async () => {
    const autorizaciones = new Map<string, Autorizacion>([
      ['autorizacion-elegida', autorizacion({ id: 'autorizacion-elegida', cupoMensualDias: 1, cupoMensualKm: 1 })],
    ]);
    const getById = vi.fn((id: string) => Promise.resolve(autorizaciones.get(id) ?? null));
    const repo: AutorizacionRepository = {
      list: () => Promise.resolve([...autorizaciones.values()]),
      getById,
      getByPresupuestoId: () => Promise.reject(new Error('no usado en este test')),
      create: () => Promise.reject(new Error('no usado en este test')),
      update: () => Promise.reject(new Error('no usado en este test')),
    };

    const { result } = renderHook(() =>
      useEmisionFactura({
        factura: factura({ autorizacionId: 'autorizacion-elegida', dias: 5, cantidadKm: 5 }),
        paciente: undefined,
        obraSocial: undefined,
        facturasExistentes: [],
        autorizacionRepository: repo,
        presupuestoRepository: fakePresupuestoRepository(new Map()),
        actualizar: vi.fn(),
        onError: vi.fn(),
      }),
    );

    await result.current.handleEmitirClick();

    expect(getById).toHaveBeenCalledWith('autorizacion-elegida');
    // 5 días facturados > 1 autorizado -> excede, se pide confirmación explícita en vez de emitir.
    await waitFor(() => expect(result.current.cupoParaConfirmar?.excedeDias).toBe(true));
  });
});

// `sacar-prestadores` reexpone `ObraSocial.plazoCobroDias` (RF-306): `emitirFactura` deja de
// pasar `plazoObraSocial: undefined` a mano — usa el dato real de la obra social del paciente.
// `calcularFechaEstimadaCobro` (no se toca, ya tenía la precedencia completa) sigue resolviendo
// amparo > plazoObraSocial > default.
describe('useEmisionFactura — emitirFactura usa el plazo real de la obra social (RF-306)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-10T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('con plazoCobroDias configurado en la obra social: fechaEstimadaCobro se calcula con ESE plazo', async () => {
    const actualizar = vi.fn().mockResolvedValue(factura());
    const { result } = renderHook(() =>
      useEmisionFactura({
        factura: factura({ dias: 1, cantidadKm: 1 }),
        paciente: paciente({ amparoJudicial: false }),
        obraSocial: obraSocial({ plazoCobroDias: 60 }),
        facturasExistentes: [],
        autorizacionRepository: fakeAutorizacionRepository(new Map()),
        presupuestoRepository: fakePresupuestoRepository(new Map()),
        actualizar,
        onError: vi.fn(),
      }),
    );

    await result.current.handleEmitirClick();

    expect(actualizar).toHaveBeenCalledWith('factura-1', expect.objectContaining({ fechaEstimadaCobro: '2026-10-09' }));
  });

  it('sin plazoCobroDias configurado: cae al default general (90 días)', async () => {
    const actualizar = vi.fn().mockResolvedValue(factura());
    const { result } = renderHook(() =>
      useEmisionFactura({
        factura: factura({ dias: 1, cantidadKm: 1 }),
        paciente: paciente({ amparoJudicial: false }),
        obraSocial: obraSocial({ plazoCobroDias: undefined }),
        facturasExistentes: [],
        autorizacionRepository: fakeAutorizacionRepository(new Map()),
        presupuestoRepository: fakePresupuestoRepository(new Map()),
        actualizar,
        onError: vi.fn(),
      }),
    );

    await result.current.handleEmitirClick();

    expect(actualizar).toHaveBeenCalledWith('factura-1', expect.objectContaining({ fechaEstimadaCobro: '2026-11-08' }));
  });

  it('amparo judicial sigue ganando aunque la obra social tenga plazoCobroDias configurado', async () => {
    const actualizar = vi.fn().mockResolvedValue(factura());
    const { result } = renderHook(() =>
      useEmisionFactura({
        factura: factura({ dias: 1, cantidadKm: 1 }),
        paciente: paciente({ amparoJudicial: true }),
        obraSocial: obraSocial({ plazoCobroDias: 60 }),
        facturasExistentes: [],
        autorizacionRepository: fakeAutorizacionRepository(new Map()),
        presupuestoRepository: fakePresupuestoRepository(new Map()),
        actualizar,
        onError: vi.fn(),
      }),
    );

    await result.current.handleEmitirClick();

    const llamada = actualizar.mock.calls[0]?.[1] as { fechaEstimadaCobro: string } | undefined;
    expect(llamada?.fechaEstimadaCobro).not.toBe('2026-10-09');
  });
});

// WU2 de `facturacion-cambios-ui` (decisión usuaria 2026-08-16, opción a): la descripción que la
// emisión congela en la factura incluye el bloque "Prestaciones:" con los nombres de las LÍNEAS
// del presupuesto de la autorización elegida (`presupuesto.lineas` — REAPERTURA #13 — resueltas
// client-side contra el catálogo del paciente, mismo criterio que `prestacionRealAutorizacion`).
describe('useEmisionFactura — emitirFactura congela la descripción con el bloque Prestaciones (WU2)', () => {
  function pacienteConCatalogo(): Paciente {
    return paciente({
      prestaciones: [
        { id: 'prest-kine', pacienteId: 'paciente-martina', nombre: 'Kinesiología', activa: true },
        { id: 'prest-fono', pacienteId: 'paciente-martina', nombre: 'Fonoaudiología', activa: true },
      ],
    });
  }

  function obraSocialGeneral(): ObraSocial {
    return obraSocial({
      modalidadFacturacion: 'general',
      plantillaFactura: {
        identificadorOrigen: 'paciente.numeroAfiliado',
        campos: [{ id: 'c-periodo', etiqueta: 'Período', origen: 'traslado.mesYAnio', orden: 0 }],
      },
    });
  }

  it('con autorización cuyo presupuesto tiene líneas: la descripción congelada termina con el bloque', async () => {
    const actualizar = vi.fn().mockResolvedValue(factura());
    const { result } = renderHook(() =>
      useEmisionFactura({
        factura: factura({ autorizacionId: 'autorizacion-general', dias: 1, cantidadKm: 1 }),
        paciente: pacienteConCatalogo(),
        obraSocial: obraSocialGeneral(),
        facturasExistentes: [],
        autorizacionRepository: fakeAutorizacionRepository(
          new Map([['autorizacion-general', autorizacion({ id: 'autorizacion-general', presupuestoId: 'presupuesto-general' })]]),
        ),
        presupuestoRepository: fakePresupuestoRepository(
          new Map([
            [
              'presupuesto-general',
              presupuesto({
                id: 'presupuesto-general',
                lineas: [
                  { id: 'linea-1', prestacionId: 'prest-kine', monto: 9000, orden: 1 },
                  { id: 'linea-2', prestacionId: 'prest-fono', monto: 4500, orden: 2 },
                ],
              }),
            ],
          ]),
        ),
        actualizar,
        onError: vi.fn(),
      }),
    );

    await result.current.handleEmitirClick();

    const llamada = actualizar.mock.calls[0]?.[1] as { descripcion: string } | undefined;
    expect(llamada?.descripcion).toContain('Prestaciones: Kinesiología, Fonoaudiología');
  });

  it('autorización con presupuesto legacy sin líneas: la descripción NO tiene bloque (legajo previo a la REAPERTURA #13)', async () => {
    const actualizar = vi.fn().mockResolvedValue(factura());
    const { result } = renderHook(() =>
      useEmisionFactura({
        factura: factura({ autorizacionId: 'autorizacion-legacy', dias: 1, cantidadKm: 1 }),
        paciente: pacienteConCatalogo(),
        obraSocial: obraSocialGeneral(),
        facturasExistentes: [],
        autorizacionRepository: fakeAutorizacionRepository(
          new Map([['autorizacion-legacy', autorizacion({ id: 'autorizacion-legacy', presupuestoId: 'presupuesto-legacy' })]]),
        ),
        presupuestoRepository: fakePresupuestoRepository(
          new Map([['presupuesto-legacy', presupuesto({ id: 'presupuesto-legacy' })]]) as Map<string, Presupuesto>,
        ),
        actualizar,
        onError: vi.fn(),
      }),
    );

    await result.current.handleEmitirClick();

    const llamada = actualizar.mock.calls[0]?.[1] as { descripcion: string } | undefined;
    expect(llamada?.descripcion).not.toContain('Prestaciones:');
  });
});
