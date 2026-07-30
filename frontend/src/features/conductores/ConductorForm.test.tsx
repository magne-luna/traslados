import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { ConductorForm } from './ConductorForm';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

// Formulario de alta/edición (tasks.md 5.2 a 5.6, 9.1, 9.3): datos personales, selector tipado
// de restricciones de perfil + observaciones, validación bloqueante, y los 2 cartelitos de
// "pendiente de confirmar" de la sección 9 de tasks.md (design.md Decisión 10).

describe('ConductorForm', () => {
  it('bloquea el guardado y señala los campos faltantes cuando apellido, nombre o documento están vacíos', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<ConductorForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/apellido es obligatorio/i)).toBeInTheDocument();
    expect(screen.getByText(/nombre es obligatorio/i)).toBeInTheDocument();
    expect(screen.getByText(/documento es obligatorio/i)).toBeInTheDocument();
  });

  it('llama a onSubmit con los valores cuando los campos obligatorios están completos (triangulación)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<ConductorForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/apellido/i), 'Pérez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Carlos');
    await user.type(screen.getByLabelText(/documento/i), '15789456');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ apellido: 'Pérez', nombre: 'Carlos', documento: '15789456' }),
    );
  });

  it('permite marcar una restricción de perfil documentada y la incluye en el submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<ConductorForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/apellido/i), 'Pérez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Carlos');
    await user.type(screen.getByLabelText(/documento/i), '15789456');
    await user.click(screen.getByLabelText(/no traslada pacientes con carga física/i));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ restricciones: ['no-carga-fisica'] }));
  });

  it('el toggle de fuera de servicio persiste como estado en el submit (mismo patrón que VehiculoForm)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<ConductorForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/apellido/i), 'Pérez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Carlos');
    await user.type(screen.getByLabelText(/documento/i), '15789456');
    await user.click(screen.getByLabelText(/fuera de servicio/i));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ estado: 'fuera-de-servicio' }));
  });

  it('llama a onSubmit con estado "operando" por default y domicilio/CUIL vacíos cuando no se completan (triangulación)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<ConductorForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/apellido/i), 'Pérez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Carlos');
    await user.type(screen.getByLabelText(/documento/i), '15789456');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ estado: 'operando', domicilio: '', cuil: '' }),
    );
  });

  it('carga domicilio y CUIL ingresados y los incluye en el submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<ConductorForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/apellido/i), 'Pérez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Carlos');
    await user.type(screen.getByLabelText(/documento/i), '15789456');
    await user.type(screen.getByLabelText(/domicilio/i), 'Calle 50 N° 1234, La Plata');
    await user.type(screen.getByLabelText(/cuil/i), '20-15789456-9');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ domicilio: 'Calle 50 N° 1234, La Plata', cuil: '20-15789456-9' }),
    );
  });

  it('no ofrece ningún campo de contraseña, email de acceso ni rol del sistema (RN-GL-03)', () => {
    render(<ConductorForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByLabelText(/contraseñ/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^email$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/rol/i)).not.toBeInTheDocument();
  });

  it('muestra el cartel de pendiente de confirmar sobre el catálogo de restricciones (tasks.md 9.1)', () => {
    render(<ConductorForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText(/pendiente de confirmar con el cliente: catálogo cerrado de restricciones/i)).toBeInTheDocument();
  });

  it('muestra el cartel de pendiente de confirmar sobre los datos mínimos del alta (tasks.md 9.3)', () => {
    render(<ConductorForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(
      screen.getByText(/pendiente de confirmar con el cliente: datos personales mínimos obligatorios del alta/i),
    ).toBeInTheDocument();
  });

  it('precarga los valores iniciales en edición', () => {
    render(
      <ConductorForm
        initial={{
          apellido: 'Pérez',
          nombre: 'Carlos',
          documento: '15789456',
          telefono: '',
          fechaNacimiento: '',
          domicilio: '',
          cuil: '',
          estado: 'operando',
          restricciones: ['no-carga-fisica'],
          observaciones: '',
        }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/apellido/i)).toHaveValue('Pérez');
    expect(screen.getByLabelText(/no traslada pacientes con carga física/i)).toBeChecked();
  });
});

// Gateo de escritura (gateo-conductores, design.md D4, tasks.md 2.3/2.4): el envoltorio de solo
// lectura cubre todos los campos (datos personales, restricciones, observaciones) con una única
// inserción; Guardar declara `requiereEscritura`, Cancelar queda fuera del envoltorio y sigue
// operativo siempre.
describe('ConductorForm — gateo de escritura', () => {
  it('sin permiso de escritura: ningún campo acepta entrada y Guardar no se puede activar', async () => {
    const user = userEvent.setup();

    renderConPermiso(false, <ConductorForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/apellido/i)).toBeDisabled();
    expect(screen.getByLabelText(/^nombre$/i)).toBeDisabled();
    expect(screen.getByLabelText(/documento/i)).toBeDisabled();
    expect(screen.getByLabelText(/cuil/i)).toBeDisabled();
    expect(screen.getByLabelText(/domicilio/i)).toBeDisabled();
    expect(screen.getByLabelText(/no traslada pacientes con carga física/i)).toBeDisabled();
    expect(screen.getByLabelText(/observaciones/i)).toBeDisabled();

    await user.type(screen.getByLabelText(/apellido/i), 'Intento bloqueado');
    expect(screen.getByLabelText(/apellido/i)).toHaveValue('');

    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });

  it('sin permiso de escritura: Guardar no dispara ninguna escritura al repositorio (onSubmit)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderConPermiso(false, <ConductorForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /guardar/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('con permiso de escritura: todos los campos aceptan entrada y Guardar guarda (triangulación)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderConPermiso(true, <ConductorForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/apellido/i)).toBeEnabled();

    await user.type(screen.getByLabelText(/apellido/i), 'Pérez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Carlos');
    await user.type(screen.getByLabelText(/documento/i), '15789456');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('sin permiso de escritura: Cancelar sigue activable y dispara onCancel, porque no persiste nada', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    renderConPermiso(false, <ConductorForm onSubmit={vi.fn()} onCancel={onCancel} />);

    const cancelar = screen.getByRole('button', { name: /cancelar/i });
    expect(cancelar).toBeEnabled();
    await user.click(cancelar);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// Rol admin sin filas de permisos (design.md D5): el short-circuit ya está probado de punta a
// punta en usePuedeEscribir.test.tsx — acá solo se confirma que ConductorForm consume ese
// resultado, mismo criterio que PacienteForm.test.tsx para el mismo escenario.
describe('ConductorForm — rol admin sin filas de permisos', () => {
  it('puedeEscribir true (equivalente al short-circuit de admin sin filas): el formulario queda plenamente editable y guardable', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderConPermiso(true, <ConductorForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/apellido/i), 'Pérez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Carlos');
    await user.type(screen.getByLabelText(/documento/i), '15789456');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
