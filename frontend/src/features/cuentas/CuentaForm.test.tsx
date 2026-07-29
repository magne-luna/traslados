import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CuentaForm } from './CuentaForm';

describe('CuentaForm', () => {
  it('completar email/nombre/apellido/password válidos y enviar invoca onSubmit con los valores y sin permisos iniciales', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CuentaForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^email$/i), 'nueva@x.com');
    await user.type(screen.getByLabelText(/nombre/i), 'Nueva');
    await user.type(screen.getByLabelText(/apellido/i), 'Cuenta');
    await user.type(screen.getByLabelText(/contraseña/i), 'password-12');
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      email: 'nueva@x.com',
      nombre: 'Nueva',
      apellido: 'Cuenta',
      password: 'password-12',
      permisos: [],
    });
  });

  it('asignar un nivel inicial a un módulo lo incluye en los permisos enviados (tasks.md 6.5/7.6)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CuentaForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^email$/i), 'nueva@x.com');
    await user.type(screen.getByLabelText(/nombre/i), 'Nueva');
    await user.type(screen.getByLabelText(/apellido/i), 'Cuenta');
    await user.type(screen.getByLabelText(/contraseña/i), 'password-12');
    await user.selectOptions(screen.getByRole('combobox', { name: /pacientes/i }), 'read');
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ permisos: [{ modulo: 'pacientes', nivelAcceso: 'read' }] }));
  });

  it('contraseña de menos de 8 caracteres bloquea el envío y muestra el error, sin invocar onSubmit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CuentaForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.type(screen.getByLabelText(/^email$/i), 'nueva@x.com');
    await user.type(screen.getByLabelText(/nombre/i), 'Nueva');
    await user.type(screen.getByLabelText(/apellido/i), 'Cuenta');
    await user.type(screen.getByLabelText(/contraseña/i), 'corta');
    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(screen.getByText('La contraseña debe tener 8 caracteres o más.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('campos obligatorios incompletos bloquean el envío y señalan los campos faltantes (triangulación)', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<CuentaForm onSubmit={onSubmit} onCancel={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /crear cuenta/i }));

    expect(screen.getByText('El email es obligatorio.')).toBeInTheDocument();
    expect(screen.getByText('El nombre es obligatorio.')).toBeInTheDocument();
    expect(screen.getByText('El apellido es obligatorio.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('cancelar invoca onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<CuentaForm onSubmit={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', { name: /cancelar/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('submitting deshabilita el botón de crear y muestra "Creando…"', () => {
    render(<CuentaForm onSubmit={vi.fn()} onCancel={vi.fn()} submitting />);
    expect(screen.getByRole('button', { name: /creando/i })).toBeDisabled();
  });

  it('muestra el error de envío (ej. email duplicado del backend) si se pasa por props', () => {
    render(<CuentaForm onSubmit={vi.fn()} onCancel={vi.fn()} submitError="El email ya está en uso." />);
    expect(screen.getByText('El email ya está en uso.')).toBeInTheDocument();
  });
});
