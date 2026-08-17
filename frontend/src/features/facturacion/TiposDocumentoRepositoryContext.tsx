import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { TipoDocumentoFactura } from '../../shared/types/tiposDocumento';
import type { TiposDocumentoRepository } from '../../shared/lib/facturacion/TiposDocumentoRepository';
import { usePermiso } from '../../shared/auth/usePermiso';

// Punto de inyección del repository del catálogo de tipos de documento de factura (RF-410,
// patrón CatalogoAccesoriosRepositoryContext): el detalle de factura consume
// `useTiposDocumento()`, nunca importa el repository directamente. El composition root de cada
// feature inyecta el repository real.
const TiposDocumentoRepositoryContext = createContext<TiposDocumentoRepository | null>(null);

export function TiposDocumentoRepositoryProvider({
  repository,
  children,
}: {
  repository: TiposDocumentoRepository;
  children: ReactNode;
}) {
  return (
    <TiposDocumentoRepositoryContext.Provider value={repository}>
      {children}
    </TiposDocumentoRepositoryContext.Provider>
  );
}

export function useTiposDocumentoRepository(): TiposDocumentoRepository {
  const repository = useContext(TiposDocumentoRepositoryContext);
  if (repository === null) {
    throw new Error('useTiposDocumentoRepository debe usarse dentro de <TiposDocumentoRepositoryProvider>.');
  }
  return repository;
}

export interface TiposDocumentoVista {
  /** Activos siempre; todos (con inactivos tachados) solo con permiso de escritura. */
  tiposDocumento: TipoDocumentoFactura[];
  cargando: boolean;
  error: string | null;
  /** Inactivos visibles solo con `facturacion: write` (la gestión del catálogo es SOLO
   * facturación, sea cual sea el writable de la ruta). */
  incluyeInactivos: boolean;
  /** Recarga el catálogo tras una escritura del gestor inline (el alta/edición/baja se refleja
   * sin recargar la página). */
  refrescar: () => Promise<void>;
}

// useTiposDocumento: carga el catálogo (activos siempre; todos si `facturacion: write`). Una
// sola fuente, dos vistas: el checklist documental del detalle de factura ofrece solo activos;
// la gestión muestra los inactivos tachados para reactivar.
export function useTiposDocumento(): TiposDocumentoVista {
  const repository = useTiposDocumentoRepository();
  const puedeGestionar = usePermiso('facturacion', 'write');

  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumentoFactura[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setCargando(true);
    const promesa = puedeGestionar ? repository.listarTodos() : repository.listarActivos();
    return promesa.then(
      (lista) => {
        setTiposDocumento(lista);
        setCargando(false);
        setError(null);
      },
      (e: unknown) => {
        setError(e instanceof Error ? e.message : 'No se pudo cargar el catálogo de tipos de documento.');
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
        setTiposDocumento(lista);
        setCargando(false);
      },
      (e: unknown) => {
        if (!activo) return;
        setError(e instanceof Error ? e.message : 'No se pudo cargar el catálogo de tipos de documento.');
        setCargando(false);
      },
    );

    return () => {
      activo = false;
    };
  }, [repository, puedeGestionar]);

  const refrescar = useCallback(() => cargar(), [cargar]);

  return { tiposDocumento, cargando, error, incluyeInactivos: puedeGestionar, refrescar };
}