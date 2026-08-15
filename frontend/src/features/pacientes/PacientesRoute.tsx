import { supabaseDocumentoRepository } from '../../shared/lib/documentos/SupabaseDocumentoRepository';
import { supabaseObraSocialRepository } from '../../shared/lib/obrasSociales/SupabaseObraSocialRepository';
import { supabasePacienteRepository } from '../../shared/lib/pacientes/SupabasePacienteRepository';
import { supabaseRecorridoHabitualRepository } from '../../shared/lib/pacientes/SupabaseRecorridoHabitualRepository';
import { supabaseRequisitosActividadRepository } from '../../shared/lib/requisitosActividad/SupabaseRequisitosActividadRepository';
import { SupabaseCatalogoAccesoriosRepository } from '../../shared/lib/accesorios/SupabaseCatalogoAccesoriosRepository';
import { PacientesDocumentacionTabs } from '../../shared/components/PacientesDocumentacionTabs';
import { PacienteRepositoryProvider } from './PacienteRepositoryContext';
import { CatalogoAccesoriosRepositoryProvider } from './CatalogoAccesoriosRepositoryContext';
import { PacientesPage } from './PacientesPage';

// Único punto de composición que conoce supabasePacienteRepository, supabaseObraSocialRepository,
// supabaseDocumentoRepository y (documentos-checklist-items-por-actividad, tasks.md §6)
// supabaseRequisitosActividadRepository (design.md Decisión 6, tasks.md 4.1; corte de Checkpoint 0
// de `integracion-documentos`, tasks.md 5.2): las cuatro entidades de esta pantalla ya tienen
// backend real — Pacientes (C-05/`integracion-pacientes`), Obra Social (C-04/`integracion-obra-
// social`), Documentos (C-03/`integracion-documentos`, único de los 4 roots documentales con
// `entidadId` real hoy; Vehículos/Conductores/Facturación siguen en `mockDocumentoRepository` hasta
// que sus propias entidades sean reales) y, ahora, la configuración de ítems por tipo de actividad
// (tabla `obra_social.requisitos_actividad`, gateada por el mismo módulo `obra_social` que
// `requisitos_os`, veredicto 1.2). También `supabaseRecorridoHabitualRepository` (RF-110,
// `pacientes.recorridos`): tabla real ya existe (sin pantalla que la use hasta este change), así
// que se wirea directo, sin paso intermedio por mock. El resto de la feature solo conoce las
// interfaces de los repositories, así que este es el único archivo que cambia (mismo criterio que
// CuentasRoute.tsx).
// `PacientesDocumentacionTabs` se monta acá, no dentro de `PacientesPage` (pacientes-docs-
// actividad-tabs): usa `useLocation`/`useNavigate`/`usePermiso`, que exigen Router y AuthProvider
// — `PacientesPage`/`PacientesPage.test.tsx` se mantienen deliberadamente libres de esa
// dependencia (~15 tests existentes la montan con `render()` sin Router). Acá, en cambio, ya
// estamos en el único archivo que conoce el mundo exterior a la feature.
export function PacientesRoute() {
  return (
    <PacienteRepositoryProvider repository={supabasePacienteRepository}>
      <CatalogoAccesoriosRepositoryProvider repository={SupabaseCatalogoAccesoriosRepository}>
        <PacientesDocumentacionTabs />
        <PacientesPage
          obraSocialRepository={supabaseObraSocialRepository}
          documentoRepository={supabaseDocumentoRepository}
          requisitosActividadRepository={supabaseRequisitosActividadRepository}
          recorridoHabitualRepository={supabaseRecorridoHabitualRepository}
        />
      </CatalogoAccesoriosRepositoryProvider>
    </PacienteRepositoryProvider>
  );
}
