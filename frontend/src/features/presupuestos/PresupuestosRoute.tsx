import { mockAutorizacionRepository } from '../../shared/lib/mocks/mockAutorizacionRepository';
import { mockObraSocialRepository } from '../../shared/lib/mocks/mockObraSocialRepository';
import { mockPacienteRepository } from '../../shared/lib/mocks/mockPacienteRepository';
import { mockPresupuestoRepository } from '../../shared/lib/mocks/mockPresupuestoRepository';
import { AutorizacionRepositoryProvider } from './AutorizacionRepositoryContext';
import { PresupuestoRepositoryProvider } from './PresupuestoRepositoryContext';
import { PresupuestosPage } from './PresupuestosPage';

// Único punto de composición que conoce mockPresupuestoRepository, mockAutorizacionRepository,
// mockPacienteRepository y mockObraSocialRepository (design.md Decisión 10, tasks.md 8.1): cuando
// existan Supabase*Repository (FE-8), este es el único archivo que cambia — el resto de la
// feature solo conoce las interfaces de los repositories.
export function PresupuestosRoute() {
  return (
    <PresupuestoRepositoryProvider repository={mockPresupuestoRepository}>
      <AutorizacionRepositoryProvider repository={mockAutorizacionRepository}>
        <PresupuestosPage pacienteRepository={mockPacienteRepository} obraSocialRepository={mockObraSocialRepository} />
      </AutorizacionRepositoryProvider>
    </PresupuestoRepositoryProvider>
  );
}
