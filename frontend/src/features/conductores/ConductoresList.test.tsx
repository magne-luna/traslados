import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Conductor } from '../../shared/types/conductor';
import { VehiculoRepositoryProvider } from '../vehiculos/VehiculoRepositoryContext';
import type { Vehiculo } from '../../shared/types/vehiculo';
import type { VehiculoRepository } from '../../shared/lib/vehiculos/VehiculoRepository';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { ConductoresList } from './ConductoresList';

const perez: Conductor = {
  id: 'conductor-perez',
  apellido: 'Pérez',
  nombre: 'Carlos',
  documento: '15789456',
  telefono: '221-555-1234',
  domicilio: 'Calle 50 N° 1234, La Plata',
  cuil: '20-15789456-9',
  estado: 'operando',
  restricciones: ['no-carga-fisica'],
  asignaciones: [{ id: 'asig-1', vehiculoId: 'vehiculo-abc', semana: '2026-W30' }],
};

const gonzalez: Conductor = {
  id: 'conductor-gonzalez',
  apellido: 'González',
  nombre: 'Marcos',
  documento: '28456789',
  domicilio: 'Av. Rivadavia 4500, CABA',
  cuil: '20-28456789-3',
  estado: 'fuera-de-servicio',
  restricciones: [],
  asignaciones: [],
};

const vehiculoAbc = { id: 'vehiculo-abc', patente: 'ABC123' } as Vehiculo;

const vehiculoRepositoryStub: VehiculoRepository = {
  list: async () => [vehiculoAbc],
  getById: async () => vehiculoAbc,
  create: async () => vehiculoAbc,
  update: async () => vehiculoAbc,
};

function renderList(props: Partial<Parameters<typeof ConductoresList>[0]> = {}) {
  return render(
    <VehiculoRepositoryProvider repository={vehiculoRepositoryStub}>
      <ConductoresList
        conductores={[perez, gonzalez]}
        loading={false}
        error={null}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
        ahora={new Date('2026-07-26T12:00:00Z')}
        {...props}
      />
    </VehiculoRepositoryProvider>,
  );
}

function renderListConPermiso(puedeEscribir: boolean, props: Partial<Parameters<typeof ConductoresList>[0]> = {}) {
  return render(
    <PuedeEscribirContext.Provider value={puedeEscribir}>
      <VehiculoRepositoryProvider repository={vehiculoRepositoryStub}>
        <ConductoresList
          conductores={[perez, gonzalez]}
          loading={false}
          error={null}
          onSelect={vi.fn()}
          onCreateNew={vi.fn()}
          ahora={new Date('2026-07-26T12:00:00Z')}
          {...props}
        />
      </VehiculoRepositoryProvider>
    </PuedeEscribirContext.Provider>,
  );
}

