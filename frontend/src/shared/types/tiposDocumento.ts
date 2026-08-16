// Tipos del catalogo de tipos de documento de factura (facturacion.tipos_documento).
//
// Fuente de verdad: el maestro en Supabase (seed de 3 valores + alta gestionable desde la UI del
// detalle de factura). `tipo` es `string` deliberadamente — NO una union cerrada: dar de alta un
// tipo nuevo no debe exigir recompilar el frontend (mismo criterio que `TipoAccesorio` del
// catalogo de accesorios de movilidad). La validacion runtime vive en el repository (lectura del
// catalogo `activa = true`) y en la RLS del servidor.

/** Valor del campo `tipo` del catalogo. String libre; no validar contra literales en el frontend. */
export type TipoDocumento = string;

/** Fila del catalogo `facturacion.tipos_documento` (las columnas `requerido`/`activa` las agrega
 * la migración `20260816120000_tipos_documento_crud`). */
export interface TipoDocumentoFactura {
  id: string;
  tipo: string;
  /** El checklist documental de la factura se arma desde este catalogo: `true` = obligatorio
   * para el respaldo documental completo (mismo criterio que el seed de `CHECKLIST_DOCUMENTOS_FACTURA`). */
  requerido: boolean;
  /** Baja logica: `false` = queda visible donde ya se usa (facturas con documentos cargados),
   * deja de ofrecerse como tipo nuevo. El DELETE no se expone desde la UI. */
  activa: boolean;
}