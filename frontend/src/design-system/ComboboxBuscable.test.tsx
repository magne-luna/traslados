import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComboboxBuscable, type OpcionCombobox } from './ComboboxBuscable';

const OPCIONES: OpcionCombobox[] = [
  { valor: 'p-1', etiqueta: 'Acuña Pastor, Mauricio' },
  { valor: 'p-2', etiqueta: 'Acosta, Luca' },
  { valor: 'p-3', etiqueta: 'Sanguinetti, Brisa' },
];

function Controlado({ inicial = '', onChange }: { inicial?: string; onChange?: (valor: string) => void }) {
  const [valor, setValor] = useState(inicial);
  return (
    <>
      <label htmlFor="combo">Paciente</label>
      <ComboboxBuscable
        id="combo"
        opciones={OPCIONES}
        valor={valor}
        onChange={(nuevo) => {
          setValor(nuevo);
          onChange?.(nuevo);
        }}
        placeholder="Buscar paciente…"
      />
    </>
  );
}

describe('ComboboxBuscable', () => {
  it('filtra mientras se escribe, sin importar mayúsculas ni tildes', async () => {
    const user = userEvent.setup();
    render(<Controlado />);

    await user.type(screen.getByLabelText('Paciente'), 'acu');

    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Acuña Pastor, Mauricio']);
  });

  it('matchea varias palabras en cualquier orden ("luca aco")', async () => {
    const user = userEvent.setup();
    render(<Controlado />);

    await user.type(screen.getByLabelText('Paciente'), 'luca aco');

    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Acosta, Luca']);
  });

  it('click en una opción la elige y muestra su etiqueta', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlado onChange={onChange} />);

    await user.type(screen.getByLabelText('Paciente'), 'san');
    await user.click(screen.getByRole('option', { name: 'Sanguinetti, Brisa' }));

    expect(onChange).toHaveBeenLastCalledWith('p-3');
    expect(screen.getByLabelText('Paciente')).toHaveValue('Sanguinetti, Brisa');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('flechas + Enter eligen sin mouse', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlado onChange={onChange} />);

    await user.type(screen.getByLabelText('Paciente'), 'a');
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenLastCalledWith('p-2');
  });

  it('con un valor inicial muestra su etiqueta', () => {
    render(<Controlado inicial="p-2" />);

    expect(screen.getByLabelText('Paciente')).toHaveValue('Acosta, Luca');
  });

  it('borrar el texto deja el campo sin elegir', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Controlado inicial="p-2" onChange={onChange} />);

    await user.clear(screen.getByLabelText('Paciente'));

    expect(onChange).toHaveBeenLastCalledWith('');
  });

  it('si se sale escribiendo algo que no eligió, vuelve a mostrar lo elegido', async () => {
    const user = userEvent.setup();
    render(<Controlado inicial="p-2" />);

    await user.type(screen.getByLabelText('Paciente'), 'xyz');
    await user.tab();

    expect(screen.getByLabelText('Paciente')).toHaveValue('Acosta, Luca');
  });

  it('sin coincidencias lo dice, en vez de una lista vacía', async () => {
    const user = userEvent.setup();
    render(<Controlado />);

    await user.type(screen.getByLabelText('Paciente'), 'zzz');

    expect(screen.getByText('Sin coincidencias')).toBeInTheDocument();
  });
});
