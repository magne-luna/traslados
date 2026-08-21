import { supabaseDocumentoRepository } from '../../shared/lib/documentos/SupabaseDocumentoRepository';
import { supabaseVehiculoRepository } from '../../shared/lib/vehiculos/SupabaseVehiculoRepository';
import { SupabaseCatalogoAccesoriosRepository } from '../../shared/lib/accesorios/SupabaseCatalogoAccesoriosRepository';
import { VehiculoRepositoryProvider } from './VehiculoRepositoryContext';
import { CatalogoAccesoriosRepositoryProvider } from '../pacientes/CatalogoAccesoriosRepositoryContext';
import { VehiculosPage } from './VehiculosPage';

// Único punto de composición que conoce los repositories de la feature (design.md Decisión 7 y
// 8). CORTE REAL 1 (integracion-conductores-vehiculos, tasks.md §5.9): Vehículo pasa a
// `supabaseVehiculoRepository` — la Edge Function `vehiculos` (backend de Enzo, C-08) ya está
// completa, ver cabecera de `SupabaseVehiculoRepository.ts`. Documentos pasa a
// `supabaseDocumentoRepository` (documentos-vehiculos-conductores-facturacion, 2026-08-16):
// `entidadId` es un UUID real desde CORTE REAL 1, la RLS del bucket `documentos-vehiculos` ya
// gatea por `vehiculos` (`20260805140001_fix_documentos_vehiculos_rls_modulo.sql`) y las columnas
// `nombre_archivo`/`created_at` ya existen — `CONFIG_ENTIDAD` de `documentoMapping.ts` no cambió,
// solo se habilita lo que ya soportaba.
export function VehiculosRoute() {
  return (
    <VehiculoRepositoryProvider repository={supabaseVehiculoRepository}>
      <CatalogoAccesoriosRepositoryProvider repository={SupabaseCatalogoAccesoriosRepository}>
        <VehiculosPage documentoRepository={supabaseDocumentoRepository} />
      </CatalogoAccesoriosRepositoryProvider>
    </VehiculoRepositoryProvider>
  );
}
