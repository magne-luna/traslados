import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DashboardAvisoDiscrepancias } from './DashboardAvisoDiscrepancias';

// tasks.md 6.8, design.md §Discrepancias (1 a 4), spec dashboard-composicion (Requirement
// "Cartel agrupado de discrepancias"): un único AvisoModeloDatos agrupando las 4 discrepancias.

describe('DashboardAvisoDiscrepancias', () => {
  it('muestra un único cartel con las 4 discrepancias del docx', () => {
    render(<DashboardAvisoDiscrepancias />);
    const cartel = screen.getByRole('note');
    expect(cartel).toBeInTheDocument();
    expect(cartel).toHaveTextContent(/ninguna vista/i);
    expect(cartel).toHaveTextContent(/fecha de emisión/i);
    expect(cartel).toHaveTextContent(/período de atribución/i);
    expect(cartel).toHaveTextContent(/se derivan en el cliente/i);
  });

  it('no renderiza más de un cartel', () => {
    render(<DashboardAvisoDiscrepancias />);
    expect(screen.getAllByRole('note')).toHaveLength(1);
  });
});
