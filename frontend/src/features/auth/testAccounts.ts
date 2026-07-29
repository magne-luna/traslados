// Botones de autocompletado en LoginPage (solo en desarrollo, nunca en el build de producción):
// las cuentas viven en VITE_TEST_ACCOUNTS (frontend/.env.local, gitignoreado), nunca hardcodeadas
// ni commiteadas. Ver LoginPage.tsx — decisión explícita distinta del "hack de demo" que se borró
// en auth-frontend-real: acá solo se rellena el formulario, el login sigue pasando por
// signIn(email, password) contra Supabase real.
export type CuentaDePrueba = {
  label: string;
  email: string;
  password: string;
};

function esCuentaDePrueba(item: unknown): item is CuentaDePrueba {
  if (typeof item !== 'object' || item === null) return false;
  const registro = item as Record<string, unknown>;
  return (
    typeof registro.label === 'string' &&
    typeof registro.email === 'string' &&
    typeof registro.password === 'string'
  );
}

export function parseCuentasDePrueba(raw: string | undefined): CuentaDePrueba[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];
  return parsed.filter(esCuentaDePrueba);
}

export function getCuentasDePrueba(): CuentaDePrueba[] {
  if (!import.meta.env.DEV) return [];
  return parseCuentasDePrueba(import.meta.env.VITE_TEST_ACCOUNTS);
}
