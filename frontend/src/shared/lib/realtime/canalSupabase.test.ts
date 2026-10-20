import { describe, expect, it, vi } from 'vitest';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { crearCanalSupabase } from './canalSupabase';
import type { EstadoCanal } from './canal';

type Cliente = Pick<SupabaseClient, 'channel' | 'removeChannel'>;
type Callback = () => void;
type Estado = (status: string) => void;

function armar() {
  const callbacks: Callback[] = [];
  let estado: Estado | null = null;
  const filtros: unknown[] = [];
  const canalFalso = {
    on: vi.fn((_tipo: string, filtro: unknown, cb: Callback) => {
      filtros.push(filtro);
      callbacks.push(cb);
      return canalFalso;
    }),
    subscribe: vi.fn((cb: Estado) => {
      estado = cb;
      return canalFalso;
    }),
  };
  const channel = vi.fn(() => canalFalso as unknown as RealtimeChannel);
  const removeChannel = vi.fn(() => Promise.resolve('ok' as const));
  const cliente: Cliente = { channel, removeChannel };
  return { cliente, canalFalso, channel, removeChannel, callbacks, filtros, emitirEstado: (s: string) => estado?.(s) };
}

describe('crearCanalSupabase', () => {
  it('escuchar registra un binding postgres_changes por tabla sobre un único canal', () => {
    const { cliente, channel, canalFalso, filtros } = armar();
    const canal = crearCanalSupabase(cliente);
    canal.escuchar('pacientes', 'cud', () => {});
    canal.escuchar('conductores', 'vehiculo', () => {});
    expect(channel).toHaveBeenCalledTimes(1);
    expect(canalFalso.on).toHaveBeenCalledWith('postgres_changes', { event: '*', schema: 'pacientes', table: 'cud' }, expect.any(Function));
    expect(filtros).toEqual([
      { event: '*', schema: 'pacientes', table: 'cud' },
      { event: '*', schema: 'conductores', table: 'vehiculo' },
    ]);
  });

  it('el callback de cambio se invoca sin payload', () => {
    const { cliente, callbacks } = armar();
    const onCambio = vi.fn();
    crearCanalSupabase(cliente).escuchar('pacientes', 'cud', onCambio);
    (callbacks[0] as (payload: unknown) => void)({ new: { dato: 'salud' } });
    expect(onCambio).toHaveBeenCalledWith();
  });

  it('suscribir reenvía el status', () => {
    const { cliente, emitirEstado } = armar();
    const recibidos: EstadoCanal[] = [];
    crearCanalSupabase(cliente).suscribir((e) => recibidos.push(e));
    emitirEstado('SUBSCRIBED');
    emitirEstado('CHANNEL_ERROR');
    emitirEstado('TIMED_OUT');
    emitirEstado('CLOSED');
    expect(recibidos).toEqual(['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']);
  });

  it('cerrar llama removeChannel con el canal', () => {
    const { cliente, removeChannel, canalFalso } = armar();
    crearCanalSupabase(cliente).cerrar();
    expect(removeChannel).toHaveBeenCalledWith(canalFalso);
  });
});
