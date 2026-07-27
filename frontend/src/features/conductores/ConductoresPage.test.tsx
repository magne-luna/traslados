import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Conductor } from '../../shared/types/conductor';
import type { ConductorRepository } from '../../shared/lib/conductores/ConductorRepository';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { VehiculoRepository } from '../../shared/lib/vehiculos/VehiculoRepository';
import { ConductorRepositoryProvider } from './ConductorRepositoryContext';
import { VehiculoRepositoryProvider } from '../vehiculos/VehiculoRepositoryContext';
import { ConductoresPage } from './ConductoresPage';

const perez: Conductor = {
  id: 'conductor-perez',
  apellido: 'Pérez',
  nombre: 'Carlos',
  documento: '15789456',
  domicilio: 'Calle 50 N° 1234, La Plata',
  cuil: '20-15789456-9',
  estado: 'operando',
  restricciones: [],
  asignaciones: [],
};

function buildFakeRepository(): ConductorRepository {
  return {
    list: vi.fn().mockResolvedValue([perez]),
    getById: vi.fn().mockResolvedValue(perez),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(perez),
  };
}

function buildFakeDocumentoRepository(): DocumentoRepository {
  return { listByEntity: vi.fn().mockResolvedValue([]), upload: vi.fn(), remove: vi.fn() };
}

function buildFakeVehiculoRepository(): VehiculoRepository {
  return { list: vi.fn().mockResolvedValue([]), getById: vi.fn().mockResolvedValue(null), create: vi.fn(), update: vi.fn() };
}

function renderPage(repository: ConductorRepository) {
  return render(
    <ConductorRepositoryProvider repository={repository}>
      <VehiculoRepositoryProvider repository={buildFakeVehiculoRepository()}>
        <ConductoresPage documentoRepository={buildFakeDocumentoRepository()} />
      </VehiculoRepositoryProvider>
    </ConductorRepositoryProvider>,
  );
}

// Composición raíz de la feature (tasks.md 4.2, 5.7): resuelve el ConductorRepository del
// context, wire de useConductores, y decide qué pantalla mostrar (listado o detalle) — mismo
// patrón que VehiculosPage.

describe('ConductoresPage', () => {
  it('carga y muestra el listado usando el repository inyectado por context', async () => {
    renderPage(buildFakeRepository());

    expect(await screen.findByText('Pérez')).toBeInTheDocument();
  });

  it('navega al detalle de alta al hacer click en "Nuevo conductor"', async () => {
    const user = userEvent.setup();
    renderPage(buildFakeRepository());

    await screen.findByText('Pérez');
    await user.click(screen.getByRole('button', { name: /nuevo conductor/i }));

    expect(screen.getByText('Nuevo conductor')).toBeInTheDocument();
  });

  it('navega al detalle de edición precargado al hacer click en "Editar"', async () => {
    const user = userEvent.setup();
    renderPage(buildFakeRepository());

    await screen.findByText('Pérez');
    await user.click(screen.getByRole('button', { name: /editar pérez/i }));
    await user.click(screen.getByRole('button', { name: /editar datos/i }));

    expect(screen.getByLabelText(/apellido/i)).toHaveValue('Pérez');
  });
});
