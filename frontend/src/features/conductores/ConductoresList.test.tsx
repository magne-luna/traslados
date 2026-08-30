import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderConQuery } from '../../shared/test/queryWrapper';
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
  observaciones: 'No traslada pacientes con carga física.',
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
  asignaciones: [],
};

const vehiculoAbc = { id: 'vehiculo-abc', patente: 'ABC123' } as Vehiculo;

const vehiculoRepositoryStub: VehiculoRepository = {
  list: async () => [vehiculoAbc],
  getById: async () => vehiculoAbc,
  create: async () => vehiculoAbc,
  update: async () => vehiculoAbc,
};

// paginacion-listados, Fase 3 (tasks.md 16.3): `ConductoresList` deja de tener estado propio de
// filtrado (mismo criterio que PacientesList 13.8, presentacional puro) — `busqueda`/`pagina`/
// `total`/`tamanio` llegan por props desde `useConductoresPaginado` (vía ConductoresPage), y
// `conductores` es SOLO la página actual, no el padrón completo.
function defaultProps(overrides: Partial<React.ComponentProps<typeof ConductoresList>> = {}): React.ComponentProps<
  typeof ConductoresList
> {
  return {
    conductores: [],
    loading: false,
    error: null,
    onSelect: vi.fn(),
    onCreateNew: vi.fn(),
    ahora: new Date('2026-07-26T12:00:00Z'),
    busqueda: '',
    onBusquedaChange: vi.fn(),
    pagina: 1,
    tamanio: 20,
    total: 0,
    onCambiarPagina: vi.fn(),
    ...overrides,
  };
}

function renderList(overrides: Partial<React.ComponentProps<typeof ConductoresList>> = {}) {
  return renderConQuery(
    <VehiculoRepositoryProvider repository={vehiculoRepositoryStub}>
      <ConductoresList {...defaultProps(overrides)} />
    </VehiculoRepositoryProvider>,
  );
}

function renderListConPermiso(puedeEscribir: boolean, overrides: Partial<React.ComponentProps<typeof ConductoresList>> = {}) {
  return renderConQuery(
    <PuedeEscribirContext.Provider value={puedeEscribir}>
      <VehiculoRepositoryProvider repository={vehiculoRepositoryStub}>
        <ConductoresList {...defaultProps(overrides)} />
      </VehiculoRepositoryProvider>
    </PuedeEscribirContext.Provider>,
  );
}

