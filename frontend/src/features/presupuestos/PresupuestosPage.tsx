import { useState } from 'react';
import { AvisoSoloLectura } from '../../design-system/components';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
import type { RecorridoHabitualRepository } from '../../shared/lib/pacientes/RecorridoHabitualRepository';
import type { Presupuesto } from '../../shared/types/presupuesto';
import { useObrasSociales } from '../obras-sociales/useObrasSociales';
import { usePacientes } from '../pacientes/usePacientes';
import { useAutorizacionRepository } from './AutorizacionRepositoryContext';
import { PresupuestoDetail } from './PresupuestoDetail';
import { usePresupuestoRepository } from './PresupuestoRepositoryContext';
import { PresupuestosList } from './PresupuestosList';
import { useAutorizaciones } from './useAutorizaciones';
import { usePresupuestos } from './usePresupuestos';

type View = { kind: 'list' } | { kind: 'detail'; presupuestoId: string | null };

interface PresupuestosPageProps {
  /** Reutilizado de FE-3 (design.md Decisión 8): puebla el selector de paciente del form, solo lectura. */
  pacienteRepository: PacienteRepository;
  /** Reutilizado de FE-2 (design.md Decisión 8): puebla el selector de obra social del form, solo lectura. */
  obraSocialRepository: ObraSocialRepository;
  /** Botón "Traer de los destinos habituales del paciente" de PresupuestoForm
   * (presupuestos-vigencia-datos-traslado-vista-previa, tasks.md 8.5) — reutilizado de RF-110
   * (Pacientes), solo lectura acá. */
  recorridoHabitualRepository: Pick<RecorridoHabitualRepository, 'list'>;
}

// Composición raíz de la feature (tasks.md 4.2, 8.1): resuelve PresupuestoRepository y
// AutorizacionRepository del context, wire de usePresupuestos, reutiliza usePacientes/
// useObrasSociales (solo lectura, design.md Decisión 8) para resolver nombres en el listado y
// poblar los selectores del form, y decide qué pantalla mostrar (listado o detalle). Mismo
// patrón que PacientesPage/VehiculosPage.
export function PresupuestosPage({
  pacienteRepository,
  obraSocialRepository,
  recorridoHabitualRepository,
}: PresupuestosPageProps) {
  const presupuestoRepository = usePresupuestoRepository();
  const autorizacionRepository = useAutorizacionRepository();
  const { presupuestos, loading, error, crear, crearLote, actualizar } = usePresupuestos(presupuestoRepository);
  const { pacientes } = usePacientes(pacienteRepository);
  const { obrasSociales } = useObrasSociales(obraSocialRepository);
  /** Solo lectura (design.md Decisión 8): alimenta el chip de estado por tarjeta en el listado. */
  const { autorizaciones } = useAutorizaciones(autorizacionRepository);
  const [view, setView] = useState<View>({ kind: 'list' });

  function nombrePaciente(pacienteId: string): string {
    const paciente = pacientes.find((p) => p.id === pacienteId);
    return paciente ? `${paciente.apellido}, ${paciente.nombre}` : 'Paciente desconocido';
  }

  function nombreObraSocial(obraSocialId: string): string {
    return obrasSociales.find((o) => o.id === obraSocialId)?.nombre ?? 'Obra social desconocida';
  }

  // tasks.md 8.1, design.md D5: mismo criterio de resolución que `PresupuestoResumen.nombrePrestacion`
  // — buscada en el catálogo de TODOS los pacientes (los ids de `Prestacion` son globalmente
  // únicos, igual que el resto de las entidades del repo), no solo el paciente del presupuesto
  // actual, porque el listado no resuelve "el paciente de esta fila" antes de llamar a esto.
  function nombrePrestacion(prestacionId: string): string {
    for (const paciente of pacientes) {
      const prestacion = paciente.prestaciones?.find((p) => p.id === prestacionId);
      if (prestacion) return prestacion.nombre;
    }
    return 'Prestación desconocida';
  }

  function estadoAutorizacion(presupuestoId: string) {
    return autorizaciones.find((a) => a.presupuestoId === presupuestoId)?.estado ?? null;
  }

  if (view.kind === 'detail') {
    const presupuesto: Presupuesto | null =
      view.presupuestoId === null ? null : (presupuestos.find((p) => p.id === view.presupuestoId) ?? null);

    return (
      <>
        <AvisoSoloLectura />
        <PresupuestoDetail
          presupuesto={presupuesto}
          crear={crear}
          crearLote={crearLote}
          actualizar={actualizar}
          pacientes={pacientes}
          obrasSociales={obrasSociales}
          autorizacionRepository={autorizacionRepository}
          recorridoHabitualRepository={recorridoHabitualRepository}
          onCreated={(creado) => setView({ kind: 'detail', presupuestoId: creado.id })}
          onBack={() => setView({ kind: 'list' })}
        />
      </>
    );
  }

  return (
    <>
      <AvisoSoloLectura />
      <PresupuestosList
        presupuestos={presupuestos}
        loading={loading}
        error={error}
        nombrePaciente={nombrePaciente}
        nombreObraSocial={nombreObraSocial}
        nombrePrestacion={nombrePrestacion}
        estadoAutorizacion={estadoAutorizacion}
        onSelect={(presupuesto) => setView({ kind: 'detail', presupuestoId: presupuesto.id })}
        onCreateNew={() => setView({ kind: 'detail', presupuestoId: null })}
      />
    </>
  );
}
