import { useCallback, useEffect, useState } from 'react';
import type { ActualizacionPaciente, NuevoPaciente, Paciente } from '../../shared/types/paciente';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';

export interface UsePacientesResult {
  pacientes: Paciente[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  crear: (data: NuevoPaciente) => Promise<Paciente>;
  actualizar: (id: string, data: ActualizacionPaciente) => Promise<Paciente>;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado.';
}

// Wiring de estado entre las pantallas de Pacientes y un PacienteRepository (mock hoy, Supabase
// el día de mañana — ver PacienteRepository.ts). Mismo patrón que useObrasSociales (FE-2): la
// carga inicial la dispara un efecto sobre un load imperativo (`cargar`), reutilizado tras cada
// mutación. Devuelve un objeto (no array) porque expone más de dos valores (react-best-practices).
export function usePacientes(repository: PacienteRepository): UsePacientesResult {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await repository.list();
      setPacientes(data);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const crear = useCallback(
    async (data: NuevoPaciente) => {
      try {
        const creado = await repository.create(data);
        await cargar();
        return creado;
      } catch (err) {
        setError(toErrorMessage(err));
        throw err;
      }
    },
    [repository, cargar],
  );

  const actualizar = useCallback(
    async (id: string, data: ActualizacionPaciente) => {
      try {
        const actualizado = await repository.update(id, data);
        await cargar();
        return actualizado;
      } catch (err) {
        setError(toErrorMessage(err));
        throw err;
      }
    },
    [repository, cargar],
  );

  return { pacientes, loading, error, recargar: cargar, crear, actualizar };
}
