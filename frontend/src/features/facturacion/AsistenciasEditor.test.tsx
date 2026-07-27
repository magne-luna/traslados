import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AsistenciaPrestacion } from '../../shared/types/factura';
import { AsistenciasEditor } from './AsistenciasEditor';

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
