import { supabase } from '../supabaseClient';
import type { EmisionRepository } from './EmisionRepository';
import { ensamblarFactura } from './facturaMapping';
import { traducirErrorEmision } from './emisionErrores';

// Implementación real de `EmisionRepository` (facturacion-electronica-arca, design.md D2). Toda la
// I/O pasa por la Edge Function `facturar` (`supabase.functions.invoke`), nunca PostgREST directo:
// el armado del payload fiscal, la llamada al miniserver, el CAE y los snapshots congelados viven
// del lado del servidor (D8). Este archivo no consulta `modulos.permisos` — el gateo
// (`requirePermiso('facturacion', 'write')`) vive en la EF.
//
// La EF devuelve la fila releída de `facturacion.facturas` en shape snake_case + embed
// `asistencia_prestacion` (igual que `SELECT_FACTURA_COMPLETA` de `SupabaseFacturaRepository`), así
// que `ensamblarFactura` la mapea sin mapping nuevo.
//
// Nadie lo importa todavía (tasks.md §5): el swap real ocurre en un único commit que cambia
// `useEmisionFactura` para llamar acá en vez de `actualizar(id, { estado: 'facturado' })`.
export const supabaseEmisionRepository: EmisionRepository = {
  async emitir(facturaId: string) {
    const { data, error } = await supabase.functions.invoke('facturar', {
      method: 'POST',
      body: { facturaId },
    });

    if (error) throw await traducirErrorEmision(error);

    const factura = ensamblarFactura(data);
    // `ensamblarFactura` es total (nunca lanza): una respuesta 200 con un cuerpo inesperado
    // produciría una factura con `id === ''`. No hacerla pasar por éxito.
    if (!factura.id) throw new Error('No se pudo emitir la factura.');
    return factura;
  },
};
