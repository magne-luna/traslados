import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Direccion } from '../../shared/types/paciente';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { DireccionesEditor } from './DireccionesEditor';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

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

// Gateo de escritura (gateo-pacientes, design.md D2, tasks.md 4.3). DireccionesEditor cuelga de
// PacienteDetail, fuera de PacienteForm — un único <CamposSoloLectura> cubre el <button> nativo
// "Quitar" de cada fila, los 3 campos de "Agregar nueva dirección" y el Button "+ Agregar
// dirección", sin que el componente reciba el módulo por props ni importe el literal 'pacientes'
// (usePuedeEscribir() resuelve el permiso).
describe('DireccionesEditor — gateo de escritura', () => {
  it('sin permiso de escritura: "+ Agregar dirección", el <button> nativo "Quitar" y los campos quedan inertes, pero las direcciones existentes siguen legibles', async () => {
    const user = userEvent.setup();

    renderConPermiso(false, <DireccionesEditor direcciones={[domicilio]} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /agregar dirección/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /quitar domicilio/i })).toBeDisabled();
    expect(screen.getByLabelText(/tipo de lugar/i)).toBeDisabled();
    expect(screen.getByLabelText(/calle y número/i)).toBeDisabled();
    expect(screen.getByLabelText(/^localidad$/i)).toBeDisabled();

    await user.type(screen.getByLabelText(/calle y número/i), 'Intento bloqueado');
    expect(screen.getByLabelText(/calle y número/i)).toHaveValue('');

    // Las direcciones existentes siguen siendo legibles (design.md Goals — nunca más
    // restrictivo que la lectura que ya autoriza el nivel `read`).
    expect(screen.getByText(/av\. rivadavia 4500, caba/i)).toBeInTheDocument();
  });

  it('con permiso de escritura: "+ Agregar dirección", "Quitar" y los campos están activables (triangulación)', () => {
    renderConPermiso(true, <DireccionesEditor direcciones={[domicilio]} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /agregar dirección/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /quitar domicilio/i })).toBeEnabled();
    expect(screen.getByLabelText(/calle y número/i)).toBeEnabled();
  });
});
