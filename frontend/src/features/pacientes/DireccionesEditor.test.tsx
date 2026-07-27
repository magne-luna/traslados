import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Direccion } from '../../shared/types/paciente';
import { DireccionesEditor } from './DireccionesEditor';

const domicilio: Direccion = {
  id: 'dir-1',
  tipo: 'domicilio',
  calle: 'Av. Rivadavia 4500',
  localidad: 'CABA',
};

describe('DireccionesEditor', () => {
  it('sin direcciones, muestra un estado vacío explícito', () => {
    render(<DireccionesEditor direcciones={[]} onChange={vi.fn()} />);

    expect(screen.getByText(/no hay direcciones/i)).toBeInTheDocument();
  });

  it('lista cada dirección ya cargada de solo lectura, con tipo y calle/localidad', () => {
    render(<DireccionesEditor direcciones={[domicilio]} onChange={vi.fn()} />);

    expect(screen.getAllByText('Domicilio').length).toBeGreaterThan(0);
    expect(screen.getByText(/av\. rivadavia 4500, caba/i)).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Av. Rivadavia 4500')).not.toBeInTheDocument();
  });

  it('permite registrar varias direcciones de distinto tipo para el mismo paciente', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<DireccionesEditor direcciones={[domicilio]} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText(/tipo de lugar/i), 'escuela');
    await user.type(screen.getByLabelText(/calle y número/i), 'Bulnes 1200');
    await user.type(screen.getByLabelText(/^localidad$/i), 'CABA');
    await user.click(screen.getByRole('button', { name: /agregar dirección/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const nuevaLista = onChange.mock.calls[0]?.[0] as Direccion[];
    expect(nuevaLista).toHaveLength(2);
    expect(nuevaLista[0]).toEqual(domicilio);
    expect(nuevaLista[1]).toMatchObject({ tipo: 'escuela', calle: 'Bulnes 1200' });
  });

  it('agregar una dirección no toca ni deriva las demás ya cargadas (registros independientes)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<DireccionesEditor direcciones={[]} onChange={onChange} />);

    await user.type(screen.getByLabelText(/calle y número/i), 'Av. Rivadavia 4500');
    await user.type(screen.getByLabelText(/^localidad$/i), 'CABA');
    await user.click(screen.getByRole('button', { name: /agregar dirección/i }));

    const nuevaLista = onChange.mock.calls[0]?.[0] as Direccion[];
    expect(nuevaLista).toHaveLength(1);
  });

  it('quitar una dirección no altera las demás (registros independientes)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const escuela: Direccion = { id: 'dir-2', tipo: 'escuela', calle: 'Bulnes 1200', localidad: 'CABA' };

    render(<DireccionesEditor direcciones={[domicilio, escuela]} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /quitar escuela/i }));

    expect(onChange).toHaveBeenCalledWith([domicilio]);
  });

  it('varias direcciones con datos distintos coexisten sin fusionarse', () => {
    const escuela: Direccion = { id: 'dir-2', tipo: 'escuela', calle: 'Bulnes 1200', localidad: 'CABA', horario: '16:30' };

    render(<DireccionesEditor direcciones={[domicilio, escuela]} onChange={vi.fn()} />);

    expect(screen.getByText(/av\. rivadavia 4500, caba/i)).toBeInTheDocument();
    expect(screen.getByText(/bulnes 1200, caba/i)).toBeInTheDocument();
  });

  it('quitar una dirección llama a onChange sin esa entrada', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<DireccionesEditor direcciones={[domicilio]} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /quitar/i }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('renderiza cada fila con key estable por id', () => {
    const { container } = render(<DireccionesEditor direcciones={[domicilio]} onChange={vi.fn()} />);
    expect(container.querySelector('li[data-direccion-id="dir-1"]')).not.toBeNull();
  });
});
