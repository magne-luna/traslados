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
 * Coordenada geográfica fixture (design.md Decisión 6): en este prototipo NO proviene de
 * geocoding real — son valores fixture razonables para poder dibujar el mapa y calcular
 * `sugerirOrdenPorCercania` por haversine. El geocoding real de las direcciones del paciente lo
 * resuelve el backend (`C-10`) en producción (FE-8).
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
  /** Fixture, no geocoding real (design.md Decisión 6) — usada para el mapa y sugerirOrdenPorCercania. */
  coordenadaOrigen?: Coordenada;
  /**
   * Hora estimada del tramo (formato "HH:mm"), ej. "08:30". Opcional — un recorrido manual
   * (RN-HR-03) puede no tener horario fijo. Puramente informativa: nunca determina `orden`, que
   * el operador controla a mano o vía "Sugerir orden" (RN-HR-01).
   */
  horaEstimada?: string;
}

/**
 * Recorrido de un vehículo/conductor dentro de la hoja de ruta del día (design.md Decisión 1).
 *
 * ⚠️ Discrepancia con el docx (design.md Discrepancia 2, punto de discrepancia central de este
 * change): `docs/core/Traslados-Modelo-Datos.docx §Historial de Recorridos` NO tiene campo
 * Conductor (liga el viaje solo a Paciente + Vehículo). `conductorId` es un campo AGREGADO sobre
 * el docx porque RN-VE-01/02, US-700 y `07_flujos_principales.md §Flujo 2` exigen agrupar,
 * editar y auditar recorridos por vehículo Y conductor. Pendiente de confirmar con el dueño del
 * docx antes de cerrar el esquema de la tabla `recorrido` en el backend `C-10` (ver también
 * `knowledge-base/04_modelo_de_datos.md §Discrepancias` y el cartel `AvisoModeloDatos` en
 * `HojaDeRutaPage`).
 */
export interface Recorrido {
  id: string;
  vehiculoId: string;
  /** Campo agregado sobre el docx — ver comentario de la interfaz y design.md Decisión 2. */
  conductorId: string;
  /** Recorrido manual sin frecuencia fija ni turno preestablecido (RN-HR-03). */
  manual: boolean;
  notas?: string;
  paradas: ParadaRecorrido[];
}

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

/** Payload de alta de un recorrido: sin `id`, sus paradas tampoco llevan `id` todavía. */
export type NuevoRecorrido = Omit<Recorrido, 'id' | 'paradas'> & { paradas: NuevaParadaRecorrido[] };

/** Payload de alta de la hoja de ruta: sin `id`, recorridos como `NuevoRecorrido[]`. */
export type NuevaHojaDeRuta = Omit<HojaDeRuta, 'id' | 'recorridos'> & { recorridos: NuevoRecorrido[] };

/** Payload de edición: actualización parcial del agregado completo, sin permitir cambiar el id. */
export type ActualizacionHojaDeRuta = Partial<Omit<HojaDeRuta, 'id'>>;
