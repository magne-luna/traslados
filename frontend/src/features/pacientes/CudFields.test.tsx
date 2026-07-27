import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Cud } from '../../shared/types/paciente';
import { CudFields } from './CudFields';

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
