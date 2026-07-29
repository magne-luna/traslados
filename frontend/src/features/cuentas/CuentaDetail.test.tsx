import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Cuenta } from '../../shared/lib/cuentas/CuentaRepository';
import { CuentaDetail } from './CuentaDetail';

const CUENTA: Cuenta = {
  id: 'u1',
  email: 'andrea@x.com',
  nombre: 'Andrea',
  apellido: 'Pastor',
  rol: 'empleado',
  permisos: { pacientes: 'admin' },
};

const CUENTA_ADMIN: Cuenta = { ...CUENTA, rol: 'admin' };

describe('CuentaDetail', () => {
  it('muestra el perfil (nombre, apellido, email, rol, módulos habilitados) y la matriz de permisos', () => {
    render(<CuentaDetail cuenta={CUENTA} onActualizarPermisos={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Andrea Pastor' })).toBeInTheDocument();
    expect(screen.getByText('andrea@x.com')).toBeInTheDocument();
    expect(screen.getByText('empleado')).toBeInTheDocument();
    // El nivel de acceso se muestra aparte del Chip del módulo (son dos datos distintos, no un
    // solo texto compuesto dentro de la pill). "Pacientes" aparece dos veces en la pantalla (el
    // Chip del perfil y el label del <Select> en la matriz) — el Chip es el primero en el DOM.
    const [chipPacientes] = screen.getAllByText('Pacientes');
    if (!chipPacientes) throw new Error('No se encontró el Chip de Pacientes');
    const filaPacientes = chipPacientes.closest('div');
    if (!filaPacientes) throw new Error('El Chip de Pacientes no tiene contenedor');
    expect(within(filaPacientes).getByText('Administrador')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /pacientes/i })).toHaveValue('admin');
  });

  it('cuenta sin ningún permiso muestra los 4 módulos en "Sin acceso" (triangulación)', () => {
    const sinPermisos: Cuenta = { ...CUENTA, permisos: {} };
    render(<CuentaDetail cuenta={sinPermisos} onActualizarPermisos={vi.fn()} onBack={vi.fn()} />);

    // Scope a la sección "Cuenta" (no a toda la pantalla): la matriz de abajo también tiene la
    // opción "Sin acceso" en cada <select>, que no debe contarse acá.
    const seccionCuenta = screen.getByRole('heading', { name: 'Andrea Pastor' }).closest('section');
    if (!seccionCuenta) throw new Error('No se encontró la sección "Cuenta"');
    expect(within(seccionCuenta).getAllByText('Sin acceso')).toHaveLength(4);
  });

  it('guardar en la matriz invoca onActualizarPermisos con el id de la cuenta y el conjunto de permisos', async () => {
    const user = userEvent.setup();
    const onActualizarPermisos = vi.fn().mockResolvedValue(undefined);
    render(<CuentaDetail cuenta={CUENTA} onActualizarPermisos={onActualizarPermisos} onBack={vi.fn()} />);

    await user.selectOptions(screen.getByRole('combobox', { name: /conductores/i }), 'read');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(onActualizarPermisos).toHaveBeenCalledWith('u1', [
      { modulo: 'pacientes', nivelAcceso: 'admin' },
      { modulo: 'conductores', nivelAcceso: 'read' },
    ]);
  });

  it('si onActualizarPermisos rechaza, muestra el mensaje de error en la matriz', async () => {
    const user = userEvent.setup();
    const onActualizarPermisos = vi.fn().mockRejectedValue(new Error('La cuenta ya no existe.'));
    render(<CuentaDetail cuenta={CUENTA} onActualizarPermisos={onActualizarPermisos} onBack={vi.fn()} />);

    await user.selectOptions(screen.getByRole('combobox', { name: /conductores/i }), 'read');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText('La cuenta ya no existe.')).toBeInTheDocument();
  });

  it('cuenta admin muestra un aviso en vez de la matriz editable (tienePermiso ignora la matriz para admin)', () => {
    render(<CuentaDetail cuenta={CUENTA_ADMIN} onActualizarPermisos={vi.fn()} onBack={vi.fn()} />);

    expect(screen.getByText(/acceso completo a todos los módulos/i)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('volver invoca onBack', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<CuentaDetail cuenta={CUENTA} onActualizarPermisos={vi.fn()} onBack={onBack} />);

    const [primerLink] = screen.getAllByText(/volver al listado/i);
    await user.click(primerLink as HTMLElement);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
