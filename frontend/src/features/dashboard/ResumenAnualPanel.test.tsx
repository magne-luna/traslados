import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ResumenAnual } from '../../shared/types/reportes';
import { ResumenAnualPanel } from './ResumenAnualPanel';

// tasks.md 6.7, spec reporte-resumen-anual: selector de año, totales destacados, desglose de
// los 12 meses como tabla accesible, estados de carga/error/vacío.

function buildResumen(overrides: Partial<ResumenAnual> = {}): ResumenAnual {
  const meses = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, anio: 2026, facturado: 0, cobrado: 0, diferencia: 0 }));
  return {
    anio: 2026,
    totalFacturado: 500_000,
    totalCobrado: 400_000,
    totalDiferencia: 100_000,
    facturasEmitidas: 10,
    facturasSaldadas: 6,
    meses,
    ...overrides,
  };
}

function renderPanel(overrides: Partial<React.ComponentProps<typeof ResumenAnualPanel>> = {}) {
  return render(
    <ResumenAnualPanel
      anio={2026}
      onChangeAnio={vi.fn()}
      aniosDisponibles={[2025, 2026]}
      resumen={buildResumen()}
      cargando={false}
      error={null}
      {...overrides}
    />,
  );
}

describe('ResumenAnualPanel', () => {
  it('muestra los totales destacados identificados con texto', () => {
    renderPanel();
    expect(screen.getAllByText(/facturado/i).length).toBeGreaterThan(0);
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('muestra el desglose de los 12 meses como tabla accesible', () => {
    renderPanel();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(13); // encabezado + 12 meses
  });

  it('ofrece un selector de año acotado a los años disponibles', async () => {
    const onChangeAnio = vi.fn();
    renderPanel({ onChangeAnio });
    const select = screen.getByLabelText(/a[ñn]o/i);
    await userEvent.selectOptions(select, '2025');
    expect(onChangeAnio).toHaveBeenCalledWith(2025);
  });

  it('muestra estado de carga', () => {
    renderPanel({ cargando: true });
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('muestra estado de error', () => {
    renderPanel({ error: 'Falló la lectura' });
    expect(screen.getByRole('alert')).toHaveTextContent('Falló la lectura');
  });

  it('muestra estado vacío cuando el año no tiene movimiento', () => {
    renderPanel({ resumen: buildResumen({ totalFacturado: 0, totalCobrado: 0, facturasEmitidas: 0, facturasSaldadas: 0 }) });
    expect(screen.getByText(/sin movimiento/i)).toBeInTheDocument();
  });
});
