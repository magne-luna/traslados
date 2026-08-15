import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AccesorioCatalogo } from '../../shared/types/catalogoAccesorios';
import type { CatalogoAccesoriosRepository } from '../../shared/lib/accesorios/CatalogoAccesoriosRepository';
import { usePermiso } from '../../shared/auth/usePermiso';

// Punto de inyección del repository del catálogo (patrón VehiculoRepositoryContext): los
// selectores de Pacientes y Vehículos consumen `useCatalogoAccesorios()`, nunca importan el
// repository directamente. El composition root de cada feature inyecta el repository real.
const CatalogoAccesoriosRepositoryContext = createContext<CatalogoAccesoriosRepository | null>(null);

export function CatalogoAccesoriosRepositoryProvider({
  repository,
  children,
}: {
  repository: CatalogoAccesoriosRepository;
  children: ReactNode;
}) {
  return (
    <CatalogoAccesoriosRepositoryContext.Provider value={repository}>
      {children}
    </CatalogoAccesoriosRepositoryContext.Provider>
  );
}

export function useCatalogoAccesoriosRepository(): CatalogoAccesoriosRepository {
  const repository = useContext(CatalogoAccesoriosRepositoryContext);
  if (repository === null) {
    throw new Error('useCatalogoAccesoriosRepository debe usarse dentro de <CatalogoAccesoriosRepositoryProvider>.');
  }
  return repository;
}

export interface CatalogoAccesoriosVista {
  /** Activos siempre; todos (con inactivos tachados) solo con permiso de escritura. */
  accesorios: AccesorioCatalogo[];
  cargando: boolean;
  error: string | null;
  /** Inactivos visibles solo con `pacientes: write` (la gestión es SOLO pacientes, sea cual sea
   * el módulo de la ruta — en VehiculoForm el writable de ruta es vehiculos, no alcanza). */
  incluyeInactivos: boolean;
  /** Recarga el catálogo tras una escritura del gestor inline (el alta/edición/baja se refleja
   * sin recargar la página — spec "Alta visible sin recompilar"). */
  refrescar: () => Promise<void>;
}

// useCatalogoAccesorios: carga el catálogo (activos siempre; todos si `pacientes: write` — design
// D3, plan recortado). Una sola fuente, dos vistas: los selectores de asignación nueva ofrecen
// solo activos; la gestión muestra los inactivos tachados para reactivar.
export function useCatalogoAccesorios(): CatalogoAccesoriosVista {
  const repository = useCatalogoAccesoriosRepository();
  const puedeGestionar = usePermiso('pacientes', 'write');

  const [accesorios, setAccesorios] = useState<AccesorioCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    const promesa = puedeGestionar ? repository.listarTodos() : repository.listarActivos();
    return promesa.then(
      (lista) => {
        setAccesorios(lista);
        setCargando(false);
        setError(null);
      },
      (e: unknown) => {
        setError(e instanceof Error ? e.message : 'No se pudo cargar el catálogo de accesorios.');
        setCargando(false);
      },
    );
  }, [repository, puedeGestionar]);

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError(null);

    const promesa = puedeGestionar ? repository.listarTodos() : repository.listarActivos();
    promesa.then(
      (lista) => {
        if (!activo) return;
        setAccesorios(lista);
        setCargando(false);
      },
      (e: unknown) => {
        if (!activo) return;
        setError(e instanceof Error ? e.message : 'No se pudo cargar el catálogo de accesorios.');
        setCargando(false);
      },
    );

    return () => {
      activo = false;
    };
  }, [repository, puedeGestionar]);

  const refrescar = useCallback(() => cargar(), [cargar]);

  return { accesorios, cargando, error, incluyeInactivos: puedeGestionar, refrescar };
}