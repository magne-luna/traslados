import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { Conductor } from '../../shared/types/conductor';
import type { ConductorRepository } from '../../shared/lib/conductores/ConductorRepository';
import type { Cobro, Factura } from '../../shared/types/factura';
import type { CobroRepository } from '../../shared/lib/facturacion/CobroRepository';
import type { FacturaRepository } from '../../shared/lib/facturacion/FacturaRepository';
import type { HojaDeRuta } from '../../shared/types/hojaDeRuta';
import type { HojaDeRutaRepository } from '../../shared/lib/hojas-de-ruta/HojaDeRutaRepository';
import type { Paciente } from '../../shared/types/paciente';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
import type { Vehiculo } from '../../shared/types/vehiculo';
import type { VehiculoRepository } from '../../shared/lib/vehiculos/VehiculoRepository';
import { DashboardPage } from './DashboardPage';

// tasks.md 6.9, spec dashboard-composicion: compone cartel, panel del día, tarjetas y los dos
// paneles de reporte. tasks.md 5.7: garantía de solo lectura — ningún método de escritura de
// ningún repositorio se invoca al renderizar/interactuar con el dashboard completo.

const factura: Factura = {
  id: 'f1',
  pacienteId: 'p1',
  descripcion: '',
  dias: 10,
  valorKm: 100,
  monto: 1000,
  estado: 'facturado',
  fechaInicial: '2026-01-01',
  fechaTope: '2026-01-31',
  tipoComprobante: 'A',
  cantidadKm: 10,
  prestacion: 'Kinesiología',
  mesFacturado: 1,
  anioFacturado: 2026,
  dependenciaYRetorno: '',
  domicilioId: 'd1',
  asistencias: [],
};

const cobro: Cobro = { id: 'c1', facturaId: 'f1', fecha: '2026-01-15', montoPagado: 500 };

const paciente: Paciente = {
  id: 'p1',
  apellido: 'Pérez',
  nombre: 'Juana',
  fechaNacimiento: '2000-01-01',
  dni: '30111222',
  cuilTitular: '27301112223',
  diagnostico: '',
  accesorioMovilidad: [],
  obraSocialId: null,
  numeroAfiliado: { valor: '30111222' },
  cud: null,
  direcciones: [],
  personasACargo: [],
  amparoJudicial: false,
};

const vehiculo: Vehiculo = {
  id: 'v1',
  patente: 'AB123CD',
  modelo: 'Sprinter',
  tipo: 'combi',
  capacidad: 6,
  accesoriosCompatibles: [],
  estado: 'habilitado',
  kilometraje: 1000,
  kilometrajeUltimoService: 900,
  fechaUltimoService: '2026-07-01',
  habilitaciones: [],
  gastos: [],
  mantenimientos: [],
};

const conductor: Conductor = {
  id: 'c1',
  apellido: 'Gómez',
  nombre: 'Luis',
  documento: '1',
  domicilio: '',
  cuil: '1',
  estado: 'operando',
  asignaciones: [],
};

const hojaDeRuta: HojaDeRuta = { id: 'h1', fecha: new Date().toISOString().slice(0, 10), franjaInicio: '08:00', franjaFin: '20:00', recorridos: [] };

function buildRepositorios() {
  const facturaRepository: FacturaRepository = {
    list: vi.fn().mockResolvedValue([factura]),
    getById: vi.fn(),
    listByPaciente: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const cobroRepository: CobroRepository = {
    list: vi.fn().mockResolvedValue([cobro]),
    listByFactura: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  };
  const pacienteRepository: PacienteRepository = {
    list: vi.fn().mockResolvedValue([paciente]),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const vehiculoRepository: VehiculoRepository = {
    list: vi.fn().mockResolvedValue([vehiculo]),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const hojaDeRutaRepository: HojaDeRutaRepository = {
    list: vi.fn(),
    getById: vi.fn(),
    getByFecha: vi.fn().mockResolvedValue(hojaDeRuta),
    create: vi.fn(),
    update: vi.fn(),
  };
  const conductorRepository: ConductorRepository = {
    list: vi.fn().mockResolvedValue([conductor]),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  return { facturaRepository, cobroRepository, pacienteRepository, vehiculoRepository, hojaDeRutaRepository, conductorRepository };
}

describe('DashboardPage', () => {
  it('renderiza el cartel de discrepancias, el panel del día, las tarjetas y los dos reportes', async () => {
    const repos = buildRepositorios();
    render(
      <MemoryRouter>
        <DashboardPage {...repos} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.queryAllByText(/cargando/i)).toHaveLength(0));

    expect(screen.getByRole('note')).toBeInTheDocument();
    expect(screen.getByText(/recorridos de hoy/i)).toBeInTheDocument();
    expect(screen.getAllByText(/facturas en mora/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/facturado vs\. cobrado/i)).toBeInTheDocument();
    expect(screen.getByText(/resumen anual/i)).toBeInTheDocument();
  });

  it('garantía de solo lectura: no invoca ningún método de escritura de ningún repositorio', async () => {
    const repos = buildRepositorios();
    render(
      <MemoryRouter>
        <DashboardPage {...repos} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.queryAllByText(/cargando/i)).toHaveLength(0));

    expect(repos.facturaRepository.create).not.toHaveBeenCalled();
    expect(repos.facturaRepository.update).not.toHaveBeenCalled();
    expect(repos.cobroRepository.create).not.toHaveBeenCalled();
    expect(repos.cobroRepository.remove).not.toHaveBeenCalled();
    expect(repos.pacienteRepository.create).not.toHaveBeenCalled();
    expect(repos.pacienteRepository.update).not.toHaveBeenCalled();
    expect(repos.vehiculoRepository.create).not.toHaveBeenCalled();
    expect(repos.vehiculoRepository.update).not.toHaveBeenCalled();
    expect(repos.hojaDeRutaRepository.create).not.toHaveBeenCalled();
    expect(repos.hojaDeRutaRepository.update).not.toHaveBeenCalled();
    expect(repos.conductorRepository.create).not.toHaveBeenCalled();
    expect(repos.conductorRepository.update).not.toHaveBeenCalled();
  });

  // tasks.md 6.10: las tablas de reporte se desplazan dentro de su propio contenedor
  // (overflow-x-auto), nunca la página entera. jsdom no calcula layout real, así que se
  // verifica a nivel estructural: el contenedor con overflow-x-auto es el padre inmediato de
  // cada tabla ancha, y el contenedor raíz de la página no declara overflow-x-auto (no delega
  // el scroll horizontal a sí misma).
  it('las tablas de reporte se desplazan en su propio contenedor, no en la página', async () => {
    const repos = buildRepositorios();
    const { container } = render(
      <MemoryRouter>
        <DashboardPage {...repos} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.queryAllByText(/cargando/i)).toHaveLength(0));

    // ResumenAnualPanel siempre renderiza su tabla; FacturadoVsCobradoPanel solo si hay datos
    // en el rango de período seleccionado (puede no haberlos con los fixtures de este test).
    const tablas = screen.getAllByRole('table');
    expect(tablas.length).toBeGreaterThanOrEqual(1);
    for (const tabla of tablas) {
      expect(tabla.parentElement).toHaveClass('overflow-x-auto');
    }

    const raiz = container.firstElementChild;
    expect(raiz?.className).not.toMatch(/overflow-x-auto/);
  });
});
