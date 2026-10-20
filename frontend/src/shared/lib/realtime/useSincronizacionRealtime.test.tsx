import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { crearQueryClientDeTest } from '../../test/queryWrapper';
import { claves } from '../query/claves';
import type { CanalRealtime, CrearCanal, EstadoCanal } from './canal';
import { TABLAS_REALTIME } from './tablas';
import { INTERVALO_COALESCENCIA_MS, useSincronizacionRealtime } from './useSincronizacionRealtime';

class CanalFake implements CanalRealtime {
  bindings = new Map<string, () => void>();
  onEstado: ((e: EstadoCanal) => void) | null = null;
  suscripciones = 0;
  cierres = 0;
  escuchar(schema: string, tabla: string, onCambio: () => void) {
    this.bindings.set(`${schema}.${tabla}`, onCambio);
  }
  suscribir(onEstado: (e: EstadoCanal) => void) {
    this.suscripciones += 1;
    this.onEstado = onEstado;
  }
  cerrar() {
    this.cierres += 1;
  }
  // El fake manda un payload basura que el puerto no expone: el hook jamás lo ve.
  emitir(tabla: string) {
    const cb = this.bindings.get(tabla);
    if (!cb) throw new Error(`sin binding para ${tabla}`);
    (cb as (payload?: unknown) => void)({ new: { basura: 1 }, old: { id: 'x' } });
  }
  estado(e: EstadoCanal) {
    this.onEstado?.(e);
  }
}

function montar(inicial: { habilitado: boolean; usuarioId: string | null } = { habilitado: true, usuarioId: 'u1' }, strict = false) {
  const client = crearQueryClientDeTest();
  const invalidar = vi.spyOn(client, 'invalidateQueries');
  const setData = vi.spyOn(client, 'setQueryData');
  const canales: CanalFake[] = [];
  const crearCanal: CrearCanal = () => {
    const c = new CanalFake();
    canales.push(c);
    return c;
  };
  const wrapper = ({ children }: { children: ReactNode }) => {
    const arbol = <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    return strict ? <StrictMode>{arbol}</StrictMode> : arbol;
  };
  const hook = renderHook(
    (p: { habilitado: boolean; usuarioId: string | null }) =>
      useSincronizacionRealtime({ crearCanal, habilitado: p.habilitado, usuarioId: p.usuarioId }),
    { initialProps: inicial, wrapper },
  );
  return { ...hook, canales, invalidar, setData };
}

const avanzar = () => act(() => vi.advanceTimersByTime(INTERVALO_COALESCENCIA_MS + 1));

describe('useSincronizacionRealtime', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('habilitado: un binding por tabla y una sola suscripción', () => {
    const { canales } = montar();
    expect(canales).toHaveLength(1);
    expect([...canal(canales, 0).bindings.keys()].sort()).toEqual(Object.keys(TABLAS_REALTIME).sort());
    expect(canal(canales, 0).suscripciones).toBe(1);
  });

  it('evento invalida el dominio tras el intervalo, sin leer el payload', () => {
    const { canales, invalidar, setData } = montar();
    canal(canales, 0).emitir('pacientes.cud');
    expect(invalidar).not.toHaveBeenCalled();
    avanzar();
    expect(invalidar).toHaveBeenCalledTimes(1);
    expect(invalidar).toHaveBeenCalledWith({ queryKey: claves.pacientes.todos() });
    expect(setData).not.toHaveBeenCalled();
  });

  it('otra tabla invalida su propio dominio', () => {
    const { canales, invalidar } = montar();
    canal(canales, 0).emitir('pacientes.hoja_de_ruta');
    avanzar();
    expect(invalidar).toHaveBeenCalledWith({ queryKey: claves.hojasDeRuta.todos() });
  });

  it('coalesce ráfagas: una invalidación por dominio', () => {
    const { canales, invalidar } = montar();
    for (const t of ['pacientes.paciente', 'pacientes.direcciones', 'pacientes.cud', 'pacientes.clinicos', 'obra_social.coberturas_paciente', 'conductores.vehiculo']) {
      canal(canales, 0).emitir(t);
    }
    avanzar();
    expect(invalidar).toHaveBeenCalledTimes(2);
    expect(invalidar).toHaveBeenCalledWith({ queryKey: claves.pacientes.todos() });
    expect(invalidar).toHaveBeenCalledWith({ queryKey: claves.vehiculos.todos() });
  });

  it('un evento posterior al intervalo abre una nueva ventana', () => {
    const { canales, invalidar } = montar();
    canal(canales, 0).emitir('pacientes.paciente');
    avanzar();
    canal(canales, 0).emitir('pacientes.paciente');
    avanzar();
    expect(invalidar).toHaveBeenCalledTimes(2);
  });

  it('el primer SUBSCRIBED no invalida', () => {
    const { canales, invalidar } = montar();
    canal(canales, 0).estado('SUBSCRIBED');
    expect(invalidar).not.toHaveBeenCalled();
  });

  it.each<EstadoCanal>(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'])('%s -> SUBSCRIBED invalida todo', (corte) => {
    const { canales, invalidar } = montar();
    canal(canales, 0).estado('SUBSCRIBED');
    canal(canales, 0).estado(corte);
    expect(invalidar).not.toHaveBeenCalled();
    canal(canales, 0).estado('SUBSCRIBED');
    expect(invalidar).toHaveBeenCalledTimes(1);
    expect(invalidar).toHaveBeenCalledWith();
    canal(canales, 0).estado('SUBSCRIBED');
    expect(invalidar).toHaveBeenCalledTimes(1);
  });

  it('deshabilitado: nunca crea canal', () => {
    const { canales } = montar({ habilitado: false, usuarioId: null });
    expect(canales).toHaveLength(0);
  });

  it('habilitado -> deshabilitado cierra el canal y cancela el timer pendiente', () => {
    const { canales, invalidar, rerender } = montar();
    canal(canales, 0).emitir('pacientes.paciente');
    rerender({ habilitado: false, usuarioId: null });
    expect(canal(canales, 0).cierres).toBe(1);
    avanzar();
    expect(invalidar).not.toHaveBeenCalled();
  });

  it('cambio de usuario cierra y crea un canal nuevo', () => {
    const { canales, rerender } = montar();
    rerender({ habilitado: true, usuarioId: 'u2' });
    expect(canal(canales, 0).cierres).toBe(1);
    expect(canales).toHaveLength(2);
    expect(canal(canales, 1).suscripciones).toBe(1);
  });

  it('unmount cierra el canal', () => {
    const { canales, unmount } = montar();
    unmount();
    expect(canal(canales, 0).cierres).toBe(1);
  });

  it('StrictMode: todo canal creado queda cerrado salvo el vivo, sin invalidar de más', () => {
    const { canales, unmount, invalidar } = montar({ habilitado: true, usuarioId: 'u1' }, true);
    expect(canales.slice(0, -1).every((c) => c.cierres === 1)).toBe(true);
    expect(canales.at(-1)?.cierres).toBe(0);
    unmount();
    expect(canales.every((c) => c.cierres === 1)).toBe(true);
    expect(invalidar).not.toHaveBeenCalled();
  });
});

function canal(canales: CanalFake[], i: number): CanalFake {
  const c = canales[i];
  if (!c) throw new Error(`no hay canal #${i}`);
  return c;
}
