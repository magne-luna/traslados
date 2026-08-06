import { createContext, useContext, type ReactNode } from 'react';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';

// Punto de inyección del repository (design.md Decisión 10): las pantallas de la feature reciben
// el AutorizacionRepository vía este context, nunca importan una implementación concreta
// directamente. El único lugar que conoce supabaseAutorizacionRepository (tasks.md 4.1) es el
// composition root (PresupuestosRoute).
const AutorizacionRepositoryContext = createContext<AutorizacionRepository | null>(null);

export function AutorizacionRepositoryProvider({
  repository,
  children,
}: {
  repository: AutorizacionRepository;
  children: ReactNode;
}) {
  return (
    <AutorizacionRepositoryContext.Provider value={repository}>{children}</AutorizacionRepositoryContext.Provider>
  );
}

export function useAutorizacionRepository(): AutorizacionRepository {
  const repository = useContext(AutorizacionRepositoryContext);
  if (repository === null) {
    throw new Error('useAutorizacionRepository debe usarse dentro de <AutorizacionRepositoryProvider>.');
  }
  return repository;
}
