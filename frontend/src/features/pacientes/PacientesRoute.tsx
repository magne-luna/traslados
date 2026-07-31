import { mockDocumentoRepository } from '../../shared/lib/documentos/mockDocumentoRepository';
import { mockObraSocialRepository } from '../../shared/lib/mocks/mockObraSocialRepository';
import { supabasePacienteRepository } from '../../shared/lib/pacientes/SupabasePacienteRepository';
import { PacienteRepositoryProvider } from './PacienteRepositoryContext';
import { PacientesPage } from './PacientesPage';

// Único punto de composición que conoce supabasePacienteRepository, mockObraSocialRepository y
// mockDocumentoRepository (design.md Decisión 6, tasks.md 4.1): Pacientes ya tiene backend real
// (C-05, migración `crear_paciente_completo` aplicada — tasks.md 1B.3), a diferencia de Obras
// Sociales y Documentos, que siguen en mock porque sus propios backends todavía no existen — el
// resto de la feature solo conoce las interfaces de los repositories, así que cuando esos
// backends existan, este es el único archivo que cambia (mismo criterio que CuentasRoute.tsx).
export function PacientesRoute() {
  return (
    <PacienteRepositoryProvider repository={supabasePacienteRepository}>
      <PacientesPage obraSocialRepository={mockObraSocialRepository} documentoRepository={mockDocumentoRepository} />
    </PacienteRepositoryProvider>
  );
}
