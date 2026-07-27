import { mockCobroRepository } from '../../shared/lib/mocks/mockCobroRepository';
import { mockConductorRepository } from '../../shared/lib/mocks/mockConductorRepository';
import { mockFacturaRepository } from '../../shared/lib/mocks/mockFacturaRepository';
import { mockHojaDeRutaRepository } from '../../shared/lib/mocks/mockHojaDeRutaRepository';
import { mockPacienteRepository } from '../../shared/lib/mocks/mockPacienteRepository';
import { mockVehiculoRepository } from '../../shared/lib/mocks/mockVehiculoRepository';
import { DashboardPage } from './DashboardPage';

// tasks.md 5.6, design.md Decisión 9 (y el gap documentado en useConductoresDashboard.ts):
// composition root que inyecta los seis repositorios mock de solo lectura (Factura, Cobro,
// Paciente, Vehiculo, HojaDeRuta y Conductor) y renderiza DashboardPage. Ningún componente hijo
// importa nada de shared/lib/mocks/ — solo este archivo los conoce, mismo patrón que
// HojaDeRutaRoute. Cuando exista el repositorio real de Supabase (FE-8), este es el único
// archivo que cambia.
export function DashboardRoute() {
  return (
    <DashboardPage
      facturaRepository={mockFacturaRepository}
      cobroRepository={mockCobroRepository}
      pacienteRepository={mockPacienteRepository}
      vehiculoRepository={mockVehiculoRepository}
      hojaDeRutaRepository={mockHojaDeRutaRepository}
      conductorRepository={mockConductorRepository}
    />
  );
}