describe('ConductoresList', () => {
  it('muestra un indicador de carga mientras loading es true', () => {
    renderList({ conductores: [], loading: true });

    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('estado 1/3 — sin conductores cargados: total 0 y sin búsqueda muestra el estado vacío con acción de crear', async () => {
    const user = userEvent.setup();
    const onCreateNew = vi.fn();

    renderList({ conductores: [], total: 0, busqueda: '', onCreateNew });

    expect(screen.getByText(/no hay conductores/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /crear el primer conductor/i }));
    expect(onCreateNew).toHaveBeenCalledTimes(1);
  });

  it('estado 2/3 — búsqueda sin coincidencias: total 0 CON búsqueda muestra un mensaje distinto del vacío inicial', () => {
    renderList({ conductores: [], total: 0, busqueda: 'zzz-inexistente' });

    expect(screen.getByText(/ningún conductor coincide con "zzz-inexistente"/i)).toBeInTheDocument();
    expect(screen.queryByText(/no hay conductores cargados/i)).not.toBeInTheDocument();
  });

  it('muestra el error visible sin ocultar el resto de la pantalla', () => {
    renderList({ conductores: [], error: 'caído' });

    expect(screen.getByRole('alert')).toHaveTextContent('caído');
  });

  it('lista apellido, nombre y documento de cada conductor', () => {
    renderList({ conductores: [perez, gonzalez], total: 2 });

    expect(screen.getByText('Pérez')).toBeInTheDocument();
    expect(screen.getByText('Carlos')).toBeInTheDocument();
    expect(screen.getByText('González')).toBeInTheDocument();
    expect(screen.getByText('15789456')).toBeInTheDocument();
  });

  it('distingue el estado fuera de servicio con texto además de color (no solo color)', () => {
    renderList({ conductores: [perez, gonzalez], total: 2 });

    expect(screen.getByText(/fuera de servicio/i)).toBeInTheDocument();
  });

  it('dispara onSelect al hacer click en cualquier parte de la fila, no solo en el botón Editar', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    renderList({ conductores: [perez, gonzalez], total: 2, onSelect });

    await user.click(screen.getByText('Carlos'));
    expect(onSelect).toHaveBeenCalledWith(perez);
  });

  it('no duplica la llamada a onSelect cuando el click viene del botón Editar (triangulación)', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    renderList({ conductores: [perez, gonzalez], total: 2, onSelect });

    await user.click(screen.getByRole('button', { name: /editar pérez/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(perez);
  });

  it('muestra cuil, domicilio y teléfono de cada conductor', () => {
    renderList({ conductores: [perez, gonzalez], total: 2 });

    expect(screen.getByText('20-15789456-9')).toBeInTheDocument();
    expect(screen.getByText('Calle 50 N° 1234, La Plata')).toBeInTheDocument();
    expect(screen.getByText('221-555-1234')).toBeInTheDocument();
  });

  it('muestra "Sin datos" cuando el conductor no tiene teléfono cargado', () => {
    renderList({ conductores: [perez, gonzalez], total: 2 });

    expect(screen.getAllByText(/sin datos/i).length).toBeGreaterThan(0);
  });

  // D6-B (tasks.md 2C.5): el listado ya no muestra restricciones como dato estructurado aparte —
  // solo queda `observaciones` como texto libre (ya cubierto por el fixture `perez` de arriba).
  it('no muestra ninguna columna/celda de restricciones de perfil ni su estado vacío', () => {
    renderList({ conductores: [perez, gonzalez], total: 2 });

    expect(screen.queryByText(/restricciones de perfil/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^sin restricciones/i)).not.toBeInTheDocument();
  });

  it('resuelve la patente del vehículo asignado la semana actual contra VehiculoRepository', async () => {
    renderList({ conductores: [perez, gonzalez], total: 2 });

    expect(await screen.findByText('ABC123')).toBeInTheDocument();
  });

  it('indica que no hay vehículo asignado esta semana cuando no hay asignaciones', async () => {
    renderList({ conductores: [perez, gonzalez], total: 2 });

    await screen.findByText('ABC123');
    expect(screen.getByText(/sin vehículo asignado/i)).toBeInTheDocument();
  });

  // 16.3: el buscador ya no filtra en memoria — alimenta el término del hook vía prop.
  describe('ConductoresList — búsqueda alimenta el hook, no filtra en memoria', () => {
    it('escribir en el buscador llama a onBusquedaChange con el valor crudo (no filtra "conductores" localmente)', async () => {
      const user = userEvent.setup();
      const onBusquedaChange = vi.fn();

      renderList({ conductores: [perez, gonzalez], total: 2, onBusquedaChange });

      await user.type(screen.getByLabelText(/buscar conductor/i), 'x');
      expect(onBusquedaChange).toHaveBeenCalledWith('x');
      // Ambos siguen en pantalla: el componente ya no decide qué filas mostrar por su cuenta.
      expect(screen.getByText('Carlos')).toBeInTheDocument();
      expect(screen.getByText('Marcos')).toBeInTheDocument();
    });
  });

  // 16.3: <Paginador> montado con el total que llega por props.
  describe('ConductoresList — <Paginador>', () => {
    it('renderiza el total de resultados que llega por props', () => {
      renderList({ conductores: [perez], total: 45, pagina: 2, tamanio: 20 });

      expect(screen.getByText('45 resultados')).toBeInTheDocument();
      expect(screen.getByText(/página 2 de 3/i)).toBeInTheDocument();
    });

    it('click en "Siguiente" invoca onCambiarPagina con pagina + 1', async () => {
      const user = userEvent.setup();
      const onCambiarPagina = vi.fn();

      renderList({ conductores: [perez], total: 45, pagina: 2, tamanio: 20, onCambiarPagina });

      await user.click(screen.getByRole('button', { name: /página siguiente/i }));
      expect(onCambiarPagina).toHaveBeenCalledWith(3);
    });

    it('no monta el <Paginador> (fila de navegación) mientras sin resultados', () => {
      renderList({ conductores: [], total: 0, busqueda: '' });

      expect(screen.queryByText(/resultados/i)).not.toBeInTheDocument();
    });
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
    renderListConPermiso(false, { conductores: [], total: 0 });

    expect(screen.getByRole('button', { name: /crear el primer conductor/i })).toBeDisabled();
  });

  it('con permiso de escritura: "Nuevo conductor" y "Crear el primer conductor" están activables (triangulación)', () => {
    renderListConPermiso(true);
    expect(screen.getByRole('button', { name: /nuevo conductor/i })).toBeEnabled();
  });

  it('sin permiso de escritura: "Editar" por fila queda visible y no se puede activar, y la fila sigue navegando al detalle', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    renderListConPermiso(false, { conductores: [perez, gonzalez], total: 2, onSelect });

    const editar = screen.getByRole('button', { name: /editar pérez/i });
    expect(editar).toBeVisible();
    expect(editar).toBeDisabled();

    await user.click(screen.getByText('Carlos'));
    expect(onSelect).toHaveBeenCalledWith(perez);
  });

  it('con permiso de escritura: "Editar" por fila está activable (triangulación)', () => {
    renderListConPermiso(true, { conductores: [perez, gonzalez], total: 2 });
    expect(screen.getByRole('button', { name: /editar pérez/i })).toBeEnabled();
  });

  it('sin permiso de escritura: el <button> nativo "Ver detalle" queda deshabilitado por el envoltorio', () => {
    renderListConPermiso(false, { conductores: [perez, gonzalez], total: 2 });
    expect(screen.getAllByRole('button', { name: /^ver detalle$/i })[0]).toBeDisabled();
  });

  it('con permiso de escritura: el <button> nativo "Ver detalle" está activable (triangulación)', () => {
    renderListConPermiso(true, { conductores: [perez, gonzalez], total: 2 });
    expect(screen.getAllByRole('button', { name: /^ver detalle$/i })[0]).toBeEnabled();
  });
});

// Rol admin sin filas de permisos (design.md D5): el short-circuit ya está probado de punta a
// punta en usePuedeEscribir.test.tsx — acá solo se verifica que ConductoresList consume ese
// resultado, mismo criterio que PacientesList.test.tsx para el mismo escenario.
describe('ConductoresList — rol admin sin filas de permisos', () => {
  it('con puedeEscribir true (equivalente al short-circuit de admin sin filas): la acción de alta está activable', () => {
    renderListConPermiso(true, { conductores: [], total: 0 });
    expect(screen.getByRole('button', { name: /crear el primer conductor/i })).toBeEnabled();
  });
});
