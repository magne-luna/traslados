// Tipos del dominio de Obras Sociales (RF-300 a RF-306, knowledge-base/04_modelo_de_datos.md
// §ObraSocial). Maestro del que dependen Pacientes (FE-3), Presupuestos (FE-4) y Facturación
// (FE-6): cada factura arma su descripción y su checklist documental según la obra social del
// paciente. Contrato "tipos primero" (ver design.md de obras-sociales-ui) — cuando el backend
// real (C-04) se archive, estos tipos no deberían necesitar reescritura.

import type { ChecklistItem } from './documento';

/** RN-FA-07: tipo de comprobante fiscal que emite el prestador para esa obra social. */
export type TipoComprobante = 'A' | 'B' | 'C';

/** Facturación por cada prestación individual, o una factura general consolidada. */
export type ModalidadFacturacion = 'por-prestacion' | 'general';

// Origen del dato para un campo de la plantilla de descripción de factura (RF-302, RF-400).
// Unión cerrada de literales (no `string` libre) para mantener modo strict y habilitar
// el identificador de factura configurable por obra social (IN-01, ver design.md Decisión 3).
export type OrigenCampoPlantilla =
  | 'paciente.nombre'
  | 'paciente.dni'
  | 'paciente.numeroAfiliado'
  | 'paciente.domicilio'
  | 'traslado.prestacion'
  | 'traslado.mesYAnio'
  | 'traslado.cantidadDias'
  | 'traslado.dependenciaYRetorno'
  | 'traslado.valorKm'
  | 'traslado.cantidadKm'
  | 'traslado.total'
  | 'valor-manual';

// Subconjunto de OrigenCampoPlantilla relevante para IN-01 (identificador de paciente en la
// factura): "¿es el DNI o el número de afiliado?" — pregunta abierta de prioridad Alta, sin
// cerrar con el cliente (knowledge-base/10_preguntas_abiertas.md). Se modela como campo
// configurable con default documentado, nunca hardcodeado (ver DEFAULT_IDENTIFICADOR_ORIGEN
// en mockObraSocialRepository.ts).
export type IdentificadorOrigenFactura = 'paciente.dni' | 'paciente.numeroAfiliado';

export interface PlantillaCampo {
  id: string;
  etiqueta: string;
  origen: OrigenCampoPlantilla;
  /** Posición del campo dentro de la plantilla; 0 = primero. */
  orden: number;
}

export interface PlantillaFactura {
  campos: PlantillaCampo[];
  /** Qué campo de la ficha del paciente alimenta el identificador que aparece en la factura (IN-01). */
  identificadorOrigen: IdentificadorOrigenFactura;
}

export interface ObraSocial {
  id: string;
  nombre: string;
  /**
   * CUIT — ambigüedad sin confirmar (integracion-obra-social D8, discrepancia #12): la base real
   * tiene `obra_social.cuit` y `prestadores.cuit` como columnas distintas, y no está confirmado si
   * este campo corresponde a la obra social (entidad pagadora) o al prestador. RN-ID-01 solo separa
   * CUIT (empresa) de CUIL (titular del paciente) — no dice cuál empresa. Ver
   * `AvisoModeloDatos` en `ObraSocialDetail.tsx` y `knowledge-base/04_modelo_de_datos.md`
   * §Discrepancias. No se resuelve acá.
   */
  cuit: string;
  /** Plazo de cobro en días, configurable por obra social (default documentado: 90 días). */
  plazoCobroDias: number;
  tipoComprobante: TipoComprobante;
  modalidadFacturacion: ModalidadFacturacion;
  /** Si la obra social admite pagos parciales o por lote. */
  admitePagosParciales: boolean;
  /** Checklist documental configurable (RN-FA-08); reutiliza ChecklistItem de FE-1. El orden
   * de los ítems del array es significativo y debe preservarse. */
  checklist: ChecklistItem[];
  plantillaFactura: PlantillaFactura;
  /**
   * Código interno/identificador corto de la obra social (integracion-obra-social D9,
   * discrepancia #11 del docx: la columna `obra_social.codigo` ya existe en la base desde
   * `20260724100003_schema_obra_social.sql` pero ninguna vía de la app podía completarla).
   * Opcional: la columna es NULLable y el docx no la marca obligatoria.
   */
  codigo?: string;
  /** Dirección de la obra social (D9, discrepancia #11). Columna `obra_social.direccion`, NULLable. */
  direccion?: string;
  /** Teléfono de la obra social (D9, discrepancia #11). Columna `obra_social.telefono`, NULLable. */
  telefono?: string;
  /**
   * Condición frente al IVA (D9, discrepancia #11 y #14). Columna `obra_social.condicion_iva`,
   * `TEXT` libre — ninguna fuente (docx ni KB) enumera sus valores posibles, así que se modela
   * como `string` libre y no como unión de literales inventada. Pregunta abierta en
   * `knowledge-base/10_preguntas_abiertas.md`.
   */
  condicionIva?: string;
}

/** Payload de alta: todo lo de ObraSocial salvo el id, que asigna el repository. */
export type NuevaObraSocial = Omit<ObraSocial, 'id'>;

/** Payload de edición: actualización parcial, sin permitir cambiar el id. */
export type ActualizacionObraSocial = Partial<Omit<ObraSocial, 'id'>>;
