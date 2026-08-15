import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Cobro, Factura } from '../../shared/types/factura';
import type { ObraSocial } from '../../shared/types/obraSocial';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { CobrosPanel } from './CobrosPanel';

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

function obraSocial(overrides: Partial<ObraSocial> = {}): ObraSocial {
  return {
    id: 'os-1',
    nombre: 'OSECAC',
    cuit: '30-54155200-6',
    modalidadFacturacion: 'por-prestacion',
    admitePagosParciales: true,
    formatoAfiliado: 'numero-documento',
    checklist: [],
    plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
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

// RF-306: wiring end-to-end — CobrosPanel resuelve `admitePagosParciales` desde la prop
// `obraSocial` y bloquea el submit cuando corresponde.
describe('CobrosPanel — RF-306 (obra social que no admite pagos parciales)', () => {
  it('bloquea el submit de un cobro parcial cuando la obra social no admite pagos parciales', async () => {
    const registrar = vi.fn().mockResolvedValue(undefined);
    render(
      <CobrosPanel
        factura={factura()}
        cobros={[]}
        loading={false}
        error={null}
        registrar={registrar}
        eliminar={vi.fn()}
        obraSocial={obraSocial({ admitePagosParciales: false })}
      />,
    );

    await userEvent.type(screen.getByLabelText(/fecha/i), '2026-08-15');
    await userEvent.type(screen.getByLabelText(/monto/i), '1500');
    await userEvent.click(screen.getByRole('button', { name: /registrar cobro/i }));

    expect(registrar).not.toHaveBeenCalled();
    expect(screen.getByText(/no admite pagos parciales/i)).toBeInTheDocument();
  });

  it('sin obra social resuelta (caso legacy), no bloquea (fallback seguro)', async () => {
    const registrar = vi.fn().mockResolvedValue(undefined);
    render(<CobrosPanel factura={factura()} cobros={[]} loading={false} error={null} registrar={registrar} eliminar={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/fecha/i), '2026-08-15');
    await userEvent.type(screen.getByLabelText(/monto/i), '1500');
    await userEvent.click(screen.getByRole('button', { name: /registrar cobro/i }));

    expect(registrar).toHaveBeenCalledWith({ facturaId: 'factura-1', fecha: '2026-08-15', montoPagado: 1500 });
  });
});

// Gateo de escritura (gateo-facturacion, tasks.md 5.2, design.md D2). "Registrar cobro" es una
// escritura no-CRUD gateada al mismo nivel `write` que un Guardar — ninguna requiere `admin`
// (decisión 5). El <button> nativo "Quitar cobro" y los campos del alta quedan inertes; el
// historial ya cargado sigue siendo legible con solo `read`.
describe('CobrosPanel — gateo de escritura', () => {
  const cobrosExistentes: Cobro[] = [{ id: 'c1', facturaId: 'factura-1', fecha: '2026-08-05', montoPagado: 2000 }];

  it('sin permiso de escritura: "Registrar cobro", su <button> nativo y sus campos quedan inertes; el historial sigue legible', async () => {
    const user = userEvent.setup();
    const registrar = vi.fn();
    const eliminar = vi.fn();

    renderConPermiso(
      false,
      <CobrosPanel factura={factura()} cobros={cobrosExistentes} loading={false} error={null} registrar={registrar} eliminar={eliminar} />,
    );

    expect(screen.getByLabelText(/fecha/i)).toBeDisabled();
    expect(screen.getByLabelText(/monto/i)).toBeDisabled();
    const registrarCobro = screen.getByRole('button', { name: /registrar cobro/i });
    expect(registrarCobro).toBeDisabled();
    const quitar = screen.getByRole('button', { name: /quitar/i });
    expect(quitar).toBeDisabled();

    await user.click(quitar);
    expect(eliminar).not.toHaveBeenCalled();

    // Los cobros ya registrados siguen siendo legibles.
    expect(screen.getByText('$2.000', { selector: 'span' })).toBeInTheDocument();
  });

  it('con permiso de escritura (sin admin): todo operativo (triangulación) — no requiere admin (decisión 5)', async () => {
    const registrar = vi.fn().mockResolvedValue(undefined);

    renderConPermiso(
      true,
      <CobrosPanel factura={factura()} cobros={cobrosExistentes} loading={false} error={null} registrar={registrar} eliminar={vi.fn()} />,
    );

    expect(screen.getByLabelText(/fecha/i)).toBeEnabled();

    await userEvent.type(screen.getByLabelText(/fecha/i), '2026-08-15');
    await userEvent.type(screen.getByLabelText(/monto/i), '1500');
    await userEvent.click(screen.getByRole('button', { name: /registrar cobro/i }));

    expect(registrar).toHaveBeenCalledWith({ facturaId: 'factura-1', fecha: '2026-08-15', montoPagado: 1500 });
  });
});
