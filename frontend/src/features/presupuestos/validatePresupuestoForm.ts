// Validación de campos requeridos del formulario de Presupuesto (tasks.md 5.3): exige paciente,
// obra social y monto. Función pura: sin acceso a DOM ni al repository, para poder testearla
// aislada del componente (mismo criterio que validateVehiculoForm/validatePacienteForm).

export interface PresupuestoFormInput {
  pacienteId: string | null;
  obraSocialId: string | null;
  monto: number;
}

export interface PresupuestoFormErrors {
  pacienteId?: string;
  obraSocialId?: string;
  monto?: string;
}

export function validatePresupuestoForm(input: PresupuestoFormInput): PresupuestoFormErrors {
  const errors: PresupuestoFormErrors = {};

  if (input.pacienteId === null) {
    errors.pacienteId = 'El paciente es obligatorio.';
  }

  // Fix "la obra social debe derivarse del paciente, no elegirse aparte": `obraSocialId` ya no es
  // un campo que el usuario tipea en este form — PresupuestoForm lo deriva solo de
  // `paciente.obraSocialId` (ver el efecto dedicado en el componente) y bloquea el botón Guardar
  // cuando el paciente elegido no tiene obra social asignada. Este chequeo queda como red de
  // seguridad genérica (cubre también "todavía no se eligió ningún paciente"), no como la fuente
  // primaria del bloqueo — esa vive en el componente (`bloqueadoSinObraSocial`), con el mensaje
  // específico ("Asignala en la ficha del paciente…") que sí orienta a resolverlo.
  if (input.obraSocialId === null) {
    errors.obraSocialId = 'La obra social es obligatoria.';
  }

  if (input.monto <= 0) {
    errors.monto = 'El monto debe ser mayor a 0.';
  }

  return errors;
}

// -------------------------------------------------------------------------------------------
// Validación de la rama `por-prestacion` (presupuesto-prestaciones, design.md D9/D10, tasks.md
// 8.7): sin campo `monto` — el alta es un lote de prestaciones seleccionadas, cada una con su
// propio monto. Función aparte y aditiva: `validatePresupuestoForm` (arriba) no cambia de firma
// y sigue siendo la validación de la rama `simple`/`general` (donde `monto` ya es la suma de las
// líneas, calculada por PresupuestoLineasEditor antes de llegar acá).
// -------------------------------------------------------------------------------------------

export interface PresupuestoLoteItemInput {
  prestacionId: string;
  monto: number;
}

export interface PresupuestoLoteFormInput {
  pacienteId: string | null;
  obraSocialId: string | null;
  items: PresupuestoLoteItemInput[];
}

export interface PresupuestoLoteFormErrors {
  pacienteId?: string;
  obraSocialId?: string;
  items?: string;
}

/** Al menos una prestación seleccionada con `monto > 0` (spec `presupuesto-prestacion`,
 * Requirement "Alta atómica en lote…"). `items` ya llega acotado a las prestaciones que el
 * usuario efectivamente marcó — no valida contra el catálogo completo del paciente. */
export function validatePresupuestoLoteForm(input: PresupuestoLoteFormInput): PresupuestoLoteFormErrors {
  const errors: PresupuestoLoteFormErrors = {};

  if (input.pacienteId === null) {
    errors.pacienteId = 'El paciente es obligatorio.';
  }

  if (input.obraSocialId === null) {
    errors.obraSocialId = 'La obra social es obligatoria.';
  }

  const algunaConMonto = input.items.some((item) => item.monto > 0);
  if (!algunaConMonto) {
    errors.items = 'Cargá el monto de al menos una prestación seleccionada.';
  }

  return errors;
}
