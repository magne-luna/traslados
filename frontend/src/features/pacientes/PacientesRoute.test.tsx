import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PacientesRoute } from './PacientesRoute';

// Smoke test de integración: confirma que el composition root real (con mockPacienteRepository,
// mockObraSocialRepository y mockDocumentoRepository, no fakes de test) queda correctamente
// inyectado end-to-end y que el fixture de pacientes aparece precargado en el primer arranque.
describe('PacientesRoute', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('monta la feature con los mocks reales inyectados y muestra el fixture precargado', async () => {
    render(<PacientesRoute />);

    expect(await screen.findByText(/gómez díaz, martina sol/i)).toBeInTheDocument();
  });
});
