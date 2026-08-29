import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderConQuery } from '../../shared/test/queryWrapper';
import { MemoryRouter } from 'react-router';
import { DashboardRoute } from './DashboardRoute';

// tasks.md 5.6, design.md Decisión 9: composition root que inyecta los seis repositorios mock
// de solo lectura (Factura, Cobro, Paciente, Vehiculo, HojaDeRuta y Conductor — este último
// necesario para resolver el nombre del conductor en RecorridosDelDiaPanel, ver informe de la
// sub-agente) y renderiza DashboardPage.

describe('DashboardRoute', () => {
  it('renderiza el dashboard completo con los repositorios mock inyectados', async () => {
    renderConQuery(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.queryAllByText(/cargando/i)).toHaveLength(0), { timeout: 3000 });

    expect(screen.getByRole('heading', { level: 1, name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/recorridos de hoy/i)).toBeInTheDocument();
  });
});
