import { createContext, useContext, type ReactNode } from 'react';
import type { FacturaRepository } from '../../shared/lib/facturacion/FacturaRepository';

// Punto de inyección del repository (tasks.md 5.3, design.md Decisión 15): las pantallas de la
// feature reciben el FacturaRepository vía este context, nunca importan el mock directamente. El
// único lugar que conoce mockFacturaRepository es el composition root (FacturacionRoute).
const FacturaRepositoryContext = createContext<FacturaRepository | null>(null);

export function FacturaRepositoryProvider({
  repository,
  children,
}: {
  repository: FacturaRepository;
  children: ReactNode;
}) {
  return <FacturaRepositoryContext.Provider value={repository}>{children}</FacturaRepositoryContext.Provider>;
}

export function useFacturaRepository(): FacturaRepository {
  const repository = useContext(FacturaRepositoryContext);
  if (repository === null) {
    throw new Error('useFacturaRepository debe usarse dentro de <FacturaRepositoryProvider>.');
  }
  return repository;
}
