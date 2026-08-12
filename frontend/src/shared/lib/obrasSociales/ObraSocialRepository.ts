import type { ActualizacionObraSocial, NuevaObraSocial, ObraSocial } from '../../types/obraSocial';
import type { Pagina, RangoPagina } from '../../types/paginacion';

// Contrato de datos (ver design.md de obras-sociales-ui, Decisión 6). Las pantallas de la
// feature consumen esta interfaz, nunca Supabase directamente. Cuando C-04 (obras-sociales-
// prestadores) se archive en el backend, se escribe un SupabaseObraSocialRepository que cumpla
// este mismo contrato y se inyecta en el punto de composición — los componentes no cambian.

// paginacion-listados, design.md §D3/§D5 (búsqueda simple, sin checkpoint): término libre que
// matchea nombre o CUIT. Vacío ('') = sin filtro.
export interface FiltrosObraSocial {
  busqueda: string;
}

export interface ObraSocialRepository {
  /** Padrón completo, SIN paginar — lo consumen los selectores de obra social de Pacientes,
   * Presupuestos y Facturación, y `PacientesList` (resuelve el nombre de la obra social de cada
   * paciente vía `nombreObraSocial`). NUNCA cambia de firma ni de comportamiento por `listPage`
   * (design.md §D3): paginar acá dejaría "Sin obra social" a pacientes cuya obra social cayó
   * fuera de la página — dato incorrecto sin ningún error visible. */
  list(): Promise<ObraSocial[]>;
  /** Página server-side con búsqueda (design.md §D3, ADITIVO a `list()`, nunca lo reemplaza). */
  listPage(query: RangoPagina & { filtros: FiltrosObraSocial }): Promise<Pagina<ObraSocial>>;
  /** Resuelve `null` si no existe una obra social con ese id (no lanza excepción). */
  getById(id: string): Promise<ObraSocial | null>;
  create(data: NuevaObraSocial): Promise<ObraSocial>;
  update(id: string, data: ActualizacionObraSocial): Promise<ObraSocial>;
}
