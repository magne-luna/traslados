import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Cobro, Factura } from '../../shared/types/factura';
import { CobrosPanel } from './CobrosPanel';

function factura(overrides: Partial<Factura> = {}): Factura {
  return {
    id: 'factura-1',
    pacienteId: 'paciente-martina',
    descripcion: '',
    dias: 10,
    valorKm: 100,
    monto: 5000,
    estado: 'facturado',
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

describe('CobrosPanel', () => {
  it('lista los cobros ordenados por fecha, con el total cobrado y el saldo pendiente', () => {
    const cobros: Cobro[] = [
      { id: 'c2', facturaId: 'factura-1', fecha: '2026-08-20', montoPagado: 1000 },
      { id: 'c1', facturaId: 'factura-1', fecha: '2026-08-05', montoPagado: 2000 },
    ];

    render(<CobrosPanel factura={factura()} cobros={cobros} loading={false} error={null} registrar={vi.fn()} eliminar={vi.fn()} />);

    const fechas = screen.getAllByText(/\d{1,2} de \w+, 2026/).map((el) => el.textContent);
    expect(fechas[0]).toBe('5 de Agosto, 2026');
    expect(fechas[1]).toBe('20 de Agosto, 2026');
    expect(screen.getByText(/total cobrado/i)).toBeInTheDocument();
    expect(screen.getByText('$3.000')).toBeInTheDocument();
    expect(screen.getByText(/saldo pendiente/i)).toBeInTheDocument();
    expect(screen.getByText('$2.000')).toBeInTheDocument();
  });

  it('no ofrece registrar cobros cuando la factura sigue en a-facturar', () => {
    render(<CobrosPanel factura={factura({ estado: 'a-facturar' })} cobros={[]} loading={false} error={null} registrar={vi.fn()} eliminar={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /registrar cobro/i })).not.toBeInTheDocument();
    expect(screen.getByText(/emit[íi] la factura/i)).toBeInTheDocument();
  });

  it('registra un cobro nuevo con fecha y monto válidos', async () => {
    const registrar = vi.fn().mockResolvedValue(undefined);
    render(<CobrosPanel factura={factura()} cobros={[]} loading={false} error={null} registrar={registrar} eliminar={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/fecha/i), '2026-08-15');
    await userEvent.type(screen.getByLabelText(/monto/i), '1500');
    await userEvent.click(screen.getByRole('button', { name: /registrar cobro/i }));

    expect(registrar).toHaveBeenCalledWith({ facturaId: 'factura-1', fecha: '2026-08-15', montoPagado: 1500 });
  });

  it('permite dar de baja un cobro existente', async () => {
    const eliminar = vi.fn().mockResolvedValue(undefined);
    const cobros: Cobro[] = [{ id: 'c1', facturaId: 'factura-1', fecha: '2026-08-05', montoPagado: 2000 }];
    render(<CobrosPanel factura={factura()} cobros={cobros} loading={false} error={null} registrar={vi.fn()} eliminar={eliminar} />);

    await userEvent.click(screen.getByRole('button', { name: /quitar/i }));
    expect(eliminar).toHaveBeenCalledWith('c1');
  });
});
