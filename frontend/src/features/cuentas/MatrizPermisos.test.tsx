import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MapaPermisos } from '../../shared/types/usuario';
import { MatrizPermisos } from './MatrizPermisos';

const PERMISOS_PARCIALES: MapaPermisos = { pacientes: 'read', facturacion: 'admin' };

describe('MatrizPermisos', () => {
  it('muestra las 4 filas (una por módulo) con el nivel actual seleccionado, cada control etiquetado', () => {
    render(<MatrizPermisos permisos={PERMISOS_PARCIALES} onGuardar={vi.fn()} />);

    expect(screen.getByRole('combobox', { name: /pacientes/i })).toHaveValue('read');
    expect(screen.getByRole('combobox', { name: /obras sociales/i })).toHaveValue('sin_acceso');
    expect(screen.getByRole('combobox', { name: /facturación/i })).toHaveValue('admin');
    expect(screen.getByRole('combobox', { name: /conductores/i })).toHaveValue('sin_acceso');
  });

  it('cambiar un nivel no invoca onGuardar todavía (edición diferida)', async () => {
    const user = userEvent.setup();
    const onGuardar = vi.fn();
    render(<MatrizPermisos permisos={PERMISOS_PARCIALES} onGuardar={onGuardar} />);

    await user.selectOptions(screen.getByRole('combobox', { name: /conductores/i }), 'write');

    expect(onGuardar).not.toHaveBeenCalled();
  });

  it('otorgar un módulo y guardar invoca onGuardar con el conjunto completo resultante (Scenario: Otorgar acceso)', async () => {
    const user = userEvent.setup();
    const onGuardar = vi.fn().mockResolvedValue(undefined);
    render(<MatrizPermisos permisos={PERMISOS_PARCIALES} onGuardar={onGuardar} />);

    await user.selectOptions(screen.getByRole('combobox', { name: /conductores/i }), 'write');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onGuardar).toHaveBeenCalledWith(
      expect.arrayContaining([
        { modulo: 'pacientes', nivelAcceso: 'read' },
        { modulo: 'facturacion', nivelAcceso: 'admin' },
        { modulo: 'conductores', nivelAcceso: 'write' },
      ]),
    );
    const primeraLlamada = onGuardar.mock.calls[0]?.[0] as unknown[] | undefined;
    expect(primeraLlamada?.length).toBe(3);
  });

  it('revocar un módulo (dejarlo en "sin acceso") y guardar lo excluye del conjunto enviado (Scenario: Revocar acceso)', async () => {
    const user = userEvent.setup();
    const onGuardar = vi.fn().mockResolvedValue(undefined);
    render(<MatrizPermisos permisos={PERMISOS_PARCIALES} onGuardar={onGuardar} />);

    await user.selectOptions(screen.getByRole('combobox', { name: /facturación/i }), 'sin_acceso');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onGuardar).toHaveBeenCalledWith([{ modulo: 'pacientes', nivelAcceso: 'read' }]);
  });

  it('dejar todos los módulos en "sin acceso" y guardar envía un array vacío (Scenario: Revocar todos)', async () => {
    const user = userEvent.setup();
    const onGuardar = vi.fn().mockResolvedValue(undefined);
    render(<MatrizPermisos permisos={PERMISOS_PARCIALES} onGuardar={onGuardar} />);

    await user.selectOptions(screen.getByRole('combobox', { name: /pacientes/i }), 'sin_acceso');
    await user.selectOptions(screen.getByRole('combobox', { name: /facturación/i }), 'sin_acceso');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onGuardar).toHaveBeenCalledWith([]);
  });

  it('cancelar descarta los cambios sin invocar onGuardar y la matriz vuelve al estado almacenado (Scenario: Cambios descartados)', async () => {
    const user = userEvent.setup();
    const onGuardar = vi.fn();
    render(<MatrizPermisos permisos={PERMISOS_PARCIALES} onGuardar={onGuardar} />);

    await user.selectOptions(screen.getByRole('combobox', { name: /conductores/i }), 'admin');
    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(onGuardar).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: /conductores/i })).toHaveValue('sin_acceso');
  });

  it('guardando=true deshabilita los selects y los botones (controles bloqueados durante la operación)', () => {
    render(<MatrizPermisos permisos={PERMISOS_PARCIALES} onGuardar={vi.fn()} guardando />);

    expect(screen.getByRole('combobox', { name: /pacientes/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /guardando/i })).toBeDisabled();
  });

  it('muestra el error de guardado si se pasa por props', () => {
    render(<MatrizPermisos permisos={PERMISOS_PARCIALES} onGuardar={vi.fn()} error="La cuenta ya no existe." />);
    expect(screen.getByText('La cuenta ya no existe.')).toBeInTheDocument();
  });
});
