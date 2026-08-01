import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { ObraSocialForm, type ObraSocialFormValues } from './ObraSocialForm';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

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
      modalidadFacturacion: 'por-prestacion',
      admitePagosParciales: false,
      formatoAfiliado: 'numero-documento',
      // D9 (tasks.md 2.5/2.6): los 4 campos del docx no son obligatorios — un alta sin
      // completarlos se propaga con cadena vacía, nunca bloquea el submit.
      codigo: '',
      direccion: '',
      telefono: '',
      condicionIva: '',
    });
  });

  it('precarga los valores iniciales en modo edición (triangulación con modo alta)', () => {
    render(
      <ObraSocialForm
        initial={{
          nombre: 'OSECAC',
          cuit: '30-54155200-6',
          modalidadFacturacion: 'general',
          admitePagosParciales: true,
        }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/nombre/i)).toHaveValue('OSECAC');
    expect(screen.getByLabelText(/cuit/i)).toHaveValue('30-54155200-6');
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

// Los 4 campos del docx (tasks.md 2.6, D9): se renderizan, se editan y se propagan al submit.
describe('ObraSocialForm — los 4 campos del docx (2.6)', () => {
  it('se renderizan los 4 campos nuevos', () => {
    render(<ObraSocialForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/^código$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^dirección$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^teléfono$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/condición frente al iva/i)).toBeInTheDocument();
  });

  it('se editan y se propagan al submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<ObraSocialForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/nombre/i), 'Swiss Medical');
    await user.type(screen.getByLabelText(/cuit/i), '30-11111111-1');
    await user.type(screen.getByLabelText(/^código$/i), 'SM-01');
    await user.type(screen.getByLabelText(/^dirección$/i), 'Av. Corrientes 1234');
    await user.type(screen.getByLabelText(/^teléfono$/i), '11-4000-5000');
    await user.type(screen.getByLabelText(/condición frente al iva/i), 'Responsable Inscripto');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[ObraSocialFormValues]>(
      expect.objectContaining({
        codigo: 'SM-01',
        direccion: 'Av. Corrientes 1234',
        telefono: '11-4000-5000',
        condicionIva: 'Responsable Inscripto',
      }),
    );
  });

  it('precarga los 4 campos en modo edición cuando la obra social ya los tiene completos', () => {
    render(
      <ObraSocialForm
        initial={{
          nombre: 'OSECAC',
          cuit: '30-54155200-6',
          modalidadFacturacion: 'por-prestacion',
          admitePagosParciales: false,
          codigo: 'OS-01',
          direccion: 'Callao 100',
          telefono: '11-1111-2222',
          condicionIva: 'Exento',
        }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/^código$/i)).toHaveValue('OS-01');
    expect(screen.getByLabelText(/^dirección$/i)).toHaveValue('Callao 100');
    expect(screen.getByLabelText(/^teléfono$/i)).toHaveValue('11-1111-2222');
    expect(screen.getByLabelText(/condición frente al iva/i)).toHaveValue('Exento');
  });

  it('en modo edición sin los 4 campos completos, se precargan vacíos (no rompe con undefined)', () => {
    render(
      <ObraSocialForm
        initial={{
          nombre: 'OSECAC',
          cuit: '30-54155200-6',
          modalidadFacturacion: 'por-prestacion',
          admitePagosParciales: false,
        }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/^código$/i)).toHaveValue('');
    expect(screen.getByLabelText(/^dirección$/i)).toHaveValue('');
  });
});

// Gateo de escritura (gateo-obrasocial, tasks.md 4.3/4.4): los 6 campos y Guardar quedan
// bloqueados sin permiso `write`; Cancelar sobrevive siempre (design.md D4/riesgos — el
// envoltorio de solo lectura se aplica al bloque de campos, nunca a la barra de acciones).
describe('ObraSocialForm — gateo de escritura', () => {
  it('sin permiso de escritura: ninguno de los campos acepta entrada', async () => {
    const user = userEvent.setup();

    renderConPermiso(false, <ObraSocialForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/^nombre$/i)).toBeDisabled();
    expect(screen.getByLabelText(/cuit/i)).toBeDisabled();
    expect(screen.getByLabelText(/modalidad de facturación/i)).toBeDisabled();
    expect(screen.getByLabelText(/admite pagos parciales/i)).toBeDisabled();

    // toBeDisabled() ya cubre que el navegador no deja tipear, pero lo confirmamos por
    // comportamiento observable (D7): intentar escribir no cambia el valor.
    await user.type(screen.getByLabelText(/^nombre$/i), 'Intento bloqueado');
    expect(screen.getByLabelText(/^nombre$/i)).toHaveValue('');
  });

  it('sin permiso de escritura: Guardar no se puede activar', () => {
    renderConPermiso(false, <ObraSocialForm onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });

  it('con permiso de escritura: todos los campos aceptan entrada y Guardar está activable', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderConPermiso(true, <ObraSocialForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^nombre$/i), 'Swiss Medical');
    await user.type(screen.getByLabelText(/cuit/i), '30-11111111-1');
    expect(screen.getByRole('button', { name: /guardar/i })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /guardar/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('sin permiso de escritura: Cancelar sigue activable y dispara onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    renderConPermiso(false, <ObraSocialForm onSubmit={vi.fn()} onCancel={onCancel} />);

    const cancelar = screen.getByRole('button', { name: /cancelar/i });
    expect(cancelar).toBeEnabled();
    await user.click(cancelar);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
