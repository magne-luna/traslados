import { useMemo, useState } from 'react';
import type { Cobro, Factura } from '../../shared/types/factura';
import type { FacturaEnMora, PeriodoMeses, ResumenAnual, SerieFacturadoVsCobrado } from '../../shared/types/reportes';
import { facturadoVsCobrado } from '../../shared/lib/reportes/facturadoVsCobrado';
import { facturasEnMora } from '../../shared/lib/reportes/facturasEnMora';
import { aniosConDatos, resumenAnual } from '../../shared/lib/reportes/resumenAnual';
import { componentesFecha } from '../../shared/lib/reportes/periodos';

export interface UseReportesFinancierosInput {
  facturas: Factura[];
  cobros: Cobro[];
  /** ISO date de referencia, inyectada. */
  hoy: string;
}

export interface UseReportesFinancierosResult {
  periodo: PeriodoMeses;
  setPeriodo: (periodo: PeriodoMeses) => void;
  serie: SerieFacturadoVsCobrado;
  anio: number;
  setAnio: (anio: number) => void;
  aniosDisponibles: number[];
  resumen: ResumenAnual;
  mora: FacturaEnMora[];
}

// tasks.md 5.5, design.md Decisión 7 (nota de eficiencia): facturadoVsCobrado, resumenAnual y
// facturasEnMora consumen el mismo par (facturas, cobros), ya leído una sola vez por
// useDatosFinancieros. Cada derivación se memoiza sobre sus propias dependencias, para que
// cambiar el selector de período no recalcule el resumen anual (que depende del año, no del
// período) ni la mora (que no depende de ningún selector), y viceversa.
export function useReportesFinancieros({ facturas, cobros, hoy }: UseReportesFinancierosInput): UseReportesFinancierosResult {
  const [periodo, setPeriodo] = useState<PeriodoMeses>(3);
  const [anio, setAnio] = useState<number>(() => componentesFecha(hoy).anio);

  const serie = useMemo(
    () => facturadoVsCobrado({ facturas, cobros, hoy, meses: periodo }),
    [facturas, cobros, hoy, periodo],
  );

  const resumen = useMemo(() => resumenAnual({ facturas, cobros, anio }), [facturas, cobros, anio]);

  const mora = useMemo(() => facturasEnMora({ facturas, cobros, hoy }), [facturas, cobros, hoy]);

  const aniosDisponibles = useMemo(() => aniosConDatos({ facturas, cobros, hoy }), [facturas, cobros, hoy]);

  return { periodo, setPeriodo, serie, anio, setAnio, aniosDisponibles, resumen, mora };
}
