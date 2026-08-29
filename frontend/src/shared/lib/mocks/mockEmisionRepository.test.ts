import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { ActualizacionFactura, Factura } from '../../types/factura';
import type { FacturaRepository } from '../facturacion/FacturaRepository';
import { makeMockEmisionRepository } from './mockEmisionRepository';

function facturaBase(overrides: Partial<Factura> = {}): Factura {
  return {
    id: 'factura-1',
    pacienteId: 'paciente-1',
    descripcion: 'Traslados marzo',
    dias: 20,
    valorKm: 150,
    monto: 121000,
    estado: 'a-facturar',
    fechaInicial: '2026-03-01',
    fechaTope: '2026-03-31',
    tipoComprobante: 'A',
    cantidadKm: 320,
    prestacion: 'Traslado',
    mesFacturado: 3,
    anioFacturado: 2026,
    dependenciaYRetorno: 'Domicilio - Centro',
    domicilioId: 'domicilio-1',
    asistencias: [],
    ...overrides,
  };
}

function fakeFacturaRepository(factura: Factura | null): {
  repo: FacturaRepository;
  update: ReturnType<typeof vi.fn>;
} {
  const update = vi.fn(async (id: string, data: ActualizacionFactura) => ({ ...(factura as Factura), ...data, id }));
  const repo: FacturaRepository = {
    list: async () => (factura ? [factura] : []),
    getById: async (id) => (factura && factura.id === id ? factura : null),
    listByPaciente: async () => (factura ? [factura] : []),
    create: async () => facturaBase(),
    update,
  };
  return { repo, update };
}

describe('makeMockEmisionRepository.emitir()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('emite: pasa a facturado y persiste CAE / vencimiento / nº / punto de venta / PDF / ambiente', async () => {
    const { repo, update } = fakeFacturaRepository(facturaBase());
    const emision = makeMockEmisionRepository(repo);

    const factura = await emision.emitir('factura-1');

    expect(update).toHaveBeenCalledTimes(1);
    const [, cambios] = update.mock.calls[0] as [string, ActualizacionFactura];
    expect(cambios.estado).toBe('facturado');
    expect(cambios.cae).toMatch(/^\d{14}$/);
    expect(cambios.fechaFactura).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // vencimiento del CAE = fechaFactura + 10 días
    const vto = new Date(`${cambios.caeVencimiento}T00:00:00Z`).getTime();
    const emitida = new Date(`${cambios.fechaFactura}T00:00:00Z`).getTime();
    expect((vto - emitida) / 86_400_000).toBe(10);
    expect(typeof cambios.cbteNro).toBe('number');
    expect(cambios.ptoVta).toBe(1);
    expect(cambios.arcaAmbiente).toBe('homologacion');
    expect(cambios.comprobantePdfUrl).toMatch(/^factura-1\/FACTURA_A-1-\d+\.pdf$/);
    expect(factura.estado).toBe('facturado');
  });

  it('factura inexistente → "La factura ya no existe."', async () => {
    const { repo } = fakeFacturaRepository(null);
    await expect(makeMockEmisionRepository(repo).emitir('factura-x')).rejects.toThrow('La factura ya no existe.');
  });

  it('idempotencia: una factura que ya tiene CAE no se re-emite', async () => {
    const { repo, update } = fakeFacturaRepository(facturaBase({ estado: 'facturado', cae: '60000000000001' }));
    await expect(makeMockEmisionRepository(repo).emitir('factura-1')).rejects.toThrow(
      'Esta factura ya fue emitida (CAE 60000000000001).',
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('estado ≠ a-facturar (sin CAE) → mensaje de estado, no emite', async () => {
    const { repo, update } = fakeFacturaRepository(facturaBase({ estado: 'cobrado' }));
    await expect(makeMockEmisionRepository(repo).emitir('factura-1')).rejects.toThrow(
      'Solo se pueden emitir facturas en estado "a facturar".',
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('dos emisiones de facturas distintas usan números de comprobante distintos', async () => {
    const a = fakeFacturaRepository(facturaBase({ id: 'f-a' }));
    const b = fakeFacturaRepository(facturaBase({ id: 'f-b' }));
    await makeMockEmisionRepository(a.repo).emitir('f-a');
    await makeMockEmisionRepository(b.repo).emitir('f-b');

    const nroA = (a.update.mock.calls[0] as [string, ActualizacionFactura])[1].cbteNro;
    const nroB = (b.update.mock.calls[0] as [string, ActualizacionFactura])[1].cbteNro;
    expect(nroA).not.toBe(nroB);
  });
});
