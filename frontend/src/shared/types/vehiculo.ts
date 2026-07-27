// Tipos del dominio de flota (RF-500 a RF-508, knowledge-base/04_modelo_de_datos.md
// §Vehiculo). Maestro operativo del que dependen las Hojas de Ruta (FE-5): capacidad y
// accesorios de movilidad compatibles con cada paciente (RN-VE-01), estado habilitado/fuera
// de servicio (RN-VE-02). Contrato "tipos primero" (ver design.md de vehiculos-ui) — cuando el
// backend real (C-08) se archive, estos tipos no deberían necesitar reescritura.

/** Conjunto cerrado de accesorios de movilidad compatibles (RN-VE-01). No usar `string` libre. */
export type AccesorioMovilidad = 'silla-plegable' | 'silla-rigida' | 'silla-postural' | 'andador' | 'tripode';

/** RN-VE-02: un vehículo fuera de servicio queda excluido de las hojas de ruta (lo aplica FE-5). */
export type EstadoVehiculo = 'habilitado' | 'fuera-de-servicio';

/**
 * Habilitación VTV o RTO, registrable de forma independiente (RN-VE-04): un vehículo puede
 * tener la VTV vigente y la RTO vencida, o viceversa. Fechas como ISO string.
 */
export interface RegistroHabilitacion {
  tipo: 'vtv' | 'rto';
  fechaEmision: string;
  fechaVencimiento: string;
}

/** Clasificación del gasto, para poder filtrar/agrupar el registro (RF-508). Conjunto cerrado. */
export type CategoriaGasto = 'mantenimiento' | 'reparacion' | 'service';

/** Evento de gasto del vehículo (RF-508): fecha + monto, sin frecuencia fija. */
export interface GastoVehiculo {
  id: string;
  fecha: string; // ISO date
  monto: number;
  descripcion?: string;
  categoria: CategoriaGasto;
}

export interface Vehiculo {
  id: string;
  patente: string;
  modelo: string;
  tipo: string;
  /** Capacidad de pasajeros, hasta 6 (RF-500). */
  capacidad: number;
  accesoriosCompatibles: AccesorioMovilidad[];
  estado: EstadoVehiculo;
  kilometraje: number;
  /** Kilometraje registrado en el último service preventivo (RN-VE-03). */
  kilometrajeUltimoService: number;
  /** Fecha del último service preventivo (RN-VE-03), ISO date. */
  fechaUltimoService: string;
  habilitaciones: RegistroHabilitacion[];
  gastos: GastoVehiculo[];
}

/** Payload de alta: todo lo de Vehiculo salvo el id, que asigna el repository. */
export type NuevoVehiculo = Omit<Vehiculo, 'id'>;

/** Payload de edición: actualización parcial, sin permitir cambiar el id. */
export type ActualizacionVehiculo = Partial<Omit<Vehiculo, 'id'>>;
