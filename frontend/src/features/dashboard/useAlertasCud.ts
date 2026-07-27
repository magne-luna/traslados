import { useEffect, useState } from 'react';
import type { Paciente } from '../../shared/types/paciente';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';

export interface UseAlertasCudResult {
  pacientes: Paciente[];
  cargando: boolean;
  error: string | null;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado.';
}

// tasks.md 5.4, design.md Decisión 7/9: lectura de solo lectura de PacienteRepository.list()
// para la tarjeta de CUD, con su propio estado de carga/error independiente del resto de los
// bloques del dashboard. A propósito NO expone `crear` ni `actualizar` — a diferencia de
// usePacientes (que sí los expone para la feature de Pacientes) — para que sea estructuralmente
// imposible que el dashboard escriba (design.md Non-Goals, spec dashboard-composicion "Solo
// lectura en toda la pantalla").
export function useAlertasCud(repository: PacienteRepository): UseAlertasCudResult {
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const data = await repository.list();
        if (cancelado) return;
        setPacientes(data);
      } catch (err) {
        if (cancelado) return;
        setError(toErrorMessage(err));
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    void cargar();

    return () => {
      cancelado = true;
    };
  }, [repository]);

  return { pacientes, cargando, error };
}
