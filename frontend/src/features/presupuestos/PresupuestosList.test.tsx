import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Presupuesto } from '../../shared/types/presupuesto';
import { PresupuestosList } from './PresupuestosList';

const presupuestoMartina: Presupuesto = {
  id: 'presupuesto-martina-1',
  pacienteId: 'paciente-martina',
  obraSocialId: 'osecac',
  monto: 150_000,
  fechaEmision: '2026-06-01',
};

const presupuestoLucas: Presupuesto = {
  id: 'presupuesto-lucas-1',
  pacienteId: 'paciente-lucas',
  obraSocialId: 'swiss-medical',
  monto: 80_000,
  fechaEmision: '2026-06-10',
};

const nombrePaciente = (id: string) =>
  ({ 'paciente-martina': 'Gómez, Martina', 'paciente-lucas': 'Pérez, Lucas' })[id] ?? id;
const nombreObraSocial = (id: string) => ({ osecac: 'OSECAC', 'swiss-medical': 'Swiss Medical' })[id] ?? id;
const sinAutorizacion = () => null;

describe('PresupuestosList', () => {
  it('muestra un indicador de carga mientras loading es true', () => {
    render(
      <PresupuestosList
        presupuestos={[]}
        loading
        error={null}
        nombrePaciente={nombrePaciente}
        nombreObraSocial={nombreObraSocial}
        estadoAutorizacion={sinAutorizacion}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('muestra un estado vacío con acción de crear cuando no hay presupuestos', async () => {
    const user = userEvent.setup();
    const onCreateNew = vi.fn();

    render(
      <PresupuestosList
        presupuestos={[]}
        loading={false}
        error={null}
        nombrePaciente={nombrePaciente}
        nombreObraSocial={nombreObraSocial}
        estadoAutorizacion={sinAutorizacion}
        onSelect={vi.fn()}
        onCreateNew={onCreateNew}
      />,
    );

    expect(screen.getByText(/no hay presupuestos/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /crear/i }));
    expect(onCreateNew).toHaveBeenCalledTimes(1);
  });

  it('muestra un mensaje de error visible sin quedar en loading infinito', () => {
    render(
      <PresupuestosList
        presupuestos={[]}
        loading={false}
        error="no se pudo conectar"
        nombrePaciente={nombrePaciente}
        nombreObraSocial={nombreObraSocial}
        estadoAutorizacion={sinAutorizacion}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    expect(screen.getByText(/no se pudo conectar/i)).toBeInTheDocument();
    expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument();
  });

  it('muestra cada tarjeta con paciente, obra social, monto y fecha de emisión', () => {
    render(
      <PresupuestosList
        presupuestos={[presupuestoMartina]}
        loading={false}
        error={null}
        nombrePaciente={nombrePaciente}
        nombreObraSocial={nombreObraSocial}
        estadoAutorizacion={sinAutorizacion}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    expect(screen.getByText('Gómez, Martina')).toBeInTheDocument();
    expect(screen.getByText('OSECAC')).toBeInTheDocument();
    expect(screen.getByText(/150.000|150000/)).toBeInTheDocument();
    expect(screen.getByText('2026-06-01')).toBeInTheDocument();
  });

  it('muestra el chip de estado de la autorización cuando ya existe una respuesta', () => {
    render(
      <PresupuestosList
        presupuestos={[presupuestoMartina]}
        loading={false}
        error={null}
        nombrePaciente={nombrePaciente}
        nombreObraSocial={nombreObraSocial}
        estadoAutorizacion={() => 'autorizada'}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    expect(screen.getByText('Autorizada')).toBeInTheDocument();
  });

  it('muestra "Sin autorización" cuando todavía no hay respuesta de la obra social', () => {
    render(
      <PresupuestosList
        presupuestos={[presupuestoMartina]}
        loading={false}
        error={null}
        nombrePaciente={nombrePaciente}
        nombreObraSocial={nombreObraSocial}
        estadoAutorizacion={sinAutorizacion}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    expect(screen.getByText('Sin autorización')).toBeInTheDocument();
  });

  it('filtra por nombre de paciente u obra social con el buscador', async () => {
    const user = userEvent.setup();

    render(
      <PresupuestosList
        presupuestos={[presupuestoMartina, presupuestoLucas]}
        loading={false}
        error={null}
        nombrePaciente={nombrePaciente}
        nombreObraSocial={nombreObraSocial}
        estadoAutorizacion={sinAutorizacion}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    await user.type(screen.getByRole('textbox', { name: /buscar presupuesto/i }), 'swiss');

    expect(screen.getByText('Pérez, Lucas')).toBeInTheDocument();
    expect(screen.queryByText('Gómez, Martina')).not.toBeInTheDocument();
  });

  it('dispara onSelect al hacer click en cualquier parte de la tarjeta', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <PresupuestosList
        presupuestos={[presupuestoMartina]}
        loading={false}
        error={null}
        nombrePaciente={nombrePaciente}
        nombreObraSocial={nombreObraSocial}
        estadoAutorizacion={sinAutorizacion}
        onSelect={onSelect}
        onCreateNew={vi.fn()}
      />,
    );

    await user.click(screen.getByText('Gómez, Martina'));
    expect(onSelect).toHaveBeenCalledWith(presupuestoMartina);
  });

  it('el botón Editar abre el detalle sin duplicar por la propagación del click de la tarjeta', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <PresupuestosList
        presupuestos={[presupuestoMartina]}
        loading={false}
        error={null}
        nombrePaciente={nombrePaciente}
        nombreObraSocial={nombreObraSocial}
        estadoAutorizacion={sinAutorizacion}
        onSelect={onSelect}
        onCreateNew={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar gómez, martina/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(presupuestoMartina);
  });
});
