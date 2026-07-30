import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { FacturaAvisoDiscrepancias } from './FacturaAvisoDiscrepancias';

// Lectura preservada (gateo-facturacion, tasks.md 6.1, design.md D4). `FacturaAvisoDiscrepancias`
// es puramente presentacional (sin `usePuedeEscribir`) — debe seguir renderizándose completo con
// nivel `read`.
describe('FacturaAvisoDiscrepancias — lectura preservada en modo solo lectura', () => {
  it('con solo `read`: se renderiza completo', () => {
    render(
      <PuedeEscribirContext.Provider value={false}>
        <FacturaAvisoDiscrepancias />
      </PuedeEscribirContext.Provider>,
    );

    expect(screen.getByText(/AsistenciaPrestacion/)).toBeInTheDocument();
  });

  it('con `write`: se renderiza igual (triangulación)', () => {
    render(
      <PuedeEscribirContext.Provider value={true}>
        <FacturaAvisoDiscrepancias />
      </PuedeEscribirContext.Provider>,
    );

    expect(screen.getByText(/AsistenciaPrestacion/)).toBeInTheDocument();
  });
});
