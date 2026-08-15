import { useId, useState, type FormEvent } from 'react';
import { Button, CamposSoloLectura, FieldGroupHeading } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Field, Input, Textarea } from '../../design-system/form';
import { CardForm } from '../../design-system/layout';
import type { AccesorioMovilidad, EstadoVehiculo } from '../../shared/types/vehiculo';
import { AccesoriosMovilidadSelector } from '../pacientes/AccesoriosMovilidadSelector';
import { validateVehiculoForm, type VehiculoFormErrors } from './validateVehiculoForm';

export interface VehiculoFormValues {
  patente: string;
  modelo: string;
  tipo: string;
  capacidad: number;
  kilometraje: number;
  estado: EstadoVehiculo;
  accesoriosCompatibles: AccesorioMovilidad[];
  /** C-08: observaciones libres sobre el vehículo (`Vehiculo.notas`). */
  notas: string;
}

const DEFAULT_VALUES: VehiculoFormValues = {
  patente: '',
  modelo: '',
  tipo: '',
  capacidad: 4,
  kilometraje: 0,
  estado: 'habilitado',
  accesoriosCompatibles: [],
  notas: '',
};

interface VehiculoFormProps {
  initial?: VehiculoFormValues;
  /** RF-505: kilometraje ya registrado, para bloquear valores menores en edición. */
  kilometrajeMinimo?: number;
  onSubmit: (values: VehiculoFormValues) => void;
  onCancel: () => void;
  submitting?: boolean;
  submitError?: string | null;
}

// Formulario de alta/edición de vehículo (tasks.md 5.2 a 5.6): patente, modelo, tipo, capacidad,
// kilometraje, selector de accesorios de movilidad (multi-selección tipada, RN-VE-01) y toggle
// habilitado/fuera de servicio (RN-VE-02), todo en un único submit (mismo criterio de estado
// controlado plano que ObraSocialForm — YAGNI, sin librería de formularios).
export function VehiculoForm({
  initial,
  kilometrajeMinimo,
  onSubmit,
  onCancel,
  submitting = false,
  submitError = null,
}: VehiculoFormProps) {
  const [values, setValues] = useState<VehiculoFormValues>(initial ?? DEFAULT_VALUES);
  const [errors, setErrors] = useState<VehiculoFormErrors>({});
  const formId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validateVehiculoForm({
      patente: values.patente,
      capacidad: values.capacidad,
      kilometraje: values.kilometraje,
      kilometrajeMinimo,
    });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    onSubmit(values);
  }

  return (
    <CardForm onSubmit={handleSubmit} gap="md" radius="sm" padding="lg">
      {submitError && <Alert tone="danger">{submitError}</Alert>}

      {/* gateo-conductores (design.md D4): una sola inserción cubre todos los campos del
          formulario (datos generales + accesorios de movilidad). El envoltorio NO cubre la
          barra de acciones: Cancelar debe seguir operativo para una cuenta de solo lectura. */}
      <CamposSoloLectura>
      <div className="flex flex-col gap-md">
      <div>
      <FieldGroupHeading>Datos generales</FieldGroupHeading>
      <div className="grid grid-cols-1 gap-md md:grid-cols-2">
        <Field label="Patente" htmlFor={`${formId}-patente`} error={errors.patente}>
          <Input
            id={`${formId}-patente`}
            density="comfortable"
            value={values.patente}
            onChange={(event) => setValues((prev) => ({ ...prev, patente: event.target.value }))}
          />
        </Field>

        <Field label="Modelo" htmlFor={`${formId}-modelo`}>
          <Input
            id={`${formId}-modelo`}
            density="comfortable"
            value={values.modelo}
            onChange={(event) => setValues((prev) => ({ ...prev, modelo: event.target.value }))}
          />
        </Field>

        <Field label="Tipo" htmlFor={`${formId}-tipo`}>
          <Input
            id={`${formId}-tipo`}
            density="comfortable"
            value={values.tipo}
            onChange={(event) => setValues((prev) => ({ ...prev, tipo: event.target.value }))}
          />
        </Field>

        <Field label="Capacidad" htmlFor={`${formId}-capacidad`} error={errors.capacidad}>
          <Input
            id={`${formId}-capacidad`}
            type="number"
            density="comfortable"
            value={values.capacidad}
            onChange={(event) => setValues((prev) => ({ ...prev, capacidad: Number(event.target.value) }))}
          />
        </Field>

        <Field label="Kilometraje" htmlFor={`${formId}-kilometraje`} error={errors.kilometraje}>
          <Input
            id={`${formId}-kilometraje`}
            type="number"
            min={0}
            density="comfortable"
            value={values.kilometraje}
            onChange={(event) => setValues((prev) => ({ ...prev, kilometraje: Number(event.target.value) }))}
          />
        </Field>

        <label
          htmlFor={`${formId}-fuera-servicio`}
          className="flex items-center gap-sm self-end pb-2 font-body text-[13px] text-text"
        >
          <input
            id={`${formId}-fuera-servicio`}
            type="checkbox"
            checked={values.estado === 'fuera-de-servicio'}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, estado: event.target.checked ? 'fuera-de-servicio' : 'habilitado' }))
            }
          />
          Fuera de servicio
        </label>
      </div>
      </div>

      {/* Swap del catálogo (tasks.md 4.3): el selector reutilizable de `features/pacientes/` (import
          cross-feature) reemplaza la lista estática; se alimenta del catálogo activo y gestiona
          inline con `pacientes: write` — el PuedeEscribirContext de esta ruta es vehiculos y no
          alcanza, por eso el gateo vive adentro del componente. */}
      <AccesoriosMovilidadSelector
        idBase={formId}
        titulo="Accesorios de movilidad compatibles"
        seleccion={values.accesoriosCompatibles}
        onChange={(seleccion) => setValues((prev) => ({ ...prev, accesoriosCompatibles: seleccion }))}
      />

      <Field label="Notas (opcional)" htmlFor={`${formId}-notas`}>
        <Textarea
          id={`${formId}-notas`}
          density="comfortable"
          value={values.notas}
          onChange={(event) => setValues((prev) => ({ ...prev, notas: event.target.value }))}
        />
      </Field>
      </div>
      </CamposSoloLectura>

      <div className="flex items-center justify-end gap-sm">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" requiereEscritura>
          {submitting ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </CardForm>
  );
}
