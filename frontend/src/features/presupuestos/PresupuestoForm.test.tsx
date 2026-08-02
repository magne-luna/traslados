import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Paciente } from '../../shared/types/paciente';
import type { ObraSocial } from '../../shared/types/obraSocial';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { PresupuestoForm, type PresupuestoFormValues } from './PresupuestoForm';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

const martina: Paciente = {
  id: 'paciente-martina',
  apellido: 'Gómez',
  nombre: 'Martina',
  fechaNacimiento: '2015-03-12',
  dni: '45123456',
  cuilTitular: '27-30111222-4',
  diagnostico: 'Parálisis cerebral',
  accesorioMovilidad: [],
  obraSocialId: 'osecac',
  numeroAfiliado: { valor: '45123456' },
  cud: null,
  direcciones: [],
  personasACargo: [],
  amparoJudicial: false,
};

const osecac: ObraSocial = {
  id: 'osecac',
  nombre: 'OSECAC',
  cuit: '30-54155200-6',
  modalidadFacturacion: 'por-prestacion',
  admitePagosParciales: false,
  formatoAfiliado: 'numero-documento',
  checklist: [],
  plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
};

describe('PresupuestoForm', () => {
  it('bloquea el guardado y señala paciente/obra social/monto faltantes cuando se envía vacío', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PresupuestoForm pacientes={[martina]} obrasSociales={[osecac]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/el paciente es obligatorio/i)).toBeInTheDocument();
    expect(screen.getByText(/la obra social es obligatoria/i)).toBeInTheDocument();
    expect(screen.getByText(/el monto debe ser mayor a 0/i)).toBeInTheDocument();
  });

  it('el selector de paciente ofrece las opciones inyectadas por PacienteRepository', () => {
    render(<PresupuestoForm pacientes={[martina]} obrasSociales={[osecac]} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('option', { name: /gómez, martina/i })).toBeInTheDocument();
  });

  it('el selector de obra social ofrece las opciones inyectadas por ObraSocialRepository', () => {
    render(<PresupuestoForm pacientes={[martina]} obrasSociales={[osecac]} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('option', { name: 'OSECAC' })).toBeInTheDocument();
  });

  it('llama a onSubmit guardando solo los ids de paciente/obra social (no los objetos embebidos)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<PresupuestoForm pacientes={[martina]} obrasSociales={[osecac]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-martina');
    await user.selectOptions(screen.getByLabelText(/obra social/i), 'osecac');
    await user.type(screen.getByLabelText(/monto/i), '150000');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledWith<[PresupuestoFormValues]>(
      expect.objectContaining({ pacienteId: 'paciente-martina', obraSocialId: 'osecac', monto: 150_000 }),
    );
  });

  it('muestra el AvisoModeloDatos de archivo único (Discrepancia 1, NO multi-documento)', () => {
    render(<PresupuestoForm pacientes={[martina]} obrasSociales={[osecac]} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByRole('note')).toHaveTextContent(/un solo archivo/i);
  });

  it('el input de archivo es de un único archivo, no un checklist', () => {
    render(<PresupuestoForm pacientes={[martina]} obrasSociales={[osecac]} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    const input = screen.getByLabelText(/archivo/i) as HTMLInputElement;
    expect(input.type).toBe('file');
    expect(input.multiple).toBe(false);
  });

  it('precarga los valores iniciales en modo edición', () => {
    render(
      <PresupuestoForm
        pacientes={[martina]}
        obrasSociales={[osecac]}
        initial={{ pacienteId: 'paciente-martina', obraSocialId: 'osecac', monto: 150_000, fechaEmision: '2026-06-01' }}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/paciente/i)).toHaveValue('paciente-martina');
    expect(screen.getByLabelText(/obra social/i)).toHaveValue('osecac');
    expect(screen.getByLabelText(/monto/i)).toHaveValue(150_000);
  });

  it('muestra el error del repository sin ocultar el formulario', () => {
    render(
      <PresupuestoForm
        pacientes={[martina]}
        obrasSociales={[osecac]}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        submitError="No se pudo guardar"
      />,
    );

    expect(screen.getByText('No se pudo guardar')).toBeInTheDocument();
    expect(screen.getByLabelText(/paciente/i)).toBeInTheDocument();
  });

  it('dispara onCancel al hacer click en Cancelar', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(<PresupuestoForm pacientes={[martina]} obrasSociales={[osecac]} onSubmit={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// Gateo de escritura (gateo-facturacion, tasks.md 2.3/2.4, design.md D3). Un único envoltorio
// cubre todo el bloque de campos; Guardar declara `requiereEscritura`; Cancelar queda fuera del
// envoltorio y sigue operativo siempre (mismo criterio que PacienteForm/gateo-pacientes).
describe('PresupuestoForm — gateo de escritura', () => {
  it('sin permiso de escritura: ningún campo acepta entrada', async () => {
    const user = userEvent.setup();

    renderConPermiso(false, <PresupuestoForm pacientes={[martina]} obrasSociales={[osecac]} onSubmit={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/paciente/i)).toBeDisabled();
    expect(screen.getByLabelText(/obra social/i)).toBeDisabled();
    expect(screen.getByLabelText(/monto/i)).toBeDisabled();
    expect(screen.getByLabelText(/fecha de emisión/i)).toBeDisabled();
    expect(screen.getByLabelText(/archivo/i)).toBeDisabled();

    await user.type(screen.getByLabelText(/monto/i), '5');
    expect(screen.getByLabelText(/monto/i)).toHaveValue(0);
  });

  it('sin permiso de escritura: Guardar no se puede activar y el repositorio (onSubmit) no recibe ninguna llamada', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderConPermiso(false, <PresupuestoForm pacientes={[martina]} obrasSociales={[osecac]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    const guardar = screen.getByRole('button', { name: /guardar/i });
    expect(guardar).toBeDisabled();
    await user.click(guardar);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('con permiso de escritura: todo editable y guardable (triangulación)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    renderConPermiso(true, <PresupuestoForm pacientes={[martina]} obrasSociales={[osecac]} onSubmit={onSubmit} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(/paciente/i)).toBeEnabled();

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-martina');
    await user.selectOptions(screen.getByLabelText(/obra social/i), 'osecac');
    await user.type(screen.getByLabelText(/monto/i), '150000');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('sin permiso de escritura: Cancelar sigue activable y dispara onCancel, y el formulario se cierra', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    renderConPermiso(false, <PresupuestoForm pacientes={[martina]} obrasSociales={[osecac]} onSubmit={vi.fn()} onCancel={onCancel} />);

    const cancelar = screen.getByRole('button', { name: /cancelar/i });
    expect(cancelar).toBeEnabled();
    await user.click(cancelar);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
