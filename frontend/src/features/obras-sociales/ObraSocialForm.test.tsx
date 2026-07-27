import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ObraSocialForm, type ObraSocialFormValues } from './ObraSocialForm';

describe('ObraSocialForm', () => {
  it('bloquea el guardado y señala nombre/CUIT faltantes cuando se envía vacío', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<ObraSocialForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/el nombre es obligatorio/i)).toBeInTheDocument();
    expect(screen.getByText(/el cuit es obligatorio/i)).toBeInTheDocument();
  });

  it('llama a onSubmit con los valores completados (alta) usando los defaults documentados', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<ObraSocialForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/nombre/i), 'Swiss Medical');
    await user.type(screen.getByLabelText(/cuit/i), '30-11111111-1');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[ObraSocialFormValues]>({
      nombre: 'Swiss Medical',
      cuit: '30-11111111-1',
      plazoCobroDias: 90,
      tipoComprobante: 'A',
      modalidadFacturacion: 'por-prestacion',
      admitePagosParciales: false,
    });
  });

  it('precarga los valores iniciales en modo edición (triangulación con modo alta)', () => {
    render(
      <ObraSocialForm
        initial={{
          nombre: 'OSECAC',
          cuit: '30-54155200-6',
          plazoCobroDias: 45,
          tipoComprobante: 'B',
          modalidadFacturacion: 'general',
          admitePagosParciales: true,
        }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/nombre/i)).toHaveValue('OSECAC');
    expect(screen.getByLabelText(/cuit/i)).toHaveValue('30-54155200-6');
    expect(screen.getByLabelText(/plazo de cobro/i)).toHaveValue(45);
    expect(screen.getByLabelText(/admite pagos parciales/i)).toBeChecked();
  });

  it('muestra el error del repository sin ocultar el formulario', () => {
    render(<ObraSocialForm onSubmit={vi.fn()} onCancel={vi.fn()} submitError="El nombre ya existe" />);

    expect(screen.getByText('El nombre ya existe')).toBeInTheDocument();
    expect(screen.getByLabelText(/nombre/i)).toBeInTheDocument();
  });

  it('dispara onCancel al hacer click en Cancelar', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(<ObraSocialForm onSubmit={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
