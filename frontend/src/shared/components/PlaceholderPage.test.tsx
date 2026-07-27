import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PlaceholderPage } from './PlaceholderPage';

describe('PlaceholderPage', () => {
  it('renderiza el título del módulo recibido por prop', () => {
    render(<PlaceholderPage moduleName="Obras Sociales" />);

    expect(screen.getByText('Obras Sociales')).toBeInTheDocument();
  });

  it('muestra un indicador de "próximamente"', () => {
    render(<PlaceholderPage moduleName="Vehículos" />);

    expect(screen.getByText(/próximamente/i)).toBeInTheDocument();
  });

  it('renderiza el título del módulo recibido, con otro módulo distinto', () => {
    render(<PlaceholderPage moduleName="Facturación" />);

    expect(screen.getByText('Facturación')).toBeInTheDocument();
    expect(screen.getByText(/próximamente/i)).toBeInTheDocument();
  });
});
