import type { DocumentoAdjunto, EntidadDocumental } from '../../types/documento';

// Contrato de datos (ver ROADMAP-FRONTEND.md § "contrato de datos primero"). Las pantallas
// consumen esta interfaz, nunca Supabase directamente. Cuando C-03 (gestion-documental-core)
// se archive en el backend, se escribe un SupabaseDocumentoRepository que cumpla este mismo
// contrato y se inyecta en lugar del mock — los componentes no cambian.
export interface DocumentoRepository {
  listByEntity(entidad: EntidadDocumental, entidadId: string): Promise<DocumentoAdjunto[]>;
  upload(entidad: EntidadDocumental, entidadId: string, itemId: string, file: File): Promise<DocumentoAdjunto>;
  remove(entidad: EntidadDocumental, entidadId: string, itemId: string): Promise<void>;
}
