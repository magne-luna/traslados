import { mockDocumentoRepository } from '../../shared/lib/documentos/mockDocumentoRepository';
import { supabaseConductorRepository } from '../../shared/lib/conductores/SupabaseConductorRepository';
import { supabaseVehiculoRepository } from '../../shared/lib/vehiculos/SupabaseVehiculoRepository';
import { VehiculoRepositoryProvider } from '../vehiculos/VehiculoRepositoryContext';
import { ConductorRepositoryProvider } from './ConductorRepositoryContext';
import { ConductoresPage } from './ConductoresPage';

// Único punto de composición que conoce los repositories de la feature (design.md Decisión 7 y
// 9). CORTE REAL 2 (integracion-conductores-vehiculos, tasks.md §7.8, desbloqueada por 1B.11):
// Conductor pasa a `supabaseConductorRepository` (las RPC `SECURITY INVOKER` de
// `20260811110000_conductores_rpc.sql`, ver cabecera de `SupabaseConductorRepository.ts`) y monta
// AMBOS providers (Conductor y Vehículo, ya real desde §5.9 "CORTE REAL 1") porque el selector de
// la asignación semanal consume VehiculoRepository de solo lectura vía su propio context. Cierra
// el estado transitorio documentado en 5.10. Documentos sigue en mock (mismo gap ya señalizado en
// VehiculoDetail/ConductoresRoute, ver CHANGES.md §8).
export function ConductoresRoute() {
  return (
    <ConductorRepositoryProvider repository={supabaseConductorRepository}>
      <VehiculoRepositoryProvider repository={supabaseVehiculoRepository}>
        <ConductoresPage documentoRepository={mockDocumentoRepository} />
      </VehiculoRepositoryProvider>
    </ConductorRepositoryProvider>
  );
}
