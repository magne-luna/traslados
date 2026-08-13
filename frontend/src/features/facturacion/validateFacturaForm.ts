// Validación de campos requeridos del formulario de Factura (tasks.md 7.4): paciente, período
// (mes 1-12 + año), valor del km y cantidad de días. Función pura: sin acceso al repository —
// si hay errores, FacturaForm no invoca crear()/actualizar() (mismo criterio que
// validatePresupuestoForm/validateVehiculoForm).
//
// Decisión (change `facturacion-seleccion-autorizacion`, tasks.md 3.8): `autorizacionId` NO se
// agrega acá. El gateo del wizard (`!values.autorizacionId` bloquea "Siguiente" del Paso 2→3, D4)
// ya cubre el alta. Agregar un required acá bloquearía la EDICIÓN de facturas anteriores a este
// change (`autorizacion_id NULL`, D1: nullable, sin `NOT NULL`) — en edición el Paso 2 es de solo
// lectura y no bifurca (D4), así que no hay forma de que el operador complete un campo que este
// validador exigiera.
export interface FacturaFormInput {
  pacienteId: string | null;
  mesFacturado: number | null;
  anioFacturado: number | null;
  valorKm: number;
  dias: number;
}

export interface FacturaFormErrors {
  pacienteId?: string;
  periodo?: string;
  valorKm?: string;
  dias?: string;
}

export function validateFacturaForm(input: FacturaFormInput): FacturaFormErrors {
  const errors: FacturaFormErrors = {};

  if (input.pacienteId === null) {
    errors.pacienteId = 'El paciente es obligatorio.';
  }

  if (
    input.mesFacturado === null ||
    input.anioFacturado === null ||
    input.mesFacturado < 1 ||
    input.mesFacturado > 12
  ) {
    errors.periodo = 'El período (mes y año) es obligatorio.';
  }

  if (input.valorKm <= 0) {
    errors.valorKm = 'El valor del km es obligatorio.';
  }

  if (input.dias <= 0) {
    errors.dias = 'La cantidad de días es obligatoria.';
  }

  return errors;
}
