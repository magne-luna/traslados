import type { Factura } from '../../types/factura';

// Contrato de la emisión electrónica (facturacion-electronica-arca, design.md D2). Emitir NO es
// CRUD — es una acción con efectos fiscales externos (obtiene un CAE real de ARCA a través del
// miniserver, mediada por la Edge Function `facturar`). Por eso vive en un repository aparte y no
// como un método más de `FacturaRepository` (que sigue siendo `list/getById/create/update` puro).
//
// La feature depende de esta interfaz, nunca de `supabase.functions.invoke` directamente. El punto
// de composición inyecta `supabaseEmisionRepository` (real) o `mockEmisionRepository` (tests /
// desarrollo sin backend).
export interface EmisionRepository {
  /**
   * Emite el comprobante fiscal de la factura `facturaId`. Devuelve la factura releída, ya en
   * estado `facturado` y con `cae` / `caeVencimiento` / `cbteNro` / `ptoVta` / `arcaAmbiente` /
   * `comprobantePdfUrl` poblados.
   *
   * Lanza `Error` con `.message` en castellano (design.md D9) cuando ARCA rechaza el comprobante,
   * la identidad fiscal falla, el miniserver no responde, la emisión no está configurada, o la
   * factura ya tiene CAE (idempotencia). En esos casos la factura NO cambia de estado.
   */
  emitir(facturaId: string): Promise<Factura>;
}
