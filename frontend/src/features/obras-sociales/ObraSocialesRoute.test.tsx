import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ObraSocialesRoute } from './ObraSocialesRoute';

// Smoke test de integración: confirma que el composition root real (con
// mockObraSocialRepository, no un fake de test) queda correctamente inyectado end-to-end y que
// OSECAC aparece precargado en el primer arranque (RF-305). Timers reales — el mock usa una
// latencia simulada corta (withLatency) que resuelve dentro del timeout default de findBy.
describe('ObraSocialesRoute', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('monta la feature con el mock real inyectado y muestra OSECAC precargado', async () => {
    render(<ObraSocialesRoute />);

    expect(await screen.findByText('OSECAC')).toBeInTheDocument();
  });
});
