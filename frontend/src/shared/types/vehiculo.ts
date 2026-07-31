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

/**
 * Evento de gasto del vehículo (RF-508): fecha + monto, sin frecuencia fija — exactamente los
 * campos que el docx (`docs/core/Traslados-Modelo-Datos.docx` §Gastos de Vehículo) le da a esta
 * entidad: Vehículo, Monto, Fecha. `descripcion` es un agregado del frontend (no está en el docx,
 * Open Question 5 de `design.md` de `vehiculo-mantenimiento-registro`) para poder anotar en texto
 * libre lo que el docx describe informalmente ("combustible, peajes, reparaciones menores, entre
 * otros"). Este tipo NO tiene campo de categoría: los valores `CategoriaGasto` (`'mantenimiento' |
 * 'reparacion' | 'service'`) que existían acá antes de `vehiculo-mantenimiento-registro` eran
 * inventados (sin fuente en el docx, la KB ni el spec `vehiculo-gastos`) y se eliminaron; la
 * clasificación real de una intervención vive en `MantenimientoRegistro`.
 */
export interface GastoVehiculo {
  id: string;
  fecha: string; // ISO date
  monto: number;
  descripcion?: string;
}

/**
 * Nivel 1 de la categoría de intervención (docx §Mantenimiento, campo Categoría: "Tipo de
 * intervención: gasto, mantenimiento preventivo o mantenimiento correctivo"). Conjunto cerrado con
 * los tres valores que nombra el docx — el alta desde `HistorialMantenimiento.tsx` solo ofrece
 * `preventivo`/`correctivo` (design.md Decisión 2), pero el tipo conserva `'gasto'` para poder
 * leer un registro con ese nivel 1 sin tener que reescribir el tipo el día que el backend lo
 * inserte; no crearlo desde esta pantalla evita duplicar la entidad `Gastos de Vehículo` del mismo
 * docx.
 */
export type TipoIntervencion = 'gasto' | 'preventivo' | 'correctivo';

/**
 * Nivel 2 de una intervención preventiva (US-500, `knowledge-base/06_funcionalidades.md`
 * L128-134). Conjunto cerrado: la KB enumera exactamente estos tres, sin "etc.", y cada uno tiene
 * una regla de negocio codificada que lo evalúa (cambio de aceite/filtros → RN-VE-03; VTV/RTO →
 * RN-VE-04) — abrirlo permitiría un preventivo que ninguna regla sabe interpretar.
 */
export type SubtipoPreventivo = 'cambio-aceite-filtros' | 'vtv' | 'rto';

/** Sub-tipos correctivos con nombre propio en US-500 ("alternador, batería, frenos, embrague, cubiertas, etc."). */
export type SubtipoCorrectivoConocido = 'alternador' | 'bateria' | 'frenos' | 'embrague' | 'cubiertas';

/**
 * Nivel 2 de una intervención correctiva. US-500 deja la lista abierta con "etc.", así que un
 * enum cerrado garantizaría que la primera intervención real fuera de catálogo (radiador,
 * suspensión, caja) quedara inregistrable — el mismo patrón que llevó a inventar `CategoriaGasto`
 * en `vehiculos-ui`. La apertura es un valor de escape (`'otro'`) que exige `detalle: string`
 * (ver `MantenimientoRegistro`), nunca un `subtipo: string` libre: se conserva el chequeo de
 * tipos, los chips y el agrupamiento por sub-tipo conocido.
 */
export type SubtipoCorrectivo = SubtipoCorrectivoConocido | 'otro';

/**
 * Campos comunes a todo registro de mantenimiento (docx §Mantenimiento), mapeados 1:1 al campo
 * del docx en cada comentario. Sin `monto`: el importe de una intervención pertenece a
 * `GastoVehiculo` (entidad separada del docx) — registrar el costo de una reparación es un
 * `MantenimientoRegistro` (la intervención) + un `GastoVehiculo` (el pago), sin FK entre ambos
 * (el docx no la tiene, Open Question 4 de `design.md`).
 */
interface MantenimientoRegistroBase {
  id: string;
  fecha: string; // ISO date — docx: Fecha
  kilometraje: number; // docx: "Kilometraje actual" = odómetro al momento de la intervención
  proximoVencimientoFecha?: string; // docx: Próximo vencimiento (fecha) — informativo, ver design.md Decisión 5
  proximoVencimientoKm?: number; // docx: Próximo vencimiento (kilometraje) — informativo, ver design.md Decisión 5
  descripcion?: string;
}

/**
 * Registro de una intervención de mantenimiento del vehículo (docx §Mantenimiento, RF-507,
 * US-500). Unión discriminada de 4 miembros (design.md Decisión 4) para que `tsc`, no solo una
 * validación en runtime, garantice dos invariantes: (1) un sub-tipo `'otro'` exige `detalle`; (2)
 * un registro `tipoIntervencion: 'gasto'` no admite ningún `subtipo` — el nivel 2 solo existe
 * dentro de las dos categorías de mantenimiento, tal como lo modela el docx.
 */
export type MantenimientoRegistro =
  | (MantenimientoRegistroBase & { tipoIntervencion: 'preventivo'; subtipo: SubtipoPreventivo })
  | (MantenimientoRegistroBase & { tipoIntervencion: 'correctivo'; subtipo: SubtipoCorrectivoConocido })
  | (MantenimientoRegistroBase & { tipoIntervencion: 'correctivo'; subtipo: 'otro'; detalle: string })
  | (MantenimientoRegistroBase & { tipoIntervencion: 'gasto' });

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
  /**
   * Historial de intervenciones de mantenimiento (docx §Mantenimiento, RF-507). Embebido, sin
   * repository propio (design.md Decisión 6): se lee y muta junto con el vehículo vía
   * `VehiculoRepository.update()`, mismo patrón que `gastos`.
   */
  mantenimientos: MantenimientoRegistro[];
}

/** Payload de alta: todo lo de Vehiculo salvo el id, que asigna el repository. */
export type NuevoVehiculo = Omit<Vehiculo, 'id'>;

/** Payload de edición: actualización parcial, sin permitir cambiar el id. */
export type ActualizacionVehiculo = Partial<Omit<Vehiculo, 'id'>>;
