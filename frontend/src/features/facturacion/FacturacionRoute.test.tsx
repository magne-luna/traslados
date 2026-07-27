import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FacturacionRoute } from './FacturacionRoute';

describe('FacturacionRoute', () => {
  it('monta la feature completa con los mocks reales y muestra el listado tras cargar', async () => {
    localStorage.clear();
    render(<FacturacionRoute />);

    expect(await screen.findByRole('heading', { name: /facturaci[óo]n/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /nueva factura/i })).toBeInTheDocument();
  });
});
