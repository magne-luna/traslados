import type { Conductor } from '../../shared/types/conductor';
import type { Paciente } from '../../shared/types/paciente';
import type { HojaDeRuta } from '../../shared/types/hojaDeRuta';
import type { Vehiculo } from '../../shared/types/vehiculo';
import { TRAMO_LABELS } from '../pacientes/direccionOptions';

interface HojaDeRutaImprimibleProps {
  hoja: HojaDeRuta;
  vehiculos: Vehiculo[];
  conductores: Conductor[];
  pacientes: Paciente[];
}

// Vista imprimible (tasks.md 8.1, RF-706): print-friendly (utilidades `print:` de Tailwind v4,
// sin `style={{}}` inline — regla dura del proyecto), agrupada por vehículo/conductor, con el
// orden de recogida, direcciones por tramo y notas al pie. Al leer siempre de `hoja` (prop, no
// estado propio) refleja el estado actual tras cualquier edición manual.
export function HojaDeRutaImprimible({ hoja, vehiculos, conductores, pacientes }: HojaDeRutaImprimibleProps) {
  function direccionTexto(direccionId: string, pacienteId: string): string {
    const paciente = pacientes.find((p) => p.id === pacienteId);
    const direccion = paciente?.direcciones.find((d) => d.id === direccionId);
    return direccion ? `${direccion.calle}, ${direccion.localidad}` : 'Dirección desconocida';
  }

  function nombrePaciente(pacienteId: string): string {
    const paciente = pacientes.find((p) => p.id === pacienteId);
    return paciente ? `${paciente.apellido}, ${paciente.nombre}` : 'Paciente desconocido';
  }

  return (
    <div className="flex flex-col gap-lg p-lg print:p-0">
      <header className="flex flex-col gap-xs border-b border-border pb-md">
        <h1 className="m-0 font-heading text-[18px] font-bold text-ink">Hoja de ruta — {hoja.fecha}</h1>
        <p className="m-0 font-body text-[13px] text-muted">
          Franja horaria {hoja.franjaInicio} a {hoja.franjaFin}
        </p>
      </header>

      {hoja.recorridos.length === 0 ? (
        <p className="m-0 font-body text-sm text-muted">Sin recorridos cargados para este día.</p>
      ) : (
        hoja.recorridos.map((recorrido) => {
          const vehiculo = vehiculos.find((v) => v.id === recorrido.vehiculoId);
          const conductor = conductores.find((c) => c.id === recorrido.conductorId);
          const paradasOrdenadas = [...recorrido.paradas].sort((a, b) => a.orden - b.orden);

          return (
            <section key={recorrido.id} className="flex flex-col gap-sm break-inside-avoid border border-border p-md print:border-black">
              <h2 className="m-0 font-body text-[14px] font-semibold text-ink">
                {vehiculo ? `${vehiculo.patente} · ${vehiculo.modelo}` : 'Vehículo desconocido'} —{' '}
                {conductor ? `${conductor.apellido}, ${conductor.nombre}` : 'Conductor desconocido'}
                {recorrido.manual && ' (manual)'}
              </h2>

              <ol className="m-0 flex list-none flex-col gap-xs p-0">
                {paradasOrdenadas.map((parada, indice) => (
                  <li key={parada.id} className="flex flex-wrap items-center gap-sm font-body text-[13px] text-text">
                    <span className="font-mono text-[11px] text-faint">{indice + 1}</span>
                    <span className="font-semibold text-ink">{nombrePaciente(parada.pacienteId)}</span>
                    <span className="text-muted">· {TRAMO_LABELS[parada.tramo]}</span>
                    {parada.horaEstimada && <span className="text-muted">· {parada.horaEstimada}</span>}
                    <span className="text-muted">
                      {direccionTexto(parada.direccionOrigenId, parada.pacienteId)} → {direccionTexto(parada.direccionDestinoId, parada.pacienteId)}
                    </span>
                  </li>
                ))}
              </ol>

              {recorrido.notas && <p className="m-0 font-body text-[12px] text-muted">{recorrido.notas}</p>}
            </section>
          );
        })
      )}

      {hoja.notas && (
        <footer className="border-t border-border pt-md font-body text-[12px] text-muted">{hoja.notas}</footer>
      )}
    </div>
  );
}
