import type { FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Button } from '../../design-system/components';
import { useAuth } from '../../shared/auth/useAuth';

// Login mock (route-guard spec / Decisión 4 de design.md): NO valida credenciales reales ni
// contacta Supabase, solo dispara signIn() sobre el useAuth() en memoria. Si ya hay sesión
// activa, redirige directo al Dashboard en vez de mostrar el formulario.
export function LoginPage() {
  const { session, signIn } = useAuth();
  const navigate = useNavigate();

  if (session !== null) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    signIn();
    navigate('/', { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-xl">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-90 flex-col gap-lg rounded-lg border border-border bg-surface p-xxl shadow-card"
      >
        <div>
          <h1 className="m-0 font-heading text-[22px] font-bold text-ink">Pastor Traslados</h1>
          <p className="mt-xs font-body text-[13px] text-muted">Ingresá para continuar.</p>
        </div>

        <Button type="submit" variant="primary">
          Ingresar
        </Button>
      </form>
    </div>
  );
}
