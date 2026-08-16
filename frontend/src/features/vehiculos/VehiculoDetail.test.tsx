import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Vehiculo } from '../../shared/types/vehiculo';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { AuthProvider } from '../../shared/auth/AuthContext';
import { createMockAuthRepository } from '../../shared/lib/auth/mockAuthRepository';
import { mockCatalogoAccesoriosRepository } from '../../shared/lib/mocks/mockCatalogoAccesoriosRepository';
import type { Usuario } from '../../shared/types/usuario';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { CatalogoAccesoriosRepositoryProvider } from '../pacientes/CatalogoAccesoriosRepositoryContext';
import { VehiculoDetail } from './VehiculoDetail';

const EMPLEADO: Usuario = { id: 'u2', nombre: 'Juan', apellido: 'Pérez', email: 'juan@x.com', rol: 'empleado' };

// VehiculoDetail compone VehiculoForm → AccesoriosMovilidadSelector (tasks.md 4.3): el wrapper
// provee auth (usePermiso), catálogo (repository del selector) y ruta (gateo de escritura).
function renderDetail(ui: React.ReactElement) {
  const authRepository = createMockAuthRepository({
    usuario: EMPLEADO,
    permisos: { vehiculos: 'write', pacientes: 'write' },
  });
  return render(
    <AuthProvider repository={authRepository}>
      <CatalogoAccesoriosRepositoryProvider repository={mockCatalogoAccesoriosRepository}>
        <PuedeEscribirContext.Provider value={true}>{ui}</PuedeEscribirContext.Provider>
      </CatalogoAccesoriosRepositoryProvider>
    </AuthProvider>,
  );
}

// GastosVehiculo y HistorialMantenimiento comparten labels ("Fecha") y texto de botón
// ("+ Registrar") — se escopea la query al form correspondiente por su encabezado, en vez de
// asumir que las labels son únicas en toda la pantalla.
function formCercaDe(texto: string): HTMLElement {
  const heading = screen.getByText(texto);
  const form = heading.closest('form');
  if (!form) throw new Error(`No se encontró el <form> cerca de "${texto}"`);
  return form as HTMLElement;
}

const etios: Vehiculo = {
  id: 'vehiculo-etios',
  patente: 'AC123DE',
  modelo: 'Toyota Etios',
  tipo: 'sedan',
  capacidad: 4,
  accesoriosCompatibles: ['silla-plegable'],
  estado: 'habilitado',
  kilometraje: 85_000,
  kilometrajeUltimoService: 82_000,
  fechaUltimoService: '2026-03-01',
  habilitaciones: [{ tipo: 'vtv', fechaEmision: '2026-01-01', fechaVencimiento: '2027-01-01' }],
  gastos: [],
  mantenimientos: [],
};

function buildFakeDocumentoRepository(): DocumentoRepository {
  return {
    listByEntity: vi.fn().mockResolvedValue([]),
    upload: vi.fn(),
    remove: vi.fn(),
    resolverPrevisualizacion: vi.fn().mockResolvedValue(null),
    transferirAgrupacion: vi.fn(),
  };
}

