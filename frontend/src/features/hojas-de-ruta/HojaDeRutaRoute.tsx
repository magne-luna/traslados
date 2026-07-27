import { mockConductorRepository } from '../../shared/lib/mocks/mockConductorRepository';
import { mockHojaDeRutaRepository } from '../../shared/lib/mocks/mockHojaDeRutaRepository';
import { mockPacienteRepository } from '../../shared/lib/mocks/mockPacienteRepository';
import { mockVehiculoRepository } from '../../shared/lib/mocks/mockVehiculoRepository';
import { HojaDeRutaPage } from './HojaDeRutaPage';
import { HojaDeRutaRepositoryProvider } from './HojaDeRutaRepositoryContext';

// Único punto de composición que conoce mockHojaDeRutaRepository, mockPacienteRepository,
// mockVehiculoRepository y mockConductorRepository (tasks.md 11.1, design.md Decisión 9): cuando
// exista SupabaseHojaDeRutaRepository (FE-8), este es el único archivo que cambia — el resto de
// la feature solo conoce las interfaces de los repositories. Los repositories de
// pacientes/vehículos/conductores se inyectan de solo lectura para los selectores (no se
// modifican, ver design.md Non-Goals).
export function HojaDeRutaRoute() {
  return (
    <HojaDeRutaRepositoryProvider repository={mockHojaDeRutaRepository}>
      <HojaDeRutaPage
        pacienteRepository={mockPacienteRepository}
        vehiculoRepository={mockVehiculoRepository}
        conductorRepository={mockConductorRepository}
      />
    </HojaDeRutaRepositoryProvider>
  );
}
