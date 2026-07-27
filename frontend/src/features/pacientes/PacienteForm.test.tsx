import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ObraSocial } from '../../shared/types/obraSocial';
import { PacienteForm, type PacienteFormValues } from './PacienteForm';

const osecac: ObraSocial = {
  id: 'osecac',
  nombre: 'OSECAC',
  cuit: '30-54155200-6',
  plazoCobroDias: 90,
  tipoComprobante: 'A',
  modalidadFacturacion: 'por-prestacion',
  admitePagosParciales: false,
  checklist: [],
  plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
};

describe('PacienteForm', () => {
  it('bloquea el guardado y señala apellido/nombre/DNI faltantes al enviar vacío', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PacienteForm obrasSociales={[]} onSubmit={onSubmit} onCancel={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/el apellido es obligatorio/i)).toBeInTheDocument();
    expect(screen.getByText(/el nombre es obligatorio/i)).toBeInTheDocument();
    expect(screen.getByText(/el dni es obligatorio/i)).toBeInTheDocument();
  });

  it('llama a onSubmit con los valores completados usando el formato de afiliado por defecto', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PacienteForm obrasSociales={[]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^apellido$/i), 'Gómez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Martina');
    await user.type(screen.getByLabelText(/^dni$/i), '45123456');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[PacienteFormValues]>(
      expect.objectContaining({
        apellido: 'Gómez',
        nombre: 'Martina',
        dni: '45123456',
        numeroAfiliado: { formato: 'numero-documento', valor: '' },
        obraSocialId: null,
        accesorioMovilidad: [],
        amparoJudicial: false,
      }),
    );
  });

  it('la Condición se guarda como campo separado del Diagnóstico (opcional)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PacienteForm obrasSociales={[]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^apellido$/i), 'Gómez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Martina');
    await user.type(screen.getByLabelText(/^dni$/i), '45123456');
    await user.type(screen.getByLabelText(/diagnóstico/i), 'Parálisis cerebral');
    await user.type(screen.getByLabelText(/condición/i), 'Estable');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[PacienteFormValues]>(
      expect.objectContaining({ diagnostico: 'Parálisis cerebral', condicion: 'Estable' }),
    );
  });

  it('la Condición es opcional: se puede guardar sin completarla (triangulación)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PacienteForm obrasSociales={[]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^apellido$/i), 'Gómez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Martina');
    await user.type(screen.getByLabelText(/^dni$/i), '45123456');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0].condicion).toBeUndefined();
  });

  it('el segundo nombre es un campo opcional separado del nombre', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PacienteForm obrasSociales={[]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^apellido$/i), 'Gómez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Martina');
    await user.type(screen.getByLabelText(/segundo nombre/i), 'Sol');
    await user.type(screen.getByLabelText(/^dni$/i), '45123456');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[PacienteFormValues]>(
      expect.objectContaining({ nombre: 'Martina', segundoNombre: 'Sol' }),
    );
  });

  it('el segundo nombre queda sin completar si no se ingresa (triangulación)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PacienteForm obrasSociales={[]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^apellido$/i), 'Gómez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Martina');
    await user.type(screen.getByLabelText(/^dni$/i), '45123456');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0].segundoNombre).toBeUndefined();
  });

  it('el segundo apellido es un campo opcional separado del apellido', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PacienteForm obrasSociales={[]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^apellido$/i), 'Gómez');
    await user.type(screen.getByLabelText(/segundo apellido/i), 'Díaz');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Martina');
    await user.type(screen.getByLabelText(/^dni$/i), '45123456');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[PacienteFormValues]>(
      expect.objectContaining({ apellido: 'Gómez', segundoApellido: 'Díaz' }),
    );
  });

  it('el segundo apellido queda sin completar si no se ingresa (triangulación)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PacienteForm obrasSociales={[]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^apellido$/i), 'Gómez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Martina');
    await user.type(screen.getByLabelText(/^dni$/i), '45123456');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0].segundoApellido).toBeUndefined();
  });

  it('el select de obra social se puebla desde la lista recibida por props, no hardcodeada', () => {
    render(<PacienteForm obrasSociales={[osecac]} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('option', { name: 'OSECAC' })).toBeInTheDocument();
  });

  it('marcar amparo judicial revela el campo de aclaración', async () => {
    const user = userEvent.setup();

    render(<PacienteForm obrasSociales={[]} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByLabelText(/aclaración/i)).not.toBeInTheDocument();
    await user.click(screen.getByLabelText(/amparo judicial/i));
    expect(screen.getByLabelText(/aclaración/i)).toBeInTheDocument();
  });

  it('precarga los valores iniciales en modo edición', () => {
    render(
      <PacienteForm
        obrasSociales={[osecac]}
        initial={{
          apellido: 'Gómez',
          nombre: 'Martina',
          fechaNacimiento: '2015-03-12',
          dni: '45123456',
          cuilTitular: '27-30111222-4',
          diagnostico: 'Parálisis cerebral',
          accesorioMovilidad: ['silla-plegable', 'andador'],
          obraSocialId: 'osecac',
          numeroAfiliado: { formato: 'alfanumerico', valor: 'OS-1' },
          amparoJudicial: false,
        }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/^apellido$/i)).toHaveValue('Gómez');
    expect(screen.getByLabelText(/^dni$/i)).toHaveValue('45123456');
    expect(screen.getByLabelText(/silla plegable/i)).toBeChecked();
    expect(screen.getByLabelText(/andador/i)).toBeChecked();
    expect(screen.getByLabelText(/silla rígida/i)).not.toBeChecked();
  });

  it('muestra el error del repository sin ocultar el formulario', () => {
    render(<PacienteForm obrasSociales={[]} onSubmit={vi.fn()} onCancel={vi.fn()} submitError="DNI duplicado" />);

    expect(screen.getByText('DNI duplicado')).toBeInTheDocument();
    expect(screen.getByLabelText(/^apellido$/i)).toBeInTheDocument();
  });

  it('permite seleccionar más de un accesorio de movilidad (multi-selección, tabla de vínculo en el docx)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PacienteForm obrasSociales={[]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^apellido$/i), 'Gómez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Martina');
    await user.type(screen.getByLabelText(/^dni$/i), '45123456');
    await user.click(screen.getByLabelText(/silla plegable/i));
    await user.click(screen.getByLabelText(/andador/i));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[PacienteFormValues]>(
      expect.objectContaining({ accesorioMovilidad: ['silla-plegable', 'andador'] }),
    );
  });

  it('no tiene campo de teléfono alternativo (docx: pertenece a Personas a Cargo, no a Paciente)', () => {
    render(<PacienteForm obrasSociales={[]} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByLabelText(/teléfono/i)).not.toBeInTheDocument();
  });

  it('dispara onCancel al hacer click en Cancelar', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(<PacienteForm obrasSociales={[]} onSubmit={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
