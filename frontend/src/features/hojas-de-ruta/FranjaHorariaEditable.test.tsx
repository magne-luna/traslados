import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FranjaHorariaEditable } from './FranjaHorariaEditable';

// Andrea (2026-10-07): hay viajes programados al Garrahan a las 4-5 de la mañana y el último sale a
// las 20 — la franja tiene que poder cambiarse por día, no quedar fija en 08:00 a 20:00.
describe('FranjaHorariaEditable', () => {
  it('muestra la franja del día', () => {
    render(<FranjaHorariaEditable inicio="08:00" fin="20:00" onGuardar={vi.fn()} />);

    expect(screen.getByText('Franja 08:00 a 20:00')).toBeInTheDocument();
  });

  it('se edita y guarda inicio y fin nuevos', async () => {
    const user = userEvent.setup();
    const onGuardar = vi.fn().mockResolvedValue(undefined);
    render(<FranjaHorariaEditable inicio="08:00" fin="20:00" onGuardar={onGuardar} />);

    await user.click(screen.getByRole('button', { name: 'Editar franja horaria' }));
    await user.clear(screen.getByLabelText('Desde'));
    await user.type(screen.getByLabelText('Desde'), '04:30');
    await user.clear(screen.getByLabelText('Hasta'));
    await user.type(screen.getByLabelText('Hasta'), '21:00');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onGuardar).toHaveBeenCalledWith('04:30', '21:00');
    expect(await screen.findByText('Franja 08:00 a 20:00')).toBeInTheDocument();
  });

  it('no deja guardar si el inicio no es anterior al fin', async () => {
    const user = userEvent.setup();
    const onGuardar = vi.fn();
    render(<FranjaHorariaEditable inicio="08:00" fin="20:00" onGuardar={onGuardar} />);

    await user.click(screen.getByRole('button', { name: 'Editar franja horaria' }));
    await user.clear(screen.getByLabelText('Desde'));
    await user.type(screen.getByLabelText('Desde'), '21:00');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onGuardar).not.toHaveBeenCalled();
    expect(screen.getByText('El inicio tiene que ser anterior al fin.')).toBeInTheDocument();
  });

  it('Cancelar vuelve a mostrar la franja sin guardar', async () => {
    const user = userEvent.setup();
    const onGuardar = vi.fn();
    render(<FranjaHorariaEditable inicio="08:00" fin="20:00" onGuardar={onGuardar} />);

    await user.click(screen.getByRole('button', { name: 'Editar franja horaria' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onGuardar).not.toHaveBeenCalled();
    expect(screen.getByText('Franja 08:00 a 20:00')).toBeInTheDocument();
  });
});