describe('VehiculoDetail — modo alta (vehiculo null)', () => {
  it('solo muestra el formulario general, sin mantenimiento, gastos ni documentos', () => {
    renderDetail(
      <VehiculoDetail
        vehiculo={null}
        crear={vi.fn()}
        actualizar={vi.fn()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/^patente$/i)).toBeInTheDocument();
    expect(screen.queryByText(/registrar gasto/i)).not.toBeInTheDocument();
  });

  it('al guardar, llama a crear() con los datos del form y avisa onCreated', async () => {
    const user = userEvent.setup();
    const creado = { ...etios, id: 'nuevo-1', patente: 'ZZ000ZZ' };
    const crear = vi.fn().mockResolvedValue(creado);
    const onCreated = vi.fn();

    renderDetail(
      <VehiculoDetail
        vehiculo={null}
        crear={crear}
        actualizar={vi.fn()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={onCreated}
        onBack={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/^patente$/i), 'ZZ000ZZ');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(crear).toHaveBeenCalledWith(expect.objectContaining({ patente: 'ZZ000ZZ', gastos: [], habilitaciones: [] }));
    expect(onCreated).toHaveBeenCalledWith(creado);
  });
});

describe('VehiculoDetail — modo edición', () => {
  it('por defecto muestra un resumen de solo lectura (sin form) junto con mantenimiento, gastos y documentos', async () => {
    renderDetail(
      <VehiculoDetail
        vehiculo={etios}
        crear={vi.fn()}
        actualizar={vi.fn()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getAllByText('AC123DE').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/^patente$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /editar datos/i })).toBeInTheDocument();
    expect(screen.getAllByText(/vtv/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/no hay gastos/i)).toBeInTheDocument();
    expect(await screen.findByText('Cédula')).toBeInTheDocument();
  });

  it('al apretar "Editar datos" muestra el form precargado', async () => {
    const user = userEvent.setup();

    renderDetail(
      <VehiculoDetail
        vehiculo={etios}
        crear={vi.fn()}
        actualizar={vi.fn()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar datos/i }));

    expect(screen.getByLabelText(/^patente$/i)).toHaveValue('AC123DE');
  });

  it('al guardar los datos generales, llama a actualizar(id, valores) y vuelve al resumen', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockResolvedValue(etios);

    renderDetail(
      <VehiculoDetail
        vehiculo={etios}
        crear={vi.fn()}
        actualizar={actualizar}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar datos/i }));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(actualizar).toHaveBeenCalledWith('vehiculo-etios', expect.objectContaining({ patente: 'AC123DE' }));
    expect(await screen.findByRole('button', { name: /editar datos/i })).toBeInTheDocument();
  });

  it('al registrar un gasto, persiste vía actualizar(id, { gastos })', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockResolvedValue(etios);

    renderDetail(
      <VehiculoDetail
        vehiculo={etios}
        crear={vi.fn()}
        actualizar={actualizar}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const gastoForm = within(formCercaDe('Registrar gasto'));
    await user.type(gastoForm.getByLabelText(/^fecha$/i), '2026-07-20');
    await user.type(gastoForm.getByLabelText(/monto/i), '5000');
    await user.click(gastoForm.getByRole('button', { name: /registrar/i }));

    expect(actualizar).toHaveBeenCalledWith('vehiculo-etios', {
      gastos: [expect.objectContaining({ fecha: '2026-07-20', monto: 5000 })],
    });
  });

  // Wiring del historial de mantenimiento (tasks.md 7.2/7.3, RF-507).
  it('al registrar una intervención de mantenimiento, persiste vía actualizar(id, { mantenimientos })', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockResolvedValue(etios);

    renderDetail(
      <VehiculoDetail
        vehiculo={etios}
        crear={vi.fn()}
        actualizar={actualizar}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const mantenimientoForm = within(formCercaDe('Registrar mantenimiento'));
    await user.selectOptions(mantenimientoForm.getByLabelText(/tipo de intervención/i), 'preventivo');
    await user.selectOptions(mantenimientoForm.getByLabelText(/sub-?tipo/i), 'cambio-aceite-filtros');
    await user.type(mantenimientoForm.getByLabelText(/^fecha$/i), '2026-07-20');
    await user.type(mantenimientoForm.getByLabelText(/^kilometraje$/i), '90000');
    await user.click(mantenimientoForm.getByRole('button', { name: /registrar/i }));

    expect(actualizar).toHaveBeenCalledWith('vehiculo-etios', {
      mantenimientos: [
        expect.objectContaining({
          tipoIntervencion: 'preventivo',
          subtipo: 'cambio-aceite-filtros',
          fecha: '2026-07-20',
          kilometraje: 90_000,
        }),
      ],
    });
  });

  it('muestra el error del repository si actualizar() del historial de mantenimiento falla', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockRejectedValue(new Error('no se pudo guardar el mantenimiento'));

    renderDetail(
      <VehiculoDetail
        vehiculo={etios}
        crear={vi.fn()}
        actualizar={actualizar}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const mantenimientoForm = within(formCercaDe('Registrar mantenimiento'));
    await user.selectOptions(mantenimientoForm.getByLabelText(/tipo de intervención/i), 'preventivo');
    await user.selectOptions(mantenimientoForm.getByLabelText(/sub-?tipo/i), 'vtv');
    await user.type(mantenimientoForm.getByLabelText(/^fecha$/i), '2026-07-20');
    await user.type(mantenimientoForm.getByLabelText(/^kilometraje$/i), '90000');
    await user.click(mantenimientoForm.getByRole('button', { name: /registrar/i }));

    expect(await screen.findByText('no se pudo guardar el mantenimiento')).toBeInTheDocument();
  });

  it('registrar una intervención de mantenimiento no cambia el chip de estado de service del resumen (Decisión 5)', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockResolvedValue(etios);

    renderDetail(
      <VehiculoDetail
        vehiculo={etios}
        crear={vi.fn()}
        actualizar={actualizar}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    // El texto de estado se repite (resumen colapsado + tarjeta de VehiculoMantenimiento) — se
    // comparan todas las ocurrencias, no una sola.
    const chipsAntes = screen.getAllByText(/vencido|se acerca|al día/i).map((el) => el.textContent);

    const mantenimientoForm = within(formCercaDe('Registrar mantenimiento'));
    await user.selectOptions(mantenimientoForm.getByLabelText(/tipo de intervención/i), 'preventivo');
    await user.selectOptions(mantenimientoForm.getByLabelText(/sub-?tipo/i), 'cambio-aceite-filtros');
    await user.type(mantenimientoForm.getByLabelText(/^fecha$/i), '2026-07-20');
    await user.type(mantenimientoForm.getByLabelText(/^kilometraje$/i), '90000');
    await user.click(mantenimientoForm.getByRole('button', { name: /registrar/i }));

    // actualizar() está mockeado y resuelve el mismo `etios` sin mutar — el chip de service se
    // sigue calculando de `vehiculo.kilometraje`/`kilometrajeUltimoService`/`fechaUltimoService`,
    // no del historial nuevo (design.md Decisión 5): no debe cambiar por registrar un evento.
    const chipsDespues = screen.getAllByText(/vencido|se acerca|al día/i).map((el) => el.textContent);
    expect(chipsDespues).toEqual(chipsAntes);
  });

  // C-08: la columna `conductores.vehiculo.notas` existe en la base y nacía NULL para siempre
  // porque el frontend no la modelaba (tasks.md 2.5).
  it('muestra las notas en la ficha cuando el vehículo las tiene', () => {
    renderDetail(
      <VehiculoDetail
        vehiculo={{ ...etios, notas: 'Aire acondicionado con pérdida.' }}
        crear={vi.fn()}
        actualizar={vi.fn()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText('Aire acondicionado con pérdida.')).toBeInTheDocument();
  });

  it('no renderiza ninguna sección de notas cuando el vehículo no las tiene (sin "—" inventado)', () => {
    renderDetail(
      <VehiculoDetail
        vehiculo={etios}
        crear={vi.fn()}
        actualizar={vi.fn()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('muestra el cartel de discrepancia de modelo de datos en la sección de Mantenimiento, acotado a lo que no se resolvió', () => {
    renderDetail(
      <VehiculoDetail
        vehiculo={etios}
        crear={vi.fn()}
        actualizar={vi.fn()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText(/habilitaciones.*viven en su propia tabla/i)).toBeInTheDocument();
    expect(screen.getByText(/kilometraje y el último service.*no derivados/i)).toBeInTheDocument();
  });

  it('muestra el error del repository si actualizar falla', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockRejectedValue(new Error('patente duplicada'));

    renderDetail(
      <VehiculoDetail
        vehiculo={etios}
        crear={vi.fn()}
        actualizar={actualizar}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar datos/i }));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText('patente duplicada')).toBeInTheDocument();
  });
});

