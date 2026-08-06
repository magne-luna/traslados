import { useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AvisoModeloDatos, Button, CamposSoloLectura, InlineIcon } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Field, Select, Input } from '../../design-system/form';
import { CardForm } from '../../design-system/layout';
import { iconSubirArchivo } from '../../design-system/icons';
import type { ArchivoAdjunto, EstadoAutorizacion } from '../../shared/types/presupuesto';
import { validarAutorizacion } from '../../shared/lib/presupuestos/validarAutorizacion';

export interface AutorizacionFormValues {
  estado: EstadoAutorizacion;
  montoAutorizado?: number;
  cupoMensualDias?: number;
  cupoMensualKm?: number;
  fechaRespuesta?: string;
  vigenciaDesde?: string;
  archivo?: ArchivoAdjunto;
}

const DEFAULT_VALUES: AutorizacionFormValues = { estado: 'pendiente' };

const ESTADO_OPTIONS: { value: EstadoAutorizacion; label: string }[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'autorizada', label: 'Autorizada' },
  { value: 'judicializada', label: 'Judicializada' },
  { value: 'rechazada', label: 'Rechazada' },
];

interface AutorizacionFormProps {
  initial?: AutorizacionFormValues;
  /** Monto del presupuesto asociado — contra el que se valida RN-PA-01 (tasks.md 6.3). */
  montoPresupuesto: number;
  onSubmit: (values: AutorizacionFormValues) => void;
  onCancel: () => void;
  submitting?: boolean;
  submitError?: string | null;
}

// NOTA (tasks.md 13.1, sección 17): el campo de monto autorizado con prefijo "$" (más abajo)
// sigue con su label y clases nativas — no se migra a Field/Label acá, es el mismo candidato a
// sección 17 catalogado junto con el ícono-prefijo de CudFields.tsx (design.md §Casos que
// requerirían cambio visual). labelClasses se conserva solo para ese campo.
const labelClasses = 'font-body text-[12px] font-semibold text-muted';

function toOptionalNumber(raw: string): number | undefined {
  if (raw === '') return undefined;
  return Number(raw);
}

