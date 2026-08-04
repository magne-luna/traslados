import { mockConductorRepository } from '../../shared/lib/mocks/mockConductorRepository';
import { mockVehiculoRepository } from '../../shared/lib/mocks/mockVehiculoRepository';
import { supabaseHojaDeRutaRepository } from '../../shared/lib/hojas-de-ruta/SupabaseHojaDeRutaRepository';
import { supabasePacienteRepository } from '../../shared/lib/pacientes/SupabasePacienteRepository';
import { HojaDeRutaPage } from './HojaDeRutaPage';
import { HojaDeRutaRepositoryProvider } from './HojaDeRutaRepositoryContext';

// Único punto de composición que conoce los repositories de la feature. Swap parcial
// (design.md Checkpoint 0, opción A): Hoja de Ruta y Paciente son reales — se reusa el singleton
// `supabasePacienteRepository` de `integracion-pacientes` (mismo patrón que PacientesRoute.tsx),
// sin crear uno nuevo — porque su backend ya aterrizó. Vehículo y Conductor siguen en mock hasta
// que `integracion-conductores-vehiculos` aterrice sus repositories reales; es una transición
// documentada, no un estado final: cuando eso pase, este es el único archivo que cambia (cambiar
// dos imports), sin tocar HojaDeRutaPage ni el repository real. El resto de la feature solo conoce
// las interfaces de los repositories. Los repositories de pacientes/vehículos/conductores se
// inyectan de solo lectura para los selectores (no se modifican, ver design.md Non-Goals).
export function HojaDeRutaRoute() {
  return (
    <HojaDeRutaRepositoryProvider repository={supabaseHojaDeRutaRepository}>
      <HojaDeRutaPage
        pacienteRepository={supabasePacienteRepository}
        vehiculoRepository={mockVehiculoRepository}
        conductorRepository={mockConductorRepository}
      />
    </HojaDeRutaRepositoryProvider>
  );
}