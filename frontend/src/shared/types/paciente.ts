// Tipos del dominio de Pacientes (RF-100 a RF-115, knowledge-base/04_modelo_de_datos.md
// §Paciente). Entidad central de la que dependen Presupuestos (FE-4), Hojas de Ruta (FE-5) y
// Facturación (FE-6). Contrato "tipos primero" (ver design.md de pacientes-ui) — cuando el
// backend real (C-05) se archive, estos tipos no deberían necesitar reescritura.

import type { AccesorioMovilidad } from './vehiculo';
import type { Prestacion } from './prestacion';

/**
 * Identificador de afiliado (RF-106, RN-ID-02): `valor` es libre. El formato (número de
 * documento, alfanumérico, o CUIL del titular con sufijo) NO vive acá — es una propiedad de la
 * obra social del paciente (`ObraSocial.formatoAfiliado` en `shared/types/obraSocial.ts`), nunca
 * un dato que el operador elija por paciente/cobertura. Ver `knowledge-base/10_preguntas_
 * abiertas.md` IN-01.
 */
export interface IdentificadorAfiliado {
  valor: string;
}

/** Tipo/etiqueta de una dirección del paciente (RF-113). Unión cerrada, no `string` libre. */
export type TipoDireccion = 'domicilio' | 'escuela' | 'escuela-especial' | 'terapia' | 'cet' | 'otro';

/**
 * Tramo de un recorrido (RN-HR-02): vive en `ParadaRecorrido` (hojaDeRuta.ts), nunca en
 * `Direccion` — una misma dirección del paciente (ej. el domicilio) suele ser origen de la ida Y
 * destino de la vuelta, así que fijarle un tramo propio obligaba a duplicar la dirección para
 * cubrir ambos casos sin que nada la usara realmente para filtrar (PacienteTramoCampos.tsx
 * ofrece las direcciones del paciente completas para origen/destino, sin filtrar por tramo). El
 * tramo de cada tramo del recorrido se elige de forma independiente al armar la parada — la UI
 * nunca lo deriva de una dirección.
 */
export type Tramo = 'ida' | 'vuelta';

/** CUD: Certificado Único de Discapacidad. Fechas como ISO string (mismo criterio que el resto del dominio). */
export interface Cud {
  numero: string;
  fechaEmision: string;
  fechaVencimiento: string;
}

/** Dirección del paciente (RF-113): catálogo de lugares reutilizables (domicilio, escuela,
 * terapia, etc.) que hojas-de-ruta referencia por id para armar origen/destino de cada parada de
 * un recorrido — el tramo (ida/vuelta) de ese uso es del recorrido, no de la dirección.
 * `descripcion` (pedido directo de la usuaria, no viene del docx — ver discrepancia en
 * `knowledge-base/04_modelo_de_datos.md` §Discrepancias, mismo criterio que `Parentesco`) es
 * texto libre opcional para diferenciar dos direcciones del mismo `tipo` (ej. dos `terapia`:
 * "Kinesióloga" vs "Fonoaudióloga"). */
export interface Direccion {
  id: string;
  tipo: TipoDireccion;
  calle: string;
  localidad: string;
  descripcion?: string;
  dias?: string;
  horario?: string;
}

/** Parentesco de una persona a cargo respecto del paciente. Unión cerrada, no `string` libre —
 * mismo criterio que `TipoDireccion`. Campo pedido directamente por la usuaria (no viene del docx,
 * ver discrepancia en `knowledge-base/04_modelo_de_datos.md` §Discrepancias). */
export type Parentesco = 'padre' | 'madre' | 'tutor_legal' | 'otro';

/** Persona a cargo del paciente (lista dinámica, sin límite fijo). */
export interface PersonaACargo {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  /** Obligatorio (a diferencia de teléfono/teléfono alternativo). */
  parentesco: Parentesco;
  /** Teléfono (docx: vive en Personas a Cargo, no en Paciente). */
  telefono?: string;
  /** Teléfono alternativo (docx: vive en Personas a Cargo, no en Paciente). */
  telefonoAlternativo?: string;
}

export interface Paciente {
  id: string;
  apellido: string;
  /** Segundo apellido (docx: separado del apellido, opcional). */
  segundoApellido?: string;
  nombre: string;
  /** Segundo nombre (docx: separado del nombre, opcional). */
  segundoNombre?: string;
  /** ISO date. */
  fechaNacimiento: string;
  /** DNI del paciente — campo propio, distinto de `cuilTitular` y de `numeroAfiliado` (RN-ID-01/02). */
  dni: string;
  /** CUIL del titular (responsable de la cobertura), distinto del DNI y del identificador de afiliado. */
  cuilTitular: string;
  /** Diagnóstico clínico. */
  diagnostico: string;
  /** Condición clínica (docx: campo separado de Diagnóstico dentro de "Datos Clínicos"). */
  condicion?: string;
  /**
   * Reutiliza el tipo de FE-2 (`shared/types/vehiculo.ts`) — no se redefine acá. Lista: el docx
   * modela esto como relación N a N (tabla de vínculo, igual que Vehiculo-Accesorio) — un
   * paciente puede requerir varios accesorios a la vez. Array vacío = ninguno cargado.
   */
  accesorioMovilidad: AccesorioMovilidad[];
  /** Referencia por id al maestro de FE-2, nunca embebida (design.md Decisión 4). */
  obraSocialId: string | null;
  /** Identificador de afiliado adaptable por obra social (design.md Decisión 1). */
  numeroAfiliado: IdentificadorAfiliado;
  cud: Cud | null;
  direcciones: Direccion[];
  personasACargo: PersonaACargo[];
  /** Flag de amparo judicial (afecta plazos de cobro en Facturación, FE-6). */
  amparoJudicial: boolean;
  amparoJudicialAclaracion?: string;
  /**
   * Catálogo de prestaciones del paciente (presupuesto-prestaciones, design.md D1/D7, PR 1 de la
   * serie encadenada). OPCIONAL a propósito, a diferencia de `direcciones`/`personasACargo`
   * (siempre `[]`, nunca ausentes): la migración de `pacientes.prestaciones` (tasks.md Fase 3) es
   * aditiva y `SupabasePacienteRepository`/`pacienteMapping.ts` todavía no la leen ni escriben en
   * este PR (queda para un PR posterior, una vez aplicada) — forzar el campo a requerido hubiera
   * obligado a tocar decenas de fixtures/tests de dominios sin relación con este change solo para
   * satisfacer el tipo. `PacienteDetail` la trata como `paciente.prestaciones ?? []`.
   */
  prestaciones?: Prestacion[];
}

/** Payload de alta: todo lo de Paciente salvo el id, que asigna el repository. */
export type NuevoPaciente = Omit<Paciente, 'id'>;

/** Payload de edición: actualización parcial, sin permitir cambiar el id. */
export type ActualizacionPaciente = Partial<Omit<Paciente, 'id'>>;
