import { useId } from 'react';
import { Alert } from '../../design-system/feedback';
import { Field, Select } from '../../design-system/form';
import { Panel } from '../../design-system/layout';
import { Table, Td, Th, Tr } from '../../design-system/table';
import type { ResumenAnual } from '../../shared/types/reportes';
import { formatoMoneda } from '../../shared/lib/reportes/formato';

export interface ResumenAnualPanelProps {
  anio: number;
  onChangeAnio: (anio: number) => void;
  aniosDisponibles: number[];
  resumen: ResumenAnual;
  cargando: boolean;
  error: string | null;
}

const NOMBRE_MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// tasks.md 6.7, spec reporte-resumen-anual: totales destacados (facturado, cobrado,
// diferencia, emitidas, saldadas), desglose de los 12 meses como tabla accesible, selector de
// año acotado a los años con datos, estados de carga/error/vacío.
export function ResumenAnualPanel({ anio, onChangeAnio, aniosDisponibles, resumen, cargando, error }: ResumenAnualPanelProps) {
  const formId = useId();
  const sinMovimiento = resumen.totalFacturado === 0 && resumen.totalCobrado === 0;

  return (
    <Panel title="Resumen anual" titleId={`${formId}-heading`} gap="md" action={
      <Field label="Año" htmlFor={`${formId}-anio`}>
        <Select
          id={`${formId}-anio`}
          value={anio}
          onChange={(event) => onChangeAnio(Number(event.target.value))}
          fullWidth={false}
        >
          {aniosDisponibles.map((opcion) => (
            <option key={opcion} value={opcion}>
              {opcion}
            </option>
          ))}
        </Select>
      </Field>
    }>
      {error && (
        <Alert tone="danger">
          {error}
        </Alert>
      )}

      {cargando ? (
        <p className="m-0 font-body text-sm text-muted">Cargando resumen anual…</p>
      ) : error ? null : (
        <>
          <dl className="m-0 flex flex-wrap gap-lg">
            <Total label="Facturado" valor={formatoMoneda(resumen.totalFacturado)} />
            <Total label="Cobrado" valor={formatoMoneda(resumen.totalCobrado)} />
            <Total label="Diferencia" valor={formatoMoneda(resumen.totalDiferencia)} />
            <Total label="Facturas emitidas" valor={String(resumen.facturasEmitidas)} />
            <Total label="Facturas saldadas" valor={String(resumen.facturasSaldadas)} />
          </dl>

          {sinMovimiento && (
            <p className="m-0 font-body text-sm text-muted">El año {anio} no tiene movimiento (sin movimiento registrado).</p>
          )}

          <Table caption={`Desglose mensual del año ${anio}`} minWidth="md">
            <thead>
              <tr>
                <Th scope="col" align="left">Mes</Th>
                <Th scope="col" align="right" numeric>Facturado</Th>
                <Th scope="col" align="right" numeric>Cobrado</Th>
                <Th scope="col" align="right" numeric>Diferencia</Th>
              </tr>
            </thead>
            <tbody>
              {resumen.meses.map((punto) => (
                <Tr key={punto.mes} divided>
                  {/* tasks.md 14.2/17: `scope="row"` migrado a `Th` con el eje `weight="medium"`
                      (design-system/table.tsx), agregado en la sesión de cierre de gobernanza —
                      reproduce exactamente `px-sm py-xs text-left font-medium` (Evidencia A). */}
                  <Th scope="row" align="left" weight="medium">{NOMBRE_MES[punto.mes - 1]}</Th>
                  <Td align="right" numeric>{formatoMoneda(punto.facturado)}</Td>
                  <Td align="right" numeric>{formatoMoneda(punto.cobrado)}</Td>
                  <Td align="right" numeric>{formatoMoneda(punto.diferencia)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </>
      )}
    </Panel>
  );
}

function Total({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <dt className="font-body text-[11px] font-semibold text-muted">{label}</dt>
      <dd className="m-0 font-heading text-[18px] font-bold text-ink">{valor}</dd>
    </div>
  );
}
