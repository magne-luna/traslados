import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConductorForm } from './ConductorForm';

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
