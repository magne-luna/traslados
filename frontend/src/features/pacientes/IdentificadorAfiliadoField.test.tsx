import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { IdentificadorAfiliado } from '../../shared/types/paciente';
import { IdentificadorAfiliadoField } from './IdentificadorAfiliadoField';

describe('IdentificadorAfiliadoField', () => {
  it('muestra las tres opciones de formato de la unión cerrada', () => {
    const value: IdentificadorAfiliado = { formato: 'numero-documento', valor: '123' };

    render(<IdentificadorAfiliadoField value={value} onChange={vi.fn()} />);

    expect(screen.getByRole('option', { name: /número de documento/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /alfanumérico/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /cuil del titular con sufijo/i })).toBeInTheDocument();
  });

  it('cambiar el formato NO borra ni fuerza el valor cargado (RN-ID-02)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value: IdentificadorAfiliado = { formato: 'numero-documento', valor: '45123456' };

    render(<IdentificadorAfiliadoField value={value} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText(/formato/i), 'cuil-con-sufijo');

    expect(onChange).toHaveBeenCalledWith({ formato: 'cuil-con-sufijo', valor: '45123456' });
  });

  it('editar el valor no cambia el formato seleccionado (triangulación)', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value: IdentificadorAfiliado = { formato: 'alfanumerico', valor: '' };

    render(<IdentificadorAfiliadoField value={value} onChange={onChange} />);

    await user.type(screen.getByLabelText(/valor/i), 'X');

    expect(onChange).toHaveBeenCalledWith({ formato: 'alfanumerico', valor: 'X' });
  });

  it('el formato por defecto es editable: cualquier opción puede seleccionarse libremente', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const value: IdentificadorAfiliado = { formato: 'numero-documento', valor: '1' };

    render(<IdentificadorAfiliadoField value={value} onChange={onChange} />);
    const select = screen.getByLabelText(/formato/i) as HTMLSelectElement;

    expect(select.value).toBe('numero-documento');
    await user.selectOptions(select, 'alfanumerico');
    expect(onChange).toHaveBeenCalledWith({ formato: 'alfanumerico', valor: '1' });
  });
});
