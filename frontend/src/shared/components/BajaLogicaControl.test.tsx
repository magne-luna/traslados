import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BajaLogicaControl } from './BajaLogicaControl';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('BajaLogicaControl', () => {
  it('activo: ofrece Inactivar y, confirmado, pide pasar a activo = false', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onCambiar = vi.fn().mockResolvedValue(undefined);
    render(<BajaLogicaControl activo entidad="paciente" onCambiar={onCambiar} />);

    await userEvent.click(screen.getByRole('button', { name: 'Inactivar paciente' }));

    expect(onCambiar).toHaveBeenCalledWith(false);
    expect(screen.queryByText('Inactivo')).not.toBeInTheDocument();
  });

  it('si se cancela la confirmación no cambia nada', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onCambiar = vi.fn();
    render(<BajaLogicaControl activo entidad="paciente" onCambiar={onCambiar} />);

    await userEvent.click(screen.getByRole('button', { name: 'Inactivar paciente' }));

    expect(onCambiar).not.toHaveBeenCalled();
  });

  it('inactivo: muestra el chip y Reactivar sin pedir confirmación', async () => {
    const confirmar = vi.spyOn(window, 'confirm');
    const onCambiar = vi.fn().mockResolvedValue(undefined);
    render(<BajaLogicaControl activo={false} entidad="obra social" onCambiar={onCambiar} />);

    expect(screen.getByText('Inactiva')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reactivar obra social' }));

    expect(confirmar).not.toHaveBeenCalled();
    expect(onCambiar).toHaveBeenCalledWith(true);
  });

  it('muestra el error si el guardado falla', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onCambiar = vi.fn().mockRejectedValue(new Error('Sin conexión'));
    render(<BajaLogicaControl activo entidad="paciente" onCambiar={onCambiar} />);

    await userEvent.click(screen.getByRole('button', { name: 'Inactivar paciente' }));

    expect(await screen.findByText('Sin conexión')).toBeInTheDocument();
  });
});
