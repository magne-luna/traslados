import { useEffect, useState } from 'react';
import type { Cobro, Factura } from '../../shared/types/factura';
import type { CobroRepository } from '../../shared/lib/facturacion/CobroRepository';
import type { FacturaRepository } from '../../shared/lib/facturacion/FacturaRepository';

export interface UseDatosFinancierosResult {
  facturas: Factura[];
  cobros: Cobro[];
  cargando: boolean;
  error: string | null;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado.';
}

// tasks.md 5.2, design.md Decisión 7 (nota de eficiencia): facturadoVsCobrado, resumenAnual y
// facturasEnMora consumen las mismas dos colecciones — se leen UNA sola vez acá y se comparten,
// en vez de que cada proyección dispare su propia lectura del mismo repositorio. Solo lectura:
// no expone ningún método de creación/edición/borrado (design.md Non-Goals).
export function useDatosFinancieros(
  facturaRepository: FacturaRepository,
  cobroRepository: CobroRepository,
): UseDatosFinancierosResult {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;

    async function cargar() {
      setCargando(true);
      setError(null);
      try {
        const [datosFacturas, datosCobros] = await Promise.all([facturaRepository.list(), cobroRepository.list()]);
        if (cancelado) return;
        setFacturas(datosFacturas);
        setCobros(datosCobros);
      } catch (err) {
        if (cancelado) return;
        setError(toErrorMessage(err));
      } finally {
        if (!cancelado) setCargando(false);
      }
    }

    void cargar();

    return () => {
      cancelado = true;
    };
  }, [facturaRepository, cobroRepository]);

  return { facturas, cobros, cargando, error };
}
