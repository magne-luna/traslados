import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Cud } from '../../shared/types/paciente';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { CudFields } from './CudFields';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

describe('CudFields', () => {
  it('cuando no hay CUD cargado, muestra la acción de agregarlo en vez de los campos', () => {
    render(<CudFields value={null} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /agregar cud/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/vencimiento/i)).not.toBeInTheDocument();
  });

  it('con un CUD cargado, se muestra de solo lectura (sin inputs) hasta que se toca Editar', () => {
    const cud: Cud = { numero: 'CUD-001', fechaEmision: '2020-01-01', fechaVencimiento: '2026-09-01' };
    render(<CudFields value={cud} onChange={vi.fn()} />);

    expect(screen.getByText('CUD-001')).toBeInTheDocument();
    expect(screen.queryByLabelText(/número/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/vencimiento/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^editar$/i })).toBeInTheDocument();
  });

  it('agregar CUD revela el form editable sin persistir nada hasta Guardar', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<CudFields value={null} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /agregar cud/i }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/número/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/número/i), 'CUD-2026-01');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onChange).toHaveBeenCalledWith({ numero: 'CUD-2026-01', fechaEmision: '', fechaVencimiento: '' });
  });

  it('editar un CUD existente precarga sus valores y solo persiste al Guardar (conserva lo no tocado)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const cud: Cud = { numero: 'CUD-001', fechaEmision: '2020-01-01', fechaVencimiento: '' };

    render(<CudFields value={cud} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /^editar$/i }));

    expect(onChange).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(/vencimiento/i), '2026-09-01');
    expect(onChange).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onChange).toHaveBeenCalledWith({ numero: 'CUD-001', fechaEmision: '2020-01-01', fechaVencimiento: '2026-09-01' });
  });

  it('cancelar la edición descarta los cambios locales y vuelve a solo lectura', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const cud: Cud = { numero: 'CUD-001', fechaEmision: '2020-01-01', fechaVencimiento: '2026-09-01' };

    render(<CudFields value={cud} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /^editar$/i }));
    await user.type(screen.getByLabelText(/número/i), 'X');
    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('CUD-001')).toBeInTheDocument();
  });

  it('quitar CUD limpia el valor a null directo desde la vista de solo lectura', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const cud: Cud = { numero: 'CUD-001', fechaEmision: '2020-01-01', fechaVencimiento: '2026-09-01' };

    render(<CudFields value={cud} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /quitar cud/i }));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});

// Gateo de escritura (gateo-pacientes, design.md D2, tasks.md 4.1/4.2). CudFields cuelga de
// PacienteDetail (no de PacienteForm) y tiene su propio mini-ciclo de edición — cada Button
// declara `requiereEscritura` por separado (no hay un único fieldset natural: las 3 vistas son
// returns mutuamente excluyentes). El Cancelar de la edición interna es la única excepción: no
// persiste nada y NUNCA lleva `requiereEscritura` (design.md D2 — el punto más fácil de gatear
// de más de todo el change).
describe('CudFields — gateo de escritura', () => {
  it('sin permiso de escritura: "Agregar CUD" (alta) queda visible y no se puede activar', () => {
    renderConPermiso(false, <CudFields value={null} onChange={vi.fn()} />);

    const agregar = screen.getByRole('button', { name: /agregar cud/i });
    expect(agregar).toBeVisible();
    expect(agregar).toBeDisabled();
  });

  it('sin permiso de escritura: "Editar" y "Quitar CUD" quedan visibles y no se pueden activar, y los datos del CUD siguen legibles', () => {
    const cud: Cud = { numero: 'CUD-001', fechaEmision: '2020-01-01', fechaVencimiento: '2026-09-01' };
    renderConPermiso(false, <CudFields value={cud} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /^editar$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /quitar cud/i })).toBeDisabled();
    // Los datos siguen siendo legibles con solo `read` (design.md Goals).
    expect(screen.getByText('CUD-001')).toBeInTheDocument();
  });

  it('con permiso de escritura: "Agregar CUD", "Editar" y "Quitar CUD" están activables (triangulación)', () => {
    const cud: Cud = { numero: 'CUD-001', fechaEmision: '2020-01-01', fechaVencimiento: '2026-09-01' };
    renderConPermiso(true, <CudFields value={cud} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /^editar$/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /quitar cud/i })).toBeEnabled();
  });

  it('sin permiso de escritura: "Guardar" no se puede activar dentro del form de edición', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const cud: Cud = { numero: 'CUD-001', fechaEmision: '2020-01-01', fechaVencimiento: '2026-09-01' };

    // Se llega al form de edición con escritura habilitada y luego cambia el permiso (mismo
    // patrón que un cambio de matriz a mitad de sesión) — es la única forma de alcanzar ese
    // estado interno para afirmar sobre "Guardar" sin poder clickear un "Editar" ya deshabilitado.
    const { rerender } = renderConPermiso(true, <CudFields value={cud} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /^editar$/i }));

    rerender(
      <PuedeEscribirContext.Provider value={false}>
        <CudFields value={cud} onChange={onChange} />
      </PuedeEscribirContext.Provider>,
    );

    expect(screen.getByRole('button', { name: /guardar/i })).toBeDisabled();
  });

  it('sin permiso de escritura: el Cancelar de la edición interna sigue activable, porque no persiste nada', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const cud: Cud = { numero: 'CUD-001', fechaEmision: '2020-01-01', fechaVencimiento: '2026-09-01' };

    const { rerender } = renderConPermiso(true, <CudFields value={cud} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /^editar$/i }));

    rerender(
      <PuedeEscribirContext.Provider value={false}>
        <CudFields value={cud} onChange={onChange} />
      </PuedeEscribirContext.Provider>,
    );

    const cancelar = screen.getByRole('button', { name: /cancelar/i });
    expect(cancelar).toBeEnabled();
    await user.click(cancelar);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText('CUD-001')).toBeInTheDocument();
  });

  it('con permiso de escritura: el Cancelar de la edición interna también está activable (triangulación)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const cud: Cud = { numero: 'CUD-001', fechaEmision: '2020-01-01', fechaVencimiento: '2026-09-01' };

    renderConPermiso(true, <CudFields value={cud} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /^editar$/i }));

    const cancelar = screen.getByRole('button', { name: /cancelar/i });
    expect(cancelar).toBeEnabled();
    await user.click(cancelar);
    expect(screen.getByText('CUD-001')).toBeInTheDocument();
  });
});
