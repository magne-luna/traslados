import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PlantillaFactura } from '../../shared/types/obraSocial';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { PlantillaFacturaEditor } from './PlantillaFacturaEditor';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

const plantilla: PlantillaFactura = {
  campos: [
    { id: 'f1', etiqueta: 'Paciente', origen: 'paciente.nombre', orden: 0 },
    { id: 'f2', etiqueta: 'Prestación', origen: 'traslado.prestacion', orden: 1 },
  ],
  identificadorOrigen: 'paciente.numeroAfiliado',
};

describe('PlantillaFacturaEditor', () => {
  it('muestra un estado vacío cuando la obra social no tiene campos configurados', () => {
    render(<PlantillaFacturaEditor plantilla={{ campos: [], identificadorOrigen: 'paciente.dni' }} onChange={vi.fn()} />);

    expect(screen.getByText(/sin campos/i)).toBeInTheDocument();
  });

  it('agrega un campo con etiqueta y origen a la plantilla', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<PlantillaFacturaEditor plantilla={plantilla} onChange={onChange} />);

    await user.type(screen.getByLabelText(/nueva etiqueta/i), 'Domicilio');
    await user.click(screen.getByRole('button', { name: /agregar campo/i }));

    const next = onChange.mock.calls[0]?.[0] as PlantillaFactura;
    expect(next.campos).toHaveLength(3);
    expect(next.campos[2]).toMatchObject({ etiqueta: 'Domicilio', orden: 2 });
  });

  it('cada obra social conserva su propio conjunto de campos (no comparte una plantilla única)', () => {
    const onChangeA = vi.fn();
    const onChangeB = vi.fn();

    const { unmount } = render(<PlantillaFacturaEditor plantilla={plantilla} onChange={onChangeA} />);
    expect(screen.getAllByRole('textbox', { name: /etiqueta del campo/i })).toHaveLength(2);
    unmount();

    render(
      <PlantillaFacturaEditor
        plantilla={{ campos: [], identificadorOrigen: 'paciente.dni' }}
        onChange={onChangeB}
      />,
    );
    expect(screen.queryByDisplayValue('Paciente')).not.toBeInTheDocument();
  });

  it('no persiste la etiqueta en cada tecla, solo al perder foco (evita el lag del round-trip async)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<PlantillaFacturaEditor plantilla={plantilla} onChange={onChange} />);

    const etiquetaPaciente = screen.getByLabelText(/etiqueta del campo paciente/i);
    await user.type(etiquetaPaciente, 'X');
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(etiquetaPaciente);
    expect(onChange).toHaveBeenCalledWith({
      ...plantilla,
      campos: [{ ...plantilla.campos[0], etiqueta: 'PacienteX' }, plantilla.campos[1]],
    });
  });

  it('permite elegir explícitamente el origen del identificador de factura (IN-01)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<PlantillaFacturaEditor plantilla={plantilla} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText(/identificador en la factura/i), 'paciente.dni');

    expect(onChange).toHaveBeenCalledWith({ ...plantilla, identificadorOrigen: 'paciente.dni' });
  });

  it('toma el default documentado de identificadorOrigen cuando no fue confirmado por el cliente', () => {
    render(<PlantillaFacturaEditor plantilla={plantilla} onChange={vi.fn()} />);

    expect(screen.getByLabelText(/identificador en la factura/i)).toHaveValue('paciente.numeroAfiliado');
  });

  it('quita un campo de la plantilla y renumera el orden restante', () => {
    const onChange = vi.fn();

    render(<PlantillaFacturaEditor plantilla={plantilla} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /quitar paciente/i }));

    expect(onChange).toHaveBeenCalledWith({
      ...plantilla,
      campos: [{ ...plantilla.campos[1], orden: 0 }],
    });
  });

  it('reordena campos con los botones subir/bajar y renumera orden', () => {
    const onChange = vi.fn();

    render(<PlantillaFacturaEditor plantilla={plantilla} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /bajar paciente/i }));

    expect(onChange).toHaveBeenCalledWith({
      ...plantilla,
      campos: [
        { ...plantilla.campos[1], orden: 0 },
        { ...plantilla.campos[0], orden: 1 },
      ],
    });
  });

  it('reordena por drag-and-drop nativo y renumera orden', () => {
    const onChange = vi.fn();

    render(<PlantillaFacturaEditor plantilla={plantilla} onChange={onChange} />);

    const rows = screen.getAllByRole('listitem');
    const firstRow = rows[0];
    const secondRow = rows[1];
    if (!firstRow || !secondRow) throw new Error('esperaba 2 filas de campos');

    firstRow.dispatchEvent(new Event('dragstart', { bubbles: true }));
    secondRow.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
    secondRow.dispatchEvent(new Event('drop', { bubbles: true }));

    expect(onChange).toHaveBeenCalledWith({
      ...plantilla,
      campos: [
        { ...plantilla.campos[1], orden: 0 },
        { ...plantilla.campos[0], orden: 1 },
      ],
    });
  });

  it('la vista previa compone la línea de descripción con valores de ejemplo, en simultáneo con el editor', () => {
    render(<PlantillaFacturaEditor plantilla={plantilla} onChange={vi.fn()} />);

    // Ambas etiquetas ("Paciente", "Prestación") aparecen dos veces: una en el input editable
    // de Configuración, otra en el texto de la Vista previa — mismo criterio que ChecklistEditor.
    expect(screen.getAllByText(/paciente/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/juan garcía/i)).toBeInTheDocument();
    expect(screen.getByText(/traslado ambulatorio/i)).toBeInTheDocument();
    expect(screen.getByText(/los valores reales se completarán/i)).toBeInTheDocument();
  });
});

