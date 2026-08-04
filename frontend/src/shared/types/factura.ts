// Tipos del dominio de Facturación y Cobros (US-400, RF-400 a RF-411,
// knowledge-base/04_modelo_de_datos.md §Factura, docs/core/Traslados-Modelo-Datos.docx §5
// Facturación). Último eslabón del camino crítico (C-01 → C-02 → C-04 → C-05 → C-06 → C-07).
// Contrato "tipos primero" (ver design.md de facturacion-ui) — cuando el backend real (C-07) se
// archive, estos tipos no deberían necesitar reescritura.
//
// Reutiliza (nunca redefine): TipoComprobante, PlantillaFactura, PlantillaCampo,
// OrigenCampoPlantilla e IdentificadorOrigenFactura de obraSocial.ts (C-04); CupoAutorizado de
// presupuesto.ts (C-06); ChecklistItem/DocumentoAdjunto de documento.ts (C-03).
//
// RN-FA-01, design.md Decisión 2: este archivo NO importa nada de `hojaDeRuta.ts`. Las
// prestaciones declaradas se facturan íntegramente; el recorrido efectivo es independiente y no
// se deriva ni se valida a partir de él. Esa garantía se hace estructural acá: si algún día
// alguien intenta referenciar un Recorrido/HojaDeRuta desde este archivo, rompe la regla a
// simple vista (y el test de import de tasks.md 13.3 la hace explícita).

import type {
  IdentificadorOrigenFactura,
  OrigenCampoPlantilla,
  PlantillaCampo,
  PlantillaFactura,
  TipoComprobante,
} from './obraSocial';
import type { CupoAutorizado } from './presupuesto';
import type { ChecklistItem, DocumentoAdjunto } from './documento';

// Se reexportan para que quien consuma factura.ts no tenga que importar de obraSocial.ts /
// presupuesto.ts / documento.ts por separado — sin redefinir ninguno de los tipos.
export type { IdentificadorOrigenFactura, OrigenCampoPlantilla, PlantillaCampo, PlantillaFactura, TipoComprobante };
export type { CupoAutorizado };
export type { ChecklistItem, DocumentoAdjunto };

// Discrepancia 5 (design.md): el docx enumera "a facturar, cobrada, pagada parcialmente o
// pendiente" — NO tiene el estado `facturado`. La KB/US-400 sí lo tiene y lo necesita como
// disparador del cálculo de fecha estimada de cobro. Se adopta la unión de la KB (design.md
// Decisión 10); el `pendiente` del docx se trata como sinónimo de `a-facturar`. Unión cerrada,
// nunca `string` libre.
export type EstadoFactura = 'a-facturar' | 'facturado' | 'cobrado' | 'pagado-parcialmente';

/**
 * Identificador del paciente congelado en la factura al emitirla (IN-01, design.md Decisión 3):
 * snapshot del valor resuelto desde `plantillaFactura.identificadorOrigen` de la obra social en
 * el momento de emitir, para que un cambio posterior de la plantilla no mute facturas ya
 * emitidas (RN-FA-06 — sin ajustes retroactivos; una factura emitida es un documento fiscal).
 */
export interface IdentificadorFactura {
  origen: IdentificadorOrigenFactura;
  valor: string;
}

/**
 * Entidad agregada por el frontend sobre el docx (Discrepancia 1, design.md Decisión 1 y 2): el
 * docx no tiene ninguna entidad de asistencias/prestaciones en el área de Facturación. Se
 * embebe en `Factura` (mismo ciclo de vida — se declaran y facturan juntas), sin repository
 * propio. A propósito, NO tiene ningún campo que referencie `Recorrido`, `HojaDeRuta` ni
 * `ParadaRecorrido` (RN-FA-01): el recorrido efectivo no se deriva ni se valida contra esto.
 */
export interface AsistenciaPrestacion {
  id: string;
  /** ISO date de la prestación declarada. */
  fecha: string;
  prestacion: string;
  dependencia: string;
  retorno: string;
  /** RN-FA-03: los sábados se incluyen en `diasFacturables` solo si esta prestación lo indica. */
  facturaSabados: boolean;
}

