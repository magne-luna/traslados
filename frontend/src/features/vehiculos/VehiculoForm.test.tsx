import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider } from '../../shared/auth/AuthContext';
import { createMockAuthRepository } from '../../shared/lib/auth/mockAuthRepository';
import { mockCatalogoAccesoriosRepository } from '../../shared/lib/mocks/mockCatalogoAccesoriosRepository';
import type { Usuario } from '../../shared/types/usuario';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { CatalogoAccesoriosRepositoryProvider } from '../pacientes/CatalogoAccesoriosRepositoryContext';
import { VehiculoForm, type VehiculoFormValues } from './VehiculoForm';

const EMPLEADO: Usuario = { id: 'u2', nombre: 'Juan', apellido: 'Pérez', email: 'juan@x.com', rol: 'empleado' };

// El form ahora compone <AccesoriosMovilidadSelector> (tasks.md 4.3), que usa
// usePermiso('pacientes','write') y el repository del catálogo — el wrapper provee los tres
// contextos necesarios (auth para usePermiso, catálogo para el selector, ruta para el gateo).
function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  const authRepository = createMockAuthRepository({
    usuario: EMPLEADO,
    permisos: {
      vehiculos: puedeEscribir ? 'write' : 'read',
      pacientes: puedeEscribir ? 'write' : 'read',
    },
  });
  return render(
    <AuthProvider repository={authRepository}>
      <CatalogoAccesoriosRepositoryProvider repository={mockCatalogoAccesoriosRepository}>
        <PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>
      </CatalogoAccesoriosRepositoryProvider>
    </AuthProvider>,
  );
}

function renderForm(ui: React.ReactElement) {
  return renderConPermiso(true, ui);
}

describe('VehiculoForm', () => {
  it('bloquea el guardado y señala patente/capacidad inválidos cuando se envía vacío', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderForm(<VehiculoForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.clear(screen.getByLabelText(/capacidad/i));
    await user.type(screen.getByLabelText(/capacidad/i), '0');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/la patente es obligatoria/i)).toBeInTheDocument();
    expect(screen.getByText(/la capacidad debe estar entre/i)).toBeInTheDocument();
  });

  it('llama a onSubmit con los valores completados (alta) usando los defaults documentados', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderForm(<VehiculoForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^patente$/i), 'AC123DE');
    await user.type(screen.getByLabelText(/^modelo$/i), 'Toyota Etios');
    await user.click(await screen.findByRole('checkbox', { name: /silla plegable/i }));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[VehiculoFormValues]>({
      patente: 'AC123DE',
      modelo: 'Toyota Etios',
      tipo: '',
      capacidad: 4,
      kilometraje: 0,
      estado: 'habilitado',
      accesoriosCompatibles: ['silla-plegable'],
      notas: '',
    });
  });

  // C-08: la columna `conductores.vehiculo.notas` existe en la base y nacía NULL para siempre
  // porque el frontend no la modelaba (tasks.md 2.4).
  it('carga notas y las incluye en el submit (C-08)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderForm(<VehiculoForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^patente$/i), 'AC123DE');
    await user.type(screen.getByLabelText(/notas/i), 'Aire acondicionado con pérdida.');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ notas: 'Aire acondicionado con pérdida.' }),
    );
  });

