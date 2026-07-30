import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Vehiculo } from '../../shared/types/vehiculo';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { VehiculoDetail } from './VehiculoDetail';

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
  habilitaciones: [{ tipo: 'vtv', fechaEmision: '2026-01-01', fechaVencimiento: '2027-01-01' }],
  gastos: [],
};

function buildFakeDocumentoRepository(): DocumentoRepository {
  return {
    listByEntity: vi.fn().mockResolvedValue([]),
    upload: vi.fn(),
    remove: vi.fn(),
  };
}

describe('VehiculoDetail — modo alta (vehiculo null)', () => {
  it('solo muestra el formulario general, sin mantenimiento, gastos ni documentos', () => {
    render(
      <VehiculoDetail
        vehiculo={null}
        crear={vi.fn()}
        actualizar={vi.fn()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/^patente$/i)).toBeInTheDocument();
    expect(screen.queryByText(/registrar gasto/i)).not.toBeInTheDocument();
  });

  it('al guardar, llama a crear() con los datos del form y avisa onCreated', async () => {
    const user = userEvent.setup();
    const creado = { ...etios, id: 'nuevo-1', patente: 'ZZ000ZZ' };
    const crear = vi.fn().mockResolvedValue(creado);
    const onCreated = vi.fn();

    render(
      <VehiculoDetail
        vehiculo={null}
        crear={crear}
        actualizar={vi.fn()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={onCreated}
        onBack={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/^patente$/i), 'ZZ000ZZ');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(crear).toHaveBeenCalledWith(expect.objectContaining({ patente: 'ZZ000ZZ', gastos: [], habilitaciones: [] }));
    expect(onCreated).toHaveBeenCalledWith(creado);
  });
});

describe('VehiculoDetail — modo edición', () => {
  it('por defecto muestra un resumen de solo lectura (sin form) junto con mantenimiento, gastos y documentos', async () => {
    render(
      <VehiculoDetail
        vehiculo={etios}
        crear={vi.fn()}
        actualizar={vi.fn()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getAllByText('AC123DE').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/^patente$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /editar datos/i })).toBeInTheDocument();
    expect(screen.getAllByText(/vtv/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/no hay gastos/i)).toBeInTheDocument();
    expect(await screen.findByText('Cédula')).toBeInTheDocument();
  });

  it('al apretar "Editar datos" muestra el form precargado', async () => {
    const user = userEvent.setup();

    render(
      <VehiculoDetail
        vehiculo={etios}
        crear={vi.fn()}
        actualizar={vi.fn()}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar datos/i }));

    expect(screen.getByLabelText(/^patente$/i)).toHaveValue('AC123DE');
  });

  it('al guardar los datos generales, llama a actualizar(id, valores) y vuelve al resumen', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockResolvedValue(etios);

    render(
      <VehiculoDetail
        vehiculo={etios}
        crear={vi.fn()}
        actualizar={actualizar}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar datos/i }));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(actualizar).toHaveBeenCalledWith('vehiculo-etios', expect.objectContaining({ patente: 'AC123DE' }));
    expect(await screen.findByRole('button', { name: /editar datos/i })).toBeInTheDocument();
  });

  it('al registrar un gasto, persiste vía actualizar(id, { gastos })', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockResolvedValue(etios);

    render(
      <VehiculoDetail
        vehiculo={etios}
        crear={vi.fn()}
        actualizar={actualizar}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText(/fecha/i), '2026-07-20');
    await user.type(screen.getByLabelText(/monto/i), '5000');
    await user.click(screen.getByRole('button', { name: /registrar/i }));

    expect(actualizar).toHaveBeenCalledWith('vehiculo-etios', {
      gastos: [expect.objectContaining({ fecha: '2026-07-20', monto: 5000 })],
    });
  });

  it('muestra el error del repository si actualizar falla', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockRejectedValue(new Error('patente duplicada'));

    render(
      <VehiculoDetail
        vehiculo={etios}
        crear={vi.fn()}
        actualizar={actualizar}
        documentoRepository={buildFakeDocumentoRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar datos/i }));
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText('patente duplicada')).toBeInTheDocument();
  });
});

// Gateo de escritura (gateo-conductores, tasks.md 3.2): "Editar datos" del resumen queda visible
// y deshabilitado sin permiso de escritura.
describe('VehiculoDetail — gateo de escritura', () => {
  it('sin permiso de escritura: "Editar datos" queda visible y no se puede activar', () => {
    render(
      <PuedeEscribirContext.Provider value={false}>
        <VehiculoDetail
          vehiculo={etios}
          crear={vi.fn()}
          actualizar={vi.fn()}
          documentoRepository={buildFakeDocumentoRepository()}
          onCreated={vi.fn()}
          onBack={vi.fn()}
        />
      </PuedeEscribirContext.Provider>,
    );

    const editar = screen.getByRole('button', { name: /editar datos/i });
    expect(editar).toBeVisible();
    expect(editar).toBeDisabled();
  });

  it('con permiso de escritura: "Editar datos" está activable (triangulación)', () => {
    render(
      <PuedeEscribirContext.Provider value={true}>
        <VehiculoDetail
          vehiculo={etios}
          crear={vi.fn()}
          actualizar={vi.fn()}
          documentoRepository={buildFakeDocumentoRepository()}
          onCreated={vi.fn()}
          onBack={vi.fn()}
        />
      </PuedeEscribirContext.Provider>,
    );

    expect(screen.getByRole('button', { name: /editar datos/i })).toBeEnabled();
  });
});
