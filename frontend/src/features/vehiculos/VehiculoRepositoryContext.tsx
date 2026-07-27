import { createContext, useContext, type ReactNode } from 'react';
import type { VehiculoRepository } from '../../shared/lib/vehiculos/VehiculoRepository';

// Punto de inyección del repository (design.md Decisión 7): las pantallas de la feature reciben
// el VehiculoRepository vía este context, nunca importan el mock directamente. El único lugar
// que conoce mockVehiculoRepository es el composition root de la feature (VehiculosRoute).
const VehiculoRepositoryContext = createContext<VehiculoRepository | null>(null);

export function VehiculoRepositoryProvider({
  repository,
  children,
}: {
  repository: VehiculoRepository;
  children: ReactNode;
}) {
  return (
    <VehiculoRepositoryContext.Provider value={repository}>{children}</VehiculoRepositoryContext.Provider>
  );
}

export function useVehiculoRepository(): VehiculoRepository {
  const repository = useContext(VehiculoRepositoryContext);
  if (repository === null) {
    throw new Error('useVehiculoRepository debe usarse dentro de <VehiculoRepositoryProvider>.');
  }
  return repository;
}
