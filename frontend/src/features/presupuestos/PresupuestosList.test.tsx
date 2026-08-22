import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Presupuesto } from '../../shared/types/presupuesto';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { PresupuestosList } from './PresupuestosList';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

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
const nombrePrestacion = (id: string) => ({ 'prestacion-kine': 'Kinesiología', 'prestacion-fono': 'Fonoaudiología' })[id] ?? id;
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
        nombrePrestacion={nombrePrestacion}
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
        nombrePrestacion={nombrePrestacion}
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
        nombrePrestacion={nombrePrestacion}
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
        nombrePrestacion={nombrePrestacion}
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
        nombrePrestacion={nombrePrestacion}
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
        nombrePrestacion={nombrePrestacion}
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
        nombrePrestacion={nombrePrestacion}
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
        nombrePrestacion={nombrePrestacion}
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
        nombrePrestacion={nombrePrestacion}
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

// Gateo de escritura (gateo-facturacion, tasks.md 2.1/2.2, design.md D1). "+ Nuevo
// presupuesto"/"Crear el primero" nunca se ocultan (decisión 1 de la usuaria) — solo quedan
// deshabilitados. El <button> nativo "Ver detalle" cae dentro del mismo envoltorio de solo
// lectura que "Editar" (mismo patrón que PacientesList/gateo-pacientes).
describe('PresupuestosList — gateo de escritura', () => {
  it('sin permiso de escritura: "+ Nuevo presupuesto" queda visible y no se puede activar', () => {
    renderConPermiso(
      false,
      <PresupuestosList
        presupuestos={[presupuestoMartina]}
        loading={false}
        error={null}
        nombrePaciente={nombrePaciente}
        nombreObraSocial={nombreObraSocial}
        nombrePrestacion={nombrePrestacion}
        estadoAutorizacion={sinAutorizacion}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    const crear = screen.getByRole('button', { name: /\+ nuevo presupuesto/i });
    expect(crear).toBeInTheDocument();
    expect(crear).toBeVisible();
    expect(crear).toBeDisabled();
  });

  it('sin permiso de escritura: "Crear el primer presupuesto" (estado vacío) queda visible y no se puede activar (triangulación)', () => {
    renderConPermiso(
      false,
      <PresupuestosList
        presupuestos={[]}
        loading={false}
        error={null}
        nombrePaciente={nombrePaciente}
        nombreObraSocial={nombreObraSocial}
        nombrePrestacion={nombrePrestacion}
        estadoAutorizacion={sinAutorizacion}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /crear el primer presupuesto/i })).toBeDisabled();
  });

  it('con permiso de escritura: "+ Nuevo presupuesto" y "Crear el primero" están activables (triangulación)', () => {
    renderConPermiso(
      true,
      <PresupuestosList
        presupuestos={[presupuestoMartina]}
        loading={false}
        error={null}
        nombrePaciente={nombrePaciente}
        nombreObraSocial={nombreObraSocial}
        nombrePrestacion={nombrePrestacion}
        estadoAutorizacion={sinAutorizacion}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /\+ nuevo presupuesto/i })).toBeEnabled();
  });

  it('sin permiso de escritura: "Editar" por fila y el <button> nativo "Ver detalle" quedan inertes, y la fila sigue navegando al detalle', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    renderConPermiso(
      false,
      <PresupuestosList
        presupuestos={[presupuestoMartina]}
        loading={false}
        error={null}
        nombrePaciente={nombrePaciente}
        nombreObraSocial={nombreObraSocial}
        nombrePrestacion={nombrePrestacion}
        estadoAutorizacion={sinAutorizacion}
        onSelect={onSelect}
        onCreateNew={vi.fn()}
      />,
    );

    const editar = screen.getByRole('button', { name: /editar gómez, martina/i });
    expect(editar).toBeVisible();
    expect(editar).toBeDisabled();
    expect(screen.getByRole('button', { name: /^ver detalle$/i })).toBeDisabled();

    await user.click(screen.getByText(/gómez, martina/i));
    expect(onSelect).toHaveBeenCalledWith(presupuestoMartina);
  });

  it('con permiso de escritura: "Editar" y "Ver detalle" están activables (triangulación)', () => {
    renderConPermiso(
      true,
      <PresupuestosList
        presupuestos={[presupuestoMartina]}
        loading={false}
        error={null}
        nombrePaciente={nombrePaciente}
        nombreObraSocial={nombreObraSocial}
        nombrePrestacion={nombrePrestacion}
        estadoAutorizacion={sinAutorizacion}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /editar gómez, martina/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^ver detalle$/i })).toBeEnabled();
  });

  it('rol admin sin filas de permisos (equivalente puedeEscribir=true): la acción de alta está activable', () => {
    renderConPermiso(
      true,
      <PresupuestosList
        presupuestos={[]}
        loading={false}
        error={null}
        nombrePaciente={nombrePaciente}
        nombreObraSocial={nombreObraSocial}
        nombrePrestacion={nombrePrestacion}
        estadoAutorizacion={sinAutorizacion}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /crear el primer presupuesto/i })).toBeEnabled();
  });
});

