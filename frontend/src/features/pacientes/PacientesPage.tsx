import { useState } from 'react';
import { AvisoSoloLectura } from '../../design-system/components';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import type { RequisitosActividadRepository } from '../../shared/lib/requisitosActividad/RequisitosActividadRepository';
import type { Paciente } from '../../shared/types/paciente';
import { useObrasSociales } from '../obras-sociales/useObrasSociales';
import { PacienteDetail } from './PacienteDetail';
import { usePacienteRepository } from './PacienteRepositoryContext';
import { PacientesList } from './PacientesList';
import { usePacientes } from './usePacientes';

type View = { kind: 'list' } | { kind: 'detail'; pacienteId: string | null };

interface PacientesPageProps {
  /** Reutilizado de FE-2 (design.md): resuelve el nombre de la obra social del listado y puebla
   * el select de PacienteForm, sin que ninguna pantalla de esta feature importe el mock directamente. */
  obraSocialRepository: ObraSocialRepository;
  documentoRepository: DocumentoRepository;
  /** documentos-checklist-items-por-actividad (tasks.md §6): reenviado tal cual a `PacienteDetail`
   * → `PacienteDocumentos` — opcional, mismo criterio que las otras dos dependencias de arriba. */
  requisitosActividadRepository?: RequisitosActividadRepository;
}

// Composición raíz de la feature (tasks.md 4.2, 10.1): resuelve el PacienteRepository del
// context, wire de usePacientes, y decide qué pantalla mostrar (listado o detalle). No hay
// router anidado — mismo patrón que ObraSocialesPage/VehiculosPage (FE-2).
export function PacientesPage({ obraSocialRepository, documentoRepository, requisitosActividadRepository }: PacientesPageProps) {
  const pacienteRepository = usePacienteRepository();
  const { pacientes, loading, error, crear, actualizar } = usePacientes(pacienteRepository);
  const { obrasSociales } = useObrasSociales(obraSocialRepository);
  const [view, setView] = useState<View>({ kind: 'list' });

  function nombreObraSocial(obraSocialId: string | null): string {
    if (obraSocialId === null) return 'Sin obra social';
    return obrasSociales.find((obraSocial) => obraSocial.id === obraSocialId)?.nombre ?? 'Sin obra social';
  }

  if (view.kind === 'detail') {
    const paciente: Paciente | null =
      view.pacienteId === null ? null : (pacientes.find((p) => p.id === view.pacienteId) ?? null);

    return (
      <>
        <AvisoSoloLectura />
        <PacienteDetail
          paciente={paciente}
          crear={crear}
          actualizar={actualizar}
          obrasSociales={obrasSociales}
          obraSocialRepository={obraSocialRepository}
          documentoRepository={documentoRepository}
          requisitosActividadRepository={requisitosActividadRepository}
          onCreated={(creado) => setView({ kind: 'detail', pacienteId: creado.id })}
          onBack={() => setView({ kind: 'list' })}
        />
      </>
    );
  }

  return (
    <>
      <AvisoSoloLectura />
      <PacientesList
        pacientes={pacientes}
        loading={loading}
        error={error}
        nombreObraSocial={nombreObraSocial}
        onSelect={(paciente) => setView({ kind: 'detail', pacienteId: paciente.id })}
        onCreateNew={() => setView({ kind: 'detail', pacienteId: null })}
      />
    </>
  );
}
