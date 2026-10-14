import type { PacienteResumen } from '../../shared/types/paciente';
import { Field } from '../../design-system/form';
import { ComboboxBuscable } from '../../design-system/ComboboxBuscable';
import { seleccionables } from '../../shared/lib/seleccionables';

interface SelectorPacienteProps {
  formId: string;
  pacientes: PacienteResumen[];
  value: string;
  onChange: (pacienteId: string) => void;
  /** NuevoRecorridoForm permite crear el recorrido sin elegir a nadie todavía; AsignacionPanel no. */
  permitirVacio?: boolean;
}

// Select de paciente (feedback de usuario: "literal quiero que sean el mismo formulario") —
// compartido entre AsignacionPanel (agregar pasajero a un recorrido existente) y
// NuevoRecorridoForm (elegir el primer pasajero al crear uno). Buscador en vez de select (Andrea,
// 2026-10-07): con 60+ pacientes, escribir el apellido es más rápido que scrollear.
export function SelectorPaciente({ formId, pacientes, value, onChange, permitirVacio }: SelectorPacienteProps) {
  return (
    <Field label="Paciente" htmlFor={`${formId}-paciente`}>
      <ComboboxBuscable
        id={`${formId}-paciente`}
        placeholder={permitirVacio ? 'Sin pasajero por ahora — escribí para buscar…' : 'Escribí apellido o nombre…'}
        opciones={seleccionables(pacientes, value).map((paciente) => ({ valor: paciente.id, etiqueta: `${paciente.apellido}, ${paciente.nombre}` }))}
        valor={value}
        // Sin `permitirVacio` (AsignacionPanel) siempre hay alguien elegido: borrar el texto no lo des-elige.
        onChange={(pacienteId) => {
          if (pacienteId !== '' || permitirVacio) onChange(pacienteId);
        }}
      />
    </Field>
  );
}
