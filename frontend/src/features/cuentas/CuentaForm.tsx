import { useId, useState, type FormEvent } from 'react';
import { Button, FieldGroupHeading } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Field, Input } from '../../design-system/form';
import { CardForm } from '../../design-system/layout';
import type { Modulo, Permiso } from '../../shared/types/usuario';
import { filasAPermisos, filasVacias, type NivelDeFila } from './modulos';
import { PermisosMatrizFields } from './PermisosMatrizFields';
import { validateCuentaForm, type CuentaFormErrors } from './validateCuentaForm';

export interface CuentaFormValues {
  email: string;
  nombre: string;
  apellido: string;
  password: string;
  permisos: Permiso[];
}

interface CuentaFormProps {
  onSubmit: (values: CuentaFormValues) => void;
  onCancel: () => void;
  submitting?: boolean;
  submitError?: string | null;
}

// Formulario de alta de cuenta (design.md D9, tasks.md 7.6): email/nombre/apellido/password +
// permisos iniciales opcionales, misma PermisosMatrizFields que MatrizPermisos (helpers
// compartidos en ./modulos.ts) — acá no hay edición diferida porque la cuenta todavía no existe:
// los permisos elegidos viajan en el mismo `create-user` que crea la cuenta (design.md D7,
// tasks.md 6.5). Sin librería de formularios (YAGNI, mismo criterio que ObraSocialForm).
export function CuentaForm({ onSubmit, onCancel, submitting = false, submitError = null }: CuentaFormProps) {
  const [email, setEmail] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [password, setPassword] = useState('');
  const [permisosIniciales, setPermisosIniciales] = useState(filasVacias());
  const [errors, setErrors] = useState<CuentaFormErrors>({});
  const formId = useId();

  function handleCambiarNivel(modulo: Modulo, nivel: NivelDeFila) {
    setPermisosIniciales((prev) => ({ ...prev, [modulo]: nivel }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validateCuentaForm({ email, nombre, apellido, password });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    onSubmit({ email, nombre, apellido, password, permisos: filasAPermisos(permisosIniciales) });
  }

  return (
    <CardForm onSubmit={handleSubmit} gap="md" radius="sm" padding="lg">
      {submitError && <Alert tone="danger">{submitError}</Alert>}

      <div>
      <FieldGroupHeading>Datos de la cuenta</FieldGroupHeading>
      <div className="grid grid-cols-1 gap-md md:grid-cols-2">
        <Field label="Nombre" htmlFor={`${formId}-nombre`} error={errors.nombre}>
          <Input
            id={`${formId}-nombre`}
            density="comfortable"
            value={nombre}
            onChange={(event) => setNombre(event.target.value)}
          />
        </Field>

        <Field label="Apellido" htmlFor={`${formId}-apellido`} error={errors.apellido}>
          <Input
            id={`${formId}-apellido`}
            density="comfortable"
            value={apellido}
            onChange={(event) => setApellido(event.target.value)}
          />
        </Field>

        <Field label="Email" htmlFor={`${formId}-email`} error={errors.email}>
          <Input
            id={`${formId}-email`}
            type="email"
            density="comfortable"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>

        <Field label="Contraseña" htmlFor={`${formId}-password`} error={errors.password} hint="8 caracteres o más">
          <Input
            id={`${formId}-password`}
            type="password"
            density="comfortable"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </Field>
      </div>
      </div>

      <div>
        <FieldGroupHeading>Permisos iniciales (opcional)</FieldGroupHeading>
        <PermisosMatrizFields valores={permisosIniciales} onCambiarNivel={handleCambiarNivel} idPrefix={formId} />
      </div>

      <div className="flex items-center justify-end gap-sm border-t border-border pt-md">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? 'Creando…' : '+ Crear cuenta'}
        </Button>
      </div>
    </CardForm>
  );
}
