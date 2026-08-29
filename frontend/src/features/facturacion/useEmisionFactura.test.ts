import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Autorizacion } from '../../shared/types/presupuesto';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';
import type { EmisionRepository } from '../../shared/lib/facturacion/EmisionRepository';
import type { Factura } from '../../shared/types/factura';
import { useEmisionFactura } from './useEmisionFactura';

// `facturacion-electronica-arca` §5 (el swap): `emitirFactura` deja de congelar snapshots y llamar
// `actualizar(id, { estado: 'facturado', … })` — invoca `emisionRepository.emitir(facturaId)` (la
// Edge Function `facturar`, que obtiene un CAE real y congela los snapshots del lado del servidor,
// D8). La validación de cupo sigue en el cliente (D10): `resolverCupoAutorizado` no cambió.

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
    listByPresupuestoId: () => Promise.reject(new Error('no usado en este test')),
    create: () => Promise.reject(new Error('no usado en este test')),
    update: () => Promise.reject(new Error('no usado en este test')),
    uploadArchivo: () => Promise.reject(new Error('no usado en este test')),
    removeArchivo: () => Promise.reject(new Error('no usado en este test')),
    getUrlArchivo: () => Promise.reject(new Error('no usado en este test')),
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

function fakeEmisionRepository(impl?: Partial<EmisionRepository>): { repo: EmisionRepository; emitir: ReturnType<typeof vi.fn> } {
  const emitir = vi.fn(impl?.emitir ?? ((id: string) => Promise.resolve(factura({ id, estado: 'facturado', cae: '75000000000001' }))));
  return { repo: { emitir, verComprobante: impl?.verComprobante ?? vi.fn() }, emitir };
}

interface SetupOverrides {
  facturaActual?: Factura | null;
  autorizaciones?: Map<string, Autorizacion>;
  emision?: { repo: EmisionRepository; emitir: ReturnType<typeof vi.fn> };
  onEmitida?: ReturnType<typeof vi.fn<() => void>>;
  onError?: ReturnType<typeof vi.fn<(mensaje: string) => void>>;
}

function setup(over: SetupOverrides = {}) {
  const emision = over.emision ?? fakeEmisionRepository();
  const onEmitida = over.onEmitida ?? vi.fn<() => void>();
  const onError = over.onError ?? vi.fn<(mensaje: string) => void>();
  const hook = renderHook(() =>
    useEmisionFactura({
      factura: over.facturaActual === undefined ? factura() : over.facturaActual,
      facturasExistentes: [],
      autorizacionRepository: fakeAutorizacionRepository(over.autorizaciones ?? new Map()),
      emisionRepository: emision.repo,
      onEmitida,
      onError,
    }),
  );
  return { ...hook, emitir: emision.emitir, onEmitida, onError };
}

describe('useEmisionFactura — resolverCupoAutorizado (D6, no cambió con el swap)', () => {
  it('sin autorizacionId: resuelve undefined', async () => {
    const { result } = setup();
    expect(await result.current.resolverCupoAutorizado('paciente-martina', undefined)).toBeUndefined();
  });

  it('con autorizacionId: deriva el CupoAutorizado de ESA autorización', async () => {
    const autorizaciones = new Map<string, Autorizacion>([
      ['elegida', autorizacion({ id: 'elegida', cupoMensualDias: 10, cupoMensualKm: 200 })],
      ['otra', autorizacion({ id: 'otra', cupoMensualDias: 999, cupoMensualKm: 999 })],
    ]);
    const { result } = setup({ autorizaciones });
    expect(await result.current.resolverCupoAutorizado('paciente-martina', 'elegida')).toEqual({
      pacienteId: 'paciente-martina',
      cupoMensualDias: 10,
      cupoMensualKm: 200,
      vigenciaDesde: undefined,
    });
  });

  it('autorizacionId inexistente: resuelve undefined sin lanzar', async () => {
    const { result } = setup();
    expect(await result.current.resolverCupoAutorizado('paciente-martina', 'no-existe')).toBeUndefined();
  });
});

describe('useEmisionFactura — emitirFactura invoca la Edge Function `facturar` (§5)', () => {
  it('emisión dentro de cupo: llama a emisionRepository.emitir(facturaId) y luego onEmitida', async () => {
    const { result, emitir, onEmitida, onError } = setup();

    await result.current.handleEmitirClick();

    expect(emitir).toHaveBeenCalledWith('factura-1');
    expect(onEmitida).toHaveBeenCalledOnce();
    expect(onError).not.toHaveBeenCalled();
  });

  it('NO congela snapshots en el cliente: emitir recibe solo el id, nada más', async () => {
    const { result, emitir } = setup();
    await result.current.handleEmitirClick();
    expect(emitir.mock.calls[0]).toEqual(['factura-1']);
  });

  it('rechazo de ARCA (emitir rechaza): onError con el mensaje, no llama onEmitida', async () => {
    const emision = fakeEmisionRepository({
      emitir: () => Promise.reject(new Error('ARCA rechazó el comprobante: CUIT del receptor inválido')),
    });
    const { result, onEmitida, onError } = setup({ emision });

    await result.current.handleEmitirClick();

    expect(onError).toHaveBeenCalledWith('ARCA rechazó el comprobante: CUIT del receptor inválido');
    expect(onEmitida).not.toHaveBeenCalled();
  });

  it('exceso de cupo: NO emite, pide confirmación explícita; recién al confirmar invoca emitir', async () => {
    const autorizaciones = new Map<string, Autorizacion>([
      ['elegida', autorizacion({ id: 'elegida', cupoMensualDias: 1, cupoMensualKm: 1 })],
    ]);
    const { result, emitir } = setup({
      autorizaciones,
      facturaActual: factura({ autorizacionId: 'elegida', dias: 5, cantidadKm: 5 }),
    });

    await result.current.handleEmitirClick();
    await waitFor(() => expect(result.current.cupoParaConfirmar?.excedeDias).toBe(true));
    expect(emitir).not.toHaveBeenCalled();

    await result.current.handleConfirmarEmision();
    expect(emitir).toHaveBeenCalledWith('factura-1');
  });

  it('sin factura: no hace nada', async () => {
    const { result, emitir } = setup({ facturaActual: null });
    await result.current.handleEmitirClick();
    expect(emitir).not.toHaveBeenCalled();
  });
});
