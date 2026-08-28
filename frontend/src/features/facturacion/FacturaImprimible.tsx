import type { AsistenciaPrestacion, Cobro, Factura } from '../../shared/types/factura';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Paciente } from '../../shared/types/paciente';
import { saldoFactura } from '../../shared/lib/facturacion/totalesFactura';

interface FacturaImprimibleProps {
  factura: Factura;
  asistencias: AsistenciaPrestacion[];
  paciente: Paciente;
  obraSocial: ObraSocial | undefined;
  cobros: Cobro[];
}

// Vista imprimible de factura + asistencia (tasks.md 11.1, US-400, design.md Decisión 13):
// componente presentacional puro (recibe todo por props, sin repositorios), utilidades `print:`
// de Tailwind v4, sin `style={{}}` inline — mismo patrón que HojaDeRutaImprimible.tsx. Imprime la
// descripción PERSISTIDA (congelada al emitir, nunca recalculada — RN-FA-06), los datos
// económicos, el detalle de asistencias y, si existen, los cobros y el saldo.
export function FacturaImprimible({ factura, asistencias, paciente, obraSocial, cobros }: FacturaImprimibleProps) {
  const totalCobrado = cobros.reduce((acumulado, cobro) => acumulado + cobro.montoPagado, 0);
  const saldo = saldoFactura(factura, cobros);

  return (
    <div className="flex flex-col gap-lg p-lg print:p-0">
      <header className="flex flex-col gap-xs border-b border-border pb-md">
        <h1 className="m-0 font-heading text-[18px] font-bold text-ink">
          Factura — {paciente.apellido}, {paciente.nombre}
        </h1>
        <p className="m-0 font-body text-[13px] text-muted">
          {obraSocial?.nombre ?? 'Obra social desconocida'} · Período {factura.mesFacturado}/{factura.anioFacturado} · Comprobante {factura.tipoComprobante}
          {factura.ptoVta !== undefined && factura.cbteNro !== undefined &&
            ` ${String(factura.ptoVta).padStart(4, '0')}-${String(factura.cbteNro).padStart(8, '0')}`}
        </p>
        {factura.cae && (
          <p className="m-0 font-body text-[12px] text-muted">
            CAE {factura.cae}
            {factura.caeVencimiento && ` · Vto. CAE ${factura.caeVencimiento}`}
            {factura.arcaAmbiente === 'homologacion' && ' · COMPROBANTE DE PRUEBA — SIN VALOR FISCAL'}
          </p>
        )}
      </header>

      <section className="flex flex-col gap-xs">
        <h2 className="m-0 font-body text-[14px] font-semibold text-ink">Descripción</h2>
        <pre className="m-0 whitespace-pre-wrap font-body text-[13px] text-text">{factura.descripcion}</pre>
      </section>

      <section className="flex flex-wrap gap-lg font-body text-[13px] text-text">
        <span>Días: {factura.dias}</span>
        <span>Valor km: ${factura.valorKm}</span>
        <span>Cantidad km: {factura.cantidadKm}</span>
        <span>Total: ${factura.monto.toLocaleString('es-AR')}</span>
        {factura.fechaFactura && <span>Fecha de factura: {factura.fechaFactura}</span>}
        {factura.fechaEstimadaCobro && <span>Fecha estimada de cobro: {factura.fechaEstimadaCobro}</span>}
      </section>

      <section className="flex flex-col gap-xs break-inside-avoid">
        <h2 className="m-0 font-body text-[14px] font-semibold text-ink">Asistencia</h2>
        {asistencias.length === 0 ? (
          <p className="m-0 font-body text-[13px] text-muted">Sin asistencias declaradas.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-xs p-0">
            {asistencias.map((asistencia) => (
              <li key={asistencia.id} className="flex flex-wrap gap-sm font-body text-[13px] text-text">
                <span className="font-mono text-[12px] text-faint">{asistencia.fecha}</span>
                <span>{asistencia.prestacion}</span>
                <span className="text-muted">{asistencia.dependencia} → {asistencia.retorno}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {cobros.length > 0 && (
        <section className="flex flex-col gap-xs break-inside-avoid border-t border-border pt-md">
          <h2 className="m-0 font-body text-[14px] font-semibold text-ink">Cobros registrados</h2>
          <ul className="m-0 flex list-none flex-col gap-xs p-0">
            {[...cobros]
              .sort((a, b) => a.fecha.localeCompare(b.fecha))
              .map((cobro) => (
                <li key={cobro.id} className="flex gap-sm font-body text-[13px] text-text">
                  <span className="font-mono text-[12px] text-faint">{cobro.fecha}</span>
                  <span>${cobro.montoPagado.toLocaleString('es-AR')}</span>
                </li>
              ))}
          </ul>
          <p className="m-0 font-body text-[13px] font-semibold text-ink">
            Total cobrado: ${totalCobrado.toLocaleString('es-AR')} · Saldo: ${saldo.toLocaleString('es-AR')}
          </p>
        </section>
      )}
    </div>
  );
}
