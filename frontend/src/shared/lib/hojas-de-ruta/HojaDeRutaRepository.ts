import type {
  ActualizacionHojaDeRuta,
  HojaDeRuta,
  NuevaHojaDeRuta,
} from '../../types/hojaDeRuta';

// Contrato de datos (design.md Decisión 1/9). Las pantallas de la feature consumen esta
// interfaz, nunca la fuente de datos directamente. Los `Recorrido` viven embebidos en la
// `HojaDeRuta` (agregado del día) — no hay un repository de recorridos aparte (tasks.md 3.1).
// Cuando el backend real (`C-10`) se archive, se escribe un SupabaseHojaDeRutaRepository que
// cumpla este mismo contrato y se inyecta en el punto de composición — los componentes no
// cambian (FE-8).
export interface HojaDeRutaRepository {
  list(): Promise<HojaDeRuta[]>;
  /** Resuelve `null` si no existe una hoja de ruta con ese id (no lanza excepción). */
  getById(id: string): Promise<HojaDeRuta | null>;
  /** Resuelve `null` si no hay una hoja de ruta cargada para esa fecha (no lanza excepción). */
  getByFecha(fecha: string): Promise<HojaDeRuta | null>;
  create(data: NuevaHojaDeRuta): Promise<HojaDeRuta>;
  update(id: string, data: ActualizacionHojaDeRuta): Promise<HojaDeRuta>;
}
