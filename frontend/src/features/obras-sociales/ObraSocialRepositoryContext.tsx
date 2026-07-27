import { createContext, useContext, type ReactNode } from 'react';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';

// Punto de inyección del repository (design.md Decisión 6): las pantallas de la feature reciben
// el ObraSocialRepository vía este context, nunca importan el mock directamente. El único lugar
// que conoce mockObraSocialRepository es el composition root de la feature (ObraSocialesRoute).
const ObraSocialRepositoryContext = createContext<ObraSocialRepository | null>(null);

export function ObraSocialRepositoryProvider({
  repository,
  children,
}: {
  repository: ObraSocialRepository;
  children: ReactNode;
}) {
  return (
    <ObraSocialRepositoryContext.Provider value={repository}>{children}</ObraSocialRepositoryContext.Provider>
  );
}

export function useObraSocialRepository(): ObraSocialRepository {
  const repository = useContext(ObraSocialRepositoryContext);
  if (repository === null) {
    throw new Error('useObraSocialRepository debe usarse dentro de <ObraSocialRepositoryProvider>.');
  }
  return repository;
}
