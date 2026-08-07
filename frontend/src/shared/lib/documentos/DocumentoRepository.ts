import type { DocumentoAdjunto, EntidadDocumental } from '../../types/documento';

// Contrato de datos (ver ROADMAP-FRONTEND.md § "contrato de datos primero"). Las pantallas
// consumen esta interfaz, nunca Supabase directamente. Cuando C-03 (gestion-documental-core)
// se archive en el backend, se escribe un SupabaseDocumentoRepository que cumpla este mismo
// contrato y se inyecta en lugar del mock — los componentes no cambian.
export interface DocumentoRepository {
  /** `agrupacionId` es opcional (documentos-checklist-por-actividad, design.md Checkpoint (b)
   * VEREDICTO opción B) — agrega un tercer parámetro al final para no reordenar callers existentes.
   * Sin `agrupacionId`, devuelve los documentos que no tienen ninguna agrupación (Checkpoint (c));
   * con `agrupacionId`, devuelve solo los de esa agrupación puntual. Los otros 3 dominios
   * (Vehículos/Conductores/Facturas) nunca lo pasan y se comportan exactamente igual que hoy. */
  listByEntity(
    entidad: EntidadDocumental,
    entidadId: string,
    agrupacionId?: string,
  ): Promise<DocumentoAdjunto[]>;
  /** `vigenciaDesde` es opcional (pacientes-documentos-multiples, design.md Checkpoint (b)) —
   * ningún caller de la UI lo completa todavía en este change, pero el contrato ya lo acepta para
   * que el día de mañana un input de fecha en la carga no requiera tocar el repository.
   * `agrupacionId` es opcional (documentos-checklist-por-actividad, design.md Checkpoint (b)
   * VEREDICTO opción B) — se agrega DESPUÉS de `vigenciaDesde` a propósito, para no reordenar
   * parámetros ya usados por callers posicionales existentes. */
  upload(
    entidad: EntidadDocumental,
    entidadId: string,
    itemId: string,
    file: File,
    vigenciaDesde?: string,
    agrupacionId?: string,
  ): Promise<DocumentoAdjunto>;
  /** Con colección (pacientes-documentos-multiples), "quitar el documento de este ítem" deja de
   * tener sentido porque puede haber N — apunta al documento puntual por su `id` propio, no por
   * `itemId`. Breaking change de contrato (design.md D1); único implementador real hoy es el mock.
   * documentos-checklist-por-actividad (tasks.md 2.2): NO gana `agrupacionId` — el `documentoId` ya
   * es único dentro de la entidad sin importar de qué agrupación sea, verificado explícitamente en
   * `DocumentoRepository.agrupacion.types.test.ts`. */
  remove(entidad: EntidadDocumental, entidadId: string, documentoId: string): Promise<void>;
  /** Resuelve una URL utilizable para MOSTRAR el documento, sin descargarlo
   * (documentos-previsualizacion, design.md D2). Bajo demanda y no un campo persistido porque el
   * resultado es efímero: `ObjectURL` en el mock, URL firmada con expiración contra Storage privado
   * en la implementación real — nunca se persiste en `DocumentoAdjunto`.
   *
   * Devuelve `null` (no lanza) cuando el documento no es previsualizable o no tiene contenido
   * resoluble — el caso normal para los documentos que ya existían antes de este change. Los
   * fallos reales (403 de RLS, 404 de bucket, URL vencida) sí se propagan como error, para que la
   * UI los distinga de "no hay nada que ver".
   *
   * documentos-checklist-por-actividad (tasks.md 2.2): NO gana `agrupacionId` por la misma razón
   * que `remove` — mismo `documentoId` único, verificado explícitamente. */
  resolverPrevisualizacion(
    entidad: EntidadDocumental,
    entidadId: string,
    documentoId: string,
  ): Promise<string | null>;
}
