import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Prestacion } from '../../shared/types/prestacion';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { PrestacionesEditor } from './PrestacionesEditor';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

const kinesiologia: Prestacion = {
  id: 'prest-1',
  pacienteId: 'pac-1',
  nombre: 'Kinesiología',
  descripcion: 'Sesión semanal',
  activa: true,
};

describe('PrestacionesEditor', () => {
  it('sin prestaciones, muestra un estado vacío explícito', () => {
    render(<PrestacionesEditor pacienteId="pac-1" prestaciones={[]} onChange={vi.fn()} />);

    expect(screen.getByText(/no hay prestaciones/i)).toBeInTheDocument();
  });

  it('lista cada prestación activa ya cargada, con nombre y descripción', () => {
    render(<PrestacionesEditor pacienteId="pac-1" prestaciones={[kinesiologia]} onChange={vi.fn()} />);

    expect(screen.getByText('Kinesiología')).toBeInTheDocument();
    expect(screen.getByText(/sesión semanal/i)).toBeInTheDocument();
  });

  it('permite registrar una prestación nueva con nombre requerido', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<PrestacionesEditor pacienteId="pac-1" prestaciones={[kinesiologia]} onChange={onChange} />);

    await user.type(screen.getByLabelText(/nombre de la prestación/i), 'Fonoaudiología');
    await user.click(screen.getByRole('button', { name: /agregar prestación/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const nuevaLista = onChange.mock.calls[0]?.[0] as Prestacion[];
    expect(nuevaLista).toHaveLength(2);
    expect(nuevaLista[0]).toEqual(kinesiologia);
    expect(nuevaLista[1]).toMatchObject({ pacienteId: 'pac-1', nombre: 'Fonoaudiología', activa: true });
  });

  it('sin nombre, el submit no llama a onChange', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<PrestacionesEditor pacienteId="pac-1" prestaciones={[]} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /agregar prestación/i }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('editar una prestación precarga sus campos y guarda los cambios por id, sin afectar "activa"', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<PrestacionesEditor pacienteId="pac-1" prestaciones={[kinesiologia]} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /editar kinesiología/i }));

    expect(screen.getByLabelText(/nombre de la prestación/i)).toHaveValue('Kinesiología');
    expect(screen.getByLabelText(/descripción/i)).toHaveValue('Sesión semanal');

    await user.clear(screen.getByLabelText(/descripción/i));
    await user.type(screen.getByLabelText(/descripción/i), 'Sesión quincenal');
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(onChange).toHaveBeenCalledWith([{ ...kinesiologia, descripcion: 'Sesión quincenal' }]);
  });

  it('cancelar una edición no llama a onChange y vuelve el form a "Agregar prestación"', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<PrestacionesEditor pacienteId="pac-1" prestaciones={[kinesiologia]} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /editar kinesiología/i }));
    expect(screen.getByText(/editar prestación/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(screen.getByText('Agregar prestación')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('quitar una prestación sin presupuestos asociados marca activa: false directo, sin borrarla del array (baja lógica)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<PrestacionesEditor pacienteId="pac-1" prestaciones={[kinesiologia]} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /quitar kinesiología/i }));

    expect(onChange).toHaveBeenCalledWith([{ ...kinesiologia, activa: false }]);
  });

  it('quitar una prestación con presupuestos asociados abre un diálogo de confirmación, sin llamar a onChange todavía', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <PrestacionesEditor
        pacienteId="pac-1"
        prestaciones={[kinesiologia]}
        onChange={onChange}
        presupuestosPorPrestacion={{ 'prest-1': 2 }}
      />,
    );

    await user.click(screen.getByRole('button', { name: /quitar kinesiología/i }));

    expect(onChange).not.toHaveBeenCalled();
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveTextContent('2');
    expect(dialogo).toHaveTextContent(/presupuesto/i);
  });

  it('confirmar el diálogo aplica la baja lógica (activa: false)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <PrestacionesEditor
        pacienteId="pac-1"
        prestaciones={[kinesiologia]}
        onChange={onChange}
        presupuestosPorPrestacion={{ 'prest-1': 2 }}
      />,
    );

    await user.click(screen.getByRole('button', { name: /quitar kinesiología/i }));
    await user.click(screen.getByRole('button', { name: /quitar de todas formas/i }));

    expect(onChange).toHaveBeenCalledWith([{ ...kinesiologia, activa: false }]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cancelar el diálogo no aplica la baja (triangulación con confirmar)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <PrestacionesEditor
        pacienteId="pac-1"
        prestaciones={[kinesiologia]}
        onChange={onChange}
        presupuestosPorPrestacion={{ 'prest-1': 2 }}
      />,
    );

    await user.click(screen.getByRole('button', { name: /quitar kinesiología/i }));
    await user.click(screen.getByRole('button', { name: /^cancelar$/i }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('una prestación inactiva se muestra tachada, sin acciones de editar/quitar, con acción "Reactivar"', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const inactiva: Prestacion = { ...kinesiologia, activa: false };

    render(<PrestacionesEditor pacienteId="pac-1" prestaciones={[inactiva]} onChange={onChange} />);

    expect(screen.queryByRole('button', { name: /editar kinesiología/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /quitar kinesiología/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /reactivar kinesiología/i }));

    expect(onChange).toHaveBeenCalledWith([{ ...inactiva, activa: true }]);
  });

  describe('gateo de escritura', () => {
    it('sin permiso de escritura: "+ Agregar prestación", "Editar"/"Quitar" y los campos quedan inertes', async () => {
      renderConPermiso(false, <PrestacionesEditor pacienteId="pac-1" prestaciones={[kinesiologia]} onChange={vi.fn()} />);

      expect(screen.getByRole('button', { name: /agregar prestación/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /editar kinesiología/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /quitar kinesiología/i })).toBeDisabled();
      expect(screen.getByLabelText(/nombre de la prestación/i)).toBeDisabled();

      expect(screen.getByText('Kinesiología')).toBeInTheDocument();
    });

    it('con permiso de escritura: los controles están activables', () => {
      renderConPermiso(true, <PrestacionesEditor pacienteId="pac-1" prestaciones={[kinesiologia]} onChange={vi.fn()} />);

      expect(screen.getByRole('button', { name: /agregar prestación/i })).toBeEnabled();
      expect(screen.getByRole('button', { name: /editar kinesiología/i })).toBeEnabled();
      expect(screen.getByRole('button', { name: /quitar kinesiología/i })).toBeEnabled();
    });
  });
});
