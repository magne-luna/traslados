import { createContext, useContext, type ReactNode } from 'react';
import type { PrestadorRepository } from '../../shared/lib/prestadores/PrestadorRepository';

// Punto de inyección del repository (design.md D1 de prestadores-crud, espejo 1:1 de
// ObraSocialRepositoryContext.tsx): las pantallas de la feature reciben el PrestadorRepository vía
// este context, nunca importan supabasePrestadorRepository directamente. El único lugar que lo
// conoce es el composition root de la feature (PrestadoresRoute). Sin test dedicado (tasks.md
// 4.1) — mismo criterio que ya usa este repo para archivos de plomería/context.
const PrestadorRepositoryContext = createContext<PrestadorRepository | null>(null);

export function PrestadorRepositoryProvider({
  repository,
  children,
}: {
  repository: PrestadorRepository;
  children: ReactNode;
}) {
  return (
    <PrestadorRepositoryContext.Provider value={repository}>{children}</PrestadorRepositoryContext.Provider>
  );
}

export function usePrestadorRepository(): PrestadorRepository {
  const repository = useContext(PrestadorRepositoryContext);
  if (repository === null) {
    throw new Error('usePrestadorRepository debe usarse dentro de <PrestadorRepositoryProvider>.');
  }
  return repository;
}
