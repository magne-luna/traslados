import { Chip } from '../../design-system/components';
import type { Paciente } from '../../shared/types/paciente';
import type { Vehiculo } from '../../shared/types/vehiculo';
import { ACCESORIO_MOVILIDAD_LABELS } from '../vehiculos/accesorioMovilidadOptions';

interface RequisitosPacienteProps {
  paciente: Paciente;
  /** Vehículo contra el que se colorea la compatibilidad — undefined = todavía sin elegir. */
  vehiculo: Vehiculo | undefined;
}

// Accesorios de movilidad que requiere un paciente ya elegido, coloreados por compatibilidad con
// el vehículo (success/danger) o neutros (info) si todavía no hay vehículo elegido — nunca solo
// color, el texto del accesorio ya lo distingue (WCAG). Compartido entre AsignacionPanel y
// NuevoRecorridoForm (feedback de usuario: "literal quiero que sean el mismo formulario").
export function RequisitosPaciente({ paciente, vehiculo }: RequisitosPacienteProps) {
  if (paciente.accesorioMovilidad.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-sm">
      <span className="font-body text-[12px] font-semibold text-muted">Requiere:</span>
      {paciente.accesorioMovilidad.map((accesorio) => (
        <Chip
          key={accesorio}
          kind={!vehiculo ? 'info' : vehiculo.accesoriosCompatibles.includes(accesorio) ? 'success' : 'danger'}
        >
          {ACCESORIO_MOVILIDAD_LABELS[accesorio]}
        </Chip>
      ))}
    </div>
  );
}
