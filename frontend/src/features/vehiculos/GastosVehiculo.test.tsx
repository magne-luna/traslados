import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GastoVehiculo } from '../../shared/types/vehiculo';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { GastosVehiculo } from './GastosVehiculo';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

const gasto: GastoVehiculo = {
  id: 'g1',
  fecha: '2026-06-01',
  monto: 45_000,
  descripcion: 'Cambio de cubiertas',
  categoria: 'mantenimiento',
};

describe('GastosVehiculo', () => {
  it('muestra un estado vacío cuando no hay gastos', () => {
    render(<GastosVehiculo gastos={[]} onAgregar={vi.fn()} />);

    expect(screen.getByText(/no hay gastos/i)).toBeInTheDocument();
  });

  it('muestra la tabla de gastos con monto, descripción y categoría por fila cuando hay datos', () => {
    render(<GastosVehiculo gastos={[gasto]} onAgregar={vi.fn()} />);

    expect(screen.getAllByText(/45.?000/).length).toBeGreaterThan(0);
    expect(screen.getByText('Cambio de cubiertas')).toBeInTheDocument();
    expect(screen.getAllByText('Mantenimiento').length).toBeGreaterThan(0);
  });

  it('muestra el total gastado y el total del mes cuando hay datos', () => {
    const otroGasto: GastoVehiculo = { id: 'g2', fecha: '2026-01-15', monto: 5_000, categoria: 'reparacion' };
    const ahora = new Date('2026-06-15');

    render(<GastosVehiculo gastos={[gasto, otroGasto]} onAgregar={vi.fn()} ahora={ahora} />);

    expect(screen.getByText('$50.000')).toBeInTheDocument();
    expect(screen.getByText('$45.000')).toBeInTheDocument();
  });

  it('bloquea el alta con monto inválido y muestra el error', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();

    render(<GastosVehiculo gastos={[]} onAgregar={onAgregar} />);

    await user.type(screen.getByLabelText(/fecha/i), '2026-07-01');
    await user.click(screen.getByRole('button', { name: /registrar/i }));

    expect(onAgregar).not.toHaveBeenCalled();
    expect(screen.getByText(/el monto debe ser un número positivo/i)).toBeInTheDocument();
  });

  it('agrega un gasto válido llamando a onAgregar con fecha, monto, descripción y categoría', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();

    render(<GastosVehiculo gastos={[]} onAgregar={onAgregar} />);

    await user.type(screen.getByLabelText(/fecha/i), '2026-07-01');
    await user.type(screen.getByLabelText(/monto/i), '1500');
    await user.type(screen.getByLabelText(/descripción/i), 'Aceite y filtros');
    await user.selectOptions(screen.getByLabelText(/categoría/i), 'service');
    await user.click(screen.getByRole('button', { name: /registrar/i }));

    expect(onAgregar).toHaveBeenCalledWith({
      fecha: '2026-07-01',
      monto: 1500,
      descripcion: 'Aceite y filtros',
      categoria: 'service',
    });
  });
});

// Gateo de escritura (gateo-conductores, tasks.md 4.1). El alta de gasto y sus campos quedan
// inertes sin permiso de escritura; los gastos ya registrados siguen siendo legibles.
//
// NOTA (discrepancia ya documentada, ver VehiculoDetail.tsx AvisoModeloDatos): en el docx y en la
// RLS real (facturacion.gastos_vehiculos), el gasto de vehículo se gatea por el módulo
// "facturacion", no "conductores". Este cableado sigue el mismo criterio que el resto de la
// pantalla /vehiculos (módulo "conductores", vía el mecanismo compartido resuelto por la ruta) —
// no introduce una segunda resolución de permiso — pero puede quedar desalineado de la RLS real
// hasta que esa discrepancia se resuelva arquitectónicamente (fuera de alcance de este change).
describe('GastosVehiculo — gateo de escritura', () => {
  it('sin permiso de escritura: los campos y "+ Registrar" quedan inertes, y los gastos ya registrados siguen legibles', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();

    renderConPermiso(false, <GastosVehiculo gastos={[gasto]} onAgregar={onAgregar} />);

    expect(screen.getByText('Cambio de cubiertas')).toBeInTheDocument();
    expect(screen.getByLabelText(/fecha/i)).toBeDisabled();
    expect(screen.getByLabelText(/monto/i)).toBeDisabled();
    expect(screen.getByLabelText(/descripción/i)).toBeDisabled();
    expect(screen.getByLabelText(/categoría/i)).toBeDisabled();

    const registrar = screen.getByRole('button', { name: /registrar/i });
    expect(registrar).toBeDisabled();
    await user.click(registrar);
    expect(onAgregar).not.toHaveBeenCalled();
  });

  it('con permiso de escritura: el alta de gasto queda operativa (triangulación)', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();

    renderConPermiso(true, <GastosVehiculo gastos={[]} onAgregar={onAgregar} />);

    await user.type(screen.getByLabelText(/fecha/i), '2026-07-01');
    await user.type(screen.getByLabelText(/monto/i), '1500');
    await user.click(screen.getByRole('button', { name: /registrar/i }));

    expect(onAgregar).toHaveBeenCalledTimes(1);
  });
});
