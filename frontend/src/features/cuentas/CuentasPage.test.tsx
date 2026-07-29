import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Cuenta, CuentaRepository } from '../../shared/lib/cuentas/CuentaRepository';
import { CuentaRepositoryProvider } from './CuentaRepositoryContext';
import { CuentasPage } from './CuentasPage';

const ADMIN: Cuenta = {
  id: 'u1',
  email: 'andrea@x.com',
  nombre: 'Andrea',
  apellido: 'Pastor',
  rol: 'admin',
  permisos: { pacientes: 'admin' },
};

function buildFakeRepository(overrides: Partial<CuentaRepository> = {}): CuentaRepository {
  return {
    listarCuentas: vi.fn().mockResolvedValue([ADMIN]),
    crearCuenta: vi.fn().mockResolvedValue(undefined),
    actualizarPermisos: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function renderPage(repository: CuentaRepository) {
  return render(
    <CuentaRepositoryProvider repository={repository}>
      <CuentasPage />
    </CuentaRepositoryProvider>,
  );
}

describe('CuentasPage', () => {
  it('muestra un indicador de carga mientras el listado no resolvió', () => {
    const repository = buildFakeRepository({ listarCuentas: vi.fn(() => new Promise<Cuenta[]>(() => {})) });
    renderPage(repository);

    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('muestra el listado usando el repository inyectado por context', async () => {
    renderPage(buildFakeRepository());
    expect(await screen.findByText('andrea@x.com')).toBeInTheDocument();
  });

  it('muestra un error con reintentar cuando el listado falla, y reintentar vuelve a cargar', async () => {
    const user = userEvent.setup();
    const listarCuentas = vi.fn().mockRejectedValueOnce(new Error('no se pudo conectar')).mockResolvedValueOnce([ADMIN]);
    renderPage(buildFakeRepository({ listarCuentas }));

    expect(await screen.findByText('no se pudo conectar')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(await screen.findByText('andrea@x.com')).toBeInTheDocument();
  });

  it('navega al detalle al seleccionar una cuenta y vuelve al listado con "Volver al listado"', async () => {
    const user = userEvent.setup();
    renderPage(buildFakeRepository());

    await user.click(await screen.findByText('andrea@x.com'));
    expect(screen.getByRole('heading', { name: 'Andrea Pastor' })).toBeInTheDocument();

    const [volver] = screen.getAllByText(/volver al listado/i);
    await user.click(volver as HTMLElement);
    expect(screen.getByText('andrea@x.com')).toBeInTheDocument();
  });

  it('navega al alta con "Nueva cuenta", crea la cuenta y vuelve al listado', async () => {
    const user = userEvent.setup();
    const repository = buildFakeRepository();
    renderPage(repository);

    await screen.findByText('andrea@x.com');
    await user.click(screen.getByRole('button', { name: /nueva cuenta/i }));

    await user.type(screen.getByLabelText(/^email$/i), 'nueva@x.com');
    await user.type(screen.getByLabelText(/nombre/i), 'Nueva');
    await user.type(screen.getByLabelText(/apellido/i), 'Cuenta');
    await user.type(screen.getByLabelText(/contraseña/i), 'password-12');
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(repository.crearCuenta).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('andrea@x.com')).toBeInTheDocument();
  });

  it('si crearCuenta falla, muestra el error en el formulario y no navega al listado', async () => {
    const user = userEvent.setup();
    const repository = buildFakeRepository({ crearCuenta: vi.fn().mockRejectedValue(new Error('El email ya está en uso.')) });
    renderPage(repository);

    await screen.findByText('andrea@x.com');
    await user.click(screen.getByRole('button', { name: /nueva cuenta/i }));
    await user.type(screen.getByLabelText(/^email$/i), 'nueva@x.com');
    await user.type(screen.getByLabelText(/nombre/i), 'Nueva');
    await user.type(screen.getByLabelText(/apellido/i), 'Cuenta');
    await user.type(screen.getByLabelText(/contraseña/i), 'password-12');
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(await screen.findByText('El email ya está en uso.')).toBeInTheDocument();
    expect(screen.queryByText('andrea@x.com')).not.toBeInTheDocument();
  });

  it('cancelar el alta vuelve al listado sin invocar crearCuenta', async () => {
    const user = userEvent.setup();
    const repository = buildFakeRepository();
    renderPage(repository);

    await screen.findByText('andrea@x.com');
    await user.click(screen.getByRole('button', { name: /nueva cuenta/i }));
    await user.click(screen.getByRole('button', { name: /cancelar/i }));

    expect(repository.crearCuenta).not.toHaveBeenCalled();
    expect(screen.getByText('andrea@x.com')).toBeInTheDocument();
  });
});
