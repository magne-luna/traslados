import { supabaseConductorRepository } from '../../shared/lib/conductores/SupabaseConductorRepository';
import { supabaseHojaDeRutaRepository } from '../../shared/lib/hojas-de-ruta/SupabaseHojaDeRutaRepository';
import { supabasePacienteRepository } from '../../shared/lib/pacientes/SupabasePacienteRepository';
import { supabaseVehiculoRepository } from '../../shared/lib/vehiculos/SupabaseVehiculoRepository';
import { HojaDeRutaPage } from './HojaDeRutaPage';
import { HojaDeRutaRepositoryProvider } from './HojaDeRutaRepositoryContext';

// Único punto de composición que conoce los repositories de la feature. Swap completo
// (design.md Checkpoint 0, opción A): Hoja de Ruta, Paciente, Vehículo (desde
// `integracion-conductores-vehiculos` §5.9 "CORTE REAL 1") y ahora también Conductor (§7.8
// "CORTE REAL 2", desbloqueada por 1B.11) son reales — se reusa el singleton
// `supabasePacienteRepository` de `integracion-pacientes` (mismo patrón que PacientesRoute.tsx),
// sin crear uno nuevo — porque su backend ya aterrizó. Este swap es el fix directo del bug que
// disparó la sesión de §7: `pacientes.recorrido.conductor_id` es UUID NOT NULL, y este archivo
// seguía inyectando `mockConductorRepository` (ids de mock tipo `'conductor-perez'`) contra un
// `SupabaseHojaDeRutaRepository` real, que rompía con `22P02 invalid input syntax for type
// uuid` — mismo síntoma que tuvo Vehículo antes de su propio swap (§5.9), ahora cerrado también
// acá. El resto de la feature solo conoce las interfaces de los repositories. Los repositories de
// pacientes/vehículos/conductores se inyectan de solo lectura para los selectores (no se
// modifican, ver design.md Non-Goals).
export function HojaDeRutaRoute() {
  return (
    <HojaDeRutaRepositoryProvider repository={supabaseHojaDeRutaRepository}>
      <HojaDeRutaPage
        pacienteRepository={supabasePacienteRepository}
        vehiculoRepository={supabaseVehiculoRepository}
        conductorRepository={supabaseConductorRepository}
        desdeRepositoryReal
      />
    </HojaDeRutaRepositoryProvider>
  );
}