import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Factura } from '../../shared/types/factura';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { FacturasList } from './FacturasList';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

function factura(overrides: Partial<Factura> & Pick<Factura, 'id' | 'pacienteId' | 'estado'>): Factura {
  return {
    descripcion: '',
    dias: 10,
    valorKm: 100,
    monto: 5000,
    fechaInicial: '2026-08-01',
    fechaTope: '2026-08-31',
    tipoComprobante: 'A',
    cantidadKm: 50,
    prestacion: 'Kinesiología',
    mesFacturado: 8,
    anioFacturado: 2026,
    dependenciaYRetorno: '',
    domicilioId: 'dir-1',
    asistencias: [],
    ...overrides,
  };
}

const facturaMartina = factura({ id: 'f1', pacienteId: 'paciente-martina', estado: 'a-facturar', monto: 5000 });
const facturaFacundo = factura({ id: 'f2', pacienteId: 'paciente-facundo', estado: 'facturado', monto: 8000, mesFacturado: 7 });

describe('FacturasList', () => {
  it('muestra el estado de carga', () => {
    render(
      <FacturasList
        facturas={[]}
        loading={true}
        error={null}
        nombrePaciente={() => ''}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('muestra el estado vacío cuando no hay facturas', () => {
    render(
      <FacturasList facturas={[]} loading={false} error={null} nombrePaciente={() => ''} onSelect={vi.fn()} onCreateNew={vi.fn()} />,
    );
    expect(screen.getByText(/no hay facturas/i)).toBeInTheDocument();
  });

  it('muestra el mensaje de error si existe', () => {
    render(
      <FacturasList facturas={[]} loading={false} error="Falló" nombrePaciente={() => ''} onSelect={vi.fn()} onCreateNew={vi.fn()} />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Falló');
  });

  it('lista las facturas con paciente, período y estado, con key estable por id', () => {
    render(
      <FacturasList
        facturas={[facturaMartina, facturaFacundo]}
        loading={false}
        error={null}
        nombrePaciente={(id) => (id === 'paciente-martina' ? 'Gómez, Martina' : 'Pereyra, Facundo')}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );
    expect(screen.getByText('Gómez, Martina')).toBeInTheDocument();
    expect(screen.getByText('Pereyra, Facundo')).toBeInTheDocument();
  });

  it('la fila completa es clickeable y dispara onSelect', async () => {
    const onSelect = vi.fn();
    render(
      <FacturasList facturas={[facturaMartina]} loading={false} error={null} nombrePaciente={() => 'Gómez, Martina'} onSelect={onSelect} onCreateNew={vi.fn()} />,
    );

    await userEvent.click(screen.getByText('Gómez, Martina'));
    expect(onSelect).toHaveBeenCalledWith(facturaMartina);
  });

  it('el botón Editar hace stopPropagation y también dispara onSelect una sola vez', async () => {
    const onSelect = vi.fn();
    render(
      <FacturasList facturas={[facturaMartina]} loading={false} error={null} nombrePaciente={() => 'Gómez, Martina'} onSelect={onSelect} onCreateNew={vi.fn()} />,
    );

    await userEvent.click(screen.getByRole('button', { name: /editar/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('filtra por paciente', async () => {
    render(
      <FacturasList
        facturas={[facturaMartina, facturaFacundo]}
        loading={false}
        error={null}
        nombrePaciente={(id) => (id === 'paciente-martina' ? 'Gómez, Martina' : 'Pereyra, Facundo')}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
        pacientesDisponibles={[{ id: 'paciente-martina', nombre: 'Gómez, Martina' }, { id: 'paciente-facundo', nombre: 'Pereyra, Facundo' }]}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText(/filtrar por paciente/i), 'paciente-facundo');
    expect(screen.queryByText('Gómez, Martina', { selector: 'span' })).not.toBeInTheDocument();
    expect(screen.getByText('Pereyra, Facundo', { selector: 'span' })).toBeInTheDocument();
  });

  it('filtra por mes/año', async () => {
    render(
      <FacturasList
        facturas={[facturaMartina, facturaFacundo]}
        loading={false}
        error={null}
        nombrePaciente={(id) => (id === 'paciente-martina' ? 'Gómez, Martina' : 'Pereyra, Facundo')}
        onSelect={vi.fn()}
        onCreateNew={vi.fn()}
      />,
    );

    await userEvent.type(screen.getByLabelText(/filtrar por mes/i), '7');
    await userEvent.type(screen.getByLabelText(/filtrar por año/i), '2026');

    expect(screen.queryByText('Gómez, Martina')).not.toBeInTheDocument();
    expect(screen.getByText('Pereyra, Facundo')).toBeInTheDocument();
  });
});

// Gateo de escritura (gateo-facturacion, tasks.md 4.1/4.2, design.md D1). "Nueva factura"/"Crear
// la primera" nunca se ocultan (decisión 1 de la usuaria) — solo quedan deshabilitados. El
// <button> nativo "Ver detalle" cae dentro del mismo envoltorio que "Editar" (mismo patrón que
// PresupuestosList/gateo-facturacion sección 2).
describe('FacturasList — gateo de escritura', () => {
  it('sin permiso de escritura: "Nueva factura" queda visible y no se puede activar', () => {
    renderConPermiso(
      false,
      <FacturasList facturas={[facturaMartina]} loading={false} error={null} nombrePaciente={() => 'Gómez, Martina'} onSelect={vi.fn()} onCreateNew={vi.fn()} />,
    );

    const nueva = screen.getByRole('button', { name: /nueva factura/i });
    expect(nueva).toBeInTheDocument();
    expect(nueva).toBeVisible();
    expect(nueva).toBeDisabled();
  });

  it('sin permiso de escritura: "Crear la primera factura" (estado vacío) queda visible y no se puede activar (triangulación)', () => {
    renderConPermiso(
      false,
      <FacturasList facturas={[]} loading={false} error={null} nombrePaciente={() => ''} onSelect={vi.fn()} onCreateNew={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /crear la primera factura/i })).toBeDisabled();
  });

  it('con permiso de escritura: "Nueva factura" y "Crear la primera" están activables (triangulación)', () => {
    renderConPermiso(
      true,
      <FacturasList facturas={[facturaMartina]} loading={false} error={null} nombrePaciente={() => 'Gómez, Martina'} onSelect={vi.fn()} onCreateNew={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /nueva factura/i })).toBeEnabled();
  });

  it('sin permiso de escritura: "Editar" por fila y el <button> nativo "Ver detalle" quedan inertes, y la fila sigue navegando al detalle', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    renderConPermiso(
      false,
      <FacturasList facturas={[facturaMartina]} loading={false} error={null} nombrePaciente={() => 'Gómez, Martina'} onSelect={onSelect} onCreateNew={vi.fn()} />,
    );

    const editar = screen.getByRole('button', { name: /editar/i });
    expect(editar).toBeVisible();
    expect(editar).toBeDisabled();
    expect(screen.getByRole('button', { name: /^ver detalle$/i })).toBeDisabled();

    await user.click(screen.getByText('Gómez, Martina'));
    expect(onSelect).toHaveBeenCalledWith(facturaMartina);
  });

  it('con permiso de escritura: "Editar" y "Ver detalle" están activables (triangulación)', () => {
    renderConPermiso(
      true,
      <FacturasList facturas={[facturaMartina]} loading={false} error={null} nombrePaciente={() => 'Gómez, Martina'} onSelect={vi.fn()} onCreateNew={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /editar/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^ver detalle$/i })).toBeEnabled();
  });

  it('rol admin sin filas de permisos (equivalente puedeEscribir=true): la acción de alta está activable', () => {
    renderConPermiso(
      true,
      <FacturasList facturas={[]} loading={false} error={null} nombrePaciente={() => ''} onSelect={vi.fn()} onCreateNew={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /crear la primera factura/i })).toBeEnabled();
  });
});
