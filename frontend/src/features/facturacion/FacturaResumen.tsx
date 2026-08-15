import type { ReactNode } from 'react';
import { Chip, InlineIcon } from '../../design-system/components';
import { Card } from '../../design-system/layout';
import { iconCalendario, iconDocumento, iconMoneda, iconReloj, iconVelocimetro } from '../../design-system/icons';
import type { EstadoFactura, Factura } from '../../shared/types/factura';
import type { Paciente } from '../../shared/types/paciente';
import { PLAZO_COBRO_AMPARO_DIAS, PLAZO_COBRO_DEFAULT_DIAS } from '../../shared/lib/facturacion/constantes';
import { estadoVencimientoFactura } from '../../shared/lib/facturacion/estadoVencimientoFactura';

const ESTADO_LABEL: Record<EstadoFactura, string> = {
  'a-facturar': 'A facturar',
  facturado: 'Facturado',
  cobrado: 'Cobrado',
  'pagado-parcialmente': 'Pagado parcialmente',
};

const ESTADO_CHIP: Record<EstadoFactura, 'secondary' | 'warning' | 'success' | 'info'> = {
  'a-facturar': 'secondary',
  facturado: 'warning',
  cobrado: 'success',
  'pagado-parcialmente': 'info',
};

// Sin ninguna fuente de plazo propio por obra social (change `sacar-prestadores`, ver
// `useEmisionFactura.ts`): solo quedan amparo judicial y el plazo general — nunca hubo una rama
// "plazo propio de {nombre}" que mostrar acá.
function motivoPlazo(paciente: Paciente | undefined): string {
  if (paciente?.amparoJudicial) return `amparo judicial (${PLAZO_COBRO_AMPARO_DIAS} días)`;
  return `plazo general (${PLAZO_COBRO_DEFAULT_DIAS} días)`;
}

function domicilioTexto(factura: Factura, paciente: Paciente | undefined): string {
  const direccion = paciente?.direcciones.find((d) => d.id === factura.domicilioId);
  return direccion ? `${direccion.calle}, ${direccion.localidad}` : 'Dirección desconocida';
}

// Bloque ícono + label/valor de la fila de stats y del footer de fechas — mismo molde que
// RecorridoStat (features/hojas-de-ruta), reimplementado acá en vez de importado entre features
// para no acoplar dos dominios de negocio distintos por un componente de 15 líneas.
function StatTile({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center gap-sm">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
        <InlineIcon size={16}>{icon}</InlineIcon>
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="font-body text-[11px] font-semibold text-muted">{label}</span>
        <span className="font-body text-[14px] font-semibold text-ink">{value}</span>
      </span>
    </div>
  );
}

function ResumenItem({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-start gap-xs font-body text-[13px] text-text">
      <span className="mt-1.75 h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
      <span>
        <span className="font-semibold text-ink">{label}:</span> {value}
      </span>
    </li>
  );
}

