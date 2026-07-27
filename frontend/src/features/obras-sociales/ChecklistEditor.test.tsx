import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChecklistItem } from '../../shared/types/documento';
import { ChecklistEditor } from './ChecklistEditor';

const items: ChecklistItem[] = [
  { id: 'a', nombre: 'RHC', requerido: true },
  { id: 'b', nombre: 'Prescripción', requerido: true },
  { id: 'c', nombre: 'CBU', requerido: false },
];

describe('ChecklistEditor', () => {
  it('muestra el editor vacío cuando la obra social no tiene checklist (obra social nueva, no OSECAC)', () => {
    render(<ChecklistEditor items={[]} onChange={vi.fn()} />);

    expect(screen.getByText(/sin ítems/i)).toBeInTheDocument();
  });

  it('agrega un ítem al final del checklist con el nombre ingresado', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<ChecklistEditor items={items} onChange={onChange} />);

    await user.type(screen.getByLabelText(/nuevo ítem/i), 'FIM');
    await user.click(screen.getByRole('button', { name: /agregar/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const next = onChange.mock.calls[0]?.[0] as ChecklistItem[];
    expect(next).toHaveLength(4);
    expect(next[3]).toMatchObject({ nombre: 'FIM', requerido: true });
  });

  it('quita un ítem del checklist', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<ChecklistEditor items={items} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /quitar rhc/i }));

    expect(onChange).toHaveBeenCalledWith([items[1], items[2]]);
  });

  it('el nombre de un ítem existente no es editable inline (solo texto)', () => {
    render(<ChecklistEditor items={items} onChange={vi.fn()} />);

    // Aparece dos veces: una en la lista editable, otra en la vista previa de solo lectura.
    expect(screen.getAllByText('RHC').length).toBeGreaterThan(0);
    expect(screen.queryByDisplayValue('RHC')).not.toBeInTheDocument();
  });

  it('alterna el flag requerido/opcional de un ítem', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<ChecklistEditor items={items} onChange={onChange} />);

    await user.click(screen.getByLabelText(/requerido — cbu/i));

    expect(onChange).toHaveBeenCalledWith([items[0], items[1], { ...items[2], requerido: true }]);
  });

  it('reordena con los botones subir/bajar (fallback accesible de teclado, WCAG 2.1 AA)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<ChecklistEditor items={items} onChange={onChange} />);

    await user.click(screen.getByLabelText(/bajar rhc/i));

    expect(onChange).toHaveBeenCalledWith([items[1], items[0], items[2]]);
  });

  it('no permite subir el primer ítem ni bajar el último (bordes deshabilitados)', () => {
    render(<ChecklistEditor items={items} onChange={vi.fn()} />);

    expect(screen.getByLabelText(/subir rhc/i)).toBeDisabled();
    expect(screen.getByLabelText(/bajar cbu/i)).toBeDisabled();
  });

  it('reordena por drag-and-drop nativo', () => {
    const onChange = vi.fn();

    render(<ChecklistEditor items={items} onChange={onChange} />);

    const rows = screen.getAllByRole('listitem');
    const firstRow = rows[0];
    const thirdRow = rows[2];
    if (!firstRow || !thirdRow) throw new Error('esperaba 3 filas de checklist');

    firstRow.dispatchEvent(new Event('dragstart', { bubbles: true }));
    thirdRow.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
    thirdRow.dispatchEvent(new Event('drop', { bubbles: true }));

    expect(onChange).toHaveBeenCalledWith([items[1], items[2], items[0]]);
  });

  it('muestra la previsualización en paralelo (misma pantalla), de solo lectura', () => {
    render(<ChecklistEditor items={items} onChange={vi.fn()} />);

    // El renderer de FE-1 muestra el estado documental por ítem (p.ej. "Falta" para requeridos
    // sin documento adjunto todavía) — confirma que se reutiliza, no se duplica su UI, y que se
    // ve al mismo tiempo que el editor (sin toggle que la esconda).
    expect(screen.getAllByText('Falta').length).toBeGreaterThan(0);

    const subirButtons = screen.getAllByRole('button', { name: /^subir$/i });
    expect(subirButtons.length).toBeGreaterThan(0);
    subirButtons.forEach((boton) => expect(boton).toBeDisabled());
  });
});
