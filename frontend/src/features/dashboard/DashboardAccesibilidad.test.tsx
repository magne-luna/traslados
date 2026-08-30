import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderConQuery } from '../../shared/test/queryWrapper';
import userEvent from '@testing-library/user-event';
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

// tasks.md 7.1/7.2, spec dashboard-composicion: navegación por teclado en orden lógico con foco
// visible (los controles no suprimen el outline nativo — ver reglasDuras.test.ts, que verifica
// que ningún componente usa `outline-none`/`ring-0`) y estructura semántica (cada panel es una
// región con su encabezado, y los valores numéricos están disponibles como texto, no solo como
// barra).

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

const hojaDeRuta: HojaDeRuta = {
  id: 'h1',
  fecha: new Date().toISOString().slice(0, 10),
  franjaInicio: '08:00',
  franjaFin: '20:00',
  recorridos: [],
};

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
    listCompleto: vi.fn().mockResolvedValue([]),
    listPage: vi.fn(),
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
    listPage: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  return { facturaRepository, cobroRepository, pacienteRepository, vehiculoRepository, hojaDeRutaRepository, conductorRepository };
}

async function renderPagina() {
  const repos = buildRepositorios();
  renderConQuery(
    <MemoryRouter>
      <DashboardPage {...repos} />
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.queryAllByText(/cargando/i)).toHaveLength(0));
}

describe('Dashboard: navegación por teclado (tasks.md 7.1)', () => {
  it('todos los controles interactivos son alcanzables por teclado en orden lógico', async () => {
    await renderPagina();
    const user = userEvent.setup();

    const periodo = screen.getByLabelText(/per[ií]odo/i);
    const anio = screen.getByLabelText(/a[ñn]o/i);
    const enlaces = screen.getAllByRole('link');

    // Todos los selects y enlaces son elementos nativos focalizables (select/a), sin
    // tabIndex negativo: alcanzables por teclado sin trucos de foco programático.
    expect(periodo.tabIndex).not.toBe(-1);
    expect(anio.tabIndex).not.toBe(-1);
    for (const enlace of enlaces) expect(enlace.tabIndex).not.toBe(-1);

    // El orden del DOM sigue el orden visual de la pantalla (cartel → recorridos → tarjetas
    // → facturado vs. cobrado → resumen anual), así que Tab en secuencia visita el selector
    // de período antes que el de año.
    await user.tab();
    let vueltas = 0;
    while (document.activeElement !== periodo && vueltas < 40) {
      await user.tab();
      vueltas += 1;
    }
    expect(document.activeElement).toBe(periodo);

    vueltas = 0;
    while (document.activeElement !== anio && vueltas < 40) {
      await user.tab();
      vueltas += 1;
    }
    expect(document.activeElement).toBe(anio);
  });
});

describe('Dashboard: estructura semántica (tasks.md 7.2)', () => {
  it('cada panel es una región con su propio encabezado', async () => {
    await renderPagina();
    const regiones = screen.getAllByRole('region');
    // Recorridos del día, facturado vs. cobrado y resumen anual usan <section
    // aria-labelledby>: cada una expone su encabezado como nombre accesible de la región.
    expect(regiones.length).toBeGreaterThanOrEqual(3);
    for (const region of regiones) {
      expect(region).toHaveAccessibleName();
    }
  });

  it('la información numérica está disponible como texto, no solo como barra', async () => {
    await renderPagina();
    // BarraCelda siempre acompaña la barra decorativa (aria-hidden) con el monto formateado
    // como texto plano — nunca solo el ancho de una barra.
    const celdas = screen.getAllByRole('cell');
    expect(celdas.length).toBeGreaterThan(0);
    expect(celdas.some((celda) => /\$/.test(celda.textContent ?? ''))).toBe(true);
  });
});