export interface Factura {
  id: string;
  /** Referencia por id al paciente (FE-3), nunca embebido. */
  pacienteId: string;
  /**
   * Descripción renderizada por `renderDescripcionFactura` y congelada al emitir (design.md
   * Decisión 5, RN-FA-06): no se recalcula después de emitida, aunque cambie la plantilla.
   */
  descripcion: string;
  /** Cantidad de días facturados — conteo final confirmado manualmente (US-400, RN-FA-05). */
  dias: number;
  /** Valor del kilómetro (nomenclador nacional) de carga manual, sin automatización (RN-FA-05). */
  valorKm: number;
  /** Importe total (docx: `Monto`). Se propone calculado con `calcularTotalFactura` pero queda editable. */
  monto: number;
  estado: EstadoFactura;
  /** ISO date: inicio del período que cubre la factura (docx: `Fecha inicial`). */
  fechaInicial: string;
  /** ISO date: fin del período / fecha límite que cubre la factura (docx: `Fecha tope`). */
  fechaTope: string;
  tipoComprobante: TipoComprobante;
  /**
   * Referencia por id al `Prestador` elegido (change `factura-por-prestador`, design.md D1/D3),
   * nunca embebido — mismo criterio que `pacienteId`/`domicilioId`. Ausente cuando
   * `ObraSocial.modalidadFacturacion === 'general'` o cuando la obra social no tiene ningún
   * `Prestador` vinculado. Cuando está presente, `tipoComprobante` se fija desde
   * `Prestador.tipoComprobante` y queda de solo lectura en el form (D3) — no valida acá, es
   * responsabilidad del form (`FacturaForm.tsx`).
   */
  prestadorId?: string;

  // --- Agregados sobre el docx (documentados con su discrepancia, design.md §Discrepancias) ---

  /**
   * Cantidad de kilómetros facturados (Discrepancia 4, NUEVA/impacto backend): el docx solo
   * modela `Valor del kilómetro`, no la cantidad. Sin este campo es imposible validar el cupo
   * mensual de km (RN-FA-02, RN-PA-03) ni derivar el total. El backend C-07 debe agregar
   * `cantidad_km` a `factura`.
   */
  cantidadKm: number;
  /**
   * Fecha estimada de cobro, calculada y persistida al pasar a `facturado` (Discrepancia 3,
   * KNOWN/impacto backend): el docx no tiene ningún campo de plazo en días. Ausente mientras la
   * factura sigue en `a-facturar`. El backend C-07 debe agregar `fecha_estimada_cobro`.
   */
  fechaEstimadaCobro?: string;
  /**
   * Fecha en la que se emitió la factura (transición `a-facturar → facturado`), distinta de
   * `fechaInicial`/`fechaTope` (que son el período facturado, no la fecha de emisión). Ausente
   * mientras la factura sigue en `a-facturar`.
   */
  fechaFactura?: string;

  // --- Campos estructurados de la descripción (Discrepancia 6, menor): se persisten ADEMÁS del
  // texto renderizado en `descripcion`, porque son necesarios para validar el cupo *mensual*
  // (RN-FA-02) y para el reporte anual de C-11 — el docx los colapsa en un único campo de texto. ---

  prestacion: string;
  /** Mes facturado, 1-12 (design.md Decisión 4: período estructurado, no texto libre). */
  mesFacturado: number;
  anioFacturado: number;
  dependenciaYRetorno: string;
  /** Referencia por id a una de las `paciente.direcciones` (guarda solo el id, nunca embebida). */
  domicilioId: string;
  /** Snapshot congelado al emitir (ver `IdentificadorFactura`). Ausente mientras no se emitió. */
  identificadorFactura?: IdentificadorFactura;

  /** Prestaciones/asistencias declaradas del período (Discrepancia 1). Embebidas, sin repository propio. */
  asistencias: AsistenciaPrestacion[];
}

/**
 * Cobro registrado contra una factura (docx §Cobros: Factura / Fecha / Monto pagado). Repository
 * propio (design.md Decisión 1): los cobros llegan después de emitida la factura, a lo largo de
 * meses, con su propio ciclo de vida.
 */
export interface Cobro {
  /** Agregado sobre el docx (Discrepancia 7, menor): React exige keys estables por id, nunca
   * índice de array, y el borrado/edición de un cobro puntual lo requiere. Sin cartel en UI. */
  id: string;
  /** Referencia por id a la factura que cobra, nunca embebida. */
  facturaId: string;
  /** ISO date en que se registró el cobro. */
  fecha: string;
  montoPagado: number;
}

/** Payload de alta de factura: todo lo de Factura salvo el id, que asigna el repository. */
export type NuevaFactura = Omit<Factura, 'id'>;

/** Payload de edición de factura: actualización parcial, sin permitir cambiar el id. */
export type ActualizacionFactura = Partial<Omit<Factura, 'id'>>;

/** Payload de alta de cobro: todo lo de Cobro salvo el id, que asigna el repository. */
export type NuevoCobro = Omit<Cobro, 'id'>;

/** Payload de edición de cobro: actualización parcial, sin permitir cambiar el id ni la factura. */
export type ActualizacionCobro = Partial<Omit<Cobro, 'id' | 'facturaId'>>;
