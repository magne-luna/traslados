import type { ActualizacionPaciente, NuevoPaciente, Paciente } from '../../types/paciente';

// Contrato de datos (design.md Decisión 6). Las pantallas de la feature consumen esta interfaz,
// nunca Supabase directamente. Cuando C-05 (pacientes-fichas-clinicas) se archive en el backend,
// se escribe un SupabasePacienteRepository que cumpla este mismo contrato y se inyecta en el
// punto de composición — los componentes no cambian. Firmas idénticas en forma a
// ObraSocialRepository (FE-2).
export interface PacienteRepository {
  list(): Promise<Paciente[]>;
  /** Resuelve `null` si no existe un paciente con ese id (no lanza excepción). */
  getById(id: string): Promise<Paciente | null>;
  create(data: NuevoPaciente): Promise<Paciente>;
  update(id: string, data: ActualizacionPaciente): Promise<Paciente>;
}
