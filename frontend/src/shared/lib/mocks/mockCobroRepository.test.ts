import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NuevoCobro } from '../../types/factura';
import { mockCobroRepository } from './mockCobroRepository';

const STORAGE_KEY = 'cobros';

async function flushLatency<T>(promise: Promise<T>): Promise<T> {
  const result = promise;
  await vi.runAllTimersAsync();
  return result;
}

function buildNuevoCobro(overrides: Partial<NuevoCobro> = {}): NuevoCobro {
  return {
    facturaId: 'factura-martina-cobrado',
    fecha: '2026-08-15',
    montoPagado: 1000,
    ...overrides,
  };
}

describe('mockCobroRepository', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('siembra el fixture de cobros cuando no hay datos previos en localStorage', async () => {
    const cobros = await flushLatency(mockCobroRepository.listByFactura('factura-martina-cobrado'));
    expect(cobros.length).toBeGreaterThanOrEqual(2);
    expect(cobros.every((c) => c.facturaId === 'factura-martina-cobrado')).toBe(true);
  });

  it('listByFactura no devuelve cobros de otra factura', async () => {
    const cobros = await flushLatency(mockCobroRepository.listByFactura('factura-facundo-pagado-parcialmente'));
    expect(cobros.every((c) => c.facturaId === 'factura-facundo-pagado-parcialmente')).toBe(true);
  });

  it('create() persiste un nuevo cobro recuperable por listByFactura()', async () => {
    await flushLatency(mockCobroRepository.listByFactura('factura-martina-cobrado'));

    const creado = await flushLatency(mockCobroRepository.create(buildNuevoCobro({ montoPagado: 777 })));

    expect(creado.id).toBeTruthy();
    const cobros = await flushLatency(mockCobroRepository.listByFactura('factura-martina-cobrado'));
    expect(cobros.map((c) => c.montoPagado)).toContain(777);
  });

  it('remove() borra el cobro y deja de aparecer en listByFactura()', async () => {
    await flushLatency(mockCobroRepository.listByFactura('factura-martina-cobrado'));
    const creado = await flushLatency(mockCobroRepository.create(buildNuevoCobro({ montoPagado: 555 })));

    await flushLatency(mockCobroRepository.remove(creado.id));

    const cobros = await flushLatency(mockCobroRepository.listByFactura('factura-martina-cobrado'));
    expect(cobros.map((c) => c.id)).not.toContain(creado.id);
  });

  it('re-siembra desde el fixture si el schemaVersion en localStorage no coincide', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 0, cobros: [{ id: 'x' }] }));
    const cobros = await flushLatency(mockCobroRepository.listByFactura('factura-martina-cobrado'));
    expect(cobros.length).toBeGreaterThan(0);
  });

  it('re-siembra desde el fixture si el payload de localStorage está corrupto (JSON inválido)', async () => {
    localStorage.setItem(STORAGE_KEY, 'no-es-json{{{');
    const cobros = await flushLatency(mockCobroRepository.listByFactura('factura-martina-cobrado'));
    expect(cobros.length).toBeGreaterThan(0);
  });

  // tasks.md 2.2/2.3, design.md Decisión 6: list() es la única adición al contrato, para que
  // C-11 agregue por período sin fan-out de una llamada por factura.
  describe('list()', () => {
    it('devuelve todos los cobros persistidos (sembrados desde el fixture)', async () => {
      const todos = await flushLatency(mockCobroRepository.list());
      expect(todos.length).toBeGreaterThan(0);
    });

    it('devuelve un array vacío cuando no hay ningún cobro persistido', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, cobros: [] }));
      const todos = await flushLatency(mockCobroRepository.list());
      expect(todos).toEqual([]);
    });

    it('es coherente con listByFactura: los cobros de una factura son exactamente los de list() con ese facturaId', async () => {
      const todos = await flushLatency(mockCobroRepository.list());
      const deUnaFactura = await flushLatency(mockCobroRepository.listByFactura('factura-martina-cobrado'));

      const filtradosDeTodos = todos.filter((c) => c.facturaId === 'factura-martina-cobrado');
      expect(filtradosDeTodos.map((c) => c.id).sort()).toEqual(deUnaFactura.map((c) => c.id).sort());
    });
  });
});
