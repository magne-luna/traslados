import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConductoresRoute } from './ConductoresRoute';

// Smoke test de integración: confirma que el composition root real (con
// mockConductorRepository, mockVehiculoRepository y mockDocumentoRepository, no fakes de test)
// queda correctamente inyectado end-to-end y que el fixture de conductores aparece precargado
// en el primer arranque (design.md Decisión 7: monta ambos providers, Conductor y Vehiculo).
describe('ConductoresRoute', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('monta la feature con los mocks reales inyectados y muestra el fixture precargado', async () => {
    render(<ConductoresRoute />);

    expect(await screen.findByText('Pérez')).toBeInTheDocument();
  });
});
