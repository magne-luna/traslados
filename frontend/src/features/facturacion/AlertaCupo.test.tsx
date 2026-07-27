import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AlertaCupo } from './AlertaCupo';

describe('AlertaCupo', () => {
  it('muestra el mensaje comparativo cuando excede el cupo de días', () => {
    render(
      <AlertaCupo
        resultado={{
          cupoDisponible: true,
          excedeDias: true,
          excedeKm: false,
          mensaje: 'tenés autorizados 20 días, estás facturando 22.',
        }}
      />,
    );
    expect(screen.getByText(/tenés autorizados 20 días, estás facturando 22/i)).toBeInTheDocument();
  });

  it('avisa explícitamente cuando no hay cupo contra el cual validar', () => {
    render(
      <AlertaCupo
        resultado={{ cupoDisponible: false, excedeDias: false, excedeKm: false, mensaje: 'No hay cupo autorizado cargado para validar esta factura.' }}
      />,
    );
    expect(screen.getByText(/no hay cupo autorizado/i)).toBeInTheDocument();
  });

  it('muestra el mensaje de "dentro del cupo" cuando no hay exceso (persistente, no un toast)', () => {
    render(
      <AlertaCupo resultado={{ cupoDisponible: true, excedeDias: false, excedeKm: false, mensaje: 'Dentro del cupo autorizado.' }} />,
    );
    expect(screen.getByText(/dentro del cupo autorizado/i)).toBeInTheDocument();
  });
});