// Gateo de escritura (gateo-obrasocial, tasks.md 4.7): agregar, editar, reordenar (botones y
// arrastre) y eliminar campos quedan inertes sin permiso `write`; la plantilla sigue legible.
describe('PlantillaFacturaEditor — gateo de escritura', () => {
  it('sin permiso: no se puede agregar, editar etiqueta/origen, reordenar por botones ni eliminar, pero la plantilla sigue legible', () => {
    renderConPermiso(false, <PlantillaFacturaEditor plantilla={plantilla} onChange={vi.fn()} />);

    expect(screen.getByLabelText(/identificador en la factura/i)).toBeDisabled();
    expect(screen.getByLabelText(/nueva etiqueta/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /agregar campo/i })).toBeDisabled();
    expect(screen.getByLabelText(/etiqueta del campo paciente/i)).toBeDisabled();
    expect(screen.getByLabelText(/origen del campo paciente/i)).toBeDisabled();
    expect(screen.getByLabelText(/bajar paciente/i)).toBeDisabled();
    expect(screen.getByLabelText(/quitar paciente/i)).toBeDisabled();

    expect(screen.getAllByText(/paciente/i).length).toBeGreaterThan(0);
  });

  it('con permiso: agregar, editar, reordenar por botones y eliminar están operativos', () => {
    const onChange = vi.fn();

    renderConPermiso(true, <PlantillaFacturaEditor plantilla={plantilla} onChange={onChange} />);

    expect(screen.getByLabelText(/nueva etiqueta/i)).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /quitar paciente/i }));

    expect(onChange).toHaveBeenCalledWith({
      ...plantilla,
      campos: [{ ...plantilla.campos[1], orden: 0 }],
    });
  });

  it('sin permiso: el arrastre no reordena (draggable=false)', () => {
    const onChange = vi.fn();

    renderConPermiso(false, <PlantillaFacturaEditor plantilla={plantilla} onChange={onChange} />);

    const rows = screen.getAllByRole('listitem');
    const firstRow = rows[0];
    const secondRow = rows[1];
    if (!firstRow || !secondRow) throw new Error('esperaba 2 filas de campos');

    expect(firstRow).toHaveAttribute('draggable', 'false');

    firstRow.dispatchEvent(new Event('dragstart', { bubbles: true }));
    secondRow.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
    secondRow.dispatchEvent(new Event('drop', { bubbles: true }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('con permiso: el arrastre reordena con normalidad', () => {
    const onChange = vi.fn();

    renderConPermiso(true, <PlantillaFacturaEditor plantilla={plantilla} onChange={onChange} />);

    const rows = screen.getAllByRole('listitem');
    const firstRow = rows[0];
    const secondRow = rows[1];
    if (!firstRow || !secondRow) throw new Error('esperaba 2 filas de campos');

    expect(firstRow).toHaveAttribute('draggable', 'true');

    firstRow.dispatchEvent(new Event('dragstart', { bubbles: true }));
    secondRow.dispatchEvent(new Event('dragover', { bubbles: true, cancelable: true }));
    secondRow.dispatchEvent(new Event('drop', { bubbles: true }));

    expect(onChange).toHaveBeenCalledWith({
      ...plantilla,
      campos: [
        { ...plantilla.campos[1], orden: 0 },
        { ...plantilla.campos[0], orden: 1 },
      ],
    });
  });
});
