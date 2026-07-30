import { useState } from 'react';
import { AvisoSoloLectura } from '../../design-system/components';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
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
}

// Composición raíz de la feature (tasks.md 4.2, 8.1): resuelve PresupuestoRepository y
// AutorizacionRepository del context, wire de usePresupuestos, reutiliza usePacientes/
// useObrasSociales (solo lectura, design.md Decisión 8) para resolver nombres en el listado y
// poblar los selectores del form, y decide qué pantalla mostrar (listado o detalle). Mismo
// patrón que PacientesPage/VehiculosPage.
export function PresupuestosPage({ pacienteRepository, obraSocialRepository }: PresupuestosPageProps) {
  const presupuestoRepository = usePresupuestoRepository();
  const autorizacionRepository = useAutorizacionRepository();
  const { presupuestos, loading, error, crear, actualizar } = usePresupuestos(presupuestoRepository);
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
          actualizar={actualizar}
          pacientes={pacientes}
          obrasSociales={obrasSociales}
          autorizacionRepository={autorizacionRepository}
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
        estadoAutorizacion={estadoAutorizacion}
        onSelect={(presupuesto) => setView({ kind: 'detail', presupuestoId: presupuesto.id })}
        onCreateNew={() => setView({ kind: 'detail', presupuestoId: null })}
      />
    </>
  );
}
