import { mockAutorizacionRepository } from '../../shared/lib/mocks/mockAutorizacionRepository';
import { mockCobroRepository } from '../../shared/lib/mocks/mockCobroRepository';
import { mockDocumentoRepository } from '../../shared/lib/documentos/mockDocumentoRepository';
import { mockFacturaRepository } from '../../shared/lib/mocks/mockFacturaRepository';
import { mockPresupuestoRepository } from '../../shared/lib/mocks/mockPresupuestoRepository';
import { buildFeriadosFixture } from '../../shared/lib/mocks/feriadosFixture';
import { supabaseObraSocialRepository } from '../../shared/lib/obrasSociales/SupabaseObraSocialRepository';
import { supabasePacienteRepository } from '../../shared/lib/pacientes/SupabasePacienteRepository';
import { supabasePrestadorRepository } from '../../shared/lib/prestadores/SupabasePrestadorRepository';
import { PrestadorRepositoryProvider } from '../prestadores/PrestadorRepositoryContext';
import { CobroRepositoryProvider } from './CobroRepositoryContext';
import { FacturaRepositoryProvider } from './FacturaRepositoryContext';
import { FacturacionPage } from './FacturacionPage';

const FERIADOS = buildFeriadosFixture();

// Único punto de composición que conoce mockFacturaRepository y mockCobroRepository (design.md
// Decisión 15, tasks.md 12.1) — Factura y Cobro siguen en mock a propósito (pedido explícito de
// Enzo, 2026-08-05: swap parcial, `integracion-facturacion` completo queda para más adelante,
// CRÍTICO, requiere las 5 aprobaciones de su `design.md`).
//
// Paciente/ObraSocial/Prestador SÍ son reales desde acá (2026-08-05, pedido explícito de Enzo):
// `supabasePacienteRepository`/`supabaseObraSocialRepository` (ya reales en sus propias pantallas,
// `integracion-pacientes`/`integracion-obra-social`, archivados) y `supabasePrestadorRepository`.
// Los tres van juntos por una razón técnica, no solo la petición: `PrestadorSelector` llama
// `listarPorObraSocial(obraSocial.id)`, y una vez que `obraSocial.id` es un UUID real de Supabase,
// dejar `mockPrestadorRepository` (atado al id de fixture `'osecac'`, ver su propio comentario)
// rompe el selector otra vez — mismo bug que motivó crear ese mock el 2026-08-04, invertido. El
// seed real (`20260801120000_seed_obras_sociales_prestadores.sql`) ya vincula "Traslados Andrea
// Pastor" a la OSECAC real, así que el selector funciona en vivo con este swap.
// `mockPrestadorRepository` queda como doble de test, no se borra.
export function FacturacionRoute() {
  return (
    <FacturaRepositoryProvider repository={mockFacturaRepository}>
      <CobroRepositoryProvider repository={mockCobroRepository}>
        <PrestadorRepositoryProvider repository={supabasePrestadorRepository}>
          <FacturacionPage
            pacienteRepository={supabasePacienteRepository}
            obraSocialRepository={supabaseObraSocialRepository}
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