// presupuestos-vigencia-datos-traslado-vista-previa, tasks.md 8.1, design.md D5.
describe('PresupuestosList — prestación y vigencia (tasks.md 8.1)', () => {
  it('presupuesto con prestacionId (modalidad por-prestacion): muestra el nombre resuelto de la prestación', () => {
    render(
      <PresupuestosList
        presupuestos={[{ ...presupuestoMartina, prestacionId: 'prestacion-kine' }]}
        loading={false}
        error={null}
        nombrePaciente={nombrePaciente}
        nombreObraSocial={nombreObraSocial}
        nombrePrestacion={nombrePrestacion}
        estadoAutorizacion={sinAutorizacion}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    expect(screen.getByText('Kinesiología')).toBeInTheDocument();
    expect(screen.queryByText('Sin prestación asociada')).not.toBeInTheDocument();
  });

  it('presupuesto con lineas[] (modalidad general con desglose): muestra la primera prestación + "+N"', () => {
    render(
      <PresupuestosList
        presupuestos={[
          {
            ...presupuestoMartina,
            lineas: [
              { id: 'l1', prestacionId: 'prestacion-kine', monto: 100, orden: 1 },
              { id: 'l2', prestacionId: 'prestacion-fono', monto: 50, orden: 2 },
            ],
          },
        ]}
        loading={false}
        error={null}
        nombrePaciente={nombrePaciente}
        nombreObraSocial={nombreObraSocial}
        nombrePrestacion={nombrePrestacion}
        estadoAutorizacion={sinAutorizacion}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    expect(screen.getByText('Kinesiología +1')).toBeInTheDocument();
  });

  it('presupuesto sin prestacionId ni lineas: chip "Sin prestación asociada", nunca una celda vacía', () => {
    render(
      <PresupuestosList
        presupuestos={[presupuestoMartina]}
        loading={false}
        error={null}
        nombrePaciente={nombrePaciente}
        nombreObraSocial={nombreObraSocial}
        nombrePrestacion={nombrePrestacion}
        estadoAutorizacion={sinAutorizacion}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    expect(screen.getByText('Sin prestación asociada')).toBeInTheDocument();
  });

  it('muestra el rango de vigencia cuando está cargada', () => {
    render(
      <PresupuestosList
        presupuestos={[{ ...presupuestoMartina, vigenciaDesde: '2026-02-01', vigenciaHasta: '2027-01-31' }]}
        loading={false}
        error={null}
        nombrePaciente={nombrePaciente}
        nombreObraSocial={nombreObraSocial}
        nombrePrestacion={nombrePrestacion}
        estadoAutorizacion={sinAutorizacion}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    expect(screen.getByText('2026-02-01 – 2027-01-31')).toBeInTheDocument();
  });

  it('sin vigencia cargada: muestra "Sin vigencia cargada", nunca un rango inventado', () => {
    render(
      <PresupuestosList
        presupuestos={[presupuestoMartina]}
        loading={false}
        error={null}
        nombrePaciente={nombrePaciente}
        nombreObraSocial={nombreObraSocial}
        nombrePrestacion={nombrePrestacion}
        estadoAutorizacion={sinAutorizacion}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    expect(screen.getByText('Sin vigencia cargada')).toBeInTheDocument();
  });

  it('el buscador también filtra por nombre de prestación', async () => {
    const user = userEvent.setup();

    render(
      <PresupuestosList
        presupuestos={[
          { ...presupuestoMartina, prestacionId: 'prestacion-kine' },
          { ...presupuestoLucas, prestacionId: 'prestacion-fono' },
        ]}
        loading={false}
        error={null}
        nombrePaciente={nombrePaciente}
        nombreObraSocial={nombreObraSocial}
        nombrePrestacion={nombrePrestacion}
        estadoAutorizacion={sinAutorizacion}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    await user.type(screen.getByRole('textbox', { name: /buscar presupuesto/i }), 'fonoaudiología');

    expect(screen.getByText('Pérez, Lucas')).toBeInTheDocument();
    expect(screen.queryByText('Gómez, Martina')).not.toBeInTheDocument();
  });
});
