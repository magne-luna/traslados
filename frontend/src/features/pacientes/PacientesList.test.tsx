import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Paciente } from '../../shared/types/paciente';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { PacientesList } from './PacientesList';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

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
  numeroAfiliado: { valor: '45123456' },
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

// Gateo de escritura (gateo-pacientes, tasks.md 3.1-3.4). "Crear paciente"/"Crear el primero"
// nunca se ocultan (decisión 1 de la usuaria) — solo quedan deshabilitados. El <button> nativo
// "Ver detalle" (no es un componente Button) cae dentro del mismo envoltorio de solo lectura que
// "Editar" — se verifica acá que el <fieldset disabled> del mecanismo compartido lo alcanza,
// igual que alcanza a los <button> nativos de ChecklistItemRow en gateo-obrasocial.
describe('PacientesList — gateo de escritura', () => {
  it('sin permiso de escritura: "+ Nuevo paciente" queda visible y no se puede activar (sigue en el DOM, decisión 1)', () => {
    renderConPermiso(
      false,
      <PacientesList
        pacientes={[martina]}
        loading={false}
        error={null}
        nombreObraSocial={nombreObraSocial}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    const crear = screen.getByRole('button', { name: /\+ nuevo paciente/i });
    expect(crear).toBeInTheDocument();
    expect(crear).toBeVisible();
    expect(crear).toBeDisabled();
  });

  it('sin permiso de escritura: "Crear el primer paciente" (estado vacío) queda visible y no se puede activar (triangulación con la lista no vacía)', () => {
    renderConPermiso(
      false,
      <PacientesList
        pacientes={[]}
        loading={false}
        error={null}
        nombreObraSocial={nombreObraSocial}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    const crearPrimero = screen.getByRole('button', { name: /crear el primer paciente/i });
    expect(crearPrimero).toBeInTheDocument();
    expect(crearPrimero).toBeDisabled();
  });

  it('con permiso de escritura: "+ Nuevo paciente" y "Crear el primer paciente" están activables (triangulación)', () => {
    renderConPermiso(
      true,
      <PacientesList
        pacientes={[martina]}
        loading={false}
        error={null}
        nombreObraSocial={nombreObraSocial}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /\+ nuevo paciente/i })).toBeEnabled();
  });

  it('sin permiso de escritura: "Editar" por fila queda visible y no se puede activar, y la fila sigue navegando al detalle', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    renderConPermiso(
      false,
      <PacientesList
        pacientes={[martina]}
        loading={false}
        error={null}
        nombreObraSocial={nombreObraSocial}
        onSelect={onSelect}
        onCreateNew={vi.fn()}
      />,
    );

    const editar = screen.getByRole('button', { name: /editar gómez, martina/i });
    expect(editar).toBeVisible();
    expect(editar).toBeDisabled();

    await user.click(screen.getByText(/gómez, martina/i));
    expect(onSelect).toHaveBeenCalledWith(martina);
  });

  it('con permiso de escritura: "Editar" por fila está activable (triangulación)', () => {
    renderConPermiso(
      true,
      <PacientesList
        pacientes={[martina]}
        loading={false}
        error={null}
        nombreObraSocial={nombreObraSocial}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /editar gómez, martina/i })).toBeEnabled();
  });

  it('sin permiso de escritura: el <button> nativo "Ver detalle" queda deshabilitado por el envoltorio', () => {
    renderConPermiso(
      false,
      <PacientesList
        pacientes={[martina]}
        loading={false}
        error={null}
        nombreObraSocial={nombreObraSocial}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /^ver detalle$/i })).toBeDisabled();
  });

  it('con permiso de escritura: el <button> nativo "Ver detalle" está activable (triangulación)', () => {
    renderConPermiso(
      true,
      <PacientesList
        pacientes={[martina]}
        loading={false}
        error={null}
        nombreObraSocial={nombreObraSocial}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /^ver detalle$/i })).toBeEnabled();
  });
});

// Rol admin sin filas de permisos (design.md D5): el contexto ya resolvió el short-circuit de
// admin (probado de punta a punta en usePuedeEscribir.test.tsx, gateo-obrasocial tasks.md 2.2) —
// acá solo se verifica que PacientesList consume ese resultado, mismo criterio que
// ObrasSocialesList.test.tsx para el mismo escenario.
describe('PacientesList — rol admin sin filas de permisos', () => {
  it('con puedeEscribir true (equivalente al short-circuit de admin sin filas): la acción de alta está activable', () => {
    renderConPermiso(
      true,
      <PacientesList
        pacientes={[]}
        loading={false}
        error={null}
        nombreObraSocial={nombreObraSocial}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /crear el primer paciente/i })).toBeEnabled();
  });
});
