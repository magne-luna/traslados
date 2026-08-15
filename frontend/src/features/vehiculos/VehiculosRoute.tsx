import { mockDocumentoRepository } from '../../shared/lib/documentos/mockDocumentoRepository';
import { supabaseVehiculoRepository } from '../../shared/lib/vehiculos/SupabaseVehiculoRepository';
import { SupabaseCatalogoAccesoriosRepository } from '../../shared/lib/accesorios/SupabaseCatalogoAccesoriosRepository';
import { VehiculoRepositoryProvider } from './VehiculoRepositoryContext';
import { CatalogoAccesoriosRepositoryProvider } from '../pacientes/CatalogoAccesoriosRepositoryContext';
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
      <CatalogoAccesoriosRepositoryProvider repository={SupabaseCatalogoAccesoriosRepository}>
        <VehiculosPage documentoRepository={mockDocumentoRepository} />
      </CatalogoAccesoriosRepositoryProvider>
    </VehiculoRepositoryProvider>
  );
}
