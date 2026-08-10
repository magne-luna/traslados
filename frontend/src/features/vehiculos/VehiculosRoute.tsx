import { mockDocumentoRepository } from '../../shared/lib/documentos/mockDocumentoRepository';
import { supabaseVehiculoRepository } from '../../shared/lib/vehiculos/SupabaseVehiculoRepository';
import { VehiculoRepositoryProvider } from './VehiculoRepositoryContext';
import { VehiculosPage } from './VehiculosPage';

// Único punto de composición que conoce los repositories de la feature (design.md Decisión 7 y
// 8). CORTE REAL 1 (integracion-conductores-vehiculos, tasks.md §5.9): Vehículo pasa a
// `supabaseVehiculoRepository` — la Edge Function `vehiculos` (backend de Enzo, C-08) ya está
// completa, ver cabecera de `SupabaseVehiculoRepository.ts`. Documentos sigue en mock hasta que
// `integracion-conductores-vehiculos`/`integracion-facturacion` le den un `entidadId` real (mismo
// gap ya señalizado con `AvisoModeloDatos` en `VehiculoDetail.tsx`, ver CHANGES.md §8).
export function VehiculosRoute() {
  return (
    <VehiculoRepositoryProvider repository={supabaseVehiculoRepository}>
      <VehiculosPage documentoRepository={mockDocumentoRepository} />
    </VehiculoRepositoryProvider>
  );
}
