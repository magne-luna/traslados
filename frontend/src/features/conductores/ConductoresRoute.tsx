import { mockDocumentoRepository } from '../../shared/lib/documentos/mockDocumentoRepository';
import { mockConductorRepository } from '../../shared/lib/mocks/mockConductorRepository';
import { mockVehiculoRepository } from '../../shared/lib/mocks/mockVehiculoRepository';
import { VehiculoRepositoryProvider } from '../vehiculos/VehiculoRepositoryContext';
import { ConductorRepositoryProvider } from './ConductorRepositoryContext';
import { ConductoresPage } from './ConductoresPage';

// Único punto de composición que conoce mockConductorRepository, mockVehiculoRepository y
// mockDocumentoRepository (design.md Decisión 7 y 9): monta AMBOS providers (Conductor y
// Vehículo) porque el selector de la asignación semanal consume VehiculoRepository de solo
// lectura vía su propio context. Cuando exista SupabaseConductorRepository (FE-8), este es el
// único archivo que cambia — el resto de la feature solo conoce las interfaces.
export function ConductoresRoute() {
  return (
    <ConductorRepositoryProvider repository={mockConductorRepository}>
      <VehiculoRepositoryProvider repository={mockVehiculoRepository}>
        <ConductoresPage documentoRepository={mockDocumentoRepository} />
      </VehiculoRepositoryProvider>
    </ConductorRepositoryProvider>
  );
}
