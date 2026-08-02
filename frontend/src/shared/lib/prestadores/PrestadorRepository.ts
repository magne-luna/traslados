import type { ActualizacionPrestador, NuevoPrestador, Prestador } from '../../types/prestador';

// Contrato de datos (design.md de prestadores-crud, D1 — espejo 1:1 de ObraSocialRepository.ts).
// Las pantallas de `features/prestadores/` (work unit futuro, no este) consumen esta interfaz,
// nunca Supabase directamente. `SupabasePrestadorRepository.ts` es la única implementación real
// (D1: CRUD directo por PostgREST, sin RPC — `obra_social.prestadores` no tiene tablas hijas).
export interface PrestadorRepository {
  list(): Promise<Prestador[]>;
  /** Resuelve `null` si no existe un prestador con ese id (no lanza excepción). */
  getById(id: string): Promise<Prestador | null>;
  create(data: NuevoPrestador): Promise<Prestador>;
  update(id: string, data: ActualizacionPrestador): Promise<Prestador>;
  /**
   * Prestadores vinculados a una ObraSocial (D2 — panel de solo lectura de `ObraSocialDetail`,
   * work unit futuro). Resuelve `[]` si la obra social no tiene ningún prestador vinculado.
   */
  listarPorObraSocial(obraSocialId: string): Promise<Prestador[]>;
}
