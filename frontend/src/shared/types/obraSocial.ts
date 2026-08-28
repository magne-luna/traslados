// Tipos del dominio de Obras Sociales (RF-300 a RF-306, knowledge-base/04_modelo_de_datos.md
// §ObraSocial). Maestro del que dependen Pacientes (FE-3), Presupuestos (FE-4) y Facturación
// (FE-6): cada factura arma su descripción y su checklist documental según la obra social del
// paciente. Contrato "tipos primero" (ver design.md de obras-sociales-ui) — cuando el backend
// real (C-04) se archive, estos tipos no deberían necesitar reescritura.

import type { ChecklistItem } from './documento';

/** RN-FA-07: tipo de comprobante fiscal que emite el prestador para esa obra social. */
export type TipoComprobante = 'A' | 'B' | 'C';

/**
 * Condición frente al IVA de la obra social receptora (change `facturacion-electronica-arca`,
 * D4-bis — cierra la discrepancia #14). Unión cerrada con los ocho códigos que acepta ARCA (README
 * del miniserver `arca-miniserver`); es el valor que viaja al payload de emisión de Factura A. La
 * columna `obra_social.condicion_iva` gana un `CHECK` con estos mismos valores. Decisión de la
 * usuaria (2026-08-28): deja de ser `string` libre.
 */
export type CondicionIvaArca =
  | 'IVA_RESPONSABLE_INSCRIPTO'
  | 'IVA_SUJETO_EXENTO'
  | 'CONSUMIDOR_FINAL'
  | 'IVA_RESPONSABLE_MONOTRIBUTO'
  | 'MONOTRIBUTO'
  | 'PROVEEDOR_DEL_EXTERIOR'
  | 'CLIENTE_DEL_EXTERIOR'
  | 'IVA_LIBERADO';

export const CONDICIONES_IVA_ARCA: readonly CondicionIvaArca[] = [
  'IVA_RESPONSABLE_INSCRIPTO',
  'IVA_SUJETO_EXENTO',
  'CONSUMIDOR_FINAL',
  'IVA_RESPONSABLE_MONOTRIBUTO',
  'MONOTRIBUTO',
  'PROVEEDOR_DEL_EXTERIOR',
  'CLIENTE_DEL_EXTERIOR',
  'IVA_LIBERADO',
] as const;

export function esCondicionIvaArca(valor: unknown): valor is CondicionIvaArca {
  return typeof valor === 'string' && (CONDICIONES_IVA_ARCA as readonly string[]).includes(valor);
}

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

// RF-106/RN-ID-02: el formato del número de afiliado del paciente "varía según la obra social" —
// es una propiedad de la obra social, no un dato editable por paciente/cobertura (antes vivía
// como `numeroAfiliado.formato` en shared/types/paciente.ts). Unión cerrada, no `string` libre —
// mismos valores que el enum real `obra_social.formato_afiliado` de la base (ya existente,
// creado por 20260729120000_schema_pacientes_gaps.sql para coberturas_paciente).
export type FormatoAfiliado = 'numero-documento' | 'alfanumerico' | 'cuil-con-sufijo';

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
   * CUIT de la **obra social** (entidad pagadora / receptora de la Factura A). Discrepancia #12
   * cerrada por decisión de la usuaria (2026-08-28, change `facturacion-electronica-arca` D4):
   * `obra_social.cuit` es el de la obra social, no el del prestador. RN-ID-01 lo separa del CUIL
   * del titular del paciente.
   */
  cuit: string;
  modalidadFacturacion: ModalidadFacturacion;
  /** Si la obra social admite pagos parciales o por lote. */
  admitePagosParciales: boolean;
  /** Formato del número de afiliado de sus pacientes (RF-106, RN-ID-02). */
  formatoAfiliado: FormatoAfiliado;
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
   * Condición frente al IVA (columna `obra_social.condicion_iva`). Unión cerrada con los ocho
   * códigos de ARCA (`CondicionIvaArca`) — cierra la discrepancia #14 (change
   * `facturacion-electronica-arca` D4-bis, decisión de la usuaria 2026-08-28). Opcional: sin
   * cargar (`undefined`) el alta de la OS no se bloquea, pero no se puede emitir Factura A.
   */
  condicionIva?: CondicionIvaArca;
  /**
   * Plazo de cobro propio de esta obra social, en días desde `fechaFactura` (columna
   * `obra_social.plazo_cobro_dias`, ya existente — anterior al módulo `Prestador`, que la había
   * dejado sin consumidor real; change `sacar-prestadores` la reexpone acá). Opcional: sin
   * configurar, `calcularFechaEstimadaCobro` cae en `PLAZO_COBRO_DEFAULT_DIAS` (RN-FA-04).
   */
  plazoCobroDias?: number;
  /**
   * Tipo de comprobante que sugiere/precarga esta obra social al dar de alta una factura nueva
   * (columna `obra_social.tipo_comprobante`, ya existente). Sugerencia editable, no una
   * restricción dura (RN-FA-07 sigue permitiendo cambiarlo a mano en cualquier factura).
   */
  tipoComprobante?: TipoComprobante;
}

/** Payload de alta: todo lo de ObraSocial salvo el id, que asigna el repository. */
export type NuevaObraSocial = Omit<ObraSocial, 'id'>;

/** Payload de edición: actualización parcial, sin permitir cambiar el id. */
export type ActualizacionObraSocial = Partial<Omit<ObraSocial, 'id'>>;
