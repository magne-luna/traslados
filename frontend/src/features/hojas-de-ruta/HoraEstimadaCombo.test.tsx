import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HoraEstimadaCombo } from './HoraEstimadaCombo';

const SUGERENCIAS = ['06:00', '06:30', '07:00', '08:00', '08:30'];

function Wrapper({ sugerencias = SUGERENCIAS }: { sugerencias?: string[] }) {
  const [value, setValue] = useState('');
  return (
    <label htmlFor="hora">
      Hora estimada
      <HoraEstimadaCombo id="hora" value={value} onChange={setValue} sugerencias={sugerencias} />
    </label>
  );
}

describe('HoraEstimadaCombo', () => {
  it('escribir texto libre actualiza el valor aunque no matchee ninguna sugerencia', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    const input = screen.getByLabelText('Hora estimada');
    await user.type(input, '23:45');
    expect(input).toHaveValue('23:45');
  });

  it('al enfocar el input, el listbox de sugerencias queda acotado en alto y con scroll interno', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    await user.click(screen.getByLabelText('Hora estimada'));
    const listbox = screen.getByRole('listbox');
    expect(listbox.className).toMatch(/max-h-/);
    expect(listbox.className).toMatch(/overflow-y-auto/);
    expect(screen.getAllByRole('option')).toHaveLength(SUGERENCIAS.length);
  });

  it('escribir "08" filtra las sugerencias a las que empiezan con "08" (triangulación de filtro)', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    const input = screen.getByLabelText('Hora estimada');
    await user.type(input, '08');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['08:00', '08:30']);
  });

  it('clickear una sugerencia carga su valor y cierra el listbox', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    const input = screen.getByLabelText('Hora estimada') as HTMLInputElement;
    await user.click(input);
    await user.click(screen.getByRole('option', { name: '07:00' }));
    expect(input).toHaveValue('07:00');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('Escape cierra el listbox sin tocar el valor cargado', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    const input = screen.getByLabelText('Hora estimada');
    await user.type(input, '08:30');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveValue('08:30');
  });

  it('ArrowDown + Enter selecciona la primera sugerencia sin necesidad de mouse', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    const input = screen.getByLabelText('Hora estimada') as HTMLInputElement;
    await user.click(input);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(input).toHaveValue('06:00');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('ArrowDown dos veces + ArrowUp + Enter selecciona la sugerencia anterior', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    const input = screen.getByLabelText('Hora estimada') as HTMLInputElement;
    await user.click(input);
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}{Enter}');
    expect(input).toHaveValue('06:00');
  });

  it('perder el foco sin elegir una sugerencia cierra el listbox', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Wrapper />
        <button type="button">otro control</button>
      </>,
    );
    const input = screen.getByLabelText('Hora estimada');
    await user.click(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'otro control' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('sin sugerencias que matcheen, no renderiza listbox (borde)', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);
    const input = screen.getByLabelText('Hora estimada');
    await user.type(input, '99:99');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
