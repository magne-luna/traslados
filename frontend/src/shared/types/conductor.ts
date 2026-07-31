// Tipos del dominio de conductores (US-600, RN-GL-03, knowledge-base/04_modelo_de_datos.md
// §Conductor). Maestro operativo del que dependen las Hojas de Ruta (FE-5): cada recorrido se
// arma sobre un vehículo y su conductor asignado esa semana (Vehiculo 1---N Conductor,
// asignación semanal). Contrato "tipos primero" (ver design.md de conductores-ui) — cuando el
// backend real (C-09) se archive, estos tipos no deberían necesitar reescritura.
//
// Sin ningún campo de credencial/sesión/rol de acceso: RN-GL-03 es explícita — los conductores
// no acceden al sistema, se registran únicamente como datos (design.md Decisión 2).
//
// D6-B (integracion-conductores-vehiculos, 2026-07-31): el tipo `RestriccionConductor` y el campo
// `Conductor.restricciones` que vivían acá se ELIMINARON del dominio. El docx
// (`Traslados-Modelo-Datos.docx`) modela un único campo `Notas` de texto libre donde conviven las
// observaciones y las restricciones de perfil — no hay catálogo cerrado en la base. La usuaria
// resolvió por el docx literal: `observaciones?: string` pasa a ser el único campo libre del
// perfil (mapea a la columna `conductores.conductores.notas`). Consecuencia asumida: RN-GL-03
// (`C-10`, hojas de ruta) pierde el filtro automático por restricción y pasa a ser lectura humana
// de texto libre. No se reabre esta decisión sin un pedido nuevo y explícito de la usuaria.

/**
 * Disponibilidad operativa del conductor (04_modelo_de_datos.md §Conductor, discrepancia
 * resuelta 2026-07-24): mismo criterio que `EstadoVehiculo` — un conductor fuera de servicio
 * queda excluido de las hojas de ruta (lo aplicará FE-5/C-10).
 */
export type EstadoConductor = 'operando' | 'fuera-de-servicio';

/**
 * Asignación semanal de un conductor a un vehículo (design.md Decisión 4): `semana` es la
 * etiqueta ISO-8601 de semana (ej. `'2026-W30'`), no un rango de fechas. Referencia al vehículo
 * solo por `vehiculoId` (design.md Decisión 7) — NO embebe el objeto `Vehiculo`.
 */
export interface AsignacionSemanal {
  id: string;
  vehiculoId: string;
  /** Etiqueta ISO-8601 de semana, ej. '2026-W30'. */
  semana: string;
}

export interface Conductor {
  id: string;
  apellido: string;
  nombre: string;
  documento: string;
  telefono?: string;
  /** ISO date opcional; habilita a futuro validar restricciones por edad. */
  fechaNacimiento?: string;
  /** Domicilio (04_modelo_de_datos.md §Conductor). No obligatorio en el alta todavía. */
  domicilio: string;
  /** CUIL del conductor, distinto de `documento`/DNI (04_modelo_de_datos.md §Conductor). */
  cuil: string;
  estado: EstadoConductor;
  /** Único campo libre del perfil (D6-B): también donde se anota una restricción de perfil. */
  observaciones?: string;
  /** Embebidas en el conductor (design.md Decisión 5), no en un repository aparte. */
  asignaciones: AsignacionSemanal[];
}

/** Payload de alta: todo lo de Conductor salvo el id, que asigna el repository. */
export type NuevoConductor = Omit<Conductor, 'id'>;

/** Payload de edición: actualización parcial, sin permitir cambiar el id. */
export type ActualizacionConductor = Partial<Omit<Conductor, 'id'>>;
