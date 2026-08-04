import { mockAutorizacionRepository } from '../../shared/lib/mocks/mockAutorizacionRepository';
import { mockCobroRepository } from '../../shared/lib/mocks/mockCobroRepository';
import { mockDocumentoRepository } from '../../shared/lib/documentos/mockDocumentoRepository';
import { mockFacturaRepository } from '../../shared/lib/mocks/mockFacturaRepository';
import { mockObraSocialRepository } from '../../shared/lib/mocks/mockObraSocialRepository';
import { mockPacienteRepository } from '../../shared/lib/mocks/mockPacienteRepository';
import { mockPrestadorRepository } from '../../shared/lib/mocks/mockPrestadorRepository';
import { mockPresupuestoRepository } from '../../shared/lib/mocks/mockPresupuestoRepository';
import { buildFeriadosFixture } from '../../shared/lib/mocks/feriadosFixture';
import { PrestadorRepositoryProvider } from '../prestadores/PrestadorRepositoryContext';
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
//
// `PrestadorRepositoryProvider` (change `factura-por-prestador`, no listado explícito en
// tasks.md pero necesario para que `PrestadorSelector` no explote al montarse:
// `usePrestadorRepository()` lanza sin provider en el árbol): usa `mockPrestadorRepository`
// (fix de coordinación 2026-08-04, ver `CHANGES.md`) — NO `supabasePrestadorRepository` real. La
// primera versión de este archivo sí inyectaba el repository real, pero `obraSocial.id` en esta
// misma pantalla viene de `mockObraSocialRepository` (ids de fixture como `'osecac'`, no UUIDs de
// Supabase): `listarPorObraSocial('osecac')` contra el backend real nunca matchea ninguna fila —
// el selector quedaba siempre vacío en la práctica — y además rompía la promesa de
// `proposal.md` §"Lo que este change NO hace" de cero cambios a Supabase. `mockPrestadorRepository`
// (nuevo, `shared/lib/mocks/`) resuelve ambos problemas: mismo espacio de ids que
// `mockObraSocialRepository`, y el resto de la feature sigue en mocks como siempre.
export function FacturacionRoute() {
  return (
    <FacturaRepositoryProvider repository={mockFacturaRepository}>
      <CobroRepositoryProvider repository={mockCobroRepository}>
        <PrestadorRepositoryProvider repository={mockPrestadorRepository}>
          <FacturacionPage
            pacienteRepository={mockPacienteRepository}
            obraSocialRepository={mockObraSocialRepository}
            presupuestoRepository={mockPresupuestoRepository}
            autorizacionRepository={mockAutorizacionRepository}
            documentoRepository={mockDocumentoRepository}
            feriados={FERIADOS}
          />
        </PrestadorRepositoryProvider>
      </CobroRepositoryProvider>
    </FacturaRepositoryProvider>
  );
}
