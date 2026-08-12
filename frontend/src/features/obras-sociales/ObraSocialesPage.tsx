import { useCallback, useState } from 'react';
import { AvisoSoloLectura } from '../../design-system/components';
import type { ActualizacionObraSocial, ObraSocial } from '../../shared/types/obraSocial';
import { ObraSocialDetail } from './ObraSocialDetail';
import { useObraSocialRepository } from './ObraSocialRepositoryContext';
import { ObrasSocialesList } from './ObrasSocialesList';
import { useObrasSocialesPaginado } from './useObrasSocialesPaginado';

// paginacion-listados, Fase 3 (tasks.md 17.3): la vista de detalle guarda el objeto `ObraSocial`
// COMPLETO (no solo su id) — llega directo del evento que dispara la navegación (`onSelect` de la
// lista, `onCreated` del alta). Nunca se re-deriva buscando el id en el listado paginado: esa
// lista ahora es solo la página vigente, no el catálogo completo, y la obra social elegida/creada
// puede no estar en ella (mismo gotcha que PacientesPage/ConductoresPage, design.md §D3).
type View = { kind: 'list' } | { kind: 'detail'; obraSocial: ObraSocial | null };

// Composición raíz de la feature (tasks.md 3.2, 7.1; paginacion-listados Fase 3 tasks.md 17.3):
// resuelve el repository del context, wire de `useObrasSocialesPaginado` (listPage, SOLO para
// esta pantalla), y decide qué pantalla mostrar (listado o detalle). `useObrasSociales.ts`
// (`list()` completo) NO se usa acá — sigue existiendo tal cual para los selectores de obra
// social de Pacientes, Presupuestos y Facturación. No hay router anidado — el listado y el
// detalle son dos vistas del mismo componente de página, montado en una única ruta
// (`/obras-sociales`) del router de la app.
//
// gateo-obrasocial (design.md D6, tasks.md 4.8): <AvisoSoloLectura /> se monta acá, una sola
// vez, para cubrir tanto la vista de lista como la de detalle — mismo patrón de referencia que
// replican gateo-pacientes, gateo-facturacion y gateo-conductores en su propia página de módulo.
export function ObraSocialesPage() {
  const repository = useObraSocialRepository();
  const listado = useObrasSocialesPaginado(repository);
  const [view, setView] = useState<View>({ kind: 'list' });

  // `ObraSocialDetail` lee directo del prop `obraSocial` (resumen, form, checklist, plantilla de
  // factura) — no se re-deriva del listado paginado. Sin este wrapper, tras `actualizar()`
  // (editar datos, checklist o plantilla) la ficha abierta quedaría con datos viejos hasta volver
  // al listado: mismo gotcha que `actualizarYSincronizarVista` de PacientesPage (Fase 2, 13.7).
  const { actualizar } = listado;
  const actualizarYSincronizarVista = useCallback(
    async (id: string, data: ActualizacionObraSocial) => {
      const actualizada = await actualizar(id, data);
      setView((vistaActual) =>
        vistaActual.kind === 'detail' && vistaActual.obraSocial?.id === id
          ? { kind: 'detail', obraSocial: actualizada }
          : vistaActual,
      );
      return actualizada;
    },
    [actualizar],
  );

  if (view.kind === 'detail') {
    return (
      <>
        <AvisoSoloLectura />
        <ObraSocialDetail
          obraSocial={view.obraSocial}
          crear={listado.crear}
          actualizar={actualizarYSincronizarVista}
          onCreated={(creada) => setView({ kind: 'detail', obraSocial: creada })}
          onBack={() => setView({ kind: 'list' })}
        />
      </>
    );
  }

  return (
    <>
      <AvisoSoloLectura />
      <ObrasSocialesList
        obrasSociales={listado.items}
        loading={listado.loading}
        error={listado.error}
        onSelect={(obraSocial) => setView({ kind: 'detail', obraSocial })}
        onCreateNew={() => setView({ kind: 'detail', obraSocial: null })}
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
