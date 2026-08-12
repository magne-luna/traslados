import { useCallback, useState } from 'react';
import { AvisoSoloLectura } from '../../design-system/components';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { ActualizacionConductor, Conductor } from '../../shared/types/conductor';
import { useConductorRepository } from './ConductorRepositoryContext';
import { ConductorDetail } from './ConductorDetail';
import { ConductoresList } from './ConductoresList';
import { useConductoresPaginado } from './useConductoresPaginado';

// paginacion-listados, Fase 3 (tasks.md 16.3): la vista de detalle guarda el objeto `Conductor`
// COMPLETO (no solo su id) — llega directo del evento que dispara la navegación (`onSelect` de la
// lista, `onCreated` del alta). Nunca se re-deriva buscando el id en el listado paginado: esa
// lista ahora es solo la página vigente, no el padrón completo, y el conductor elegido/creado
// puede no estar en ella (mismo gotcha que PacientesPage, design.md §D3).
type View = { kind: 'list' } | { kind: 'detail'; conductor: Conductor | null };

interface ConductoresPageProps {
  documentoRepository: DocumentoRepository;
}

// Composición raíz de la feature (tasks.md 4.2, 5.5; paginacion-listados Fase 3 tasks.md 16.3):
// resuelve el ConductorRepository del context, wire de `useConductoresPaginado` (listPage, SOLO
// para esta pantalla), y decide qué pantalla mostrar (listado o detalle). `useConductores.ts`
// (`list()` completo) NO se usa acá — sigue existiendo tal cual para el selector de conductores
// de HojaDeRutaPage. No hay router anidado — mismo patrón que VehiculosPage/PacientesPage.
export function ConductoresPage({ documentoRepository }: ConductoresPageProps) {
  const repository = useConductorRepository();
  const listado = useConductoresPaginado(repository);
  const [view, setView] = useState<View>({ kind: 'list' });

  // `ConductorDetail` lee directo del prop `conductor` (resumen, form, asignación semanal) — no
  // se re-deriva del listado paginado. Sin este wrapper, tras `actualizar()` (editar datos o
  // agregar una asignación semanal) la ficha abierta quedaría con datos viejos hasta volver al
  // listado: mismo gotcha que `actualizarYSincronizarVista` de PacientesPage (Fase 2, 13.7).
  const { actualizar } = listado;
  const actualizarYSincronizarVista = useCallback(
    async (id: string, data: ActualizacionConductor) => {
      const actualizado = await actualizar(id, data);
      setView((vistaActual) =>
        vistaActual.kind === 'detail' && vistaActual.conductor?.id === id
          ? { kind: 'detail', conductor: actualizado }
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
        <ConductorDetail
          conductor={view.conductor}
          crear={listado.crear}
          actualizar={actualizarYSincronizarVista}
          documentoRepository={documentoRepository}
          onCreated={(creado) => setView({ kind: 'detail', conductor: creado })}
          onBack={() => setView({ kind: 'list' })}
        />
      </>
    );
  }

  return (
    <>
      <AvisoSoloLectura />
      <ConductoresList
        conductores={listado.items}
        loading={listado.loading}
        error={listado.error}
        onSelect={(conductor) => setView({ kind: 'detail', conductor })}
        onCreateNew={() => setView({ kind: 'detail', conductor: null })}
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
