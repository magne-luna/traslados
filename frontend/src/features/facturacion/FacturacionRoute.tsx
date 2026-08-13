import { mockAutorizacionRepository } from '../../shared/lib/mocks/mockAutorizacionRepository';
import { mockDocumentoRepository } from '../../shared/lib/documentos/mockDocumentoRepository';
import { mockPresupuestoRepository } from '../../shared/lib/mocks/mockPresupuestoRepository';
import { buildFeriadosFixture } from '../../shared/lib/mocks/feriadosFixture';
import { supabaseCobroRepository } from '../../shared/lib/facturacion/SupabaseCobroRepository';
import { supabaseFacturaRepository } from '../../shared/lib/facturacion/SupabaseFacturaRepository';
import { supabaseObraSocialRepository } from '../../shared/lib/obrasSociales/SupabaseObraSocialRepository';
import { supabasePacienteRepository } from '../../shared/lib/pacientes/SupabasePacienteRepository';
import { CobroRepositoryProvider } from './CobroRepositoryContext';
import { FacturaRepositoryProvider } from './FacturaRepositoryContext';
import { FacturacionPage } from './FacturacionPage';

const FERIADOS = buildFeriadosFixture();

// Único punto de composición que conoce supabaseFacturaRepository y supabaseCobroRepository
// (design.md D6, tasks.md §5 — "el corte real"). Factura y Cobro pasan a ser reales el
// 2026-08-12 (`integracion-facturacion`, dominio CRÍTICO, con las 5 aprobaciones de su
// `design.md` respondidas — tasks.md §0). Antes de este commit usaban
// `mockFacturaRepository`/`mockCobroRepository`; esos mocks siguen existiendo y exportándose
// como dobles de test (tasks.md 5.6), pero ya no se inyectan acá.
//
// Paciente/ObraSocial ya eran reales desde 2026-08-05 (pedido explícito de Enzo):
// `supabasePacienteRepository`/`supabaseObraSocialRepository` (ya reales en sus propias pantallas,
// `integracion-pacientes`/`integracion-obra-social`, archivados). `PrestadorRepositoryProvider`/
// `supabasePrestadorRepository` (change `factura-por-prestador`) se removieron (change
// `sacar-prestadores`): el Paso 2 del wizard ya no usa ningún repository, son dos campos de texto
// libre sin entidad detrás.
export function FacturacionRoute() {
  return (
    <FacturaRepositoryProvider repository={supabaseFacturaRepository}>
      <CobroRepositoryProvider repository={supabaseCobroRepository}>
        <FacturacionPage
          pacienteRepository={supabasePacienteRepository}
          obraSocialRepository={supabaseObraSocialRepository}
          presupuestoRepository={mockPresupuestoRepository}
          autorizacionRepository={mockAutorizacionRepository}
          documentoRepository={mockDocumentoRepository}
          feriados={FERIADOS}
        />
      </CobroRepositoryProvider>
    </FacturaRepositoryProvider>
  );
}
