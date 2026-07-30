import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MODULOS, filasVacias, mapaAFilas } from './modulos';
import { PermisosMatrizFields } from './PermisosMatrizFields';

// tasks.md 5.4 (permisos-modulos-granulares): 7 filas (una por módulo, sin agrupar). SUBMODULOS_MODULO
// se eliminó (design.md D4) — este archivo ya no testea ningún hint de "incluye X e Y".

describe('PermisosMatrizFields', () => {
  it('muestra las 7 filas (una por módulo) con el nivel actual seleccionado, cada control etiquetado', () => {
    const valores = mapaAFilas({ pacientes: 'write' });
    render(<PermisosMatrizFields valores={valores} onCambiarNivel={vi.fn()} idPrefix="test" />);

    expect(screen.getByRole('combobox', { name: /^pacientes$/i })).toHaveValue('write');
    expect(screen.getByRole('combobox', { name: /obras sociales/i })).toHaveValue('sin_acceso');
    expect(screen.getByRole('combobox', { name: /hojas de ruta/i })).toHaveValue('sin_acceso');
    expect(screen.getByRole('combobox', { name: /presupuestos/i })).toHaveValue('sin_acceso');
    expect(screen.getByRole('combobox', { name: /vehículos/i })).toHaveValue('sin_acceso');
  });

  it('un módulo padre y su módulo hijo se muestran con niveles independientes (triangulación de desacople)', () => {
    const valores = mapaAFilas({ pacientes: 'write', hojas_de_ruta: 'read' });
    render(<PermisosMatrizFields valores={valores} onCambiarNivel={vi.fn()} idPrefix="test" />);

    expect(screen.getByRole('combobox', { name: /^pacientes$/i })).toHaveValue('write');
    expect(screen.getByRole('combobox', { name: /hojas de ruta/i })).toHaveValue('read');
  });

  it('cambiar el nivel de un módulo invoca onCambiarNivel con el módulo y el nuevo nivel', async () => {
    const user = userEvent.setup();
    const onCambiarNivel = vi.fn();
    render(<PermisosMatrizFields valores={filasVacias()} onCambiarNivel={onCambiarNivel} idPrefix="test" />);

    await user.selectOptions(screen.getByRole('combobox', { name: /^conductores$/i }), 'admin');

    expect(onCambiarNivel).toHaveBeenCalledWith('conductores', 'admin');
  });

  it('cambiar el nivel de un módulo hijo no afecta al selector de su módulo padre', async () => {
    const user = userEvent.setup();
    const onCambiarNivel = vi.fn();
    render(<PermisosMatrizFields valores={filasVacias()} onCambiarNivel={onCambiarNivel} idPrefix="test" />);

    await user.selectOptions(screen.getByRole('combobox', { name: /vehículos/i }), 'write');

    expect(onCambiarNivel).toHaveBeenCalledWith('vehiculos', 'write');
    expect(onCambiarNivel).not.toHaveBeenCalledWith('conductores', expect.anything());
  });

  it('muestra un ícono de identidad por módulo, uno por cada una de las 7 filas (triangulación)', () => {
    const { container } = render(<PermisosMatrizFields valores={filasVacias()} onCambiarNivel={vi.fn()} idPrefix="test" />);
    expect(container.querySelectorAll('svg')).toHaveLength(MODULOS.length);
    expect(MODULOS).toHaveLength(7);
  });

  it('disabled deshabilita todos los selects', () => {
    render(<PermisosMatrizFields valores={filasVacias()} onCambiarNivel={vi.fn()} disabled idPrefix="test" />);
    expect(screen.getByRole('combobox', { name: /^pacientes$/i })).toBeDisabled();
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
});
