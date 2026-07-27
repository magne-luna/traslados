import { useId } from 'react';
import { Alert } from '../../design-system/feedback';
import { Field, Select } from '../../design-system/form';
import { Panel } from '../../design-system/layout';
import { Table, Td, Th, Tr } from '../../design-system/table';
import type { PeriodoMeses, SerieFacturadoVsCobrado } from '../../shared/types/reportes';
import { PERIODOS_DISPONIBLES } from '../../shared/lib/reportes/constantes';
import { formatoMoneda } from '../../shared/lib/reportes/formato';
import { claseAnchoProporcional } from './anchoBarraClases';

export interface FacturadoVsCobradoPanelProps {
  periodo: PeriodoMeses;
  onChangePeriodo: (periodo: PeriodoMeses) => void;
  serie: SerieFacturadoVsCobrado;
  cargando: boolean;
  error: string | null;
}

const NOMBRE_MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// tasks.md 6.6, spec reporte-facturado-vs-cobrado, design.md Decisión 8: tabla accesible +
// barras proporcionales al máximo del rango con utilidades de Tailwind (sin librería de
// gráficos, sin style inline — ver anchoBarraClases.ts), selector de período, nota de
// atribución visible, y estados de carga/error/vacío.
export function FacturadoVsCobradoPanel({ periodo, onChangePeriodo, serie, cargando, error }: FacturadoVsCobradoPanelProps) {
  const formId = useId();
  const sinDatos = serie.puntos.every((punto) => punto.facturado === 0 && punto.cobrado === 0);
  const maximo = Math.max(1, ...serie.puntos.flatMap((punto) => [punto.facturado, punto.cobrado]));

  return (
    <Panel title="Facturado vs. cobrado" titleId={`${formId}-heading`} gap="md" action={
      <Field label="Período" htmlFor={`${formId}-periodo`}>
        <Select
          id={`${formId}-periodo`}
          value={periodo}
          onChange={(event) => onChangePeriodo(Number(event.target.value) as PeriodoMeses)}
          fullWidth={false}
        >
          {PERIODOS_DISPONIBLES.map((opcion) => (
            <option key={opcion} value={opcion}>
              Últimos {opcion} meses
            </option>
          ))}
        </Select>
      </Field>
    }>
      <p className="m-0 font-body text-[12px] text-muted">
        Facturado por período de la factura · Cobrado por fecha del cobro.
      </p>

      {error && (
        <Alert tone="danger">
          {error}
        </Alert>
      )}

      {cargando ? (
        <p className="m-0 font-body text-sm text-muted">Cargando facturado vs. cobrado…</p>
      ) : error ? null : sinDatos ? (
        <p className="m-0 font-body text-sm text-muted">No hay facturas ni cobros en el rango seleccionado.</p>
      ) : (
        // tasks.md 14.3/17: los 3 stops de gobernanza quedaron resueltos en la sesión de cierre —
        // wrapper migrado a `Table minWidth="xl"` (nuevo valor del eje, = min-w-120); celda
        // `scope="row"` del mes migrada a `Th weight="medium"` (mismo eje que ResumenAnualPanel);
        // fila de `tfoot` migrada a `Tr emphasis="total"` (= border-t-2 border-border-strong
        // font-semibold). Los 3 ejes se agregaron a design-system/table.tsx (Evidencia A).
        <Table caption="Serie mensual de facturado, cobrado y diferencia" minWidth="xl">
          <thead>
            <tr>
              <Th scope="col" align="left">Mes</Th>
              <Th scope="col" align="right" numeric>Facturado</Th>
              <Th scope="col" align="right" numeric>Cobrado</Th>
              <Th scope="col" align="right" numeric>Diferencia</Th>
            </tr>
          </thead>
          <tbody>
            {serie.puntos.map((punto) => (
              <Tr key={`${punto.anio}-${punto.mes}`} divided>
                <Th scope="row" align="left" weight="medium">
                  {NOMBRE_MES[punto.mes - 1]} {punto.anio}
                </Th>
                <Td align="right" numeric>
                  <BarraCelda valor={punto.facturado} maximo={maximo} claseBarra="bg-info" />
                </Td>
                <Td align="right" numeric>
                  <BarraCelda valor={punto.cobrado} maximo={maximo} claseBarra="bg-success" />
                </Td>
                <Td align="right" numeric>{formatoMoneda(punto.diferencia)}</Td>
              </Tr>
            ))}
          </tbody>
          <tfoot>
            <Tr emphasis="total">
              <Th scope="row" align="left">Total del rango</Th>
              <Td align="right" numeric>{formatoMoneda(serie.totalFacturado)}</Td>
              <Td align="right" numeric>{formatoMoneda(serie.totalCobrado)}</Td>
              <Td align="right" numeric>{formatoMoneda(serie.totalDiferencia)}</Td>
            </Tr>
          </tfoot>
        </Table>
      )}
    </Panel>
  );
}

function BarraCelda({ valor, maximo, claseBarra }: { valor: number; maximo: number; claseBarra: string }) {
  const porcentaje = (Math.max(0, valor) / maximo) * 100;
  return (
    <div className="flex items-center justify-end gap-xs">
      <span>{formatoMoneda(valor)}</span>
      <div className="h-2 w-16 overflow-hidden rounded-pill bg-surface-soft" aria-hidden="true">
        <div className={`h-full rounded-pill ${claseBarra} ${claseAnchoProporcional(porcentaje)}`} />
      </div>
    </div>
  );
}
