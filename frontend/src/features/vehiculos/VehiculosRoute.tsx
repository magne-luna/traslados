import { mockDocumentoRepository } from '../../shared/lib/documentos/mockDocumentoRepository';
import { mockVehiculoRepository } from '../../shared/lib/mocks/mockVehiculoRepository';
import { VehiculoRepositoryProvider } from './VehiculoRepositoryContext';
import { VehiculosPage } from './VehiculosPage';

// Único punto de composición que conoce mockVehiculoRepository y mockDocumentoRepository
// (design.md Decisión 7 y 8): cuando exista SupabaseVehiculoRepository (FE-8), este es el único
// archivo que cambia — el resto de la feature solo conoce las interfaces de los repositories.
export function VehiculosRoute() {
  return (
    <VehiculoRepositoryProvider repository={mockVehiculoRepository}>
      <VehiculosPage documentoRepository={mockDocumentoRepository} />
    </VehiculoRepositoryProvider>
  );
}
