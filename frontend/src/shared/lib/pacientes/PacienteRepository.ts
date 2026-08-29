import type { ActualizacionPaciente, NuevoPaciente, Paciente, PacienteResumen } from '../../types/paciente';
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
  /** Padrón completo, SIN paginar. Devuelve `PacienteResumen`, no `Paciente`
   * (select-liviano-selectores, 2026-08-29): trae exactamente los campos que sus consumidores usan
   * —combos de Facturación/Presupuestos, selectores de Hojas de Ruta y las alertas de CUD del
   * dashboard— y nada más. Pedir un campo de la ficha desde acá es un error de compilación, no un
   * dato vacío en pantalla. Para la ficha completa está `getById()`. */
  list(): Promise<PacienteResumen[]>;
  /** Padrón completo con TODOS los campos de la ficha. Lo usa únicamente Facturación, que necesita
   * `obraSocialId` y pasa el paciente entero al flujo de emisión (`useEmisionFactura`).
   *
   * ⚠️ Es la consulta cara que `list()` dejó de hacer: `SELECT_PACIENTE_COMPLETO` con siete
   * relaciones anidadas MÁS un segundo viaje a `coberturas_paciente`. Existe como paso intermedio
   * honesto, no como destino: **lo correcto es que Facturación pida por `getById` el ÚNICO paciente
   * de la factura que está viendo**, en vez de traerse el padrón entero. Mientras eso no se haga,
   * esta pantalla paga lo mismo que antes; las otras tres ya no. */
  listCompleto(): Promise<Paciente[]>;
  /** Página server-side con búsqueda (design.md §D3, ADITIVO a `list()`, nunca lo reemplaza). */
  listPage(query: RangoPagina & { filtros: FiltrosPaciente }): Promise<Pagina<Paciente>>;
  /** Resuelve `null` si no existe un paciente con ese id (no lanza excepción). */
  getById(id: string): Promise<Paciente | null>;
  create(data: NuevoPaciente): Promise<Paciente>;
  update(id: string, data: ActualizacionPaciente): Promise<Paciente>;
}
