import type { Direccion, Tramo } from '../../shared/types/hojaDeRuta';
import { TRAMO_LABELS, TRAMO_OPTIONS } from '../pacientes/direccionOptions';
import { Field, Input, Select } from '../../design-system/form';
import { HORARIOS_SUGERIDOS } from './horaOptions';

interface PacienteTramoCamposProps {
  formId: string;
  direcciones: Direccion[];
  horaEstimada: string;
  tramo: Tramo;
  direccionOrigenId: string;
  direccionDestinoId: string;
  onHoraChange: (value: string) => void;
  onTramoChange: (value: Tramo) => void;
  onDireccionOrigenChange: (value: string) => void;
  onDireccionDestinoChange: (value: string) => void;
}

// Campos de hora/tramo/direcciones de un paciente ya elegido (feedback de usuario: "los
// formularios tienen que ser el mismo") — comparten literalmente este componente
// AsignacionPanel (agregar pasajero a un recorrido existente) y NuevoRecorridoForm (elegir el
// primer pasajero al crear uno), en vez de duplicar el mismo bloque de campos dos veces.
export function PacienteTramoCampos({
  formId,
  direcciones,
  horaEstimada,
  tramo,
  direccionOrigenId,
  direccionDestinoId,
  onHoraChange,
  onTramoChange,
  onDireccionOrigenChange,
  onDireccionDestinoChange,
}: PacienteTramoCamposProps) {
  return (
    <>
      <Field label="Hora estimada" htmlFor={`${formId}-hora`}>
        <Input
          id={`${formId}-hora`}
          type="text"
          inputMode="numeric"
          placeholder="HH:mm"
          list={`${formId}-horarios`}
          value={horaEstimada}
          onChange={(event) => onHoraChange(event.target.value)}
        />
        <datalist id={`${formId}-horarios`}>
          {HORARIOS_SUGERIDOS.map((hora) => (
            <option key={hora} value={hora} />
          ))}
        </datalist>
      </Field>

      <Field label="Tramo" htmlFor={`${formId}-tramo`}>
        <Select id={`${formId}-tramo`} value={tramo} onChange={(event) => onTramoChange(event.target.value as Tramo)}>
          {TRAMO_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {TRAMO_LABELS[t]}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Dirección de origen" htmlFor={`${formId}-origen`}>
        <Select
          id={`${formId}-origen`}
          value={direccionOrigenId}
          onChange={(event) => onDireccionOrigenChange(event.target.value)}
        >
          <option value="">Elegir…</option>
          {direcciones.map((direccion) => (
            <option key={direccion.id} value={direccion.id}>
              {direccion.calle}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Dirección de destino" htmlFor={`${formId}-destino`}>
        <Select
          id={`${formId}-destino`}
          value={direccionDestinoId}
          onChange={(event) => onDireccionDestinoChange(event.target.value)}
        >
          <option value="">Elegir…</option>
          {direcciones.map((direccion) => (
            <option key={direccion.id} value={direccion.id}>
              {direccion.calle}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}
