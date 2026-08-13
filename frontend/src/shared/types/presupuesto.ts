// Tipos del dominio de Presupuestos y Autorizaciones (US-200, RF-200 a RF-205,
// knowledge-base/04_modelo_de_datos.md §Presupuesto/Autorizacion). Insumo de Facturación (FE-6):
// el cupo mensual autorizado (días/km) es la base del control de facturación (RN-PA-03, RN-FA-02).
// Contrato "tipos primero" (ver design.md de presupuestos-ui) — cuando el backend real (C-06) se
// archive, estos tipos no deberían necesitar reescritura.
//
// Cruce docx (docs/core/Traslados-Modelo-Datos.docx §Facturación) + KB, con 2 discrepancias de
// impacto backend documentadas en design.md ("⚠️ Discrepancias con Traslados-Modelo-Datos.docx",
// Decisiones 4 y 5): `montoAutorizado` y `vigenciaDesde` en `Autorizacion` son campos que el
// frontend agrega sobre el docx (que no los tiene) para poder validar RN-PA-01 y RN-PA-02 en UI —
// quedan opcionales y señalizados con `AvisoModeloDatos` en las pantallas correspondientes.

/** Unión cerrada de estados de una autorización (US-200). Nunca `string` libre. */
export type EstadoAutorizacion = 'pendiente' | 'autorizada' | 'judicializada' | 'rechazada';

/**
 * Referencia a un único archivo adjunto (design.md Decisión 3, Discrepancia 1): el docx modela
 * un solo "Archivo" por Presupuesto y por Autorización, NO una colección multi-documento — por
 * eso NO se reutiliza `DocumentChecklist` (multi-doc) ni se extiende `EntidadDocumental`
 * (`documento.ts`). La subida real a storage es responsabilidad del backend; acá es solo la
 * referencia (nombre + fecha de carga).
 */
export interface ArchivoAdjunto {
  nombre: string;
  /** ISO date en que se cargó el archivo. */
  cargadoEn: string;
}

export interface Presupuesto {
  id: string;
  /** Referencia por id al paciente (FE-3), nunca embebido. */
  pacienteId: string;
  /** Referencia por id a la obra social (FE-2) a la que se dirige el presupuesto, nunca embebida. */
  obraSocialId: string;
  /** Importe único propuesto (docx: `Monto`). NO es un desglose por prestación (design.md Discrepancia 4).
   * Agregar `prestacionId` (PR 2 de `presupuesto-prestaciones`) NO cambia esto: `monto` sigue siendo
   * un único valor numérico en las dos modalidades (KB discrepancia #13, no reabierta — design.md D5). */
  monto: number;
  /** ISO date. */
  fechaEmision: string;
  archivo?: ArchivoAdjunto;
  /**
   * Referencia opcional a `pacientes.prestaciones` (`presupuesto-prestaciones`, design.md D1/D5/D9).
   * Poblado únicamente cuando la obra social del presupuesto tiene `modalidadFacturacion ===
   * 'por-prestacion'` (un presupuesto por prestación, alta vía `createLote`). En modalidad `general`
   * queda SIEMPRE `undefined` — el desglose por prestación de esa modalidad vive solo en el
   * formulario (`PresupuestoLineasEditor`, PR 3), nunca en la base. NO reabre la #13: `monto` no
   * cambia de tipo, nullability ni semántica al agregar este campo.
   */
  prestacionId?: string;
}

export interface Autorizacion {
  id: string;
  /** Referencia por id al presupuesto que responde (relación 1---1, design.md Decisión 2), nunca embebido. */
  presupuestoId: string;
  estado: EstadoAutorizacion;
  /** ISO date en que la obra social respondió. */
  fechaRespuesta?: string;
  /**
   * Campo agregado por el frontend sobre el docx (design.md Discrepancias 2 y Decisión 4): la
   * Autorización del docx no tiene ningún monto, solo cupos. Se agrega para poder validar
   * RN-PA-01 (`montoAutorizado ≤ presupuesto.monto`) en UI — pendiente de confirmar con backend.
   */
  montoAutorizado?: number;
  /**
   * Campo agregado por el frontend sobre el docx (design.md Discrepancia 3 y Decisión 5),
   * independiente de `fechaRespuesta`: soporta la carga retroactiva (RN-PA-02) que el docx no
   * tiene dónde persistir — pendiente de confirmar con backend.
   */
  vigenciaDesde?: string;
  /** Cupo mensual de días habilitados a facturar (RN-PA-03). */
  cupoMensualDias?: number;
  /** Cupo mensual de kilómetros habilitados a facturar (RN-PA-03). */
  cupoMensualKm?: number;
  archivo?: ArchivoAdjunto;
}

/**
 * Proyección consumible por FE-6/Facturación (design.md Decisión 9, RN-PA-03, RN-FA-02): el
 * cupo mensual autorizado de un paciente, derivable de una `Autorizacion` + el `pacienteId` de su
 * `Presupuesto`. Deja el dato listo y consultable sin implementar el control de facturación acá.
 */
export interface CupoAutorizado {
  pacienteId: string;
  cupoMensualDias?: number;
  cupoMensualKm?: number;
  vigenciaDesde?: string;
}

/** Payload de alta de presupuesto: todo lo de Presupuesto salvo el id, que asigna el repository. */
export type NuevoPresupuesto = Omit<Presupuesto, 'id'>;

/** Payload de edición de presupuesto: actualización parcial, sin permitir cambiar el id. */
export type ActualizacionPresupuesto = Partial<Omit<Presupuesto, 'id'>>;

/** Payload de alta de autorización: todo lo de Autorizacion salvo el id, que asigna el repository. */
export type NuevaAutorizacion = Omit<Autorizacion, 'id'>;

/** Payload de edición de autorización: actualización parcial, sin permitir cambiar el id. */
export type ActualizacionAutorizacion = Partial<Omit<Autorizacion, 'id'>>;
