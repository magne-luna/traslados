// Tipos del dominio de Prestador (US-300, knowledge-base/04_modelo_de_datos.md §Prestador).
// `razonSocial`/`cuit`/`direccion`/`telefono` ya existían en `obra_social.prestadores`
// (`20260724100003_schema_obra_social.sql:28-34`, sin ninguna vía de alta en la app hasta este
// change). `plazoCobroDias`/`tipoComprobante` se mudaron acá desde `ObraSocial` (change
// `prestadores-crud`, design.md D1/D3/D4): lectura literal de US-300 ("se registra plazo de
// cobro, tipo de comprobante y demás condiciones particulares POR PRESTADOR"), supuesto
// provisorio #3 del proposal — **SIN confirmar con Andrea**. Contrato "tipos primero" (mismo
// criterio que `shared/types/obraSocial.ts`).

import type { TipoComprobante } from './obraSocial';

export interface Prestador {
  id: string;
  razonSocial: string;
  cuit: string;
  /** Columna `obra_social.prestadores.direccion`, NULLable. */
  direccion?: string;
  /** Columna `obra_social.prestadores.telefono`, NULLable. */
  telefono?: string;
  /**
   * Plazo de cobro en días, mudado desde `ObraSocial.plazoCobroDias` (D3/D4 de `prestadores-crud`,
   * supuesto #3, sin confirmar con Andrea). Default de la migración: 90.
   */
  plazoCobroDias: number;
  /**
   * Tipo de comprobante fiscal (RN-FA-07), mudado desde `ObraSocial.tipoComprobante` (D3/D4 de
   * `prestadores-crud`, mismo supuesto #3). Default de la migración: 'A'.
   */
  tipoComprobante: TipoComprobante;
}

/** Payload de alta: todo lo de Prestador salvo el id, que asigna el repository. */
export type NuevoPrestador = Omit<Prestador, 'id'>;

/**
 * Payload de edición: actualización parcial, sin permitir cambiar el id. `obrasSocialesIds` es el
 * único campo que no vive en `Prestador` (D2 de `prestadores-crud`): representa el conjunto
 * completo de ObrasSociales vinculadas tras el guardado, resuelto por diff en el repository
 * (`SupabasePrestadorRepository.update`) — clave ausente = "no tocar el vínculo", presente
 * (incluido `[]`) = "el vínculo pasa a ser exactamente este conjunto".
 */
export type ActualizacionPrestador = Partial<Omit<Prestador, 'id'>> & { obrasSocialesIds?: string[] };
