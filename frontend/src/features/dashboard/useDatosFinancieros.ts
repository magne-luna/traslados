import { useQueries } from '@tanstack/react-query';
import type { Cobro, Factura } from '../../shared/types/factura';
import type { CobroRepository } from '../../shared/lib/facturacion/CobroRepository';
import type { FacturaRepository } from '../../shared/lib/facturacion/FacturaRepository';
import { aMensaje } from '../../shared/lib/query/aMensaje';
import { claves } from '../../shared/lib/query/claves';
import { FRESCURA } from '../../shared/lib/query/frescura';

export interface UseDatosFinancierosResult {
  facturas: Factura[];
  cobros: Cobro[];
  cargando: boolean;
  error: string | null;
}

// tasks.md 5.2, design.md Decisión 7 (nota de eficiencia): facturadoVsCobrado, resumenAnual y
// facturasEnMora consumen las mismas dos colecciones — se leen UNA sola vez acá y se comparten, en
// vez de que cada proyección dispare su propia lectura. Solo lectura: no expone ningún método de
// creación/edición/borrado (design.md Non-Goals).
//
// migracion-react-query, Fase 5. **`UseDatosFinancierosResult` NO cambió.**
//
// `useQueries` en vez de dos `useQuery` sueltos: mantiene el paralelismo del `Promise.all` anterior
// y deja `cargando`/`error` como una sola señal agregada, que es lo que las tarjetas ya consumen.
// Comparte claves con `useFacturas` y `useCobros`.
//
// ⚠️ Frescura CERO en ambas: son dinero. Es la regla dura de la Fase 4, y el dashboard no es una
// excepción — mostrar un total facturado viejo en la pantalla de inicio sería el peor lugar para
// hacerlo.
export function useDatosFinancieros(
  facturaRepository: FacturaRepository,
  cobroRepository: CobroRepository,
): UseDatosFinancierosResult {
  const [consultaFacturas, consultaCobros] = useQueries({
    queries: [
      {
        queryKey: claves.facturas.lista(),
        queryFn: () => facturaRepository.list(),
        staleTime: FRESCURA.transaccional,
      },
      {
        queryKey: claves.cobros.lista(),
        queryFn: () => cobroRepository.list(),
        staleTime: FRESCURA.transaccional,
      },
    ],
  });

  return {
    facturas: consultaFacturas.data ?? [],
    cobros: consultaCobros.data ?? [],
    // Una sola señal agregada: la pantalla muestra su placeholder hasta tener las DOS colecciones,
    // igual que cuando esperaba el `Promise.all`.
    cargando: consultaFacturas.isPending || consultaCobros.isPending,
    error: aMensaje(consultaFacturas.error) ?? aMensaje(consultaCobros.error),
  };
}
