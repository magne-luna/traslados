import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PersonaACargo } from '../../shared/types/paciente';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { PersonasACargoEditor } from './PersonasACargoEditor';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

const laura: PersonaACargo = { id: 'pac-1', nombre: 'Laura', apellido: 'Gómez', dni: '30111222', parentesco: 'madre' };

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
    await user.selectOptions(screen.getByLabelText(/^parentesco$/i), 'tutor_legal');
    await user.click(screen.getByRole('button', { name: /agregar/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const nuevaLista = onChange.mock.calls[0]?.[0] as PersonaACargo[];
    expect(nuevaLista).toHaveLength(1);
    expect(nuevaLista[0]).toMatchObject({ nombre: 'Roberto', apellido: 'Pereyra', dni: '25333444', parentesco: 'tutor_legal' });
    expect(nuevaLista[0]?.id).toBeTruthy();
  });

  it('el parentesco viene preseleccionado en "Padre" por defecto al agregar sin tocar el select (obligatorio, nunca queda vacío)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<PersonasACargoEditor personasACargo={[]} onChange={onChange} />);

    await user.type(screen.getByLabelText(/^nombre$/i), 'Roberto');
    await user.type(screen.getByLabelText(/^apellido$/i), 'Pereyra');
    await user.type(screen.getByLabelText(/^dni$/i), '25333444');
    await user.click(screen.getByRole('button', { name: /agregar/i }));

    const nuevaLista = onChange.mock.calls[0]?.[0] as PersonaACargo[];
    expect(nuevaLista[0]?.parentesco).toBe('padre');
  });

  it('quitar una persona a cargo llama a onChange sin esa entrada (triangulación)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const roberto: PersonaACargo = { id: 'pac-2', nombre: 'Roberto', apellido: 'Pereyra', dni: '25333444', parentesco: 'padre' };

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
    const roberto: PersonaACargo = {
      id: 'pac-2',
      nombre: 'Roberto',
      apellido: 'Pereyra',
      dni: '25333444',
      parentesco: 'padre',
      telefono: '221-555-6666',
    };
    render(<PersonasACargoEditor personasACargo={[roberto]} onChange={vi.fn()} />);

    expect(screen.getByText(/221-555-6666/)).toBeInTheDocument();
  });

  it('muestra la etiqueta legible del parentesco en la fila de la persona a cargo', () => {
    const { container } = render(<PersonasACargoEditor personasACargo={[laura]} onChange={vi.fn()} />);

    const fila = container.querySelector('li[data-persona-id="pac-1"]');
    expect(fila).not.toBeNull();
    expect(within(fila as HTMLElement).getByText('Madre')).toBeInTheDocument();
  });

  it('editar una persona a cargo precarga su parentesco en el select (triangulación con el default)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const tutor: PersonaACargo = { id: 'pac-3', nombre: 'Carlos', apellido: 'Díaz', dni: '20999888', parentesco: 'tutor_legal' };

    render(<PersonasACargoEditor personasACargo={[tutor]} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /editar carlos díaz/i }));

    expect(screen.getByLabelText(/^parentesco$/i)).toHaveValue('tutor_legal');

    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: 'pac-3', parentesco: 'tutor_legal' })]);
  });
});

// Gateo de escritura (gateo-pacientes, design.md D2, tasks.md 4.4). PersonasACargoEditor cuelga
// de PacienteDetail, fuera de PacienteForm — un único <CamposSoloLectura> cubre los 3 <button>
// nativos ("Editar", "Quitar" por fila y "Cancelar" del form inline) más los 5 campos y el
// Button "Agregar/Guardar cambios". A diferencia de CudFields (design.md D2), acá no se talla
// una excepción para el "Cancelar" del form inline: tasks.md 4.4 lo agrupa explícitamente con
// los otros 2 <button> nativos.
describe('PersonasACargoEditor — gateo de escritura', () => {
  it('sin permiso de escritura: "Agregar/Editar" (submit) y los 3 <button> nativos quedan inertes, y las personas a cargo siguen legibles', async () => {
    const user = userEvent.setup();

    renderConPermiso(false, <PersonasACargoEditor personasACargo={[laura]} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /agregar persona a cargo/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /editar laura gómez/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /quitar laura gómez/i })).toBeDisabled();
    expect(screen.getByLabelText(/^nombre$/i)).toBeDisabled();
    expect(screen.getByLabelText(/^apellido$/i)).toBeDisabled();
    expect(screen.getByLabelText(/^dni$/i)).toBeDisabled();
    expect(screen.getByLabelText(/^parentesco$/i)).toBeDisabled();

    await user.type(screen.getByLabelText(/^nombre$/i), 'Intento bloqueado');
    expect(screen.getByLabelText(/^nombre$/i)).toHaveValue('');

    // Las personas a cargo ya cargadas siguen siendo legibles (design.md Goals).
    expect(screen.getByText(/laura/i)).toBeInTheDocument();
  });

  it('sin permiso de escritura: el "Cancelar" del form inline (al editar) también queda inerte, sin excepción (a diferencia de CudFields)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    // Se llega al form inline de edición con escritura habilitada (mismo motivo que
    // CudFields.test.tsx: "Editar" ya está bloqueado sin permiso, así que es la única forma de
    // alcanzar ese estado interno) y luego se retira el permiso para afirmar sobre "Cancelar".
    const { rerender } = renderConPermiso(true, <PersonasACargoEditor personasACargo={[laura]} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /editar laura gómez/i }));
    expect(screen.getByRole('button', { name: /^cancelar$/i })).toBeInTheDocument();

    rerender(
      <PuedeEscribirContext.Provider value={false}>
        <PersonasACargoEditor personasACargo={[laura]} onChange={onChange} />
      </PuedeEscribirContext.Provider>,
    );

    expect(screen.getByRole('button', { name: /^cancelar$/i })).toBeDisabled();
  });

  it('con permiso de escritura: "Agregar/Editar", los 3 <button> nativos y los campos están activables (triangulación)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    renderConPermiso(true, <PersonasACargoEditor personasACargo={[laura]} onChange={onChange} />);

    expect(screen.getByRole('button', { name: /agregar persona a cargo/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /editar laura gómez/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /quitar laura gómez/i })).toBeEnabled();
    expect(screen.getByLabelText(/^nombre$/i)).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /editar laura gómez/i }));
    expect(screen.getByRole('button', { name: /^cancelar$/i })).toBeEnabled();
  });
});