// Formulario de autorización ligado a un presupuesto (tasks.md 6.1 a 6.4, 9.2 a 9.4): selector de
// estado (unión cerrada, Decisión 6), montoAutorizado validado contra RN-PA-01 (`validarAutorizacion`,
// Decisión 4), vigenciaDesde independiente de fechaRespuesta para carga retroactiva (RN-PA-02,
// Decisión 5) y archivo único (Decisión 3). Estado controlado plano, mismo criterio que
// PresupuestoForm/VehiculoForm.
export function AutorizacionForm({
  initial,
  montoPresupuesto,
  onSubmit,
  onCancel,
  submitting = false,
  submitError = null,
}: AutorizacionFormProps) {
  const [values, setValues] = useState<AutorizacionFormValues>(initial ?? DEFAULT_VALUES);
  const [montoError, setMontoError] = useState<string | null>(null);
  const formId = useId();
  const archivoInputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const resultado = validarAutorizacion({ montoAutorizado: values.montoAutorizado, montoPresupuesto });
    if (!resultado.ok) {
      setMontoError(resultado.error);
      return;
    }
    setMontoError(null);
    onSubmit(values);
  }

  function handleArchivoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const archivo: ArchivoAdjunto = { nombre: file.name, cargadoEn: new Date().toISOString().slice(0, 10) };
    setValues((prev) => ({ ...prev, archivo }));
  }

  return (
    <CardForm onSubmit={handleSubmit}>
      {submitError && <Alert tone="danger">{submitError}</Alert>}

      {/* tasks.md 5.2/5.3, design.md D5/D13#1/D13#6. Migrado desde un bloque hand-rolled
          (<div role="note">…</div> con lista propia) a dos AvisoModeloDatos agrupados por tema —
          la regla dura de la sección 5 de tasks.md prohíbe markup de alerta propio. Se mantienen
          agrupados (no un cartel por campo): uno para el archivo adjunto (D5, igual criterio que
          PresupuestoForm) y uno para montoAutorizado/vigenciaDesde (misma fila de discrepancia,
          D13#6). */}
      <AvisoModeloDatos>
        El archivo que subís acá <strong>todavía no se guarda en el servidor</strong>: por ahora
        queda solo en tu navegador, así que si volvés más tarde a esta autorización no lo vas a
        encontrar. Subir el archivo de verdad va a llegar en un cambio aparte. Además, el modelo
        real (docx) tiene un solo archivo por autorización, no un checklist multi-documento.
      </AvisoModeloDatos>

      {/* tasks.md 5.3, design.md D13#6: montoAutorizado/vigenciaDesde ya NO son "pendientes de
          confirmar con backend" — son columnas reales desde C-06. Lo que sigue vigente es que el
          docx no las modela (se agregaron para validar RN-PA-01/RN-PA-02). */}
      <AvisoModeloDatos>
        <strong>Monto autorizado</strong> y <strong>Fecha de vigencia</strong> no existen en el
        docx original (que solo modela Fecha de respuesta): se agregaron para poder validar
        RN-PA-01 y RN-PA-02. Ya son columnas reales en la base desde <code>C-06</code>, así que
        quedaron confirmadas con backend — el frontend no las está inventando.
      </AvisoModeloDatos>

      {/* gateo-facturacion (design.md D3, tasks.md 3.2): un solo envoltorio cubre todo el bloque
          de campos. NO cubre la barra de acciones — Cancelar debe seguir operativo. */}
      <CamposSoloLectura>
      <div className="grid grid-cols-1 gap-md md:grid-cols-2">
        <Field label="Estado" htmlFor={`${formId}-estado`}>
          <Select
            id={`${formId}-estado`}
            density="comfortable"
            value={values.estado}
            onChange={(event) => setValues((prev) => ({ ...prev, estado: event.target.value as EstadoAutorizacion }))}
          >
            {ESTADO_OPTIONS.map((opcion) => (
              <option key={opcion.value} value={opcion.value}>
                {opcion.label}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex flex-col gap-xs">
          <label htmlFor={`${formId}-monto-autorizado`} className={labelClasses}>
            Monto autorizado
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-md font-body text-[13px] text-muted">
              $
            </span>
            <input
              id={`${formId}-monto-autorizado`}
              type="number"
              min={0}
              className="w-full rounded-sm border border-border-strong bg-surface py-2 pl-xl pr-md font-body text-[13px] text-text"
              value={values.montoAutorizado ?? ''}
              onChange={(event) => setValues((prev) => ({ ...prev, montoAutorizado: toOptionalNumber(event.target.value) }))}
            />
          </div>
          {montoError && <span className="font-body text-xs text-danger">{montoError}</span>}
        </div>

        <Field label="Cupo mensual de días" htmlFor={`${formId}-cupo-dias`}>
          <Input
            id={`${formId}-cupo-dias`}
            type="number"
            min={0}
            density="comfortable"
            value={values.cupoMensualDias ?? ''}
            onChange={(event) => setValues((prev) => ({ ...prev, cupoMensualDias: toOptionalNumber(event.target.value) }))}
          />
        </Field>

        <Field label="Cupo mensual de km" htmlFor={`${formId}-cupo-km`}>
          <Input
            id={`${formId}-cupo-km`}
            type="number"
            min={0}
            density="comfortable"
            value={values.cupoMensualKm ?? ''}
            onChange={(event) => setValues((prev) => ({ ...prev, cupoMensualKm: toOptionalNumber(event.target.value) }))}
          />
        </Field>

        <Field label="Fecha de respuesta" htmlFor={`${formId}-fecha-respuesta`}>
          <Input
            id={`${formId}-fecha-respuesta`}
            type="date"
            density="comfortable"
            value={values.fechaRespuesta ?? ''}
            onChange={(event) => setValues((prev) => ({ ...prev, fechaRespuesta: event.target.value || undefined }))}
          />
        </Field>

        <Field label="Vigencia desde" htmlFor={`${formId}-vigencia-desde`}>
          <Input
            id={`${formId}-vigencia-desde`}
            type="date"
            density="comfortable"
            value={values.vigenciaDesde ?? ''}
            onChange={(event) => setValues((prev) => ({ ...prev, vigenciaDesde: event.target.value || undefined }))}
          />
        </Field>

        <div className="flex flex-col gap-xs md:col-span-2">
          <label htmlFor={`${formId}-archivo`} className={labelClasses}>
            Archivo
          </label>
          <input
            ref={archivoInputRef}
            id={`${formId}-archivo`}
            type="file"
            onChange={handleArchivoChange}
            className="sr-only"
          />
          <div
            onClick={() => archivoInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center gap-xs rounded-sm border-2 border-dashed border-border-strong bg-surface-soft px-lg py-xl text-center"
          >
            <InlineIcon size={32}>{iconSubirArchivo}</InlineIcon>
            <span className="font-body text-[13px]">
              <span className="font-semibold text-primary">Subir un archivo</span>{' '}
              <span className="text-muted">o arrastrar y soltar</span>
            </span>
            <span className="font-body text-[11px] text-muted">PDF, JPG o PNG hasta 10MB</span>
          </div>
          {values.archivo && (
            <span className="font-body text-xs text-muted">
              {values.archivo.nombre} (cargado {values.archivo.cargadoEn})
            </span>
          )}
        </div>
      </div>
      </CamposSoloLectura>

      <div className="flex justify-end gap-sm">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" requiereEscritura>
          {submitting ? 'Guardando…' : 'Guardar respuesta'}
        </Button>
      </div>
    </CardForm>
  );
}
