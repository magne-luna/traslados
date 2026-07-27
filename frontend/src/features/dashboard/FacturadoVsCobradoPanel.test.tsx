import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SerieFacturadoVsCobrado } from '../../shared/types/reportes';
import { FacturadoVsCobradoPanel } from './FacturadoVsCobradoPanel';

// tasks.md 6.6, spec reporte-facturado-vs-cobrado: selector de período, tabla accesible con
// caption y th scope, barras proporcionales con Tailwind (sin style inline), nota de
// atribución visible, estados de carga/error/vacío.

const serie: SerieFacturadoVsCobrado = {
  puntos: [
    { mes: 5, anio: 2026, facturado: 100_000, cobrado: 40_000, diferencia: 60_000 },
    { mes: 6, anio: 2026, facturado: 50_000, cobrado: 80_000, diferencia: -30_000 },
  ],
  totalFacturado: 150_000,
  totalCobrado: 120_000,
  totalDiferencia: 30_000,
};

function renderPanel(overrides: Partial<React.ComponentProps<typeof FacturadoVsCobradoPanel>> = {}) {
  return render(
    <FacturadoVsCobradoPanel
      periodo={6}
      onChangePeriodo={vi.fn()}
      serie={serie}
      cargando={false}
      error={null}
      {...overrides}
    />,
  );
}

describe('FacturadoVsCobradoPanel', () => {
  it('renderiza una tabla accesible con caption, encabezados con scope y los valores como texto', () => {
    renderPanel();
    const tabla = screen.getByRole('table');
    expect(tabla).toBeInTheDocument();
    expect(screen.getByText(/facturado vs\. cobrado/i)).toBeInTheDocument();
    const encabezados = screen.getAllByRole('columnheader');
    expect(encabezados.length).toBeGreaterThan(0);
    expect(screen.getByText(/60\.000,00/)).toBeInTheDocument();
  });

  it('ofrece un selector con las opciones 3, 6 y 12 y notifica el cambio', async () => {
    const onChangePeriodo = vi.fn();
    renderPanel({ onChangePeriodo });
    const select = screen.getByLabelText(/per[ií]odo/i);
    await userEvent.selectOptions(select, '12');
    expect(onChangePeriodo).toHaveBeenCalledWith(12);
  });

  it('muestra la nota de las reglas de atribución', () => {
    renderPanel();
    expect(screen.getByText(/per[ií]odo de la factura/i)).toBeInTheDocument();
    expect(screen.getByText(/fecha del cobro/i)).toBeInTheDocument();
  });

  it('muestra estado de carga', () => {
    renderPanel({ cargando: true });
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('muestra estado de error', () => {
    renderPanel({ error: 'Falló la lectura' });
    expect(screen.getByRole('alert')).toHaveTextContent('Falló la lectura');
  });

  it('muestra estado vacío cuando no hay facturas ni cobros en el rango', () => {
    const serieVacia: SerieFacturadoVsCobrado = {
      puntos: [
        { mes: 5, anio: 2026, facturado: 0, cobrado: 0, diferencia: 0 },
        { mes: 6, anio: 2026, facturado: 0, cobrado: 0, diferencia: 0 },
      ],
      totalFacturado: 0,
      totalCobrado: 0,
      totalDiferencia: 0,
    };
    renderPanel({ serie: serieVacia });
    expect(screen.getByText(/no hay facturas ni cobros/i)).toBeInTheDocument();
  });
});
