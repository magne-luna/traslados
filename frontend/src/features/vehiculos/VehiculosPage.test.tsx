import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Vehiculo } from '../../shared/types/vehiculo';
import type { VehiculoRepository } from '../../shared/lib/vehiculos/VehiculoRepository';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { VehiculoRepositoryProvider } from './VehiculoRepositoryContext';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { VehiculosPage } from './VehiculosPage';

const etios: Vehiculo = {
  id: 'vehiculo-etios',
  patente: 'AC123DE',
  modelo: 'Toyota Etios',
  tipo: 'sedan',
  capacidad: 4,
  accesoriosCompatibles: ['silla-plegable'],
  estado: 'habilitado',
  kilometraje: 85_000,
  kilometrajeUltimoService: 82_000,
  fechaUltimoService: '2026-03-01',
  habilitaciones: [],
  gastos: [],
};

function buildFakeRepository(): VehiculoRepository {
  return {
    list: vi.fn().mockResolvedValue([etios]),
    getById: vi.fn().mockResolvedValue(etios),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(etios),
  };
}

function buildFakeDocumentoRepository(): DocumentoRepository {
  return {
    listByEntity: vi.fn().mockResolvedValue([]),
    upload: vi.fn(),
    remove: vi.fn(),
  };
}

function renderPage(repository: VehiculoRepository) {
  return render(
    <VehiculoRepositoryProvider repository={repository}>
      <VehiculosPage documentoRepository={buildFakeDocumentoRepository()} />
    </VehiculoRepositoryProvider>,
  );
}

describe('VehiculosPage', () => {
  it('carga y muestra el listado usando el repository inyectado por context', async () => {
    renderPage(buildFakeRepository());

    expect(await screen.findByText('AC123DE')).toBeInTheDocument();
  });

  it('navega al detalle de alta al hacer click en "Nuevo vehículo"', async () => {
    const user = userEvent.setup();
    renderPage(buildFakeRepository());

    await screen.findByText('AC123DE');
    await user.click(screen.getByRole('button', { name: /nuevo vehículo/i }));

    expect(screen.getByText('Nuevo vehículo')).toBeInTheDocument();
  });

  it('navega al detalle de edición precargado al hacer click en "Editar"', async () => {
    const user = userEvent.setup();
    renderPage(buildFakeRepository());

    await screen.findByText('AC123DE');
    await user.click(screen.getByRole('button', { name: /editar ac123de/i }));
    await user.click(screen.getByRole('button', { name: /editar datos/i }));

    expect(screen.getByLabelText(/^patente$/i)).toHaveValue('AC123DE');
  });
});

// Gateo de escritura — aviso de solo lectura (gateo-conductores, design.md D6, tasks.md 4.4): se
// monta en las dos vistas (listado y detalle), sin permiso de escritura.
function renderPageConPermiso(puedeEscribir: boolean, repository: VehiculoRepository) {
  return render(
    <PuedeEscribirContext.Provider value={puedeEscribir}>
      <VehiculoRepositoryProvider repository={repository}>
        <VehiculosPage documentoRepository={buildFakeDocumentoRepository()} />
      </VehiculoRepositoryProvider>
    </PuedeEscribirContext.Provider>,
  );
}

describe('VehiculosPage — aviso de solo lectura', () => {
  it('sin permiso de escritura: muestra el aviso de modo solo lectura en el listado', async () => {
    renderPageConPermiso(false, buildFakeRepository());

    await screen.findByText('AC123DE');
    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();
  });

  it('sin permiso de escritura: muestra el aviso también en el detalle (triangulación)', async () => {
    const user = userEvent.setup();
    renderPageConPermiso(false, buildFakeRepository());

    await screen.findByText('AC123DE');
    await user.click(screen.getByText('Toyota Etios'));

    expect(await screen.findByRole('button', { name: /editar datos/i })).toBeInTheDocument();
    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();
  });

  it('con permiso de escritura: no muestra ningún aviso', async () => {
    renderPageConPermiso(true, buildFakeRepository());

    await screen.findByText('AC123DE');
    expect(screen.queryByText(/solo lectura/i)).not.toBeInTheDocument();
  });
});

// Rol admin sin filas de permisos (design.md D5).
describe('VehiculosPage — rol admin sin filas de permisos', () => {
  it('con puedeEscribir true (equivalente al short-circuit de admin sin filas): no muestra ningún aviso', async () => {
    renderPageConPermiso(true, buildFakeRepository());

    await screen.findByText('AC123DE');
    expect(screen.queryByText(/solo lectura/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nuevo vehículo/i })).toBeEnabled();
  });
});
