import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderConQuery } from '../../shared/test/queryWrapper';
import userEvent from '@testing-library/user-event';
import type { Conductor } from '../../shared/types/conductor';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { VehiculoRepository } from '../../shared/lib/vehiculos/VehiculoRepository';
import { VehiculoRepositoryProvider } from '../vehiculos/VehiculoRepositoryContext';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { ConductorDetail } from './ConductorDetail';

const perez: Conductor = {
  id: 'conductor-perez',
  apellido: 'Pérez',
  nombre: 'Carlos',
  documento: '15789456',
  telefono: '221-555-1234',
  fechaNacimiento: '1985-03-20',
  domicilio: 'Calle 50 N° 1234, La Plata',
  cuil: '20-15789456-9',
  estado: 'operando',
  observaciones: 'No cargar sillas rígidas.',
  asignaciones: [],
};

function buildFakeDocumentoRepository(): DocumentoRepository {
  return {
    listByEntity: vi.fn().mockResolvedValue([]),
    upload: vi.fn(),
    remove: vi.fn(),
    resolverPrevisualizacion: vi.fn().mockResolvedValue(null),
    transferirAgrupacion: vi.fn(),
  };
}

function buildFakeVehiculoRepository(): VehiculoRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
  };
}

function renderDetail(props: Partial<Parameters<typeof ConductorDetail>[0]> = {}) {
  const crear = props.crear ?? vi.fn().mockResolvedValue(perez);
  const actualizar = props.actualizar ?? vi.fn().mockResolvedValue(perez);

  return renderConQuery(
    <VehiculoRepositoryProvider repository={buildFakeVehiculoRepository()}>
      <ConductorDetail
        conductor={props.conductor ?? null}
        crear={crear}
        actualizar={actualizar}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={props.onCreated ?? vi.fn()}
        onBack={props.onBack ?? vi.fn()}
      />
    </VehiculoRepositoryProvider>,
  );
}

function renderDetailConPermiso(puedeEscribir: boolean, props: Partial<Parameters<typeof ConductorDetail>[0]> = {}) {
  const crear = props.crear ?? vi.fn().mockResolvedValue(perez);
  const actualizar = props.actualizar ?? vi.fn().mockResolvedValue(perez);

  return renderConQuery(
    <PuedeEscribirContext.Provider value={puedeEscribir}>
      <VehiculoRepositoryProvider repository={buildFakeVehiculoRepository()}>
        <ConductorDetail
          conductor={props.conductor ?? null}
          crear={crear}
          actualizar={actualizar}
          documentoRepository={buildFakeDocumentoRepository()}
          onCreated={props.onCreated ?? vi.fn()}
          onBack={props.onBack ?? vi.fn()}
        />
      </VehiculoRepositoryProvider>
    </PuedeEscribirContext.Provider>,
  );
}

// Composición de la pantalla de detalle (tasks.md 5.6): summary de datos personales,
// restricciones y observaciones cuando no está editando, form de alta/edición, y las secciones
// de asignación semanal y documentos solo una vez que el conductor existe (tiene id) — mismo
// criterio que VehiculoDetail.

