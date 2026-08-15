import { mockDocumentoRepository } from '../../shared/lib/documentos/mockDocumentoRepository';
import { buildFeriadosFixture } from '../../shared/lib/mocks/feriadosFixture';
import { supabaseCobroRepository } from '../../shared/lib/facturacion/SupabaseCobroRepository';
import { supabaseFacturaRepository } from '../../shared/lib/facturacion/SupabaseFacturaRepository';
import { supabaseObraSocialRepository } from '../../shared/lib/obrasSociales/SupabaseObraSocialRepository';
import { supabasePacienteRepository } from '../../shared/lib/pacientes/SupabasePacienteRepository';
import { supabaseAutorizacionRepository } from '../../shared/lib/presupuestos/SupabaseAutorizacionRepository';
import { supabasePresupuestoRepository } from '../../shared/lib/presupuestos/SupabasePresupuestoRepository';
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
//
// Presupuesto/Autorizacion pasan a ser reales el 2026-08-15 (fix directo, sin change SDD nuevo):
// hasta acá esta pantalla inyectaba `mockPresupuestoRepository`/`mockAutorizacionRepository`
// (datos de fixture) mientras el resto de la app (`PresupuestosRoute.tsx`, `integracion-
// presupuestos`/C-06) ya usaba `supabasePresupuestoRepository`/`supabaseAutorizacionRepository`
// desde el 2026-08-05. Consecuencia real verificada en producción: el paso "elegir autorización
// pendiente de facturar" (`facturacion-seleccion-autorizacion`) nunca encontraba autorizaciones de
// pacientes reales porque comparaba contra el fixture, no contra la base — confirmado con la
// paciente Brisa, que tiene autorización real en estado `autorizada` y la pantalla decía que no
// tenía ninguna pendiente. `mockPresupuestoRepository`/`mockAutorizacionRepository` siguen
// existiendo y exportándose como dobles de test, pero ya no se inyectan acá.
export function FacturacionRoute() {
  return (
    <FacturaRepositoryProvider repository={supabaseFacturaRepository}>
      <CobroRepositoryProvider repository={supabaseCobroRepository}>
        <FacturacionPage
          pacienteRepository={supabasePacienteRepository}
          obraSocialRepository={supabaseObraSocialRepository}
          presupuestoRepository={supabasePresupuestoRepository}
          autorizacionRepository={supabaseAutorizacionRepository}
          documentoRepository={mockDocumentoRepository}
          feriados={FERIADOS}
        />
      </CobroRepositoryProvider>
    </FacturaRepositoryProvider>
  );
}
