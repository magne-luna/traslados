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

  it('editar una dirección precarga sus campos y guarda los cambios por id, sin duplicarla (triangulación con el default)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const terapia: Direccion = { id: 'dir-9', tipo: 'terapia', calle: 'Corrientes 500', localidad: 'CABA', descripcion: 'Kinesióloga' };

    render(<DireccionesEditor direcciones={[terapia]} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /editar terapia/i }));

    expect(screen.getByLabelText(/tipo de lugar/i)).toHaveValue('terapia');
    expect(screen.getByLabelText(/calle y número/i)).toHaveValue('Corrientes 500');
    expect(screen.getByLabelText(/^localidad$/i)).toHaveValue('CABA');
    expect(screen.getByLabelText(/descripción/i)).toHaveValue('Kinesióloga');

    await user.clear(screen.getByLabelText(/descripción/i));
    await user.type(screen.getByLabelText(/descripción/i), 'Fonoaudióloga');
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(onChange).toHaveBeenCalledWith([{ id: 'dir-9', tipo: 'terapia', calle: 'Corrientes 500', localidad: 'CABA', descripcion: 'Fonoaudióloga' }]);
  });

  it('cancelar una edición no llama a onChange y vuelve el form a "Agregar nueva dirección"', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<DireccionesEditor direcciones={[domicilio]} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /editar domicilio/i }));
    expect(screen.getByText(/editar dirección/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(screen.getByText(/agregar nueva dirección/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/calle y número/i)).toHaveValue('');
    expect(onChange).not.toHaveBeenCalled();
  });
});

// tasks.md 5.3 (integracion-pacientes), design.md D9 #4/#6: días/horario no tienen columna propia
// (los días/horarios habituales viven en pacientes.recorridos, módulo Hojas de Ruta) y
// paciente.domicilio es una columna legacy suelta que duplica esta lista. `localidad` ya no forma
// parte de este aviso (discrepancia #3 cerrada, 2026-08-04).
describe('DireccionesEditor — cartel de modelo de datos', () => {
  it('avisa que la base no guarda días ni horario, y que domicilio es una columna legacy duplicada', () => {
    render(<DireccionesEditor direcciones={[]} onChange={vi.fn()} />);

    const cartel = screen.getByRole('note');
    expect(cartel).toHaveTextContent(/días/i);
    expect(cartel).toHaveTextContent(/horario/i);
    expect(cartel).toHaveTextContent(/recorridos/i);
    expect(cartel).toHaveTextContent(/hojas de ruta/i);
    expect(cartel).toHaveTextContent(/domicilio/i);
  });

  it('el cartel se muestra aunque no haya ninguna dirección cargada (no depende del contenido de la lista)', () => {
    render(<DireccionesEditor direcciones={[]} onChange={vi.fn()} />);
    expect(screen.getAllByRole('note')).toHaveLength(1);
  });
});

// Gateo de escritura (gateo-pacientes, design.md D2, tasks.md 4.3). DireccionesEditor cuelga de
// PacienteDetail, fuera de PacienteForm — un único <CamposSoloLectura> cubre los <button>
// nativos ("Editar"/"Quitar" por fila), los 4 campos de alta/edición y el Button
// "Agregar/Guardar cambios", sin que el componente reciba el módulo por props ni importe el
// literal 'pacientes' (usePuedeEscribir() resuelve el permiso).
describe('DireccionesEditor — gateo de escritura', () => {
  it('sin permiso de escritura: "+ Agregar dirección", "Editar"/"Quitar" y los campos quedan inertes, pero las direcciones existentes siguen legibles', async () => {
    const user = userEvent.setup();

    renderConPermiso(false, <DireccionesEditor direcciones={[domicilio]} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /agregar dirección/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /editar domicilio/i })).toBeDisabled();
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

  it('con permiso de escritura: "+ Agregar dirección", "Editar", "Quitar" y los campos están activables (triangulación)', () => {
    renderConPermiso(true, <DireccionesEditor direcciones={[domicilio]} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /agregar dirección/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /editar domicilio/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /quitar domicilio/i })).toBeEnabled();
    expect(screen.getByLabelText(/calle y número/i)).toBeEnabled();
  });
});
