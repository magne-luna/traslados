import type { EmisionRepository } from '../facturacion/EmisionRepository';
import type { FacturaRepository } from '../facturacion/FacturaRepository';
import { mockFacturaRepository } from './mockFacturaRepository';

// Implementación mock de `EmisionRepository` (facturacion-electronica-arca, tasks.md 3.4): para
// tests / desarrollo sin backend. No habla con ARCA — simula un CAE y un `comprobantePdfUrl`
// fijos, y respeta las mismas guardas que la Edge Function real: factura inexistente (404),
// factura ya emitida (`cae` presente → 409 idempotencia), estado ≠ `a-facturar` (409). Opera
// sobre un `FacturaRepository` inyectado (el mock por defecto), no sobre un store propio.

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function sumarDiasISO(iso: string, dias: number): string {
  const fecha = new Date(`${iso}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

let contadorComprobante = 1;

export function makeMockEmisionRepository(facturaRepository: FacturaRepository): EmisionRepository {
  return {
    async emitir(facturaId: string) {
      const factura = await facturaRepository.getById(facturaId);
      if (!factura) throw new Error('La factura ya no existe.');
      if (factura.cae) throw new Error(`Esta factura ya fue emitida (CAE ${factura.cae}).`);
      if (factura.estado !== 'a-facturar') {
        throw new Error('Solo se pueden emitir facturas en estado "a facturar".');
      }

      const fechaFactura = hoyISO();
      const cbteNro = contadorComprobante++;
      const ptoVta = 1;

      return facturaRepository.update(facturaId, {
        estado: 'facturado',
        fechaFactura,
        cae: `6${String(cbteNro).padStart(13, '0')}`,
        caeVencimiento: sumarDiasISO(fechaFactura, 10),
        cbteNro,
        ptoVta,
        arcaAmbiente: 'homologacion',
        comprobantePdfUrl: `facturas-emitidas/${facturaId}/FACTURA_${factura.tipoComprobante}-${ptoVta}-${cbteNro}.pdf`,
      });
    },
  };
}

/** Instancia lista para usar, ligada al `mockFacturaRepository` por defecto. */
export const mockEmisionRepository: EmisionRepository = makeMockEmisionRepository(mockFacturaRepository);
