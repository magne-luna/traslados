import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AlertaTipoComprobante } from './AlertaTipoComprobante';

describe('AlertaTipoComprobante', () => {
  it('muestra la etiqueta legible de la condición y la consecuencia (rechazo de ARCA)', () => {
    render(<AlertaTipoComprobante condicion="IVA_SUJETO_EXENTO" />);

    const aviso = screen.getByRole('note');
    expect(aviso).toHaveTextContent(/IVA Sujeto Exento/i);
    expect(aviso).toHaveTextContent(/Factura A/i);
    expect(aviso).toHaveTextContent(/Responsable Inscripto/i);
  });

  it('sirve para otras condiciones no inscriptas (monotributo)', () => {
    render(<AlertaTipoComprobante condicion="MONOTRIBUTO" />);
    expect(screen.getByRole('note')).toHaveTextContent(/Monotributo/i);
  });
});
