import { mockObraSocialRepository } from '../../shared/lib/mocks/mockObraSocialRepository';
import { ObraSocialesPage } from './ObraSocialesPage';
import { ObraSocialRepositoryProvider } from './ObraSocialRepositoryContext';

// Único punto de composición que conoce mockObraSocialRepository (design.md Decisión 6):
// cuando exista SupabaseObraSocialRepository (FE-8), este es el único archivo que cambia — el
// resto de la feature solo conoce la interfaz ObraSocialRepository.
export function ObraSocialesRoute() {
  return (
    <ObraSocialRepositoryProvider repository={mockObraSocialRepository}>
      <ObraSocialesPage />
    </ObraSocialRepositoryProvider>
  );
}
