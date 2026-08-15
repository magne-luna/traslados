import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AsistenciaPrestacion } from '../../shared/types/factura';
import type { Prestacion } from '../../shared/types/prestacion';
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

const catalogoPrestaciones: Prestacion[] = [
  { id: 'prestacion-1', pacienteId: 'paciente-1', nombre: 'Kinesiología', activa: true },
  { id: 'prestacion-2', pacienteId: 'paciente-1', nombre: 'Fonoaudiología', activa: true },
];

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

// Selector de prestación del catálogo del paciente (bugfix UX: re-tipear el nombre 20 veces en
// altas de asistencias por día). Decisión confirmada con la usuaria: aplica a AMBAS modalidades
// cuando el paciente tiene catálogo activo (`prestaciones.filter(p => p.activa)`, filtrado por el
// caller — este componente no conoce el criterio de "activa"). Sin catálogo, fallback a texto
// libre para no romper pacientes sin prestaciones cargadas.
describe('AsistenciasEditor — selector de prestación del catálogo', () => {
  it('con catálogo: muestra un <select> con las prestaciones del paciente como opciones', () => {
    render(<AsistenciasEditor asistencias={[]} onChange={vi.fn()} prestaciones={catalogoPrestaciones} />);

    const select = screen.getByLabelText(/prestación/i);
    expect(select.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'Kinesiología' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Fonoaudiología' })).toBeInTheDocument();
  });

  it('sin catálogo (prestaciones=[]): hace fallback al <input> de texto libre de siempre', () => {
    render(<AsistenciasEditor asistencias={[]} onChange={vi.fn()} prestaciones={[]} />);

    const campo = screen.getByLabelText(/prestación/i);
    expect(campo.tagName).toBe('INPUT');
  });

  it('sin prop prestaciones (no provista): hace fallback al <input> de texto libre, igual que antes', () => {
    render(<AsistenciasEditor asistencias={[]} onChange={vi.fn()} />);

    const campo = screen.getByLabelText(/prestación/i);
    expect(campo.tagName).toBe('INPUT');
  });

  it('con catálogo: al elegir una opción y agregar, guarda el nombre (no el id) en la nueva asistencia', async () => {
    const onChange = vi.fn();
    render(<AsistenciasEditor asistencias={[]} onChange={onChange} prestaciones={catalogoPrestaciones} />);

    await userEvent.type(screen.getByLabelText(/fecha/i), '2026-08-10');
    await userEvent.selectOptions(screen.getByLabelText(/prestación/i), 'Fonoaudiología');
    await userEvent.type(screen.getByLabelText(/dependencia/i), 'Terapia');
    await userEvent.type(screen.getByLabelText(/retorno/i), 'Domicilio');
    await userEvent.click(screen.getByRole('button', { name: /agregar/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const nuevaLista = onChange.mock.calls[0]?.[0] as AsistenciaPrestacion[];
    expect(nuevaLista[0]).toMatchObject({ prestacion: 'Fonoaudiología' });
  });

  it('con derivada seteada (modalidad por-prestacion): la fila nueva viene preseleccionada con esa prestación, pero se puede cambiar', async () => {
    const onChange = vi.fn();
    render(
      <AsistenciasEditor
        asistencias={[]}
        onChange={onChange}
        prestaciones={catalogoPrestaciones}
        prestacionPreseleccionada="Kinesiología"
      />,
    );

    expect(screen.getByLabelText(/prestación/i)).toHaveValue('prestacion-1');

    await userEvent.type(screen.getByLabelText(/fecha/i), '2026-08-10');
    await userEvent.selectOptions(screen.getByLabelText(/prestación/i), 'Fonoaudiología');
    await userEvent.type(screen.getByLabelText(/dependencia/i), 'Terapia');
    await userEvent.type(screen.getByLabelText(/retorno/i), 'Domicilio');
    await userEvent.click(screen.getByRole('button', { name: /agregar/i }));

    const nuevaLista = onChange.mock.calls[0]?.[0] as AsistenciaPrestacion[];
    expect(nuevaLista[0]).toMatchObject({ prestacion: 'Fonoaudiología' });
  });
});
