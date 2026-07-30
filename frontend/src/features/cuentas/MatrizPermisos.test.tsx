import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MapaPermisos } from '../../shared/types/usuario';
import { MatrizPermisos } from './MatrizPermisos';

// tasks.md 5.4 (permisos-modulos-granulares): 7 filas (una por módulo, sin agrupar). Spec
// (cuentas-gestion/spec.md, escenario "Módulos antes agrupados ahora se asignan por separado").
const PERMISOS_PARCIALES: MapaPermisos = { pacientes: 'read', facturacion: 'admin' };

describe('MatrizPermisos', () => {
  it('muestra las 7 filas (una por módulo) con el nivel actual seleccionado, cada control etiquetado', () => {
    render(<MatrizPermisos permisos={PERMISOS_PARCIALES} onGuardar={vi.fn()} />);

    expect(screen.getByRole('combobox', { name: /^pacientes$/i })).toHaveValue('read');
    expect(screen.getByRole('combobox', { name: /obras sociales/i })).toHaveValue('sin_acceso');
    expect(screen.getByRole('combobox', { name: /^facturación$/i })).toHaveValue('admin');
    expect(screen.getByRole('combobox', { name: /^conductores$/i })).toHaveValue('sin_acceso');
    expect(screen.getByRole('combobox', { name: /hojas de ruta/i })).toHaveValue('sin_acceso');
    expect(screen.getByRole('combobox', { name: /presupuestos/i })).toHaveValue('sin_acceso');
    expect(screen.getByRole('combobox', { name: /vehículos/i })).toHaveValue('sin_acceso');
  });

  it('cambiar un nivel no invoca onGuardar todavía (edición diferida)', async () => {
    const user = userEvent.setup();
    const onGuardar = vi.fn();
    render(<MatrizPermisos permisos={PERMISOS_PARCIALES} onGuardar={onGuardar} />);

    await user.selectOptions(screen.getByRole('combobox', { name: /^conductores$/i }), 'write');

    expect(onGuardar).not.toHaveBeenCalled();
  });

  it('otorgar un módulo y guardar invoca onGuardar con el conjunto completo resultante (Scenario: Otorgar acceso)', async () => {
    const user = userEvent.setup();
    const onGuardar = vi.fn().mockResolvedValue(undefined);
    render(<MatrizPermisos permisos={PERMISOS_PARCIALES} onGuardar={onGuardar} />);

    await user.selectOptions(screen.getByRole('combobox', { name: /^conductores$/i }), 'write');
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

    await user.selectOptions(screen.getByRole('combobox', { name: /^facturación$/i }), 'sin_acceso');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onGuardar).toHaveBeenCalledWith([{ modulo: 'pacientes', nivelAcceso: 'read' }]);
  });

  it('dejar todos los módulos en "sin acceso" y guardar envía un array vacío (Scenario: Revocar todos)', async () => {
    const user = userEvent.setup();
    const onGuardar = vi.fn().mockResolvedValue(undefined);
    render(<MatrizPermisos permisos={PERMISOS_PARCIALES} onGuardar={onGuardar} />);

    await user.selectOptions(screen.getByRole('combobox', { name: /^pacientes$/i }), 'sin_acceso');
    await user.selectOptions(screen.getByRole('combobox', { name: /^facturación$/i }), 'sin_acceso');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onGuardar).toHaveBeenCalledWith([]);
  });

  it('cancelar descarta los cambios sin invocar onGuardar y la matriz vuelve al estado almacenado (Scenario: Cambios descartados)', async () => {
    const user = userEvent.setup();
    const onGuardar = vi.fn();
    render(<MatrizPermisos permisos={PERMISOS_PARCIALES} onGuardar={onGuardar} />);

    await user.selectOptions(screen.getByRole('combobox', { name: /^conductores$/i }), 'admin');
    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(onGuardar).not.toHaveBeenCalled();
    expect(screen.getByRole('combobox', { name: /^conductores$/i })).toHaveValue('sin_acceso');
  });

  it('guardando=true deshabilita los selects y los botones (controles bloqueados durante la operación)', () => {
    render(<MatrizPermisos permisos={PERMISOS_PARCIALES} onGuardar={vi.fn()} guardando />);

    expect(screen.getByRole('combobox', { name: /^pacientes$/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /guardando/i })).toBeDisabled();
  });

  it('muestra el error de guardado si se pasa por props', () => {
    render(<MatrizPermisos permisos={PERMISOS_PARCIALES} onGuardar={vi.fn()} error="La cuenta ya no existe." />);
    expect(screen.getByText('La cuenta ya no existe.')).toBeInTheDocument();
  });

  // Scenario: Módulos antes agrupados ahora se asignan por separado (cuentas-gestion/spec.md).
  it('una cuenta con permiso previo sobre pacientes, tras la migración de datos, muestra el mismo nivel en hojas_de_ruta y permite desacoplarlos', async () => {
    const user = userEvent.setup();
    const onGuardar = vi.fn().mockResolvedValue(undefined);
    // La copia aditiva del backend (D1) deja ambas filas con el mismo nivel tras la migración.
    render(<MatrizPermisos permisos={{ pacientes: 'write', hojas_de_ruta: 'write' }} onGuardar={onGuardar} />);

    expect(screen.getByRole('combobox', { name: /^pacientes$/i })).toHaveValue('write');
    expect(screen.getByRole('combobox', { name: /hojas de ruta/i })).toHaveValue('write');

    await user.selectOptions(screen.getByRole('combobox', { name: /hojas de ruta/i }), 'read');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onGuardar).toHaveBeenCalledWith(
      expect.arrayContaining([
        { modulo: 'pacientes', nivelAcceso: 'write' },
        { modulo: 'hojas_de_ruta', nivelAcceso: 'read' },
      ]),
    );
  });
});
