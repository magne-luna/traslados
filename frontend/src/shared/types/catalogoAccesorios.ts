// Tipos del catalogo global de accesorios de movilidad (pacientes.accesorios).
//
// Fuente de verdad: el maestro en Supabase (seed de 5 valores + alta gestionable desde la UI).
// `TipoAccesorio` es `string` deliberadamente — NO una union cerrada: agregar un accesorio no
// debe exigir recompilar el frontend (discrepancia #11 cerrada). La validacion runtime vive en el
// repository (lectura del catalogo `activa = true`) y en la Edge Function pacientes-accesorios.

/** Valor del campo `tipo` del catalogo. String libre; no validar contra literales en el frontend. */
export type TipoAccesorio = string;

/** Fila del catalogo `pacientes.accesorios` (las columnas `icono`/`activa` las agrega la
 * migración `20260816090000_catalogo_accesorios_icono_activa`). */
export interface AccesorioCatalogo {
  id: string;
  tipo: string;
  /** Campo libre cargado en el alta (docx: tipo/descripcion). */
  descripcion?: string;
  /** String: clave del mapeo del design system (`iconoAccesorioMap`), nunca SVG inline ni emoji. */
  icono: string;
  /** Baja lógica: `false` = queda visible donde ya se usa, deja de ofrecerse en asignaciones nuevas. */
  activa: boolean;
}