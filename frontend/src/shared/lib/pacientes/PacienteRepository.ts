import type { ActualizacionPaciente, NuevoPaciente, Paciente } from '../../types/paciente';
import type { Pagina, RangoPagina } from '../../types/paginacion';

// Contrato de datos (design.md Decisión 6). Las pantallas de la feature consumen esta interfaz,
// nunca Supabase directamente. Cuando C-05 (pacientes-fichas-clinicas) se archive en el backend,
// se escribe un SupabasePacienteRepository que cumpla este mismo contrato y se inyecta en el
// punto de composición — los componentes no cambian. Firmas idénticas en forma a
// ObraSocialRepository (FE-2).

// paginacion-listados, design.md §D3: término libre que matchea nombre(s), apellido(s) o DNI.
// Vacío ('') = sin filtro. Semántica de tokenización en `construirFiltroBusqueda` (§D5).
export interface FiltrosPaciente {
  busqueda: string;
}

export interface PacienteRepository {
  /** Padrón completo, SIN paginar — lo consumen los selectores (combos de Presupuestos/Facturas/
   * Hojas de Ruta) y los cálculos de alertas del dashboard (CUD, financieras), que necesitan el
   * universo entero. NUNCA cambia de firma ni de comportamiento por `listPage` (design.md §D3):
   * paginar acá silenciaría esos consumidores sin ningún error visible. */
  list(): Promise<Paciente[]>;
  /** Página server-side con búsqueda (design.md §D3, ADITIVO a `list()`, nunca lo reemplaza). */
  listPage(query: RangoPagina & { filtros: FiltrosPaciente }): Promise<Pagina<Paciente>>;
  /** Resuelve `null` si no existe un paciente con ese id (no lanza excepción). */
  getById(id: string): Promise<Paciente | null>;
  create(data: NuevoPaciente): Promise<Paciente>;
  update(id: string, data: ActualizacionPaciente): Promise<Paciente>;
}
