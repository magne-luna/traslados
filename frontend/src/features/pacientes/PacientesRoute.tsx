import { mockDocumentoRepository } from '../../shared/lib/documentos/mockDocumentoRepository';
import { supabaseObraSocialRepository } from '../../shared/lib/obrasSociales/SupabaseObraSocialRepository';
import { supabasePacienteRepository } from '../../shared/lib/pacientes/SupabasePacienteRepository';
import { PacienteRepositoryProvider } from './PacienteRepositoryContext';
import { PacientesPage } from './PacientesPage';

// Único punto de composición que conoce supabasePacienteRepository, supabaseObraSocialRepository y
// mockDocumentoRepository (design.md Decisión 6, tasks.md 4.1): Pacientes y Obras Sociales ya
// tienen backend real (C-05/`integracion-pacientes`; C-04/`integracion-obra-social`), a diferencia
// de Documentos, que sigue en mock porque su propio backend todavía no existe — el resto de la
// feature solo conoce las interfaces de los repositories, así que cuando ese backend exista, este
// es el único archivo que cambia (mismo criterio que CuentasRoute.tsx).
export function PacientesRoute() {
  return (
    <PacienteRepositoryProvider repository={supabasePacienteRepository}>
      <PacientesPage obraSocialRepository={supabaseObraSocialRepository} documentoRepository={mockDocumentoRepository} />
    </PacienteRepositoryProvider>
  );
}
