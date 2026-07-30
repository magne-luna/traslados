import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AsistenciaPrestacion } from '../../shared/types/factura';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { AsistenciasEditor } from './AsistenciasEditor';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

const asistencia: AsistenciaPrestacion = {
  id: 'asistencia-1',
  fecha: '2026-08-03',
  prestacion: 'Kinesiología',
  dependencia: 'Escuela N°12',
  retorno: 'Domicilio',
  facturaSabados: false,
};

describe('AsistenciasEditor', () => {
  it('muestra un estado vacío cuando no hay asistencias cargadas', () => {
    render(<AsistenciasEditor asistencias={[]} onChange={vi.fn()} />);
    expect(screen.getByText(/no hay asistencias/i)).toBeInTheDocument();
  });

  it('lista las asistencias existentes por su prestación y fecha', () => {
    render(<AsistenciasEditor asistencias={[asistencia]} onChange={vi.fn()} />);
    expect(screen.getByText('Kinesiología')).toBeInTheDocument();
    expect(screen.getByText('2026-08-03')).toBeInTheDocument();
  });

  it('agrega una nueva asistencia al completar el formulario y confirmar', async () => {
    const onChange = vi.fn();
    render(<AsistenciasEditor asistencias={[]} onChange={onChange} />);

    await userEvent.type(screen.getByLabelText(/fecha/i), '2026-08-10');
    await userEvent.type(screen.getByLabelText(/prestación/i), 'Fonoaudiología');
    await userEvent.type(screen.getByLabelText(/dependencia/i), 'Terapia');
    await userEvent.type(screen.getByLabelText(/retorno/i), 'Domicilio');
    await userEvent.click(screen.getByRole('button', { name: /agregar/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const nuevaLista = onChange.mock.calls[0]?.[0] as AsistenciaPrestacion[];
    expect(nuevaLista).toHaveLength(1);
    expect(nuevaLista[0]).toMatchObject({ prestacion: 'Fonoaudiología', dependencia: 'Terapia' });
  });

  it('quita una asistencia existente al hacer click en "Quitar"', async () => {
    const onChange = vi.fn();
    render(<AsistenciasEditor asistencias={[asistencia]} onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /quitar/i }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('no consulta ninguna fuente de recorridos: no expone ningún selector de hoja de ruta/vehículo/conductor', () => {
    render(<AsistenciasEditor asistencias={[asistencia]} onChange={vi.fn()} />);
    expect(screen.queryByText(/recorrido/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/veh[íi]culo/i)).not.toBeInTheDocument();
  });
});

// Gateo de escritura (gateo-facturacion, tasks.md 5.4, design.md D2). Editar asistencias es una
// escritura no-CRUD gateada al mismo nivel `write` — ninguna requiere `admin` (decisión 5). El
// <button> nativo "Quitar" y los campos del alta quedan inertes; las asistencias ya cargadas
// siguen siendo legibles con solo `read`.
describe('AsistenciasEditor — gateo de escritura', () => {
  it('sin permiso de escritura: la edición, su <button> nativo y sus campos quedan inertes; las asistencias siguen legibles', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    renderConPermiso(false, <AsistenciasEditor asistencias={[asistencia]} onChange={onChange} />);

    expect(screen.getByLabelText(/fecha/i)).toBeDisabled();
    expect(screen.getByLabelText(/prestación/i)).toBeDisabled();
    expect(screen.getByLabelText(/dependencia/i)).toBeDisabled();
    expect(screen.getByLabelText(/retorno/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /agregar/i })).toBeDisabled();

    const quitar = screen.getByRole('button', { name: /quitar/i });
    expect(quitar).toBeDisabled();
    await user.click(quitar);
    expect(onChange).not.toHaveBeenCalled();

    // La asistencia ya cargada sigue siendo legible.
    expect(screen.getByText('Kinesiología')).toBeInTheDocument();
  });

  it('con permiso de escritura (sin admin): todo operativo (triangulación) — no requiere admin (decisión 5)', async () => {
    const onChange = vi.fn();

    renderConPermiso(true, <AsistenciasEditor asistencias={[]} onChange={onChange} />);

    expect(screen.getByLabelText(/fecha/i)).toBeEnabled();

    await userEvent.type(screen.getByLabelText(/fecha/i), '2026-08-10');
    await userEvent.type(screen.getByLabelText(/prestación/i), 'Fonoaudiología');
    await userEvent.type(screen.getByLabelText(/dependencia/i), 'Terapia');
    await userEvent.type(screen.getByLabelText(/retorno/i), 'Domicilio');
    await userEvent.click(screen.getByRole('button', { name: /agregar/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
