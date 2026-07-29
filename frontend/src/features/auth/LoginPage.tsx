import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { Button } from '../../design-system/components';
import { Field, Input } from '../../design-system/form';
import { Alert } from '../../design-system/feedback';
import { useAuth } from '../../shared/auth/useAuth';
import { getCuentasDePrueba } from './testAccounts';

// Reescritura (tasks.md 5.7, route-guard spec): valida credenciales reales contra Supabase Auth
// vía signIn(email, password). Borrado el hack de demo (DEMO_EMAIL/DEMO_PASSWORD/defaultValue —
// proposal.md "Eliminación del hack de demo"). Preserva el destino original: RequireAuth guarda
// la ruta pedida en el query param `destino` (ver RequireAuth.tsx), y este componente vuelve ahí
// tras un login efectivo en vez de ir siempre al Dashboard.
export function LoginPage() {
  const estado = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const cuentasDePrueba = getCuentasDePrueba();

  if (estado.status === 'loading') {
    return (
      <p role="status" className="p-xl font-body text-sm text-muted">
        Cargando…
      </p>
    );
  }

  if (estado.status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!email || !password) {
      setError('Completá el email y la contraseña.');
      return;
    }

    setError(null);
    setEnviando(true);
    const resultado = await estado.signIn(email, password);
    setEnviando(false);

    if (!resultado.ok) {
      setError(resultado.error);
      return;
    }

    const destino = searchParams.get('destino');
    navigate(destino ? decodeURIComponent(destino) : '/', { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-xl">
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="flex w-full max-w-90 flex-col gap-lg rounded-lg border border-border bg-surface p-xxl shadow-card"
      >
        <div className="flex flex-col items-center gap-sm text-center">
          <img src="/logo.jpeg" alt="Pastor Traslados" className="h-16 w-16 rounded-full object-cover" />
          <h1 className="m-0 font-heading text-[22px] font-bold text-ink">Pastor Traslados</h1>
          <p className="mt-xs font-body text-[13px] text-muted">Ingresá para continuar.</p>
        </div>

        {error && <Alert tone="danger">{error}</Alert>}

        <Field label="Email" htmlFor="login-email">
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field label="Contraseña" htmlFor="login-password">
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>

        <div className="flex justify-center">
          <Button type="submit" variant="primary" disabled={enviando}>
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </div>

        {cuentasDePrueba.length > 0 && (
          <div className="flex flex-col gap-sm border-t border-border pt-lg">
            <p className="m-0 text-center font-mono text-[11px] uppercase tracking-[0.08em] text-faint">
              Cuentas de prueba (solo dev)
            </p>
            <div className="flex flex-wrap justify-center gap-xs">
              {cuentasDePrueba.map((cuenta) => (
                <Button
                  key={cuenta.email}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setEmail(cuenta.email);
                    setPassword(cuenta.password);
                  }}
                >
                  {cuenta.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
