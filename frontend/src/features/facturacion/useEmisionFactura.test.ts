import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Autorizacion } from '../../shared/types/presupuesto';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';
import type { Factura } from '../../shared/types/factura';
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

function setup(autorizaciones: Map<string, Autorizacion>) {
  return renderHook(() =>
    useEmisionFactura({
      factura: factura(),
      paciente: undefined,
      obraSocial: undefined,
      facturasExistentes: [],
      autorizacionRepository: fakeAutorizacionRepository(autorizaciones),
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
