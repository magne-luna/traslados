import { createContext, useContext, type ReactNode } from 'react';
import type { PresupuestoRepository } from '../../shared/lib/presupuestos/PresupuestoRepository';

// Punto de inyección del repository (design.md Decisión 10): las pantallas de la feature reciben
// el PresupuestoRepository vía este context, nunca importan una implementación concreta
// directamente. El único lugar que conoce supabasePresupuestoRepository (tasks.md 4.1) es el
// composition root de la feature (PresupuestosRoute).
const PresupuestoRepositoryContext = createContext<PresupuestoRepository | null>(null);

export function PresupuestoRepositoryProvider({
  repository,
  children,
}: {
  repository: PresupuestoRepository;
  children: ReactNode;
}) {
  return (
    <PresupuestoRepositoryContext.Provider value={repository}>{children}</PresupuestoRepositoryContext.Provider>
  );
}

export function usePresupuestoRepository(): PresupuestoRepository {
  const repository = useContext(PresupuestoRepositoryContext);
  if (repository === null) {
    throw new Error('usePresupuestoRepository debe usarse dentro de <PresupuestoRepositoryProvider>.');
  }
  return repository;
}
