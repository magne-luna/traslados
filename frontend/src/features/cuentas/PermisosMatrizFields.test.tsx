import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { filasVacias, mapaAFilas } from './modulos';
import { PermisosMatrizFields } from './PermisosMatrizFields';

describe('PermisosMatrizFields', () => {
  it('muestra las 4 filas (una por módulo) con el nivel actual seleccionado, cada control etiquetado', () => {
    const valores = mapaAFilas({ pacientes: 'write' });
    render(<PermisosMatrizFields valores={valores} onCambiarNivel={vi.fn()} idPrefix="test" />);

    expect(screen.getByRole('combobox', { name: /pacientes/i })).toHaveValue('write');
    expect(screen.getByRole('combobox', { name: /obras sociales/i })).toHaveValue('sin_acceso');
  });

  it('cambiar el nivel de un módulo invoca onCambiarNivel con el módulo y el nuevo nivel', async () => {
    const user = userEvent.setup();
    const onCambiarNivel = vi.fn();
    render(<PermisosMatrizFields valores={filasVacias()} onCambiarNivel={onCambiarNivel} idPrefix="test" />);

    await user.selectOptions(screen.getByRole('combobox', { name: /conductores/i }), 'admin');

    expect(onCambiarNivel).toHaveBeenCalledWith('conductores', 'admin');
  });

  it('muestra un ícono de identidad por módulo, uno por cada una de las 4 filas (triangulación)', () => {
    const { container } = render(<PermisosMatrizFields valores={filasVacias()} onCambiarNivel={vi.fn()} idPrefix="test" />);
    expect(container.querySelectorAll('svg')).toHaveLength(4);
  });

  it('disabled deshabilita todos los selects', () => {
    render(<PermisosMatrizFields valores={filasVacias()} onCambiarNivel={vi.fn()} disabled idPrefix="test" />);
    expect(screen.getByRole('combobox', { name: /pacientes/i })).toBeDisabled();
  });

  it('dos instancias con idPrefix distinto no colisionan ids (MatrizPermisos + CuentaForm simultáneos)', () => {
    render(
      <>
        <PermisosMatrizFields valores={filasVacias()} onCambiarNivel={vi.fn()} idPrefix="a" />
        <PermisosMatrizFields valores={filasVacias()} onCambiarNivel={vi.fn()} idPrefix="b" />
      </>,
    );
    expect(screen.getAllByRole('combobox', { name: /^pacientes$/i })).toHaveLength(2);
  });

  it('aclara qué pantallas del sidebar agrupa cada módulo, incluyendo las agrupaciones no obvias', () => {
    render(<PermisosMatrizFields valores={filasVacias()} onCambiarNivel={vi.fn()} idPrefix="test" />);

    expect(screen.getByText(/incluye pacientes y hojas de ruta/i)).toBeInTheDocument();
    expect(screen.getByText(/incluye presupuestos y facturación/i)).toBeInTheDocument();
    expect(screen.getByText(/incluye conductores y vehículos/i)).toBeInTheDocument();
  });
});
