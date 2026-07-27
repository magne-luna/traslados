import { Chip, chipColors, ProgressBar, SectionBadge } from '../../design-system/components';
import { KM_SERVICE } from '../../shared/lib/mantenimiento/constantes';
import { estadoHabilitacion } from '../../shared/lib/mantenimiento/estadoHabilitacion';
import { estadoServicePreventivo } from '../../shared/lib/mantenimiento/estadoServicePreventivo';
import type { Vehiculo } from '../../shared/types/vehiculo';
import { HABILITACION_COPY, SERVICE_COPY, TIPO_HABILITACION_LABELS } from './mantenimientoCopy';

interface VehiculoMantenimientoProps {
  vehiculo: Vehiculo;
  /** Fecha de referencia inyectable (tests); por defecto "ahora" real. */
  ahora?: Date;
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

function diasHasta(fechaVencimiento: string, ahora: Date): number {
  return Math.ceil((new Date(fechaVencimiento).getTime() - ahora.getTime()) / MS_POR_DIA);
}

// RN-VE-03/04: cada tarjeta muestra estado + fechas/km, calculados al render con las funciones
// puras de shared/lib/mantenimiento/ a partir del kilometraje y las fechas del vehículo. Dos
// columnas simultáneas (Habilitaciones | Service), mismo patrón visual "badge + tarjetas" que
// ChecklistEditor/PlantillaFacturaEditor de obras-sociales-ui.
export function VehiculoMantenimiento({ vehiculo, ahora = new Date() }: VehiculoMantenimientoProps) {
  const estadoService = estadoServicePreventivo({
    kilometraje: vehiculo.kilometraje,
    kilometrajeUltimoService: vehiculo.kilometrajeUltimoService,
    fechaUltimoService: vehiculo.fechaUltimoService,
    ahora,
  });
  const serviceCopy = SERVICE_COPY[estadoService];
  const proximoServiceKm = vehiculo.kilometrajeUltimoService + KM_SERVICE;
  const kmRestantes = proximoServiceKm - vehiculo.kilometraje;
  const progresoPct = ((vehiculo.kilometraje - vehiculo.kilometrajeUltimoService) / KM_SERVICE) * 100;

  return (
    <div className="grid grid-cols-1 gap-lg md:grid-cols-2">
      <div className="flex flex-col gap-md">
        <SectionBadge tone="config">Habilitaciones</SectionBadge>

        {vehiculo.habilitaciones.length === 0 ? (
          <p className="font-body text-sm text-muted">Sin habilitaciones registradas.</p>
        ) : (
          <div className="grid grid-cols-2 gap-md">
            {vehiculo.habilitaciones.map((habilitacion) => {
              const estado = estadoHabilitacion({ fechaVencimiento: habilitacion.fechaVencimiento, ahora });
              const copy = HABILITACION_COPY[estado];
              const dias = diasHasta(habilitacion.fechaVencimiento, ahora);

              return (
                <div
                  key={habilitacion.tipo}
                  role={estado === 'vencida' ? 'alert' : undefined}
                  className="flex flex-col gap-sm rounded-md border border-border bg-surface p-lg shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-heading text-[15px] font-bold text-ink">{TIPO_HABILITACION_LABELS[habilitacion.tipo]}</span>
                    <Chip kind={copy.kind}>{copy.texto}</Chip>
                  </div>

                  <div className="flex flex-col gap-sm border-t border-border pt-sm">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-body text-[11px] text-muted">Vence</span>
                      <span className="font-body text-[13px] font-semibold text-ink">
                        {new Date(habilitacion.fechaVencimiento).toLocaleDateString('es-AR')}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-body text-[11px] text-muted">Días restantes</span>
                      <span className={`font-body text-[13px] font-semibold ${chipColors[copy.kind].fg}`}>
                        {dias >= 0 ? `${dias} días` : `Venció hace ${Math.abs(dias)} días`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-md">
        <SectionBadge tone="config">Service</SectionBadge>

        <div
          role={estadoService === 'vencido' ? 'alert' : undefined}
          className="flex flex-col gap-sm rounded-md border border-border bg-surface p-lg shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-heading text-[15px] font-bold text-ink">Último service</span>
              <span className="font-body text-[11px] text-muted">Cambio de aceite</span>
            </div>
            <Chip kind={serviceCopy.kind}>{serviceCopy.texto}</Chip>
          </div>

          <div className="grid grid-cols-2 gap-sm border-t border-border pt-sm">
            <div className="flex flex-col gap-0.5">
              <span className="font-body text-[11px] text-muted">Kilometraje actual</span>
              <span className="font-body text-[13px] font-semibold text-ink">{vehiculo.kilometraje.toLocaleString('es-AR')} km</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-body text-[11px] text-muted">Último service</span>
              <span className="font-body text-[13px] font-semibold text-ink">
                {vehiculo.kilometrajeUltimoService.toLocaleString('es-AR')} km
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-body text-[11px] text-muted">Próximo service</span>
              <span className="font-body text-[13px] font-semibold text-ink">{proximoServiceKm.toLocaleString('es-AR')} km</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-body text-[11px] text-muted">Km restantes</span>
              <span className={`font-body text-[13px] font-semibold ${chipColors[serviceCopy.kind].fg}`}>
                {kmRestantes >= 0 ? `${kmRestantes.toLocaleString('es-AR')} km` : `Excedido ${Math.abs(kmRestantes).toLocaleString('es-AR')} km`}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-xs border-t border-border pt-sm">
            <div className="flex items-center justify-between font-body text-[11px] text-muted">
              <span>Progreso hasta el próximo service</span>
              <span>{Math.round(Math.min(100, Math.max(0, progresoPct)))}%</span>
            </div>
            <ProgressBar pct={progresoPct} kind={serviceCopy.kind} />
          </div>
        </div>
      </div>
    </div>
  );
}
