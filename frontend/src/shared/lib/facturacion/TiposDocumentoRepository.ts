import type { TipoDocumentoFactura } from '../../types/tiposDocumento';

// Contrato de datos del catalogo de tipos de documento de factura (RF-410): lectura/escritura
// directas con RLS desde el frontend (mismo patron que CatalogoAccesoriosRepository — sin RPC
// nueva ni Edge Function). Las pantallas consumen esta interfaz, nunca Supabase directamente.

export interface CambiosTipoDocumento {
  tipo?: string;
  requerido?: boolean;
}

export interface TiposDocumentoRepository {
  /** Solo `activa = true`, ordenado por tipo — lo consume el checklist documental del detalle de
   * factura. Público; la policy de lectura `"Read tipos_documento facturacion"` (ajustada en la
   * migración `20260816120000`) cubre `facturacion: read`. */
  listarActivos(): Promise<TipoDocumentoFactura[]>;
  /** Todos, incluidos los inactivos (para la gestión con tachados y reactivar). Requiere permiso
   * de escritura sobre `facturacion`; si RLS lo rechaza, `mapearErrorTipoDocumento` lo traduce. */
  listarTodos(): Promise<TipoDocumentoFactura[]>;
  /** Alta con `activa = true`. `tipo` duplicado → error accionable que nombra el tipo. */
  crear(tipo: string, requerido: boolean): Promise<TipoDocumentoFactura>;
  editar(id: string, cambios: CambiosTipoDocumento): Promise<TipoDocumentoFactura>;
  /** Baja lógica: `activa = false`. Las facturas que ya usan el tipo no se tocan (FK
   * `documento_factura.id_tipo_documento ... ON DELETE RESTRICT); el DELETE no se expone. */
  desactivar(id: string): Promise<void>;
  reactivar(id: string): Promise<void>;
}