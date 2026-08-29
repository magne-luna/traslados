import { supabaseConductorRepository } from '../../shared/lib/conductores/SupabaseConductorRepository';
import { supabaseCobroRepository } from '../../shared/lib/facturacion/SupabaseCobroRepository';
import { supabaseFacturaRepository } from '../../shared/lib/facturacion/SupabaseFacturaRepository';
import { supabaseHojaDeRutaRepository } from '../../shared/lib/hojas-de-ruta/SupabaseHojaDeRutaRepository';
import { supabasePacienteRepository } from '../../shared/lib/pacientes/SupabasePacienteRepository';
import { supabaseVehiculoRepository } from '../../shared/lib/vehiculos/SupabaseVehiculoRepository';
import { DashboardPage } from './DashboardPage';

// Composition root del dashboard. Inyecta los seis repositorios reales de Supabase, de solo
// lectura (Factura, Cobro, Paciente, Vehiculo, HojaDeRuta y Conductor); DashboardPage solo llama
// `list()`/`getByFecha()`, nunca create/update/remove. Ningún componente hijo importa el cliente
// de Supabase — este archivo es el único que conoce las implementaciones concretas, mismo patrón
// que el resto de los `*Route.tsx` ya swapeados (Pacientes, Hojas de Ruta, Presupuestos, etc.).
//
// Los seis `Supabase*Repository` ya son las implementaciones de producción de sus módulos:
// - Factura / Cobro: `integracion-facturacion` (2026-08-12)
// - Paciente: `integracion-pacientes` (2026-08-07)
// - Vehiculo / Conductor: `integracion-conductores-vehiculos` (2026-08-10/11)
// - HojaDeRuta: `integracion-hojas-de-ruta` (2026-08-04)
//
// Nota de performance: cada carga del dashboard dispara un `list()` por repo. La deduplicación de
// esas lecturas con las de las otras pantallas es el objeto del change `cache-listas-referencia`
// (pendiente) — no bloquea este swap.
export function DashboardRoute() {
  return (
    <DashboardPage
      facturaRepository={supabaseFacturaRepository}
      cobroRepository={supabaseCobroRepository}
      pacienteRepository={supabasePacienteRepository}
      vehiculoRepository={supabaseVehiculoRepository}
      hojaDeRutaRepository={supabaseHojaDeRutaRepository}
      conductorRepository={supabaseConductorRepository}
    />
  );
}
