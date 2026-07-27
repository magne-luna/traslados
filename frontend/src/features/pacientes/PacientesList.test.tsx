import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Paciente } from '../../shared/types/paciente';
import { PacientesList } from './PacientesList';

const martina: Paciente = {
  id: 'paciente-martina',
  apellido: 'Gómez',
  nombre: 'Martina',
  fechaNacimiento: '2015-03-12',
  dni: '45123456',
  cuilTitular: '27-30111222-4',
  diagnostico: 'Parálisis cerebral',
  accesorioMovilidad: [],
  obraSocialId: 'osecac',
  numeroAfiliado: { formato: 'numero-documento', valor: '45123456' },
  cud: null,
  direcciones: [],
  personasACargo: [],
  amparoJudicial: false,
};

const nombreObraSocial = (id: string | null) => (id === 'osecac' ? 'OSECAC' : 'Sin obra social');

describe('PacientesList', () => {
  it('muestra un indicador de carga mientras loading es true', () => {
    render(
      <PacientesList
        pacientes={[]}
        loading
        error={null}
        nombreObraSocial={nombreObraSocial}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('muestra un estado vacío con acción de crear cuando no hay pacientes (triangulación con loading)', async () => {
    const user = userEvent.setup();
    const onCreateNew = vi.fn();

    render(
      <PacientesList
        pacientes={[]}
        loading={false}
        error={null}
        nombreObraSocial={nombreObraSocial}
        onSelect={vi.fn()}
        onCreateNew={onCreateNew}
      />,
    );

    expect(screen.getByText(/no hay pacientes/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /crear/i }));
    expect(onCreateNew).toHaveBeenCalledTimes(1);
  });

  it('muestra un mensaje de error visible sin quedar en loading infinito', () => {
    render(
      <PacientesList
        pacientes={[]}
        loading={false}
        error="no se pudo conectar"
        nombreObraSocial={nombreObraSocial}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    expect(screen.getByText(/no se pudo conectar/i)).toBeInTheDocument();
    expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument();
  });

  it('muestra cada fila con apellido y nombre, DNI y la obra social asignada', () => {
    render(
      <PacientesList
        pacientes={[martina]}
        loading={false}
        error={null}
        nombreObraSocial={nombreObraSocial}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    expect(screen.getByText(/gómez, martina/i)).toBeInTheDocument();
    expect(screen.getAllByText('45123456').length).toBeGreaterThan(0);
    expect(screen.getByText('OSECAC')).toBeInTheDocument();
  });

  it('dispara onSelect al hacer click en cualquier parte de la fila', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <PacientesList
        pacientes={[martina]}
        loading={false}
        error={null}
        nombreObraSocial={nombreObraSocial}
        onSelect={onSelect}
        onCreateNew={vi.fn()}
      />,
    );

    await user.click(screen.getByText(/gómez, martina/i));
    expect(onSelect).toHaveBeenCalledWith(martina);
  });

  it('el botón Editar abre el detalle sin togglear/duplicar por la propagación del click de la fila', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <PacientesList
        pacientes={[martina]}
        loading={false}
        error={null}
        nombreObraSocial={nombreObraSocial}
        onSelect={onSelect}
        onCreateNew={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar gómez, martina/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(martina);
  });
});
