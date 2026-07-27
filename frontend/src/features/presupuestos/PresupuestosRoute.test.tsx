import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PresupuestosRoute } from './PresupuestosRoute';

// Smoke test de integración: confirma que el composition root real (con
// mockPresupuestoRepository, mockAutorizacionRepository, mockPacienteRepository y
// mockObraSocialRepository, no fakes de test) queda correctamente inyectado end-to-end y que el
// fixture de presupuestos aparece precargado en el primer arranque.
describe('PresupuestosRoute', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('monta la feature con los mocks reales inyectados y muestra el fixture precargado', async () => {
    render(<PresupuestosRoute />);

    expect((await screen.findAllByText('Gómez, Martina')).length).toBeGreaterThan(0);
    expect((await screen.findAllByText('OSECAC')).length).toBeGreaterThan(0);
  });
});
