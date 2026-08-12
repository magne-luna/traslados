import type { ActualizacionConductor, Conductor, NuevoConductor } from '../../types/conductor';
import type { Pagina, RangoPagina } from '../../types/paginacion';

// Contrato de datos (ver design.md de conductores-ui, Decisión 9). Las pantallas de la feature
// consumen esta interfaz, nunca Supabase directamente. Cuando C-09 (conductores) se archive en
// el backend, se escribe un SupabaseConductorRepository que cumpla este mismo contrato y se
// inyecta en el punto de composición — los componentes no cambian.

// paginacion-listados, design.md §D3/§D5 (búsqueda simple, sin checkpoint): término libre que
// matchea apellido, nombre, documento o CUIL. Vacío ('') = sin filtro.
export interface FiltrosConductor {
  busqueda: string;
}

export interface ConductorRepository {
  /** Padrón completo, SIN paginar — lo consumen `useConductoresDashboard` (RecorridosDelDiaPanel)
   * y el selector de conductores de Hojas de Ruta, que necesitan resolver cualquier conductor por
   * id o calcular sobre el universo entero. NUNCA cambia de firma ni de comportamiento por
   * `listPage` (design.md §D3): paginar acá rompería esos consumidores en silencio. */
  list(): Promise<Conductor[]>;
  /** Página server-side con búsqueda (design.md §D3, ADITIVO a `list()`, nunca lo reemplaza). */
  listPage(query: RangoPagina & { filtros: FiltrosConductor }): Promise<Pagina<Conductor>>;
  /** Resuelve `null` si no existe un conductor con ese id (no lanza excepción). */
  getById(id: string): Promise<Conductor | null>;
  create(data: NuevoConductor): Promise<Conductor>;
  update(id: string, data: ActualizacionConductor): Promise<Conductor>;
}
