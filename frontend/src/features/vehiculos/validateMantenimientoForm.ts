// Validación del alta de una intervención de mantenimiento (RF-507, US-500, tasks.md 3.4/3.5):
// función pura sobre un input laxo del formulario (todo `string`, design.md Riesgos — "la unión
// de 4 miembros complica el form"). No construye el tipo estricto `MantenimientoRegistro` acá
// (ver `toMantenimientoRegistro`), solo valida.

export interface MantenimientoFormInput {
  tipoIntervencion: string;
  subtipo: string;
  detalle: string;
  fecha: string;
  kilometraje: string;
  proximoVencimientoFecha: string;
  proximoVencimientoKm: string;
}

export interface MantenimientoFormErrors {
  tipoIntervencion?: string;
  subtipo?: string;
  detalle?: string;
  fecha?: string;
  kilometraje?: string;
}

export function validateMantenimientoForm(input: MantenimientoFormInput): MantenimientoFormErrors {
  const errors: MantenimientoFormErrors = {};

  if (input.fecha.trim() === '') {
    errors.fecha = 'La fecha es obligatoria.';
  }

  const kilometraje = Number(input.kilometraje);
  if (input.kilometraje.trim() === '' || Number.isNaN(kilometraje) || kilometraje < 0) {
    errors.kilometraje = 'El kilometraje es obligatorio y no puede ser negativo.';
  }

  if (input.tipoIntervencion.trim() === '') {
    errors.tipoIntervencion = 'El tipo de intervención es obligatorio.';
  }

  // El nivel 2 solo existe dentro de las dos categorías de mantenimiento (spec
  // vehiculo-mantenimiento-historial): un tipo "gasto" no exige ni admite sub-tipo, pero esta
  // pantalla no da de alta ese tipo (design.md Decisión 2, TIPOS_INTERVENCION_ALTA).
  const exigeSubtipo = input.tipoIntervencion === 'preventivo' || input.tipoIntervencion === 'correctivo';
  if (exigeSubtipo && input.subtipo.trim() === '') {
    errors.subtipo = 'El sub-tipo es obligatorio.';
  }

  if (input.subtipo === 'otro' && input.detalle.trim() === '') {
    errors.detalle = 'El detalle es obligatorio para el sub-tipo "otro".';
  }

  return errors;
}