// Resumen de solo lectura de la factura (tasks.md 6.3), siguiendo la convención de UI del
// proyecto (08_arquitectura_propuesta.md): chip de estado + período a la izquierda, total a
// facturar destacado a la derecha, fila de stats con ícono (mismo molde que RecorridoStat),
// resumen estructurado de los campos que alimentan la plantilla de descripción (Paciente/N° de
// afiliado/Domicilio/Prestación/Período/Cantidad de días/Dependencia y retorno/Valor y cantidad
// de km — todos campos reales de Factura/Paciente, ninguno inventado) con el total destacado, y
// fecha de factura/fecha estimada de cobro con el motivo del plazo aplicado (RF-406) al pie.
// Extraído de FacturaDetail para mantener ambos componentes bajo las ~200 líneas (tasks.md 12.3).
export function FacturaResumen({ factura, paciente }: { factura: Factura; paciente: Paciente | undefined }) {
  const vencida = estadoVencimientoFactura({
    fechaEstimadaCobro: factura.fechaEstimadaCobro,
    hoy: new Date().toISOString().slice(0, 10),
    estado: factura.estado,
  });

  const identificador = factura.identificadorFactura?.valor ?? paciente?.numeroAfiliado.valor ?? '—';

  const columnaIzquierda = [
    { label: 'Paciente', value: paciente ? `${paciente.apellido}, ${paciente.nombre}` : 'Paciente desconocido' },
    { label: 'N° de afiliado', value: identificador },
    { label: 'Domicilio', value: domicilioTexto(factura, paciente) },
    { label: 'Prestación', value: factura.prestacion },
    { label: 'Período', value: `${factura.mesFacturado}/${factura.anioFacturado}` },
    { label: 'Cantidad de días', value: String(factura.dias) },
  ];
  const columnaDerecha = [
    { label: 'Dependencia y retorno', value: factura.dependenciaYRetorno },
    { label: 'Valor del km', value: `$${factura.valorKm}` },
    { label: 'Cantidad de km', value: String(factura.cantidadKm) },
  ];

  return (
    <div className="flex flex-col gap-md">
      <Card radius="md" padding="lg" gap="md" elevated>
        <div className="flex flex-wrap items-start justify-between gap-md">
          <div className="flex flex-wrap items-center gap-xs">
            <Chip kind={ESTADO_CHIP[factura.estado]}>{ESTADO_LABEL[factura.estado]}</Chip>
            {vencida && <Chip kind="danger">Vencida</Chip>}
            <span className="flex items-center gap-xs rounded-pill border border-border px-md py-xs font-body text-[12px] text-muted">
              <InlineIcon size={12}>{iconCalendario}</InlineIcon>
              Período: {factura.mesFacturado}/{factura.anioFacturado}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="font-body text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">Total a facturar</span>
            <span className="font-heading text-[24px] font-bold text-ink">${factura.monto.toLocaleString('es-AR')}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-sm border-b border-border my-lg py-lg sm:grid-cols-4">
          <StatTile icon={iconCalendario} label="Días" value={factura.dias} />
          <StatTile icon={iconMoneda} label="Valor km" value={`$${factura.valorKm}`} />
          <StatTile icon={iconVelocimetro} label="Cantidad km" value={factura.cantidadKm} />
          <StatTile icon={iconDocumento} label="Tipo de comprobante" value={<Chip kind="info">{factura.tipoComprobante}</Chip>} />
        </div>

        <div className="flex flex-col gap-md">
          <div className="grid grid-cols-1 gap-x-xl gap-y-xs md:grid-cols-2">
            <ul className="m-0 flex list-none flex-col gap-xs p-0">
              {columnaIzquierda.map((item) => (
                <ResumenItem key={item.label} label={item.label} value={item.value} />
              ))}
            </ul>
            <ul className="m-0 flex list-none flex-col gap-xs p-0">
              {columnaDerecha.map((item) => (
                <ResumenItem key={item.label} label={item.label} value={item.value} />
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between gap-sm rounded-sm bg-success-soft px-md py-sm">
            <span className="flex items-center gap-xs font-body text-[13px] font-semibold text-ink">
              <InlineIcon size={16}>{iconMoneda}</InlineIcon>
              Total:
            </span>
            <span className="font-heading text-[16px] font-bold text-success">${factura.monto.toLocaleString('es-AR')}</span>
          </div>
        </div>
      </Card>

      {(factura.fechaFactura || factura.fechaEstimadaCobro) && (
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          {factura.fechaFactura && (
            <Card radius="sm" padding="md" gap="sm">
              <StatTile icon={iconCalendario} label="Fecha de factura" value={factura.fechaFactura} />
            </Card>
          )}
          {factura.fechaEstimadaCobro && (
            <Card radius="sm" padding="md" gap="sm">
              <StatTile icon={iconReloj} label="Fecha estimada de cobro" value={factura.fechaEstimadaCobro} />
              <span className="font-body text-[12px] text-muted">({motivoPlazo(paciente)})</span>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