// Gateo de escritura (gateo-conductores, tasks.md 3.2): "Editar datos" del resumen queda visible
// y deshabilitado sin permiso de escritura.
describe('VehiculoDetail — gateo de escritura', () => {
  it('sin permiso de escritura: "Editar datos" queda visible y no se puede activar', () => {
    renderDetail(
      <PuedeEscribirContext.Provider value={false}>
        <VehiculoDetail
          vehiculo={etios}
          crear={vi.fn()}
          actualizar={vi.fn()}
          documentoRepository={buildFakeDocumentoRepository()}
          onCreated={vi.fn()}
          onBack={vi.fn()}
        />
      </PuedeEscribirContext.Provider>,
    );

    const editar = screen.getByRole('button', { name: /editar datos/i });
    expect(editar).toBeVisible();
    expect(editar).toBeDisabled();
  });

  it('con permiso de escritura: "Editar datos" está activable (triangulación)', () => {
    renderDetail(
      <PuedeEscribirContext.Provider value={true}>
        <VehiculoDetail
          vehiculo={etios}
          crear={vi.fn()}
          actualizar={vi.fn()}
          documentoRepository={buildFakeDocumentoRepository()}
          onCreated={vi.fn()}
          onBack={vi.fn()}
        />
      </PuedeEscribirContext.Provider>,
    );

    expect(screen.getByRole('button', { name: /editar datos/i })).toBeEnabled();
  });
});
