import { useEffect, useState } from 'react';
import type { Conductor } from '../../shared/types/conductor';
import type { ConductorRepository } from '../../shared/lib/conductores/ConductorRepository';

export interface UseConductoresDashboardResult {
  conductores: Conductor[];
  cargando: boolean;
  error: string | null;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado.';
}

// Gap detectado durante el apply (ver informe): RecorridosDelDiaPanel necesita resolver el
// nombre del conductor por id (spec dashboard-recorridos-del-dia, Requirement "Detalle por
// recorrido con vehículo y conductor"), lo que requiere leer ConductorRepository.list() —
// design.md Decisión 9 lista "cinco repositorios" pero la propia spec de recorridos exige
// resolver conductor por id, que solo es posible con este repositorio. Se agrega como sexto
// repositorio de solo lectura, mismo patrón exacto que HojaDeRutaRoute (que ya inyecta
// ConductorRepository de solo lectura junto a Paciente/Vehiculo). A propósito NO expone
// `crear`/`actualizar` (ver useAlertasCud/useAlertasMantenimiento).
export function useConductoresDashboard(repository: ConductorRepository): UseConductoresDashboardResult {
  const [conductores, setConductores] = useState<Conductor[]>([]);
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
        setConductores(data);
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

  return { conductores, cargando, error };
}
