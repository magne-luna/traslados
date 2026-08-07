import { supabaseDocumentoRepository } from '../../shared/lib/documentos/SupabaseDocumentoRepository';
import { supabaseObraSocialRepository } from '../../shared/lib/obrasSociales/SupabaseObraSocialRepository';
import { supabasePacienteRepository } from '../../shared/lib/pacientes/SupabasePacienteRepository';
import { PacienteRepositoryProvider } from './PacienteRepositoryContext';
import { PacientesPage } from './PacientesPage';

// Único punto de composición que conoce supabasePacienteRepository, supabaseObraSocialRepository y
// supabaseDocumentoRepository (design.md Decisión 6, tasks.md 4.1; corte de Checkpoint 0 de
// `integracion-documentos`, tasks.md 5.2): las tres entidades de esta pantalla ya tienen backend
// real — Pacientes (C-05/`integracion-pacientes`), Obra Social (C-04/`integracion-obra-social`) y
// Documentos (C-03/`integracion-documentos`, único de los 4 roots documentales con `entidadId`
// real hoy; Vehículos/Conductores/Facturación siguen en `mockDocumentoRepository` hasta que sus
// propias entidades sean reales). El resto de la feature solo conoce las interfaces de los
// repositories, así que este es el único archivo que cambia (mismo criterio que CuentasRoute.tsx).
export function PacientesRoute() {
  return (
    <PacienteRepositoryProvider repository={supabasePacienteRepository}>
      <PacientesPage obraSocialRepository={supabaseObraSocialRepository} documentoRepository={supabaseDocumentoRepository} />
    </PacienteRepositoryProvider>
  );
}
