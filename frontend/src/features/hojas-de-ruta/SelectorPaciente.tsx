import type { Paciente } from '../../shared/types/paciente';
import { Field, Select } from '../../design-system/form';

interface SelectorPacienteProps {
  formId: string;
  pacientes: Paciente[];
  value: string;
  onChange: (pacienteId: string) => void;
  /** NuevoRecorridoForm permite crear el recorrido sin elegir a nadie todavía; AsignacionPanel no. */
  permitirVacio?: boolean;
}

// Select de paciente (feedback de usuario: "literal quiero que sean el mismo formulario") —
// compartido entre AsignacionPanel (agregar pasajero a un recorrido existente) y
// NuevoRecorridoForm (elegir el primer pasajero al crear uno). Select en vez de checkboxes: más
// práctico cuando el sistema tiene muchos pacientes.
export function SelectorPaciente({ formId, pacientes, value, onChange, permitirVacio }: SelectorPacienteProps) {
  return (
    <Field label="Paciente" htmlFor={`${formId}-paciente`}>
      <Select id={`${formId}-paciente`} value={value} onChange={(event) => onChange(event.target.value)}>
        {permitirVacio && <option value="">— Sin pasajero por ahora —</option>}
        {pacientes.map((paciente) => (
          <option key={paciente.id} value={paciente.id}>
            {paciente.apellido}, {paciente.nombre}
          </option>
        ))}
      </Select>
    </Field>
  );
}
