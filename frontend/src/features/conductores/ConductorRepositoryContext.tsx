import { createContext, useContext, type ReactNode } from 'react';
import type { ConductorRepository } from '../../shared/lib/conductores/ConductorRepository';

// Punto de inyección del repository (design.md Decisión 9): las pantallas de la feature reciben
// el ConductorRepository vía este context, nunca importan el mock directamente. El único lugar
// que conoce mockConductorRepository es el composition root de la feature (ConductoresRoute).
const ConductorRepositoryContext = createContext<ConductorRepository | null>(null);

export function ConductorRepositoryProvider({
  repository,
  children,
}: {
  repository: ConductorRepository;
  children: ReactNode;
}) {
  return (
    <ConductorRepositoryContext.Provider value={repository}>{children}</ConductorRepositoryContext.Provider>
  );
}

export function useConductorRepository(): ConductorRepository {
  const repository = useContext(ConductorRepositoryContext);
  if (repository === null) {
    throw new Error('useConductorRepository debe usarse dentro de <ConductorRepositoryProvider>.');
  }
  return repository;
}
