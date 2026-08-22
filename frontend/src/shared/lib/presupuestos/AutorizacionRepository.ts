import type { ActualizacionAutorizacion, Autorizacion, NuevaAutorizacion } from '../../types/presupuesto';

// Contrato de datos (ver design.md de presupuestos-ui, Decisión 2 y 10): Autorizacion es una
// entidad separada de Presupuesto, referenciada por `presupuestoId` (relación 1---1). Las
// pantallas de la feature consumen esta interfaz, nunca Supabase directamente. Cuando el backend
// real (C-06) se archive, se escribe un SupabaseAutorizacionRepository que cumpla este mismo
// contrato y se inyecta en el punto de composición — los componentes no cambian.
export interface AutorizacionRepository {
  list(): Promise<Autorizacion[]>;
  /** Resuelve `null` si no existe una autorización con ese id (no lanza excepción). */
  getById(id: string): Promise<Autorizacion | null>;
  /** Resuelve `null` si el presupuesto todavía no tiene una autorización asociada. */
  getByPresupuestoId(presupuestoId: string): Promise<Autorizacion | null>;
  create(data: NuevaAutorizacion): Promise<Autorizacion>;
  update(id: string, data: ActualizacionAutorizacion): Promise<Autorizacion>;
  /**
   * Sube (o reemplaza, si ya había uno) el archivo único de la autorización (design.md D3/D5 de
   * `integracion-documentos-autorizaciones`). Separado de `update()` a propósito, mismo criterio
   * que `DocumentoRepository.upload`/`remove`: es una operación de I/O distinta (Storage + fila),
   * no un cambio de campos planos. En un reemplazo, el objeto viejo se borra solo después de que la
   * fila quedó apuntando al nuevo (D5, reemplazo compensado) — nunca deja la fila apuntando a una
   * clave inexistente.
   */
  uploadArchivo(id: string, file: File): Promise<Autorizacion>;
  /**
   * Quita el archivo adjunto: borra el objeto del bucket y limpia la referencia (`archivo`) de la
   * autorización. Idempotente — si la autorización no tiene archivo, resuelve sin error (spec
   * `autorizacion-archivo-storage`, escenario "Quitar cuando no hay archivo no falla").
   */
  removeArchivo(id: string): Promise<Autorizacion>;
  /**
   * URL firmada de expiración corta para el archivo adjunto (design.md D6b de
   * `presupuestos-vigencia-datos-traslado-vista-previa`, spec `autorizacion-archivo-vista-previa`,
   * requirement "URL firmada con modo explícito inline o descarga"). Dos modos, a propósito UN
   * SOLO método en vez de dos: `'inline'` sirve el objeto con su `Content-Type` para que el
   * navegador lo renderice (abrir en pestaña nueva / previsualizar dentro de la app) — la firma
   * OMITE la opción `download`. `'descarga'` la incluye para forzar
   * `Content-Disposition: attachment` (mismo criterio, invertido a propósito, que
   * `SupabaseDocumentoRepository.resolverPrevisualizacion`, fix del 2026-08-10: acá el caso base
   * es mostrar el documento, no descargarlo). Resuelve `null` sin lanzar cuando la autorización no
   * tiene archivo — mismo criterio que `getById`/`getByPresupuestoId`.
   */
  getUrlArchivo(id: string, modo: 'inline' | 'descarga'): Promise<string | null>;
}
