import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PersonaACargo } from '../../shared/types/paciente';
import { PersonasACargoEditor } from './PersonasACargoEditor';

const laura: PersonaACargo = { id: 'pac-1', nombre: 'Laura', apellido: 'Gómez', dni: '30111222' };

describe('PersonasACargoEditor', () => {
  it('sin personas a cargo, muestra un estado vacío explícito', () => {
    render(<PersonasACargoEditor personasACargo={[]} onChange={vi.fn()} />);

    expect(screen.getByText(/no hay personas a cargo/i)).toBeInTheDocument();
  });

  it('lista cada persona a cargo con su nombre, apellido y DNI', () => {
    render(<PersonasACargoEditor personasACargo={[laura]} onChange={vi.fn()} />);

    expect(screen.getByText(/laura/i)).toBeInTheDocument();
    expect(screen.getByText(/gómez/i)).toBeInTheDocument();
    expect(screen.getByText(/30111222/)).toBeInTheDocument();
  });

  it('agregar una persona a cargo llama a onChange con la lista extendida', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<PersonasACargoEditor personasACargo={[]} onChange={onChange} />);

    await user.type(screen.getByLabelText(/^nombre$/i), 'Roberto');
    await user.type(screen.getByLabelText(/^apellido$/i), 'Pereyra');
    await user.type(screen.getByLabelText(/^dni$/i), '25333444');
    await user.click(screen.getByRole('button', { name: /agregar/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const nuevaLista = onChange.mock.calls[0]?.[0] as PersonaACargo[];
    expect(nuevaLista).toHaveLength(1);
    expect(nuevaLista[0]).toMatchObject({ nombre: 'Roberto', apellido: 'Pereyra', dni: '25333444' });
    expect(nuevaLista[0]?.id).toBeTruthy();
  });

  it('quitar una persona a cargo llama a onChange sin esa entrada (triangulación)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const roberto: PersonaACargo = { id: 'pac-2', nombre: 'Roberto', apellido: 'Pereyra', dni: '25333444' };

    render(<PersonasACargoEditor personasACargo={[laura, roberto]} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /quitar laura/i }));

    expect(onChange).toHaveBeenCalledWith([roberto]);
  });

  it('no agrega una persona a cargo con campos vacíos', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<PersonasACargoEditor personasACargo={[]} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /agregar/i }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('renderiza cada fila con key estable por id (nunca por índice)', () => {
    const { container } = render(<PersonasACargoEditor personasACargo={[laura]} onChange={vi.fn()} />);
    const item = container.querySelector('li[data-persona-id="pac-1"]');
    expect(item).not.toBeNull();
  });

  it('agregar una persona a cargo incluye teléfono y teléfono alternativo (docx: viven en Personas a Cargo)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<PersonasACargoEditor personasACargo={[]} onChange={onChange} />);

    await user.type(screen.getByLabelText(/^nombre$/i), 'Roberto');
    await user.type(screen.getByLabelText(/^apellido$/i), 'Pereyra');
    await user.type(screen.getByLabelText(/^dni$/i), '25333444');
    await user.type(screen.getByLabelText(/^teléfono$/i), '221-555-6666');
    await user.type(screen.getByLabelText(/teléfono alternativo/i), '221-555-7777');
    await user.click(screen.getByRole('button', { name: /agregar/i }));

    const nuevaLista = onChange.mock.calls[0]?.[0] as PersonaACargo[];
    expect(nuevaLista[0]).toMatchObject({ telefono: '221-555-6666', telefonoAlternativo: '221-555-7777' });
  });

  it('agregar una persona a cargo sin teléfono funciona igual, es opcional (triangulación)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<PersonasACargoEditor personasACargo={[]} onChange={onChange} />);

    await user.type(screen.getByLabelText(/^nombre$/i), 'Roberto');
    await user.type(screen.getByLabelText(/^apellido$/i), 'Pereyra');
    await user.type(screen.getByLabelText(/^dni$/i), '25333444');
    await user.click(screen.getByRole('button', { name: /agregar/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const nuevaLista = onChange.mock.calls[0]?.[0] as PersonaACargo[];
    expect(nuevaLista[0]?.telefono).toBeUndefined();
  });

  it('muestra el teléfono en la fila de la persona a cargo cuando está presente', () => {
    const roberto: PersonaACargo = { id: 'pac-2', nombre: 'Roberto', apellido: 'Pereyra', dni: '25333444', telefono: '221-555-6666' };
    render(<PersonasACargoEditor personasACargo={[roberto]} onChange={vi.fn()} />);

    expect(screen.getByText(/221-555-6666/)).toBeInTheDocument();
  });
});
