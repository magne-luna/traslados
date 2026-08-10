import { mockConductorRepository } from '../../shared/lib/mocks/mockConductorRepository';
import { supabaseHojaDeRutaRepository } from '../../shared/lib/hojas-de-ruta/SupabaseHojaDeRutaRepository';
import { supabasePacienteRepository } from '../../shared/lib/pacientes/SupabasePacienteRepository';
import { supabaseVehiculoRepository } from '../../shared/lib/vehiculos/SupabaseVehiculoRepository';
import { HojaDeRutaPage } from './HojaDeRutaPage';
import { HojaDeRutaRepositoryProvider } from './HojaDeRutaRepositoryContext';

// Único punto de composición que conoce los repositories de la feature. Swap parcial
// (design.md Checkpoint 0, opción A): Hoja de Ruta, Paciente y (desde `integracion-conductores-
// vehiculos` §5.9 "CORTE REAL 1") Vehículo son reales — se reusa el singleton
// `supabasePacienteRepository` de `integracion-pacientes` (mismo patrón que PacientesRoute.tsx),
// sin crear uno nuevo — porque su backend ya aterrizó. Conductor sigue en mock: a diferencia de
// Vehículo, no existe ninguna Edge Function `conductores` en `supabase/functions/` todavía (sin
// backend real que cablear, no una migración pendiente de aplicar) — ver design.md Checkpoint 0.
// `pacientes.recorrido.conductor_id` es UUID NOT NULL, así que crear un recorrido con un
// `conductorId` de mock (ej. `'conductor-perez'`) sigue rompiendo con `22P02 invalid input syntax
// for type uuid` hasta que eso se resuelva — mismo síntoma que tenía Vehículo antes de este swap,
// documentado, no un bug nuevo. El resto de la feature solo conoce las interfaces de los
// repositories. Los repositories de pacientes/vehículos/conductores se inyectan de solo lectura
// para los selectores (no se modifican, ver design.md Non-Goals).
export function HojaDeRutaRoute() {
  return (
    <HojaDeRutaRepositoryProvider repository={supabaseHojaDeRutaRepository}>
      <HojaDeRutaPage
        pacienteRepository={supabasePacienteRepository}
        vehiculoRepository={supabaseVehiculoRepository}
        conductorRepository={mockConductorRepository}
        desdeRepositoryReal
      />
    </HojaDeRutaRepositoryProvider>
  );
}