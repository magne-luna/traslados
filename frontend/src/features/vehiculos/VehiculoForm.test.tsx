import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VehiculoForm, type VehiculoFormValues } from './VehiculoForm';

describe('VehiculoForm', () => {
  it('bloquea el guardado y señala patente/capacidad inválidos cuando se envía vacío', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<VehiculoForm onSubmit={onSubmit} onCancel={vi.fn()} />);

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

    render(<VehiculoForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^patente$/i), 'AC123DE');
    await user.type(screen.getByLabelText(/^modelo$/i), 'Toyota Etios');
    await user.click(screen.getByLabelText(/silla plegable/i));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[VehiculoFormValues]>({
      patente: 'AC123DE',
      modelo: 'Toyota Etios',
      tipo: '',
      capacidad: 4,
      kilometraje: 0,
      estado: 'habilitado',
      accesoriosCompatibles: ['silla-plegable'],
    });
  });

  it('precarga los valores iniciales en modo edición, incluyendo accesorios y estado', () => {
    render(
      <VehiculoForm
        initial={{
          patente: 'AC123DE',
          modelo: 'Toyota Etios',
          tipo: 'sedan',
          capacidad: 4,
          kilometraje: 85_000,
          estado: 'fuera-de-servicio',
          accesoriosCompatibles: ['silla-plegable', 'andador'],
        }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/^patente$/i)).toHaveValue('AC123DE');
    expect(screen.getByLabelText(/kilometraje/i)).toHaveValue(85_000);
    expect(screen.getByLabelText(/silla plegable/i)).toBeChecked();
    expect(screen.getByLabelText(/andador/i)).toBeChecked();
    expect(screen.getByLabelText(/silla rígida/i)).not.toBeChecked();
    expect(screen.getByLabelText(/fuera de servicio/i)).toBeChecked();
  });

  it('togglear accesorios agrega/quita del conjunto seleccionado (triangulación de selección múltiple)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<VehiculoForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^patente$/i), 'AC123DE');
    await user.click(screen.getByLabelText(/silla plegable/i));
    await user.click(screen.getByLabelText(/andador/i));
    await user.click(screen.getByLabelText(/silla plegable/i)); // destildar

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ accesoriosCompatibles: ['andador'] }));
  });

  it('el toggle de fuera de servicio persiste como estado en el submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<VehiculoForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^patente$/i), 'AC123DE');
    await user.click(screen.getByLabelText(/fuera de servicio/i));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ estado: 'fuera-de-servicio' }));
  });

  it('bloquea el guardado cuando el kilometraje ingresado es menor al mínimo registrado (RF-505)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <VehiculoForm
        initial={{
          patente: 'AC123DE',
          modelo: 'Toyota Etios',
          tipo: 'sedan',
          capacidad: 4,
          kilometraje: 85_000,
          estado: 'habilitado',
          accesoriosCompatibles: [],
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
    render(<VehiculoForm onSubmit={vi.fn()} onCancel={vi.fn()} submitError="La patente ya existe" />);

    expect(screen.getByText('La patente ya existe')).toBeInTheDocument();
    expect(screen.getByLabelText(/^patente$/i)).toBeInTheDocument();
  });

  it('dispara onCancel al hacer click en Cancelar', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(<VehiculoForm onSubmit={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
