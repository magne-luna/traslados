import { mockDocumentoRepository } from '../../shared/lib/documentos/mockDocumentoRepository';
import { mockObraSocialRepository } from '../../shared/lib/mocks/mockObraSocialRepository';
import { mockPacienteRepository } from '../../shared/lib/mocks/mockPacienteRepository';
import { PacienteRepositoryProvider } from './PacienteRepositoryContext';
import { PacientesPage } from './PacientesPage';

// Único punto de composición que conoce mockPacienteRepository, mockObraSocialRepository y
// mockDocumentoRepository (design.md Decisión 6, tasks.md 4.2/10.1): cuando exista
// SupabasePacienteRepository (FE-8), este es el único archivo que cambia — el resto de la
// feature solo conoce las interfaces de los repositories.
export function PacientesRoute() {
  return (
    <PacienteRepositoryProvider repository={mockPacienteRepository}>
      <PacientesPage obraSocialRepository={mockObraSocialRepository} documentoRepository={mockDocumentoRepository} />
    </PacienteRepositoryProvider>
  );
}
