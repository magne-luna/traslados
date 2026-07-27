import type { AlertaMantenimientoVehiculo, FacturaEnMora, PacienteCudPorVencer } from '../../shared/types/reportes';
import { formatoMoneda } from '../../shared/lib/reportes/formato';
import { TarjetaResumen, type TarjetaResumenItem } from './TarjetaResumen';

export interface TarjetasAlertasProps {
  mora: FacturaEnMora[];
  moraCargando: boolean;
  moraError: string | null;
  /** Resuelve el nombre del paciente por id — facturasEnMora no recibe pacientes (design.md
   * Decisión 5), así que el nombre lo resuelve el componente, mismo patrón que FacturasList. */
  nombrePaciente: (pacienteId: string) => string;

  cud: PacienteCudPorVencer[];
  cudCargando: boolean;
  cudError: string | null;

  mantenimiento: AlertaMantenimientoVehiculo[];
  mantenimientoCargando: boolean;
  mantenimientoError: string | null;
}

const MOTIVO_LABEL: Record<string, string> = {
  'service-preventivo:vencido': 'Service vencido',
  'service-preventivo:alerta-intermedia': 'Service próximo',
  'habilitacion:vencida': 'Habilitación vencida',
  'habilitacion:por-vencer': 'Habilitación por vencer',
};

function resumenMotivos(alerta: AlertaMantenimientoVehiculo): string {
  return alerta.motivos
    .map((motivo) =>
      motivo.tipo === 'service-preventivo'
        ? MOTIVO_LABEL[`service-preventivo:${motivo.estado}`]
        : `${motivo.habilitacion.toUpperCase()} ${motivo.estado === 'vencida' ? 'vencida' : 'por vencer'}`,
    )
    .join(' · ');
}

function tieneMotivoCritico(alerta: AlertaMantenimientoVehiculo): boolean {
  return alerta.motivos.some((m) => m.estado === 'vencido' || m.estado === 'vencida');
}

// tasks.md 6.4, spec dashboard-tarjetas-alertas: compone las tres tarjetas de alerta sobre
// TarjetaResumen. Cada bloque (mora/CUD/mantenimiento) tiene su propio estado de carga/error
// (design.md Decisión 7) — la falla de uno no oculta a los demás.
export function TarjetasAlertas({
  mora,
  moraCargando,
  moraError,
  nombrePaciente,
  cud,
  cudCargando,
  cudError,
  mantenimiento,
  mantenimientoCargando,
  mantenimientoError,
}: TarjetasAlertasProps) {
  const itemsMora: TarjetaResumenItem[] = mora.map((m) => ({
    id: m.facturaId,
    label: `${nombrePaciente(m.pacienteId)} · ${formatoMoneda(m.saldoPendiente)} · ${m.diasDeAtraso} días de atraso`,
    severidad: 'critico',
  }));

  const itemsCud: TarjetaResumenItem[] = cud.map((p) => ({
    id: p.pacienteId,
    label: `${p.apellido}, ${p.nombre} · vence ${p.fechaVencimiento}`,
    severidad: p.estado === 'vencido' ? 'critico' : 'alerta',
  }));

  const itemsMantenimiento: TarjetaResumenItem[] = mantenimiento.map((v) => ({
    id: v.vehiculoId,
    label: `${v.patente} · ${resumenMotivos(v)}`,
    severidad: tieneMotivoCritico(v) ? 'critico' : 'alerta',
  }));

  return (
    <div className="grid grid-cols-1 gap-lg sm:grid-cols-2 lg:grid-cols-3">
      <TarjetaResumen
        titulo="Facturas en mora"
        cargando={moraCargando}
        error={moraError}
        items={itemsMora}
        mensajeVacio="No hay facturas en mora."
        enlace={{ to: '/facturacion', label: 'Ver facturas en mora' }}
      />
      <TarjetaResumen
        titulo="CUD por vencer"
        cargando={cudCargando}
        error={cudError}
        items={itemsCud}
        mensajeVacio="No hay pacientes con CUD por vencer."
        enlace={{ to: '/pacientes', label: 'Ver CUD por vencer' }}
      />
      <TarjetaResumen
        titulo="Alertas de mantenimiento"
        cargando={mantenimientoCargando}
        error={mantenimientoError}
        items={itemsMantenimiento}
        mensajeVacio="No hay vehículos que requieran mantenimiento."
        enlace={{ to: '/vehiculos', label: 'Ver alertas de mantenimiento' }}
      />
    </div>
  );
}
