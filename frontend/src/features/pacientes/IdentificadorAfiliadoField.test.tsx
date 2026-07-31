import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IdentificadorAfiliado } from '../../shared/types/paciente';
import { IdentificadorAfiliadoField } from './IdentificadorAfiliadoField';

describe('IdentificadorAfiliadoField', () => {
  it('sin obra social seleccionada, muestra un aviso en vez de un formato (RN-ID-02)', () => {
    const value: IdentificadorAfiliado = { valor: '123' };

    render(<IdentificadorAfiliadoField value={value} onChange={vi.fn()} formato={null} />);

    expect(screen.getByLabelText(/formato/i)).toHaveValue('Elegí una obra social');
  });

  it('muestra el formato derivado de la obra social del paciente, siempre deshabilitado', () => {
    const value: IdentificadorAfiliado = { valor: '45123456' };

    render(<IdentificadorAfiliadoField value={value} onChange={vi.fn()} formato="cuil_sufijo" />);

    const formato = screen.getByLabelText(/formato/i);
    expect(formato).toHaveValue('CUIL del titular con sufijo');
    expect(formato).toBeDisabled();
  });

  it('editar el valor no afecta el formato mostrado (triangulación)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value: IdentificadorAfiliado = { valor: '' };

    render(<IdentificadorAfiliadoField value={value} onChange={onChange} formato="documento" />);

    await user.type(screen.getByLabelText(/valor/i), 'X');

    expect(onChange).toHaveBeenCalledWith({ valor: 'X' });
  });
});
