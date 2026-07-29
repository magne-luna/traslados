import { createContext, useContext, type ReactNode } from 'react';
import type { CuentaRepository } from '../../shared/lib/cuentas/CuentaRepository';

// Punto de inyección del repository (design.md D9, mismo patrón que ObraSocialRepositoryContext):
// las pantallas de la feature reciben el CuentaRepository vía este context, nunca importan
// SupabaseCuentaRepository/mockCuentaRepository directamente. El único lugar que conoce cuál
// implementación usar es el composition root de la feature (CuentasRoute.tsx, tasks.md 7.8).
const CuentaRepositoryContext = createContext<CuentaRepository | null>(null);

export function CuentaRepositoryProvider({
  repository,
  children,
}: {
  repository: CuentaRepository;
  children: ReactNode;
}) {
  return <CuentaRepositoryContext.Provider value={repository}>{children}</CuentaRepositoryContext.Provider>;
}

export function useCuentaRepository(): CuentaRepository {
  const repository = useContext(CuentaRepositoryContext);
  if (repository === null) {
    throw new Error('useCuentaRepository debe usarse dentro de <CuentaRepositoryProvider>.');
  }
  return repository;
}
