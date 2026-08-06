import type { DocumentoAdjunto, EntidadDocumental } from '../../types/documento';

// Contrato de datos (ver ROADMAP-FRONTEND.md § "contrato de datos primero"). Las pantallas
// consumen esta interfaz, nunca Supabase directamente. Cuando C-03 (gestion-documental-core)
// se archive en el backend, se escribe un SupabaseDocumentoRepository que cumpla este mismo
// contrato y se inyecta en lugar del mock — los componentes no cambian.
export interface DocumentoRepository {
  listByEntity(entidad: EntidadDocumental, entidadId: string): Promise<DocumentoAdjunto[]>;
  /** `vigenciaDesde` es opcional (pacientes-documentos-multiples, design.md Checkpoint (b)) —
   * ningún caller de la UI lo completa todavía en este change, pero el contrato ya lo acepta para
   * que el día de mañana un input de fecha en la carga no requiera tocar el repository. */
  upload(
    entidad: EntidadDocumental,
    entidadId: string,
    itemId: string,
    file: File,
    vigenciaDesde?: string,
  ): Promise<DocumentoAdjunto>;
  /** Con colección (pacientes-documentos-multiples), "quitar el documento de este ítem" deja de
   * tener sentido porque puede haber N — apunta al documento puntual por su `id` propio, no por
   * `itemId`. Breaking change de contrato (design.md D1); único implementador real hoy es el mock. */
  remove(entidad: EntidadDocumental, entidadId: string, documentoId: string): Promise<void>;
}
