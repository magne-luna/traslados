import { mockAutorizacionRepository } from '../../shared/lib/mocks/mockAutorizacionRepository';
import { mockCobroRepository } from '../../shared/lib/mocks/mockCobroRepository';
import { mockDocumentoRepository } from '../../shared/lib/documentos/mockDocumentoRepository';
import { mockFacturaRepository } from '../../shared/lib/mocks/mockFacturaRepository';
import { mockObraSocialRepository } from '../../shared/lib/mocks/mockObraSocialRepository';
import { mockPacienteRepository } from '../../shared/lib/mocks/mockPacienteRepository';
import { mockPresupuestoRepository } from '../../shared/lib/mocks/mockPresupuestoRepository';
import { buildFeriadosFixture } from '../../shared/lib/mocks/feriadosFixture';
import { CobroRepositoryProvider } from './CobroRepositoryContext';
import { FacturaRepositoryProvider } from './FacturaRepositoryContext';
import { FacturacionPage } from './FacturacionPage';

const FERIADOS = buildFeriadosFixture();

// Único punto de composición que conoce mockFacturaRepository y mockCobroRepository (design.md
// Decisión 15, tasks.md 12.1), más mockPacienteRepository/mockObraSocialRepository/
// mockPresupuestoRepository/mockAutorizacionRepository/mockDocumentoRepository de solo lectura
// (FE-1 a FE-4) para los selectores, la resolución del cupo autorizado real (tasks.md 8.2) y el
// checklist documental. Cuando existan Supabase*Repository (FE-8), este es el único archivo que
// cambia — el resto de la feature solo conoce las interfaces de los repositories. Mismo patrón
// que PresupuestosRoute/HojaDeRutaRoute.
export function FacturacionRoute() {
  return (
    <FacturaRepositoryProvider repository={mockFacturaRepository}>
      <CobroRepositoryProvider repository={mockCobroRepository}>
        <FacturacionPage
          pacienteRepository={mockPacienteRepository}
          obraSocialRepository={mockObraSocialRepository}
          presupuestoRepository={mockPresupuestoRepository}
          autorizacionRepository={mockAutorizacionRepository}
          documentoRepository={mockDocumentoRepository}
          feriados={FERIADOS}
        />
      </CobroRepositoryProvider>
    </FacturaRepositoryProvider>
  );
}
