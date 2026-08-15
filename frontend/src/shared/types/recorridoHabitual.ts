// Tipos de "Destinos habituales" (RF-110, `pacientes.recorridos`): días y horarios habituales
// (escuela, terapias, CET) de un paciente, entre dos direcciones de su propio catálogo
// (`Paciente.direcciones`). Concepto DISTINTO de `Recorrido`/`ParadaRecorrido` (hojaDeRuta.ts,
// tabla `hojas_de_ruta`/`recorrido` del backend real de C-10) — ese es el recorrido operativo del
// DÍA de un vehículo/conductor; este es el destino RECURRENTE (día de semana + hora) de un
// paciente, sin vehículo ni conductor asociado. No compartir tipos entre los dos dominios: son
// tablas y ciclos de vida distintos, aunque ambos hablen de "recorrido" en el lenguaje del
// dominio (ver DireccionesEditor.tsx:99-111, mismo comentario del lado de Direccion).
//
// `Direccion.dias`/`Direccion.horario` (shared/types/paciente.ts) son un concepto huérfano y
// obsoleto: nunca se persistieron en ningún lado. Este es el destino real de "días y horarios
// habituales" que el docx describe como entidad "Recorridos" aparte de "Direcciones".

/** Día de la semana de un `RecorridoHabitual`. Unión cerrada (mismo criterio que `TipoDireccion`)
 * aunque la columna real `pacientes.recorridos.dia_semana` sea `text` sin CHECK constraint en la
 * base — la cerradura la impone este tipo, no la base. */
export type DiaSemana = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';

/** Destino habitual de un paciente (RF-110): dirección inicial → dirección final, un día de la
 * semana y una hora fijos. `direccionInicialId`/`direccionFinalId` referencian el catálogo
 * `Paciente.direcciones` — ninguna de las dos es "origen"/"destino" en el sentido de
 * `ParadaRecorrido.direccionOrigenId/direccionDestinoId` (hojaDeRuta.ts): son entidades distintas,
 * nombradas distinto a propósito para no sugerir que comparten forma. */
export interface RecorridoHabitual {
  id: string;
  pacienteId: string;
  direccionInicialId: string;
  direccionFinalId: string;
  diaSemana: DiaSemana;
  /** Formato 'HH:MM' (mismo criterio que `horaEstimada` en hojaDeRuta.ts). */
  hora: string;
}

/** Payload de alta: sin `id`, lo asigna el repository (Postgres, `default gen_random_uuid()` o
 * equivalente) al persistir. */
export type NuevoRecorridoHabitual = Omit<RecorridoHabitual, 'id'>;