describe('ConductorDetail', () => {
  it('en alta (conductor null) muestra el form directamente, sin secciones de asignación/documentos', () => {
    renderDetail({ conductor: null });

    expect(screen.getByText('Nuevo conductor')).toBeInTheDocument();
    expect(screen.getByLabelText(/apellido/i)).toBeInTheDocument();
    expect(screen.queryByText(/asignación semanal/i)).not.toBeInTheDocument();
  });

  it('crea un conductor nuevo y notifica onCreated', async () => {
    const user = userEvent.setup();
    const crear = vi.fn().mockResolvedValue(perez);
    const onCreated = vi.fn();

    renderDetail({ conductor: null, crear, onCreated });

    await user.type(screen.getByLabelText(/apellido/i), 'Pérez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Carlos');
    await user.type(screen.getByLabelText(/documento/i), '15789456');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(crear).toHaveBeenCalled();
    expect(onCreated).toHaveBeenCalledWith(perez);
  });

  it('en edición muestra el resumen (datos, domicilio, CUIL, estado, observaciones) colapsado detrás de "Editar datos"', () => {
    renderDetail({ conductor: perez });

    expect(screen.getAllByText('Pérez').length).toBeGreaterThan(0);
    expect(screen.getByText('Carlos')).toBeInTheDocument();
    expect(screen.getByText(perez.domicilio)).toBeInTheDocument();
    expect(screen.getByText(perez.cuil)).toBeInTheDocument();
    expect(screen.getByText(/operando/i)).toBeInTheDocument();
    expect(screen.getByText('No cargar sillas rígidas.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /editar datos/i })).toBeInTheDocument();
  });

  // D6-B (tasks.md 2C.4): la ficha no muestra ningún dato estructurado de "restricciones" —
  // Observaciones es el único campo libre del perfil.
  it('no muestra ningún bloque de "restricciones de perfil" como dato estructurado aparte', () => {
    renderDetail({ conductor: perez });

    expect(screen.queryByText(/restricciones de perfil/i)).not.toBeInTheDocument();
  });

  it('muestra teléfono y fecha de nacimiento formateada en el resumen', () => {
    renderDetail({ conductor: perez });

    expect(screen.getByText('221-555-1234')).toBeInTheDocument();
    expect(screen.getByText('20/3/1985')).toBeInTheDocument();
  });

  it('muestra "Sin datos" en el resumen cuando teléfono o fecha de nacimiento no están cargados', () => {
    renderDetail({ conductor: { ...perez, telefono: undefined, fechaNacimiento: undefined } });

    expect(screen.getAllByText(/sin datos/i).length).toBeGreaterThanOrEqual(2);
  });

  it('muestra "Fuera de servicio" cuando el estado del conductor es fuera-de-servicio (triangulación)', () => {
    renderDetail({ conductor: { ...perez, estado: 'fuera-de-servicio' } });

    expect(screen.getByText(/fuera de servicio/i)).toBeInTheDocument();
  });

  it('al hacer click en "Editar datos" muestra el form precargado (triangulación con el flujo de alta)', async () => {
    const user = userEvent.setup();
    renderDetail({ conductor: perez });

    await user.click(screen.getByRole('button', { name: /editar datos/i }));

    expect(screen.getByLabelText(/apellido/i)).toHaveValue('Pérez');
  });

  it('muestra las secciones de asignación semanal y documentos cuando el conductor ya existe', () => {
    renderDetail({ conductor: perez });

    expect(screen.getByText(/asignación semanal/i)).toBeInTheDocument();
    expect(screen.getByText(/documentación/i)).toBeInTheDocument();
  });

  it('muestra el error del repository de forma visible sin dejar loading infinito', async () => {
    const user = userEvent.setup();
    const crear = vi.fn().mockRejectedValue(new Error('documento duplicado'));

    renderDetail({ conductor: null, crear });

    await user.type(screen.getByLabelText(/apellido/i), 'Pérez');
    await user.type(screen.getByLabelText(/^nombre$/i), 'Carlos');
    await user.type(screen.getByLabelText(/documento/i), '15789456');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText('documento duplicado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar/i })).toBeEnabled();
  });
});

// Gateo de escritura (gateo-conductores, tasks.md 2.2): "Editar datos" del resumen queda visible
// y deshabilitado sin permiso de escritura.
describe('ConductorDetail — gateo de escritura', () => {
  it('sin permiso de escritura: "Editar datos" queda visible y no se puede activar', () => {
    renderDetailConPermiso(false, { conductor: perez });

    const editar = screen.getByRole('button', { name: /editar datos/i });
    expect(editar).toBeVisible();
    expect(editar).toBeDisabled();
  });

  it('con permiso de escritura: "Editar datos" está activable (triangulación)', () => {
    renderDetailConPermiso(true, { conductor: perez });
    expect(screen.getByRole('button', { name: /editar datos/i })).toBeEnabled();
  });
});
