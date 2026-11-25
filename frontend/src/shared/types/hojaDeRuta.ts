// Tipos del dominio de Hojas de Ruta y Recorridos (US-700, RF-700 a RF-708,
// knowledge-base/04_modelo_de_datos.md §HojaDeRuta/Recorrido). Fase FE-5, lado UI del change
// C-10 (hojas-de-ruta-recorridos) — contrato "tipos primero" (design.md Decisión 1/2/3).
// Reutiliza Tramo/Direccion de paciente.ts, AccesorioMovilidad/EstadoVehiculo de vehiculo.ts y
// EstadoConductor de conductor.ts: no se redefinen acá (design.md Decisión 3).

import type { Direccion, Tramo } from './paciente';

// Reexport intencional: quien consuma hojaDeRuta.ts no debería tener que importar paciente.ts
// aparte solo para tipar un ParadaRecorrido.
export type { Tramo, Direccion };

/**
 * Coordenada geográfica. En fixtures/mocks (`hojas-de-ruta-ui`, design.md Decisión 6) siguen
 * siendo valores fijados a mano, sin geocoding real. Para datos reales (`SupabaseHojaDeRutaRepository`,
 * desde el change `hojas-de-ruta-geocoding`, RF-701, que resuelve el Checkpoint 2 de
 * `integracion-hojas-de-ruta/design.md`) sí proviene de geocoding real: se geocodifica una vez al
 * crear/editar la `Direccion` del paciente (nunca en cada carga de la hoja de ruta) y se persiste
 * en `pacientes.direcciones.lat/lng`; una dirección que todavía no se geocodificó (o cuyo
 * geocoding falló) deja su parada sin `coordenadaOrigen`, igual que antes.
 */
export interface Coordenada {
  lat: number;
  lng: number;
}

/**
 * Parada de un recorrido (design.md Decisión 4, RN-HR-02): cada tramo (`ida`/`vuelta`) referencia
 * su propia dirección de origen y destino del catálogo `Paciente.direcciones` de forma
 * independiente — la UI nunca deriva la vuelta invirtiendo la ida.
 */
export interface ParadaRecorrido {
  id: string;
  pacienteId: string;
  tramo: Tramo;
  /** Id de una `Direccion` del catálogo `Paciente.direcciones`. */
  direccionOrigenId: string;
  /** Id de una `Direccion` del catálogo `Paciente.direcciones`, independiente del origen (RN-HR-02). */
  direccionDestinoId: string;
  /** Orden de recogida dentro del recorrido — dato editable, nunca ruta impuesta (RN-HR-01). */
  orden: number;
  /** Fixture en mocks (design.md Decisión 6); geocoding real sobre datos reales desde el change
   *  hojas-de-ruta-geocoding (RF-701) — ver doc de `Coordenada` arriba. Usada para el mapa y
   *  `sugerirOrdenPorCercania`. */
  coordenadaOrigen?: Coordenada;
  /**
   * Hora estimada del tramo (formato "HH:mm"), ej. "08:30". Opcional — un recorrido manual
   * (RN-HR-03) puede no tener horario fijo. `orden` sigue siendo, en última instancia, un dato
   * editable a mano por el operador (RN-HR-01) — pero desde el feedback de usuario que confirmó
   * este criterio contra la hoja de ruta real en papel, "Sugerir orden" SÍ usa `horaEstimada`
   * para agrupar por bloque horario antes de aplicar cercanía dentro de cada bloque (ver
   * `sugerirOrdenPorCercania.ts`) — nunca sugiere una parada tardía antes que una temprana fuera
   * de la ventana de agrupamiento.
   */
  horaEstimada?: string;
}

/**
 * Tipo de transporte de un recorrido (RN-HR-05, change viajes-tercerizados-hoja-de-ruta):
 * `propio` = flota propia (vehículo + conductor); `aplicacion` = Uber u otra app; `remis` = agencia
 * de remis (nombre en texto libre, sin catálogo — decisión de la usuaria 2026-10-14).
 *
 * ⚠️ Discrepancia con el docx: `Traslados-Modelo-Datos.docx` no modela tipo de transporte ni
 * agencia. Campos agregados — ver `knowledge-base/04_modelo_de_datos.md §Discrepancias` y el
 * `AvisoModeloDatos` de `HojaDeRutaPage`.
 */
