import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VehiculosRoute } from './VehiculosRoute';

// Smoke test de integración: confirma que el composition root real (con mockVehiculoRepository
// y mockDocumentoRepository, no fakes de test) queda correctamente inyectado end-to-end y que
// el fixture de flota aparece precargado en el primer arranque.
describe('VehiculosRoute', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('monta la feature con el mock real inyectado y muestra el fixture precargado', async () => {
    render(<VehiculosRoute />);

    expect(await screen.findByText('AC123DE')).toBeInTheDocument();
  });
});