it('precarga los valores iniciales en modo edición, incluyendo accesorios, estado y notas', async () => {
    renderForm(
      <VehiculoForm
        initial={{
          patente: 'AC123DE',
          modelo: 'Toyota Etios',
          tipo: 'sedan',
          capacidad: 4,
          kilometraje: 85_000,
          estado: 'fuera-de-servicio',
          accesoriosCompatibles: ['silla-plegable', 'andador'],
          notas: 'Aire acondicionado con pérdida.',
        }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/^patente$/i)).toHaveValue('AC123DE');
    expect(screen.getByLabelText(/kilometraje/i)).toHaveValue(85_000);
    expect(await screen.findByRole('checkbox', { name: /silla plegable/i })).toBeChecked();
    expect(await screen.findByRole('checkbox', { name: /andador/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /silla rígida/i })).not.toBeChecked();
    expect(screen.getByLabelText(/fuera de servicio/i)).toBeChecked();
    expect(screen.getByLabelText(/notas/i)).toHaveValue('Aire acondicionado con pérdida.');
  });

  it('togglear accesorios agrega/quita del conjunto seleccionado (triangulación de selección múltiple)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderForm(<VehiculoForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^patente$/i), 'AC123DE');
    await user.click(await screen.findByRole('checkbox', { name: /silla plegable/i }));
    await user.click(await screen.findByRole('checkbox', { name: /andador/i }));
    await user.click(screen.getByRole('checkbox', { name: /silla plegable/i })); // destildar

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ accesoriosCompatibles: ['andador'] }));
  });

  it('el toggle de fuera de servicio persiste como estado en el submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderForm(<VehiculoForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^patente$/i), 'AC123DE');
    await user.click(screen.getByLabelText(/fuera de servicio/i));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ estado: 'fuera-de-servicio' }));
  });

  it('bloquea el guardado cuando el kilometraje ingresado es menor al mínimo registrado (RF-505)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderForm(
      <VehiculoForm
        initial={{
          patente: 'AC123DE',
          modelo: 'Toyota Etios',
          tipo: 'sedan',
          capacidad: 4,
          kilometraje: 85_000,
          estado: 'habilitado',
          accesoriosCompatibles: [],
          notas: '',
        }}
        kilometrajeMinimo={85_000}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    await user.clear(screen.getByLabelText(/kilometraje/i));
    await user.type(screen.getByLabelText(/kilometraje/i), '80000');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/el kilometraje no puede ser menor/i)).toBeInTheDocument();
  });

  it('muestra el error del repository sin ocultar el formulario', () => {
    renderForm(<VehiculoForm onSubmit={vi.fn()} onCancel={vi.fn()} submitError="La patente ya existe" />);

    expect(screen.getByText('La patente ya existe')).toBeInTheDocument();
    expect(screen.getByLabelText(/^patente$/i)).toBeInTheDocument();
  });

  it('dispara onCancel al hacer click en Cancelar', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    renderForm(<VehiculoForm onSubmit={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// Gateo de escritura (gateo-conductores, design.md D4, tasks.md 3.3/3.4): una sola inserción
// cubre todos los campos; Guardar declara `requiereEscritura`; Cancelar queda fuera y sigue
// operativo siempre.
describe('VehiculoForm — gateo de escritura', () => {
  it('sin permiso de escritura: ningún campo acepta entrada y Guardar no se puede activar, sin escrituras al repositorio', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderConPermiso(false, <VehiculoForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/^patente$/i)).toBeDisabled();
    expect(screen.getByLabelText(/^modelo$/i)).toBeDisabled();
    expect(screen.getByLabelText(/capacidad/i)).toBeDisabled();
    expect(screen.getByLabelText(/kilometraje/i)).toBeDisabled();
    expect(await screen.findByRole('checkbox', { name: /silla plegable/i })).toBeDisabled();
    expect(screen.getByLabelText(/fuera de servicio/i)).toBeDisabled();
    expect(screen.getByLabelText(/notas/i)).toBeDisabled();

    await user.type(screen.getByLabelText(/^patente$/i), 'Intento bloqueado');
    expect(screen.getByLabelText(/^patente$/i)).toHaveValue('');

    const guardar = screen.getByRole('button', { name: /guardar/i });
    expect(guardar).toBeDisabled();
    await user.click(guardar);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('con permiso de escritura: todos los campos aceptan entrada y Guardar guarda (triangulación)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderConPermiso(true, <VehiculoForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/^patente$/i)).toBeEnabled();

    await user.type(screen.getByLabelText(/^patente$/i), 'AC123DE');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('sin permiso de escritura: Cancelar sigue activable y dispara onCancel, porque no persiste nada', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    renderConPermiso(false, <VehiculoForm onSubmit={vi.fn()} onCancel={onCancel} />);

    const cancelar = screen.getByRole('button', { name: /cancelar/i });
    expect(cancelar).toBeEnabled();
    await user.click(cancelar);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// Rol admin sin filas de permisos (design.md D5).
describe('VehiculoForm — rol admin sin filas de permisos', () => {
  it('puedeEscribir true (equivalente al short-circuit de admin sin filas): el formulario queda plenamente editable y guardable', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderConPermiso(true, <VehiculoForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^patente$/i), 'AC123DE');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
