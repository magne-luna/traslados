import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Cobro, Factura } from '../../shared/types/factura';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { FacturaCobrosSection } from './FacturaCobrosSection';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

function factura(overrides: Partial<Factura> = {}): Factura {
  return {
    id: 'factura-1',
    pacienteId: 'paciente-martina',
    descripcion: '',
    dias: 10,
    valorKm: 100,
    monto: 5000,
    estado: 'cobrado',
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

describe('FacturaCobrosSection', () => {
  it('sin inconsistencia, no muestra el banner de corrección', () => {
    const cobros: Cobro[] = [{ id: 'c1', facturaId: 'factura-1', fecha: '2026-08-05', montoPagado: 5000 }];
    render(<FacturaCobrosSection factura={factura()} cobros={cobros} loading={false} error={null} registrar={vi.fn()} eliminar={vi.fn()} onCorregirEstado={vi.fn()} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('con inconsistencia (estado persistido != derivado), muestra el banner visible sin sobrescribir en silencio', () => {
    // Persistido "cobrado" pero sin cobros -> derivado sería "facturado".
    render(<FacturaCobrosSection factura={factura({ estado: 'cobrado' })} cobros={[]} loading={false} error={null} registrar={vi.fn()} eliminar={vi.fn()} onCorregirEstado={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/cobrado/);
    expect(screen.getByRole('alert')).toHaveTextContent(/facturado/);
  });

  it('permite aplicar la corrección manual elegida', async () => {
    const onCorregirEstado = vi.fn();
    render(<FacturaCobrosSection factura={factura({ estado: 'cobrado' })} cobros={[]} loading={false} error={null} registrar={vi.fn()} eliminar={vi.fn()} onCorregirEstado={onCorregirEstado} />);

    await userEvent.selectOptions(screen.getByLabelText(/corregir estado manualmente/i), 'facturado');
    await userEvent.click(screen.getByRole('button', { name: /aplicar/i }));

    expect(onCorregirEstado).toHaveBeenCalledWith('facturado');
  });
});

// Gateo de escritura (gateo-facturacion, tasks.md 5.3, design.md D2). "Aplicar" corrección de
// estado es una escritura no-CRUD gateada al mismo nivel `write` — ninguna requiere `admin`
// (decisión 5).
describe('FacturaCobrosSection — gateo de escritura', () => {
  it('sin permiso de escritura: "Aplicar" queda visible y no se puede activar', () => {
    renderConPermiso(
      false,
      <FacturaCobrosSection
        factura={factura({ estado: 'cobrado' })}
        cobros={[]}
        loading={false}
        error={null}
        registrar={vi.fn()}
        eliminar={vi.fn()}
        onCorregirEstado={vi.fn()}
      />,
    );

    const aplicar = screen.getByRole('button', { name: /aplicar/i });
    expect(aplicar).toBeVisible();
    expect(aplicar).toBeDisabled();
  });

  it('con permiso de escritura (sin admin): "Aplicar" está activable (triangulación) — no requiere admin (decisión 5)', async () => {
    const user = userEvent.setup();
    const onCorregirEstado = vi.fn();

    renderConPermiso(
      true,
      <FacturaCobrosSection
        factura={factura({ estado: 'cobrado' })}
        cobros={[]}
        loading={false}
        error={null}
        registrar={vi.fn()}
        eliminar={vi.fn()}
        onCorregirEstado={onCorregirEstado}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/corregir estado manualmente/i), 'facturado');
    const aplicar = screen.getByRole('button', { name: /aplicar/i });
    expect(aplicar).toBeEnabled();
    await user.click(aplicar);
    expect(onCorregirEstado).toHaveBeenCalledWith('facturado');
  });
});
