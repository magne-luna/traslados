import { useEffect, useState } from 'react';
import type { RecorridoHabitualRepository } from '../../shared/lib/pacientes/RecorridoHabitualRepository';
import type { RecorridoHabitual } from '../../shared/types/recorridoHabitual';

// Carga los destinos habituales (RF-110, `pacientes.recorridos`) del paciente elegido en el
// formulario de armado de la hoja de ruta. Mismo criterio de estados que el bloque equivalente de
// PresupuestoForm ("Traer de los destinos habituales"), acá extraído a un hook porque lo usan DOS
// formularios (NuevoRecorridoForm y AsignacionPanel) en vez de uno solo.
//
// Un error de red NO rompe el formulario: se devuelve en `error` para que el selector lo muestre
// deshabilitado con el motivo, y el operador sigue cargando origen/destino/hora a mano. Se
// PROPAGA en vez de tragarse (como hacía la primera versión) porque "falló la consulta" y "este
// paciente no tiene ninguno" se arreglan de maneras distintas y el operador tiene que poder
// distinguirlos. El `repository` es opcional a propósito (`undefined` = la pantalla no lo
// inyecta): sin él el hook no pide nada y el formulario ni monta el campo.
export function useRecorridosHabituales(
  repository: Pick<RecorridoHabitualRepository, 'list'> | undefined,
  pacienteId: string,
): { recorridos: RecorridoHabitual[]; loading: boolean; error: string | null } {
  const [recorridos, setRecorridos] = useState<RecorridoHabitual[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (repository === undefined || pacienteId === '') {
      setRecorridos([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelado = false;
    setLoading(true);
    setError(null);
    repository
      .list(pacienteId)
      .then((lista) => {
        if (cancelado) return;
        setRecorridos(lista);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelado) return;
        setRecorridos([]);
        setError(e instanceof Error ? e.message : 'No se pudieron cargar los destinos habituales.');
        setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [repository, pacienteId]);

  return { recorridos, loading, error };
}
