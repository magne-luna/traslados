import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { FacturaAvisoDiscrepancias } from './FacturaAvisoDiscrepancias';

// Inventario de discrepancias reconciliado contra el schema real (design.md D12, tasks.md 6.1/6.2).
// Las 4 discrepancias originales de CHANGES.md §C-07 (AsistenciaPrestacion, documento_factura,
// fecha_estimada_cobro, cantidad_km) están CERRADAS: las cuatro existen en la base real, verificado
// columna por columna contra information_schema.columns (tasks.md 1.3) — ya no se afirman como
// faltantes acá.
describe('FacturaAvisoDiscrepancias — discrepancias cerradas retiradas (tasks.md 6.1)', () => {
  it('ya no afirma que AsistenciaPrestacion no existe como entidad', () => {
    render(<FacturaAvisoDiscrepancias />);
    expect(screen.queryByText(/AsistenciaPrestacion.*no existe/i)).not.toBeInTheDocument();
  });

  it('ya no afirma que no existe tabla de documentos por factura', () => {
    render(<FacturaAvisoDiscrepancias />);
    expect(screen.queryByText(/no existe tabla de documentos por factura/i)).not.toBeInTheDocument();
  });

  it('ya no afirma que no existe fecha_estimada_cobro', () => {
    render(<FacturaAvisoDiscrepancias />);
    expect(screen.queryByText(/no existe campo de fecha estimada de cobro/i)).not.toBeInTheDocument();
  });

  it('ya no afirma que no existe cantidad_km', () => {
    render(<FacturaAvisoDiscrepancias />);
    expect(screen.queryByText(/no existe.*cantidad_km/i)).not.toBeInTheDocument();
  });
});

// Discrepancias vigentes que este change abre/mantiene (design.md D12 N1/N2, §Open Questions).
describe('FacturaAvisoDiscrepancias — discrepancias vigentes sumadas (tasks.md 6.2)', () => {
  it('suma que el enum real conserva el literal "pendiente", no modelado por separado', () => {
    render(<FacturaAvisoDiscrepancias />);
    expect(screen.getByText(/pendiente/i)).toBeInTheDocument();
  });

  it('suma que fecha_factura es un campo agregado sobre el docx', () => {
    render(<FacturaAvisoDiscrepancias />);
    expect(screen.getByText(/fecha_factura/)).toBeInTheDocument();
  });

  it('suma que la factura no congela la obra social con la que se emitió', () => {
    render(<FacturaAvisoDiscrepancias />);
    expect(screen.getByText(/no congela la obra social/i)).toBeInTheDocument();
  });
});

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

    expect(screen.getByText(/fecha_factura/)).toBeInTheDocument();
  });

  it('con `write`: se renderiza igual (triangulación)', () => {
    render(
      <PuedeEscribirContext.Provider value={true}>
        <FacturaAvisoDiscrepancias />
      </PuedeEscribirContext.Provider>,
    );

    expect(screen.getByText(/fecha_factura/)).toBeInTheDocument();
  });
});
