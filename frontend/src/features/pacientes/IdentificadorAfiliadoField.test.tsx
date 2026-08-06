import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IdentificadorAfiliado } from '../../shared/types/paciente';
import { IdentificadorAfiliadoField } from './IdentificadorAfiliadoField';
import { FORMATO_AFILIADO_LABELS } from './formatoAfiliadoOptions';

// El formato ya no es editable acá (RF-106/RN-ID-02): se derivó de la obra social del paciente y
// llega como prop de solo lectura (ver IdentificadorAfiliadoField.tsx). Estas pruebas cubren la
// etiqueta legible derivada, el placeholder sin obra social, y que el campo de valor sigue
// editable e independiente del formato.

describe('IdentificadorAfiliadoField', () => {
  it('muestra la etiqueta legible del formato derivado de la obra social para cada valor de la unión', () => {
    const value: IdentificadorAfiliado = { valor: '123' };
    const { rerender } = render(<IdentificadorAfiliadoField value={value} onChange={vi.fn()} formato="numero-documento" />);
    expect(screen.getByDisplayValue(FORMATO_AFILIADO_LABELS['numero-documento'])).toBeInTheDocument();

    rerender(<IdentificadorAfiliadoField value={value} onChange={vi.fn()} formato="alfanumerico" />);
    expect(screen.getByDisplayValue(FORMATO_AFILIADO_LABELS.alfanumerico)).toBeInTheDocument();

    rerender(<IdentificadorAfiliadoField value={value} onChange={vi.fn()} formato="cuil-con-sufijo" />);
    expect(screen.getByDisplayValue(FORMATO_AFILIADO_LABELS['cuil-con-sufijo'])).toBeInTheDocument();
  });

  it('muestra un placeholder cuando todavía no hay obra social seleccionada (formato null)', () => {
    const value: IdentificadorAfiliado = { valor: '' };

    render(<IdentificadorAfiliadoField value={value} onChange={vi.fn()} formato={null} />);

    expect(screen.getByDisplayValue('Elegí una obra social primero')).toBeInTheDocument();
  });

  it('el campo de formato es de solo lectura: no se puede editar desde este componente', () => {
    const value: IdentificadorAfiliado = { valor: '123' };

    render(<IdentificadorAfiliadoField value={value} onChange={vi.fn()} formato="numero-documento" />);

    expect(screen.getByLabelText(/formato/i)).toBeDisabled();
  });

  it('editar el valor dispara onChange solo con el valor nuevo, sin tocar el formato (RN-ID-02)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value: IdentificadorAfiliado = { valor: '' };

    render(<IdentificadorAfiliadoField value={value} onChange={onChange} formato="alfanumerico" />);

    await user.type(screen.getByLabelText(/valor/i), 'X');

    expect(onChange).toHaveBeenCalledWith({ valor: 'X' });
  });

  // RF-106/RN-ID-02: error inline de formato, mismo patrón que el resto del formulario de
  // paciente (error?: string pasado a Field, ver PacienteDatosPersonalesFields.tsx).
  it('muestra el mensaje de error recibido por prop debajo del campo Valor', () => {
    const value: IdentificadorAfiliado = { valor: 'OS-AB12345' };

    render(
      <IdentificadorAfiliadoField
        value={value}
        onChange={vi.fn()}
        formato="numero-documento"
        error="El identificador de afiliado debe tener 7 u 8 dígitos."
      />,
    );

    expect(screen.getByText('El identificador de afiliado debe tener 7 u 8 dígitos.')).toBeInTheDocument();
  });

  it('sin error, no muestra ningún mensaje debajo del campo Valor', () => {
    const value: IdentificadorAfiliado = { valor: '45123456' };

    render(<IdentificadorAfiliadoField value={value} onChange={vi.fn()} formato="numero-documento" />);

    expect(screen.queryByText(/identificador de afiliado debe tener/i)).not.toBeInTheDocument();
  });
});
