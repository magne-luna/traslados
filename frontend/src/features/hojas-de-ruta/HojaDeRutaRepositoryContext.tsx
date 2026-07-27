import { createContext, useContext, type ReactNode } from 'react';
import type { HojaDeRutaRepository } from '../../shared/lib/hojas-de-ruta/HojaDeRutaRepository';

// Punto de inyección del repository (design.md Decisión 9): las pantallas de la feature reciben
// el HojaDeRutaRepository vía este context, nunca importan el mock directamente. El único lugar
// que conoce mockHojaDeRutaRepository es el composition root de la feature (HojaDeRutaRoute).
const HojaDeRutaRepositoryContext = createContext<HojaDeRutaRepository | null>(null);

export function HojaDeRutaRepositoryProvider({
  repository,
  children,
}: {
  repository: HojaDeRutaRepository;
  children: ReactNode;
}) {
  return (
    <HojaDeRutaRepositoryContext.Provider value={repository}>{children}</HojaDeRutaRepositoryContext.Provider>
  );
}

export function useHojaDeRutaRepository(): HojaDeRutaRepository {
  const repository = useContext(HojaDeRutaRepositoryContext);
  if (repository === null) {
    throw new Error('useHojaDeRutaRepository debe usarse dentro de <HojaDeRutaRepositoryProvider>.');
  }
  return repository;
}
