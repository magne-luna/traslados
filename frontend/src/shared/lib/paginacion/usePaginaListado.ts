import { useCallback, useEffect, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Pagina, RangoPagina } from '../../types/paginacion';
import { aMensaje } from '../query/aMensaje';
import { FRESCURA } from '../query/frescura';

// Estado compartido de los listados con búsqueda + paginación server-side (design.md §D6):
// página, tamaño, término crudo y término debounceado, total, loading, error. Responsabilidad no
// obvia: resetea la página a 1 cada vez que cambia el término aplicado (§D6) — sin eso, buscar algo
// con 3 resultados estando en la página 5 muestra una pantalla vacía que parece un bug.
//
// migracion-react-query, Fase 3 (tasks.md 3.6): el estado de SERVIDOR (items, total, loading, error)
// pasó a `useQuery`; el estado de UI (página, término, debounce, reset) se queda acá, porque eso no
// es estado de servidor y React Query no tiene nada que ver con él.
//
// Tres cosas que la migración simplificó, no complicó:
//
//   1. **Desapareció el descarte manual de respuestas fuera de orden.** Antes hacía falta un
//      `solicitudVigenteRef` para que la respuesta de la página 1 no pisara a la de la página 2 si
//      llegaba tarde. Con una clave por página, son consultas DISTINTAS: la vieja escribe en su
//      propia entrada de caché y nunca toca la vigente. React Query lo resuelve por diseño.
//   2. **Desaparecieron los refs de `listPage`/`construirFiltros`.** Existían para que el efecto no
//      se redisparara cuando el caller pasaba closures inline. Ya no hace falta: React Query
//      reacciona a la `queryKey` (comparada por CONTENIDO), no a la identidad del `queryFn`.
//   3. **Desapareció el token de recarga.** `recargar()` es `refetch()`.
//
// ⚠️ `placeholderData: keepPreviousData` es lo que evita que la tabla quede vacía al cambiar de
// página (spec, "Cambiar de página no vacía la tabla"). Sin esto, cada avance de página parpadea.
//
// ⚠️ `frescura: FRESCURA.paginado` (cero). Un resultado paginado depende de la página y del filtro
// vigentes: cachearlo mostraría una página que ya no es la que el filtro produce.

const DEBOUNCE_MS_DEFAULT = 300;

export interface UsePaginaListadoParams<T, Filtros extends { busqueda: string }> {
  /** Lectura paginada del repository (`listPage`, aditivo — nunca `list()`, ver design.md §D3). */
  listPage: (query: RangoPagina & { filtros: Filtros }) => Promise<Pagina<T>>;
  /** Tamaño de página fijo (checkpoint 0.3: 20, sin selector en esta iteración). */
  tamanio: number;
  /** Arma el objeto `Filtros` completo del repository a partir del término aplicado. */
  construirFiltros: (busquedaAplicada: string) => Filtros;
  /** Clave de caché de la consulta, del dominio del caller (p. ej. `claves.pacientes.pagina`).
   *
   * migracion-react-query: es el ÚNICO campo nuevo de este contrato. Es obligatorio a propósito —
   * un default genérico haría que dos dominios distintos colisionaran en la misma entrada de caché,
   * un bug silencioso y muy caro de diagnosticar. Solo lo construyen los tres hooks `*Paginado`;
   * ninguna pantalla lo ve. */
  clave: (query: RangoPagina & { filtros: Filtros }) => readonly unknown[];
  /** Ventana de debounce en ms, inyectable para testear con timers falsos (default 300). */
  debounceMs?: number;
}

export interface UsePaginaListadoResult<T> {
  items: T[];
  total: number;
  pagina: number;
  tamanio: number;
  /** Término crudo, reflejado de inmediato (4.6) — no espera el debounce. */
  busqueda: string;
  loading: boolean;
  error: string | null;
  setBusqueda: (valor: string) => void;
  irAPagina: (pagina: number) => void;
  /** Repite la consulta vigente (misma página, mismo término) sin resetear nada. Pensado para
   * refrescar el listado después de crear/editar un registro desde la pantalla que usa este hook:
   * saltar a la página 1 o dejar la página vigente con datos viejos son ambos comportamientos
   * peores que repetir la misma consulta. */
  recargar: () => void;
}

// Extraído del cuerpo de usePaginaListado (4.9 REFACTOR): "cuál es el valor debounceado" es una
// preocupación aparte de "qué hacer cuando cambia" (resetear página). Privado a este módulo.
function useDebouncedValue<V>(valor: V, delayMs: number): V {
  const [valorDebounceado, setValorDebounceado] = useState(valor);

  useEffect(() => {
    const timer = setTimeout(() => {
      setValorDebounceado(valor);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [valor, delayMs]);

  return valorDebounceado;
}

export function usePaginaListado<T, Filtros extends { busqueda: string }>({
  listPage,
  tamanio,
  construirFiltros,
  clave,
  debounceMs = DEBOUNCE_MS_DEFAULT,
}: UsePaginaListadoParams<T, Filtros>): UsePaginaListadoResult<T> {
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const busquedaAplicada = useDebouncedValue(busqueda, debounceMs);

  // Reset de página al cambiar el término aplicado (§D6): sin esto, buscar algo con 3 resultados
  // estando en la página 5 muestra una pantalla vacía que parece un bug.
  const busquedaAplicadaAnteriorRef = useRef(busquedaAplicada);
  useEffect(() => {
    if (busquedaAplicadaAnteriorRef.current !== busquedaAplicada) {
      busquedaAplicadaAnteriorRef.current = busquedaAplicada;
      setPagina(1);
    }
  }, [busquedaAplicada]);

  const consulta = { pagina, tamanio, filtros: construirFiltros(busquedaAplicada) };

  const { data, isPending, error, refetch } = useQuery({
    queryKey: clave(consulta),
    queryFn: () => listPage(consulta),
    staleTime: FRESCURA.paginado,
    placeholderData: keepPreviousData,
  });

  const irAPagina = useCallback((nuevaPagina: number) => {
    setPagina(nuevaPagina);
  }, []);

  const recargar = useCallback(() => {
    void refetch();
  }, [refetch]);

  return {
    items: data?.items ?? [],
    total: data?.total ?? 0,
    pagina,
    tamanio,
    busqueda,
    loading: isPending,
    error: aMensaje(error),
    setBusqueda,
    irAPagina,
    recargar,
  };
}
