import { createContext, useContext, type ReactNode } from 'react';
import type { CobroRepository } from '../../shared/lib/facturacion/CobroRepository';

// Punto de inyección del repository (tasks.md 5.3, design.md Decisión 15): las pantallas de la
// feature reciben el CobroRepository vía este context, nunca importan el mock directamente. El
// único lugar que conoce mockCobroRepository es el composition root (FacturacionRoute).
const CobroRepositoryContext = createContext<CobroRepository | null>(null);

export function CobroRepositoryProvider({
  repository,
  children,
}: {
  repository: CobroRepository;
  children: ReactNode;
}) {
  return <CobroRepositoryContext.Provider value={repository}>{children}</CobroRepositoryContext.Provider>;
}

export function useCobroRepository(): CobroRepository {
  const repository = useContext(CobroRepositoryContext);
  if (repository === null) {
    throw new Error('useCobroRepository debe usarse dentro de <CobroRepositoryProvider>.');
  }
  return repository;
}