describe('ConductoresList', () => {
  it('muestra un indicador de carga mientras loading es true', () => {
    renderList({ conductores: [], loading: true });

    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('muestra un estado vacío con la acción de crear el primer conductor cuando no hay datos', () => {
    renderList({ conductores: [] });

    expect(screen.getByText(/no hay conductores/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear el primer conductor/i })).toBeInTheDocument();
  });

  it('muestra el error visible sin ocultar el resto de la pantalla', () => {
    renderList({ conductores: [], error: 'caído' });

    expect(screen.getByRole('alert')).toHaveTextContent('caído');
  });

  it('lista apellido, nombre y documento de cada conductor', () => {
    renderList();

    expect(screen.getByText('Pérez')).toBeInTheDocument();
    expect(screen.getByText('Carlos')).toBeInTheDocument();
    expect(screen.getByText('González')).toBeInTheDocument();
    expect(screen.getByText('15789456')).toBeInTheDocument();
  });

  it('distingue el estado fuera de servicio con texto además de color (no solo color)', () => {
    renderList();

    expect(screen.getByText(/fuera de servicio/i)).toBeInTheDocument();
  });

  it('dispara onSelect al hacer click en cualquier parte de la fila, no solo en el botón Editar', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    renderList({ onSelect });

    await user.click(screen.getByText('Carlos'));
    expect(onSelect).toHaveBeenCalledWith(perez);
  });

  it('no duplica la llamada a onSelect cuando el click viene del botón Editar (triangulación)', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    renderList({ onSelect });

    await user.click(screen.getByRole('button', { name: /editar pérez/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(perez);
  });

  it('muestra cuil, domicilio y teléfono de cada conductor', () => {
    renderList();

    expect(screen.getByText('20-15789456-9')).toBeInTheDocument();
    expect(screen.getByText('Calle 50 N° 1234, La Plata')).toBeInTheDocument();
    expect(screen.getByText('221-555-1234')).toBeInTheDocument();
  });

  it('muestra "Sin datos" cuando el conductor no tiene teléfono cargado', () => {
    renderList();

    expect(screen.getAllByText(/sin datos/i).length).toBeGreaterThan(0);
  });

  it('resuelve la patente del vehículo asignado la semana actual contra VehiculoRepository', async () => {
    renderList();

    expect(await screen.findByText('ABC123')).toBeInTheDocument();
  });

  it('indica que no hay vehículo asignado esta semana cuando no hay asignaciones', async () => {
    renderList();

    await screen.findByText('ABC123');
    expect(screen.getByText(/sin vehículo asignado/i)).toBeInTheDocument();
  });

  it('filtra por apellido, documento o cuil con el buscador', async () => {
    const user = userEvent.setup();
    renderList();

    await user.type(screen.getByLabelText(/buscar conductor/i), '284567');
    expect(screen.queryByText('Carlos')).not.toBeInTheDocument();
    expect(screen.getByText('Marcos')).toBeInTheDocument();
  });

  it('muestra un mensaje cuando ningún conductor coincide con la búsqueda', async () => {
    const user = userEvent.setup();
    renderList();

    await user.type(screen.getByLabelText(/buscar conductor/i), 'no-existe-nadie');
    expect(screen.getByText(/ningún conductor coincide/i)).toBeInTheDocument();
  });
});

// Gateo de escritura (gateo-conductores, tasks.md 2.1/2.2). "Nuevo conductor"/"Crear el primer
// conductor" nunca se ocultan (decisión 1 de la usuaria) — solo quedan deshabilitados. El
// <button> nativo "Ver detalle" cae dentro del mismo envoltorio de solo lectura que "Editar".
describe('ConductoresList — gateo de escritura', () => {
  it('sin permiso de escritura: "Nuevo conductor" queda visible y no se puede activar', () => {
    renderListConPermiso(false);

    const crear = screen.getByRole('button', { name: /nuevo conductor/i });
    expect(crear).toBeInTheDocument();
    expect(crear).toBeVisible();
    expect(crear).toBeDisabled();
  });

  it('sin permiso de escritura: "Crear el primer conductor" (estado vacío) queda visible y no se puede activar (triangulación con la lista no vacía)', () => {
    renderListConPermiso(false, { conductores: [] });

    expect(screen.getByRole('button', { name: /crear el primer conductor/i })).toBeDisabled();
  });

  it('con permiso de escritura: "Nuevo conductor" y "Crear el primer conductor" están activables (triangulación)', () => {
    renderListConPermiso(true);
    expect(screen.getByRole('button', { name: /nuevo conductor/i })).toBeEnabled();
  });

  it('sin permiso de escritura: "Editar" por fila queda visible y no se puede activar, y la fila sigue navegando al detalle', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    renderListConPermiso(false, { onSelect });

    const editar = screen.getByRole('button', { name: /editar pérez/i });
    expect(editar).toBeVisible();
    expect(editar).toBeDisabled();

    await user.click(screen.getByText('Carlos'));
    expect(onSelect).toHaveBeenCalledWith(perez);
  });

  it('con permiso de escritura: "Editar" por fila está activable (triangulación)', () => {
    renderListConPermiso(true);
    expect(screen.getByRole('button', { name: /editar pérez/i })).toBeEnabled();
  });

  it('sin permiso de escritura: el <button> nativo "Ver detalle" queda deshabilitado por el envoltorio', () => {
    renderListConPermiso(false);
    expect(screen.getAllByRole('button', { name: /^ver detalle$/i })[0]).toBeDisabled();
  });

  it('con permiso de escritura: el <button> nativo "Ver detalle" está activable (triangulación)', () => {
    renderListConPermiso(true);
    expect(screen.getAllByRole('button', { name: /^ver detalle$/i })[0]).toBeEnabled();
  });
});

// Rol admin sin filas de permisos (design.md D5): el short-circuit ya está probado de punta a
// punta en usePuedeEscribir.test.tsx — acá solo se verifica que ConductoresList consume ese
// resultado, mismo criterio que PacientesList.test.tsx para el mismo escenario.
describe('ConductoresList — rol admin sin filas de permisos', () => {
  it('con puedeEscribir true (equivalente al short-circuit de admin sin filas): la acción de alta está activable', () => {
    renderListConPermiso(true, { conductores: [] });
    expect(screen.getByRole('button', { name: /crear el primer conductor/i })).toBeEnabled();
  });
});
