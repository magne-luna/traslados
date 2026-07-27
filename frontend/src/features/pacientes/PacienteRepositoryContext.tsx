import { createContext, useContext, type ReactNode } from 'react';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';

// Punto de inyección del repository (design.md Decisión 6): las pantallas de la feature reciben
// el PacienteRepository vía este context, nunca importan el mock directamente. El único lugar
// que conoce mockPacienteRepository es el composition root de la feature (PacientesRoute).
const PacienteRepositoryContext = createContext<PacienteRepository | null>(null);

export function PacienteRepositoryProvider({
  repository,
  children,
}: {
  repository: PacienteRepository;
  children: ReactNode;
}) {
  return <PacienteRepositoryContext.Provider value={repository}>{children}</PacienteRepositoryContext.Provider>;
}

export function usePacienteRepository(): PacienteRepository {
  const repository = useContext(PacienteRepositoryContext);
  if (repository === null) {
    throw new Error('usePacienteRepository debe usarse dentro de <PacienteRepositoryProvider>.');
  }
  return repository;
}
