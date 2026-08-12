import { useLocation, useNavigate } from 'react-router';
import { TopTabs } from '../../design-system/components';
import { usePermiso } from '../auth/usePermiso';

// pacientes-docs-actividad-tabs: barra de tabs de módulo que conecta /pacientes con
// /documentacion-por-actividad (antes dos entradas de sidebar separadas, ahora "Documentación
// por Actividad" vive detrás del segundo tab — ver `ocultaEnSidebar` en app/routes.ts). A
// propósito NAVEGA entre dos rutas reales en vez de alternar un estado interno tipo `view`
// (patrón que sí usa PacientesPage para lista/detalle): /documentacion-por-actividad sigue
// gateada por el módulo `obra_social`, no `pacientes` (documentos-checklist-items-por-actividad/
// design.md — decisión explícita, no por descarte). Si esto fuera un switch de estado dentro de
// /pacientes, `usePuedeEscribir()` (consumido por ChecklistItemRow dentro de esa pantalla)
// resolvería el permiso de escritura de `pacientes`, no el de `obra_social` — permiso equivocado
// para decidir si se puede editar la config global de checklist. Navegar de verdad hace que
// RequireAuth vuelva a correr para la ruta destino y listo.
//
// El segundo tab solo se renderiza si el usuario tiene lectura sobre `obra_social`: si solo
// tiene `pacientes`, no ve un tab que lo llevaría a un cartel de acceso denegado.
export function PacientesDocumentacionTabs() {
  const location = useLocation();
  const navigate = useNavigate();
  const puedeVerRequisitos = usePermiso('obra_social', 'read');

  if (!puedeVerRequisitos) return null;

  const enRequisitos = location.pathname === '/documentacion-por-actividad';

  // px-xl acá replica el margen horizontal que ya usan PacientesList/PacienteDetail
  // (py-xxl px-xl) para que los tabs queden alineados con el contenido de abajo, no más
  // afuera — este wrapper es el único responsable del padding superior/lateral de los tabs
  // en sí, la pantalla de abajo sigue poniendo el suyo propio.
  return (
    <div className="px-xl pt-lg">
      <TopTabs
        tabs={[
          { label: 'Lista de pacientes', active: !enRequisitos, onClick: () => navigate('/pacientes') },
          {
            label: 'Documentación por requisitos',
            active: enRequisitos,
            onClick: () => navigate('/documentacion-por-actividad'),
          },
        ]}
      />
    </div>
  );
}
