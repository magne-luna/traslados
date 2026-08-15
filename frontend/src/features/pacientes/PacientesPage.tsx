import { useCallback, useState } from 'react';
import { AvisoSoloLectura } from '../../design-system/components';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import type { RecorridoHabitualRepository } from '../../shared/lib/pacientes/RecorridoHabitualRepository';
import type { RequisitosActividadRepository } from '../../shared/lib/requisitosActividad/RequisitosActividadRepository';
import type { ActualizacionPaciente, Paciente } from '../../shared/types/paciente';
import { useObrasSociales } from '../obras-sociales/useObrasSociales';
import { PacienteDetail } from './PacienteDetail';
import { usePacienteRepository } from './PacienteRepositoryContext';
import { PacientesList } from './PacientesList';
import { usePacientesPaginado } from './usePacientesPaginado';

// paginacion-listados, Fase 2 (tasks.md 13.2): la vista de detalle guarda el objeto `Paciente`
// COMPLETO (no solo su id) — llega directo del evento que dispara la navegación (`onSelect` de la
// lista, `onCreated` del alta). Nunca se re-deriva buscando el id en el listado paginado: esa
// lista ahora es solo la página vigente, no el padrón completo, y el paciente elegido/creado puede
// no estar en ella (design.md §D3, gotcha de la Fase 2).
type View = { kind: 'list' } | { kind: 'detail'; paciente: Paciente | null };

interface PacientesPageProps {
  /** Reutilizado de FE-2 (design.md): resuelve el nombre de la obra social del listado y puebla
   * el select de PacienteForm, sin que ninguna pantalla de esta feature importe el mock directamente. */
  obraSocialRepository: ObraSocialRepository;
  documentoRepository: DocumentoRepository;
  /** documentos-checklist-items-por-actividad (tasks.md §6): reenviado tal cual a `PacienteDetail`
   * → `PacienteDocumentos` — opcional, mismo criterio que las otras dos dependencias de arriba. */
  requisitosActividadRepository?: RequisitosActividadRepository;
  /** RF-110 (destinos habituales): reenviado tal cual a `PacienteDetail` — opcional, mismo
   * criterio que `requisitosActividadRepository`. */
  recorridoHabitualRepository?: RecorridoHabitualRepository;
}

// Composición raíz de la feature (tasks.md 4.2, 10.1; paginacion-listados Fase 2 tasks.md 13.2):
// resuelve el PacienteRepository del context, wire de `usePacientesPaginado` (listPage, SOLO para
// esta pantalla), y decide qué pantalla mostrar (listado o detalle). `usePacientes.ts` (list()
// completo) NO se usa acá — sigue existiendo tal cual para los selectores de otras pantallas
// (PresupuestosPage/FacturacionPage/HojaDeRutaPage) y el dashboard. No hay router anidado — mismo
// patrón que ObraSocialesPage/VehiculosPage (FE-2).
export function PacientesPage({
  obraSocialRepository,
  documentoRepository,
  requisitosActividadRepository,
  recorridoHabitualRepository,
}: PacientesPageProps) {
  const pacienteRepository = usePacienteRepository();
  const listado = usePacientesPaginado(pacienteRepository);
  const { obrasSociales } = useObrasSociales(obraSocialRepository);
  const [view, setView] = useState<View>({ kind: 'list' });

  function nombreObraSocial(obraSocialId: string | null): string {
    if (obraSocialId === null) return 'Sin obra social';
    return obrasSociales.find((obraSocial) => obraSocial.id === obraSocialId)?.nombre ?? 'Sin obra social';
  }

  // Tras editar (CUD/personas a cargo/direcciones/datos generales, todos llaman `actualizar`
  // directo desde `PacienteDetail` sin pasar por esta pantalla) se sincroniza también la ficha
  // abierta con el resultado fresco de la base — `actualizar` (de `usePacientesPaginado`) ya
  // recarga la página vigente del listado (13.7), pero la ficha en pantalla no forma parte de esa
  // página necesariamente. Se destructura de `listado` (en vez de depender de `listado.actualizar`
  // inline) para que el lint de deps de hooks pueda verificar la dependencia real.
  const { actualizar } = listado;
  const actualizarYSincronizarVista = useCallback(
    async (id: string, data: ActualizacionPaciente) => {
      const actualizado = await actualizar(id, data);
      setView((vistaActual) =>
        vistaActual.kind === 'detail' && vistaActual.paciente?.id === id
          ? { kind: 'detail', paciente: actualizado }
          : vistaActual,
      );
      return actualizado;
    },
    [actualizar],
  );

  if (view.kind === 'detail') {
    return (
      <>
        <AvisoSoloLectura />
        <PacienteDetail
          paciente={view.paciente}
          crear={listado.crear}
          actualizar={actualizarYSincronizarVista}
          obrasSociales={obrasSociales}
          obraSocialRepository={obraSocialRepository}
          documentoRepository={documentoRepository}
          requisitosActividadRepository={requisitosActividadRepository}
          recorridoHabitualRepository={recorridoHabitualRepository}
          onCreated={(creado) => setView({ kind: 'detail', paciente: creado })}
          onBack={() => setView({ kind: 'list' })}
        />
      </>
    );
  }

  return (
    <>
      <AvisoSoloLectura />
      <PacientesList
        pacientes={listado.items}
        loading={listado.loading}
        error={listado.error}
        nombreObraSocial={nombreObraSocial}
        onSelect={(paciente) => setView({ kind: 'detail', paciente })}
        onCreateNew={() => setView({ kind: 'detail', paciente: null })}
        busqueda={listado.busqueda}
        onBusquedaChange={listado.setBusqueda}
        pagina={listado.pagina}
        tamanio={listado.tamanio}
        total={listado.total}
        onCambiarPagina={listado.irAPagina}
      />
    </>
  );
}
