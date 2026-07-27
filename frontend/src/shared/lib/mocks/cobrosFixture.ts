import type { Cobro } from '../../types/factura';
import { buildFacturasFixture } from './facturasFixture';

// Fixture inicial del mock de Cobros (tasks.md 4.5): ligados por `facturaId` a las facturas de
// facturasFixture.ts. Los montos se derivan del `monto` real de cada factura (en vez de
// hardcodear números que puedan desincronizarse) para que la suma de cobros sea consistente con
// `saldoFactura`/`estadoDerivadoFactura`: 'factura-martina-cobrado' queda saldada por completo
// (dos cobros); 'factura-facundo-pagado-parcialmente' queda con saldo pendiente (un cobro parcial).

function isoDiasDespues(fechaIso: string, dias: number): string {
  const fecha = new Date(`${fechaIso}T00:00:00.000Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

export function buildCobrosFixture(): Cobro[] {
  const facturas = buildFacturasFixture();
  const facturaCobrada = facturas.find((f) => f.id === 'factura-martina-cobrado');
  const facturaParcial = facturas.find((f) => f.id === 'factura-facundo-pagado-parcialmente');

  if (!facturaCobrada || !facturaParcial || !facturaCobrada.fechaFactura || !facturaParcial.fechaFactura) {
    throw new Error('cobrosFixture requiere que facturasFixture siga sembrando facturas ya emitidas.');
  }

  const primerCobroCobrada = Math.round(facturaCobrada.monto * 0.6);
  const segundoCobroCobrada = facturaCobrada.monto - primerCobroCobrada;

  const cobroParcial = Math.round(facturaParcial.monto * 0.4);

  return [
    {
      id: 'cobro-martina-1',
      facturaId: facturaCobrada.id,
      fecha: isoDiasDespues(facturaCobrada.fechaFactura, 30),
      montoPagado: primerCobroCobrada,
    },
    {
      id: 'cobro-martina-2',
      facturaId: facturaCobrada.id,
      fecha: isoDiasDespues(facturaCobrada.fechaFactura, 55),
      montoPagado: segundoCobroCobrada,
    },
    {
      id: 'cobro-facundo-1',
      facturaId: facturaParcial.id,
      fecha: isoDiasDespues(facturaParcial.fechaFactura, 20),
      montoPagado: cobroParcial,
    },
  ];
}
