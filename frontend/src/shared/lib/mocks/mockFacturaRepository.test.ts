import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NuevaFactura } from '../../types/factura';
import { mockFacturaRepository } from './mockFacturaRepository';

const STORAGE_KEY = 'facturas';

async function flushLatency<T>(promise: Promise<T>): Promise<T> {
  const result = promise;
  await vi.runAllTimersAsync();
  return result;
}

function buildNuevaFactura(overrides: Partial<NuevaFactura> = {}): NuevaFactura {
  return {
    pacienteId: 'paciente-martina',
    descripcion: '',
    dias: 10,
    valorKm: 300,
    monto: 3000,
    estado: 'a-facturar',
    fechaInicial: '2026-08-01',
    fechaTope: '2026-08-31',
    tipoComprobante: 'A',
    cantidadKm: 10,
    prestacion: 'Kinesiología',
    mesFacturado: 8,
    anioFacturado: 2026,
    dependenciaYRetorno: 'Escuela / domicilio',
    domicilioId: 'dir-martina-domicilio-ida',
    asistencias: [],
    ...overrides,
  };
}

describe('mockFacturaRepository', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('siembra el fixture de 4 facturas cuando no hay datos previos en localStorage', async () => {
    const facturas = await flushLatency(mockFacturaRepository.list());

    expect(facturas).toHaveLength(4);
    expect(facturas.map((f) => f.estado)).toEqual(
      expect.arrayContaining(['a-facturar', 'facturado', 'cobrado', 'pagado-parcialmente']),
    );
  });

  it('list() resuelve una promesa con latencia simulada (loading states reales)', async () => {
    let resolved = false;
    mockFacturaRepository.list().then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    await vi.runAllTimersAsync();
    expect(resolved).toBe(true);
  });

  it('create() persiste una nueva factura recuperable por list()', async () => {
    await flushLatency(mockFacturaRepository.list());

    const creada = await flushLatency(mockFacturaRepository.create(buildNuevaFactura({ monto: 4321 })));

    expect(creada.id).toBeTruthy();
    const facturas = await flushLatency(mockFacturaRepository.list());
    expect(facturas.map((f) => f.monto)).toContain(4321);
  });

  it('getById resuelve null cuando el id no existe', async () => {
    const found = await flushLatency(mockFacturaRepository.getById('no-existe'));
    expect(found).toBeNull();
  });

  it('listByPaciente filtra solo las facturas de ese paciente', async () => {
    await flushLatency(mockFacturaRepository.list());
    const deFacundo = await flushLatency(mockFacturaRepository.listByPaciente('paciente-facundo'));

    expect(deFacundo.length).toBeGreaterThan(0);
    expect(deFacundo.every((f) => f.pacienteId === 'paciente-facundo')).toBe(true);
  });

  it('update() persiste los cambios y devuelve la entidad actualizada', async () => {
    const [primera] = await flushLatency(mockFacturaRepository.list());
    if (!primera) throw new Error('Debería existir al menos una factura tras el seed inicial');

    const actualizada = await flushLatency(mockFacturaRepository.update(primera.id, { monto: 999_999 }));

    expect(actualizada.monto).toBe(999_999);
    expect(actualizada.pacienteId).toBe(primera.pacienteId);

    const releida = await flushLatency(mockFacturaRepository.getById(primera.id));
    expect(releida?.monto).toBe(999_999);
  });

  it('update() lanza un error explícito si el id no existe (borde)', async () => {
    await flushLatency(mockFacturaRepository.list());
    await expect(mockFacturaRepository.update('no-existe', { monto: 1 })).rejects.toThrow();
  });

  it('re-siembra desde el fixture si el schemaVersion en localStorage no coincide', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 0, facturas: [{ id: 'x' }] }));
    const facturas = await flushLatency(mockFacturaRepository.list());
    expect(facturas).toHaveLength(4);
  });

  it('re-siembra desde el fixture si el payload de localStorage está corrupto (JSON inválido)', async () => {
    localStorage.setItem(STORAGE_KEY, 'no-es-json{{{');
    const facturas = await flushLatency(mockFacturaRepository.list());
    expect(facturas).toHaveLength(4);
  });
});
