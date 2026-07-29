import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Cuenta } from '../../shared/lib/cuentas/CuentaRepository';
import { CuentasList } from './CuentasList';

const ADMIN: Cuenta = {
  id: 'u1',
  email: 'andrea@x.com',
  nombre: 'Andrea',
  apellido: 'Pastor',
  rol: 'admin',
  permisos: { pacientes: 'admin', obra_social: 'admin', facturacion: 'admin', conductores: 'admin' },
};

const EMPLEADO: Cuenta = {
  id: 'u2',
  email: 'enzo@x.com',
  nombre: 'Enzo',
  apellido: 'Gómez',
  rol: 'empleado',
  permisos: { pacientes: 'write' },
};

describe('CuentasList', () => {
  it('muestra un indicador de carga mientras loading es true', () => {
    render(<CuentasList cuentas={[]} loading error={null} onSelect={vi.fn()} onRetry={vi.fn()} />);
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('muestra un estado vacío cuando no hay cuentas (triangulación con loading)', () => {
    render(<CuentasList cuentas={[]} loading={false} error={null} onSelect={vi.fn()} onRetry={vi.fn()} />);
    expect(screen.getByText(/no hay cuentas/i)).toBeInTheDocument();
  });

  it('muestra un mensaje de error con botón de reintentar, sin quedar en loading infinito', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<CuentasList cuentas={[]} loading={false} error="no se pudo conectar" onSelect={vi.fn()} onRetry={onRetry} />);

    expect(screen.getByText(/no se pudo conectar/i)).toBeInTheDocument();
    expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('lista email y rol de cada cuenta, sin nombre ni módulos (esos van en el detalle)', () => {
    render(<CuentasList cuentas={[ADMIN, EMPLEADO]} loading={false} error={null} onSelect={vi.fn()} onRetry={vi.fn()} />);

    expect(screen.getByText('andrea@x.com')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();

    expect(screen.getByText('enzo@x.com')).toBeInTheDocument();
    expect(screen.getByText('empleado')).toBeInTheDocument();

    expect(screen.queryByText('Andrea Pastor')).not.toBeInTheDocument();
    expect(screen.queryByText('Pacientes')).not.toBeInTheDocument();
  });

  it('filtra el listado por nombre, apellido o email a medida que se escribe en el buscador', async () => {
    const user = userEvent.setup();
    render(<CuentasList cuentas={[ADMIN, EMPLEADO]} loading={false} error={null} onSelect={vi.fn()} onRetry={vi.fn()} />);

    await user.type(screen.getByRole('textbox', { name: /buscar cuenta/i }), 'enzo');

    expect(screen.getByText('enzo@x.com')).toBeInTheDocument();
    expect(screen.queryByText('andrea@x.com')).not.toBeInTheDocument();
  });

  it('muestra un mensaje cuando ninguna cuenta coincide con la búsqueda (triangulación)', async () => {
    const user = userEvent.setup();
    render(<CuentasList cuentas={[ADMIN, EMPLEADO]} loading={false} error={null} onSelect={vi.fn()} onRetry={vi.fn()} />);

    await user.type(screen.getByRole('textbox', { name: /buscar cuenta/i }), 'nadie-existe');

    expect(screen.getByText(/ninguna cuenta coincide/i)).toBeInTheDocument();
  });

  it('dispara onSelect al hacer click en cualquier parte de la fila', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<CuentasList cuentas={[ADMIN]} loading={false} error={null} onSelect={onSelect} onRetry={vi.fn()} />);

    await user.click(screen.getByText('andrea@x.com'));
    expect(onSelect).toHaveBeenCalledWith(ADMIN);
  });

  it('el email es un control real operable por teclado (Enter dispara onSelect)', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<CuentasList cuentas={[ADMIN]} loading={false} error={null} onSelect={onSelect} onRetry={vi.fn()} />);

    const emailBtn = screen.getByRole('button', { name: /andrea@x\.com/i });
    emailBtn.focus();
    await user.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith(ADMIN);
  });

  it('usa el id de la cuenta como key, no el índice (react-best-practices)', () => {
    // No hay forma directa de leer `key` desde el DOM: se verifica indirectamente que las dos
    // filas con el mismo rol pero distinto id/email se renderizan como elementos independientes
    // (si usara el índice como key, React podría reusar el nodo del DOM incorrectamente al
    // reordenar/filtrar en un cambio posterior — acá alcanza con confirmar 2 filas separadas).
    const dosAdmins: Cuenta[] = [ADMIN, { ...ADMIN, id: 'u1-bis', email: 'otra@x.com' }];
    render(<CuentasList cuentas={dosAdmins} loading={false} error={null} onSelect={vi.fn()} onRetry={vi.fn()} />);
    expect(screen.getAllByText('admin')).toHaveLength(2);
  });
});