export type TipoTransporte = 'propio' | 'aplicacion' | 'remis';

/**
 * Unión discriminada (design.md D3): solo un recorrido `propio` tiene `vehiculoId`/`conductorId`,
 * así el compilador obliga a distinguir el tipo antes de leerlos (nunca "Vehículo desconocido" por
 * un tercerizado).
 *
 * ⚠️ Discrepancia con el docx (design.md Discrepancia 2 de C-10): `docs/core/Traslados-Modelo-Datos.docx
 * §Historial de Recorridos` NO tiene campo Conductor (liga el viaje solo a Paciente + Vehículo).
 * `conductorId` es un campo AGREGADO sobre el docx porque RN-VE-01/02, US-700 y
 * `07_flujos_principales.md §Flujo 2` exigen agrupar, editar y auditar recorridos por vehículo Y
 * conductor.
 */
export type TransporteRecorrido =
  | { tipoTransporte: 'propio'; vehiculoId: string; conductorId: string }
  | { tipoTransporte: 'aplicacion' }
  | { tipoTransporte: 'remis'; agenciaRemis: string };

/** Campos de un recorrido que no dependen del tipo de transporte. */
export interface RecorridoBase {
  id: string;
  /** Recorrido manual sin frecuencia fija ni turno preestablecido (RN-HR-03). */
  manual: boolean;
  notas?: string;
  paradas: ParadaRecorrido[];
}

/** Recorrido dentro de la hoja de ruta del día (design.md Decisión 1 de C-10 + D3 de
 *  viajes-tercerizados-hoja-de-ruta). */
export type Recorrido = RecorridoBase & TransporteRecorrido;

/** Recorrido de flota propia: el único con vehículo y conductor. */
export type RecorridoPropio = RecorridoBase & Extract<TransporteRecorrido, { tipoTransporte: 'propio' }>;

/**
 * Hoja de ruta del día (design.md Decisión 1): agregado de la jornada operativa con los
 * `Recorrido` embebidos (no en un repository aparte). Concepto que no existe como tal en el docx
 * (design.md Discrepancia 1) — ver `AvisoModeloDatos` en la pantalla.
 */
export interface HojaDeRuta {
  id: string;
  /** ISO date. */
  fecha: string;
  /** Franja horaria del día, ej. '08:00'. Default ~8:00-20:00, configurable (no hardcodeado en la lógica). */
  franjaInicio: string;
  franjaFin: string;
  /** Notas al pie a nivel de la hoja de ruta completa (RF-703). */
  notas?: string;
  recorridos: Recorrido[];
}

/** Payload de alta de una parada: sin `id`, lo asigna el repository al persistir el agregado. */
export type NuevaParadaRecorrido = Omit<ParadaRecorrido, 'id'>;

/** Payload de alta de un recorrido: sin `id`, sus paradas tampoco llevan `id` todavía. Se arma
 *  con intersección (no `Omit<Recorrido, ...>`) porque `Omit` sobre una unión no es distributivo y
 *  perdería el discriminante (design.md D3). */
export type NuevoRecorrido = Omit<RecorridoBase, 'id' | 'paradas'> &
  TransporteRecorrido & { paradas: NuevaParadaRecorrido[] };

/** Payload de alta de la hoja de ruta: sin `id`, recorridos como `NuevoRecorrido[]`. */
export type NuevaHojaDeRuta = Omit<HojaDeRuta, 'id' | 'recorridos'> & { recorridos: NuevoRecorrido[] };

/** Payload de edición: actualización parcial del agregado completo, sin permitir cambiar el id. */
export type ActualizacionHojaDeRuta = Partial<Omit<HojaDeRuta, 'id'>>;
