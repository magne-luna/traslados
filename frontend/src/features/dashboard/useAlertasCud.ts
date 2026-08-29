import { useQuery } from '@tanstack/react-query';
import type { Paciente } from '../../shared/types/paciente';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
import { aMensaje } from '../../shared/lib/query/aMensaje';
import { claves } from '../../shared/lib/query/claves';
import { FRESCURA } from '../../shared/lib/query/frescura';

export interface UseAlertasCudResult {
  pacientes: Paciente[];
  cargando: boolean;
  error: string | null;
}

// tasks.md 5.4, design.md Decisión 7/9: lectura para la tarjeta de CUD.
//
// migracion-react-query, Fase 5. **`UseAlertasCudResult` NO cambió** (sigue exponiendo `cargando`, no
// `loading`). Lo que cambia es de dónde sale el dato: usa **la misma clave** que
// `usePacientes` (`claves.pacientes.lista()`), así que si la usuaria ya pasó por ese módulo el
// dashboard NO vuelve a pedir el padrón — y viceversa. `/` es la ruta índice y se la visita
// constantemente: ese round-trip repetido era uno de los tres desperdicios que motivaron el change.
//
// Sigue siendo de SOLO LECTURA: no expone `crear` ni `actualizar`, para que sea estructuralmente
// imposible que el dashboard escriba (design.md Non-Goals del change de dashboard).
export function useAlertasCud(repository: PacienteRepository): UseAlertasCudResult {
  const { data, isPending, error } = useQuery({
    queryKey: claves.pacientes.lista(),
    queryFn: () => repository.list(),
    staleTime: FRESCURA.referencia,
  });

  return { pacientes: data ?? [], cargando: isPending, error: aMensaje(error) };
}
