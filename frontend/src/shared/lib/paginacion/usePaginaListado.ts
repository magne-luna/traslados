import { useCallback, useEffect, useRef, useState } from 'react';
import type { Pagina, RangoPagina } from '../../types/paginacion';

// Estado compartido de los 8 listados con búsqueda + paginación server-side (design.md §D6):
// página, tamaño (fijo, ver checkpoint 0.3), término crudo y término debounceado, total, loading,
// error. Responsabilidad no obvia: resetea la página a 1 cada vez que cambia el término aplicado
// (§D6) — sin eso, buscar algo con 3 resultados estando en la página 5 muestra una pantalla vacía
// que parece un bug.
//
// Fase 0: sin consumidores todavía (tabla de fases de design.md) — el cableado real a
// PacientesList/ConductoresList/ObrasSocialesList llega en las fases 2 y 3.

const DEBOUNCE_MS_DEFAULT = 300;

export interface UsePaginaListadoParams<T, Filtros extends { busqueda: string }> {
  /** Lectura paginada del repository (`listPage`, aditivo — nunca `list()`, ver design.md §D3). */
  listPage: (query: RangoPagina & { filtros: Filtros }) => Promise<Pagina<T>>;
  /** Tamaño de página fijo (checkpoint 0.3: 20, sin selector en esta iteración). */
  tamanio: number;
  /** Arma el objeto `Filtros` completo del repository a partir del término aplicado. */
  construirFiltros: (busquedaAplicada: string) => Filtros;
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
  /** Repite la consulta vigente (misma página, mismo término) sin resetear nada — a diferencia de
   * cambiar el término (que sí resetea la página, ver más abajo). Pensado para refrescar el
   * listado después de crear/editar un registro desde la pantalla que usa este hook (Fase 2,
   * tasks.md 13.7): saltar a la página 1 o dejar la página vigente con datos viejos son ambos
   * comportamientos peores que repetir la misma consulta. */
  recargar: () => void;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado.';
}

// Extraído del cuerpo de usePaginaListado (4.9 REFACTOR): "cuál es el valor debounceado" es una
// preocupación aparte de "qué hacer cuando cambia" (resetear página) o "cómo pedir la página"
// (fetch + descarte de respuestas fuera de orden). Privado a este módulo — no tiene consumidores
// propios fuera de este hook, así que no amerita archivo ni test dedicado.
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
  debounceMs = DEBOUNCE_MS_DEFAULT,
}: UsePaginaListadoParams<T, Filtros>): UsePaginaListadoResult<T> {
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const busquedaAplicada = useDebouncedValue(busqueda, debounceMs);
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset de página al cambiar el término aplicado (§D6): sin esto, buscar algo con 3 resultados
  // estando en la página 5 muestra una pantalla vacía que parece un bug.
  const busquedaAplicadaAnteriorRef = useRef(busquedaAplicada);
  useEffect(() => {
    if (busquedaAplicadaAnteriorRef.current !== busquedaAplicada) {
      busquedaAplicadaAnteriorRef.current = busquedaAplicada;
      setPagina(1);
    }
  }, [busquedaAplicada]);

  // `listPage`/`construirFiltros` viajan por ref, actualizada en cada render pero SIN ser
  // dependencia del efecto de abajo: la mayoría de los callers los pasa como closures inline
  // (nuevo valor en cada render del componente que llama al hook, como hacen los propios tests) y
  // si el efecto de fetch dependiera de esas identidades, cada render dispararía un nuevo pedido
  // — el efecto solo debe reaccionar a cambios de página/tamaño/término, nunca a que el caller
  // haya re-renderizado.
  const listPageRef = useRef(listPage);
  useEffect(() => {
    listPageRef.current = listPage;
  });
  const construirFiltrosRef = useRef(construirFiltros);
  useEffect(() => {
    construirFiltrosRef.current = construirFiltros;
  });

  // Contador de recarga (13.7): `recargar()` lo incrementa sin tocar pagina/tamanio/término, para
  // que el efecto de abajo vuelva a disparar la MISMA consulta — a diferencia de `irAPagina`/
  // `setBusqueda`, que cambian el estado que la consulta ya usa como dependencia.
  const [tokenRecarga, setTokenRecarga] = useState(0);

  const solicitudVigenteRef = useRef(0);
  useEffect(() => {
    const idSolicitud = ++solicitudVigenteRef.current;
    setLoading(true);
    setError(null);
    listPageRef
      .current({ pagina, tamanio, filtros: construirFiltrosRef.current(busquedaAplicada) })
      .then((resultado) => {
        if (idSolicitud !== solicitudVigenteRef.current) return;
        setItems(resultado.items);
        setTotal(resultado.total);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (idSolicitud !== solicitudVigenteRef.current) return;
        setError(toErrorMessage(err));
        setLoading(false);
      });
  }, [pagina, tamanio, busquedaAplicada, tokenRecarga]);

  const irAPagina = useCallback((nuevaPagina: number) => {
    setPagina(nuevaPagina);
  }, []);

  const recargar = useCallback(() => {
    setTokenRecarga((token) => token + 1);
  }, []);

  return { items, total, pagina, tamanio, busqueda, loading, error, setBusqueda, irAPagina, recargar };
}
