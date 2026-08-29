import type { ActualizacionPaciente, NuevoPaciente, PacienteResumen } from '../../shared/types/paciente';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
import { claves } from '../../shared/lib/query/claves';
import { FRESCURA } from '../../shared/lib/query/frescura';
import { useListaDeDominio } from '../../shared/lib/query/useListaDeDominio';

export interface UsePacientesResult {
  /** select-liviano-selectores: el padrón que puebla combos y selectores viene como
   * `PacienteResumen`, no como `Paciente`. La ficha completa se lee con `getById`. */
  pacientes: PacienteResumen[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  crear: (data: NuevoPaciente) => Promise<PacienteResumen>;
  actualizar: (id: string, data: ActualizacionPaciente) => Promise<PacienteResumen>;
}

// Wiring de estado entre las pantallas de Pacientes y un PacienteRepository.
//
// migracion-react-query, Fase 3: el cuerpo delega en `useListaDeDominio` (el patrón compartido de
// los cuatro dominios de referencia). **`UsePacientesResult` NO cambió** — solo se renombra `datos` a
// `pacientes`, que es el nombre que las pantallas ya usan.
export function usePacientes(repository: PacienteRepository): UsePacientesResult {
  const { datos, ...resto } = useListaDeDominio<PacienteResumen, NuevoPaciente, ActualizacionPaciente>({
    claveDominio: claves.pacientes.todos(),
    claveLista: claves.pacientes.lista(),
    cargar: () => repository.list(),
    crear: (data) => repository.create(data),
    actualizar: (id, data) => repository.update(id, data),
    frescuraMs: FRESCURA.referencia,
  });

  return { pacientes: datos, ...resto };
}
