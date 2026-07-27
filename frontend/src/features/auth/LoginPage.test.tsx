import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { LoginPage } from './LoginPage';
import { useAuth } from '../../shared/auth/useAuth';

vi.mock('../../shared/auth/useAuth');
const mockedUseAuth = vi.mocked(useAuth);

describe('LoginPage', () => {
  it('al confirmar el login invoca signIn() y navega al Dashboard', () => {
    const signIn = vi.fn();
    mockedUseAuth.mockReturnValue({ session: null, signIn, signOut: vi.fn() });

    const router = createMemoryRouter(
      [
        { path: '/login', element: <LoginPage /> },
        { path: '/', element: <div>Dashboard</div> },
      ],
      { initialEntries: ['/login'] },
    );

    render(<RouterProvider router={router} />);

    fireEvent.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(signIn).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
