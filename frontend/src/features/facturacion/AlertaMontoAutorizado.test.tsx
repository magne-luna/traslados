import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { AlertaMontoAutorizado } from './AlertaMontoAutorizado';

describe('AlertaMontoAutorizado', () => {
  it('avisa explícitamente cuando no hay monto autorizado cargado', () => {
    render(
      <AlertaMontoAutorizado
        resultado={{ montoAutorizadoDisponible: false, excede: false, mensaje: 'No hay monto autorizado cargado para validar esta factura.' }}
      />,
    );
    expect(screen.getByText(/no hay monto autorizado/i)).toBeInTheDocument();
  });

  it('muestra el acumulado del año aunque no se exceda (persistente, informativo)', () => {
    render(
      <AlertaMontoAutorizado
        resultado={{ montoAutorizadoDisponible: true, excede: false, mensaje: 'Facturado en el año: $1.500,00 de $5.000,00 autorizados.' }}
      />,
    );
    expect(screen.getByText(/facturado en el año: \$1.500,00 de \$5.000,00 autorizados/i)).toBeInTheDocument();
  });

  it('muestra el mensaje de exceso anual cuando se supera el monto autorizado', () => {
    render(
      <AlertaMontoAutorizado
        resultado={{
          montoAutorizadoDisponible: true,
          excede: true,
          mensaje: 'El total facturado en el año ($5.300,00, incluyendo esta factura) supera el monto autorizado anual ($5.000,00).',
        }}
      />,
    );
    expect(screen.getByText(/supera el monto autorizado anual/i)).toBeInTheDocument();
  });
});

// Lectura preservada (gateo-facturacion, mismo criterio que AlertaCupo): puramente presentacional,
// se renderiza completa incluso con solo `read`.
describe('AlertaMontoAutorizado — lectura preservada en modo solo lectura', () => {
  it('con solo `read`: se renderiza completa', () => {
    render(
      <PuedeEscribirContext.Provider value={false}>
        <AlertaMontoAutorizado
          resultado={{ montoAutorizadoDisponible: true, excede: false, mensaje: 'Facturado en el año: $1.500,00 de $5.000,00 autorizados.' }}
        />
      </PuedeEscribirContext.Provider>,
    );
    expect(screen.getByText(/facturado en el año/i)).toBeInTheDocument();
  });
});
