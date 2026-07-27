// Validación del formulario de alta de cobro (tasks.md 9.3): monto positivo y fecha
// obligatorios (errores duros, bloquean el submit), más una alerta NO bloqueante cuando la suma
// cobrada superaría el monto de la factura (RN-FA-02 aplica el mismo criterio de "avisar, no
// impedir" que la validación de cupo — design.md Decisión 6). Función pura, test-first.
export interface CobroFormInput {
  montoPagado: number;
  fecha: string;
  montoFactura: number;
  /** Suma de los cobros ya registrados en la factura, sin contar este nuevo cobro. */
  totalCobradoActual: number;
}

export interface CobroFormErrors {
  montoPagado?: string;
  fecha?: string;
  /** Aviso informativo, no bloqueante. */
  alertaExceso?: string;
}

export function validateCobroForm(input: CobroFormInput): CobroFormErrors {
  const errors: CobroFormErrors = {};

  if (input.montoPagado <= 0) {
    errors.montoPagado = 'El monto pagado debe ser mayor a 0.';
  }

  if (!input.fecha) {
    errors.fecha = 'La fecha es obligatoria.';
  }

  if (input.montoPagado > 0 && input.totalCobradoActual + input.montoPagado > input.montoFactura) {
    errors.alertaExceso = `La suma cobrada ($${input.totalCobradoActual + input.montoPagado}) superaría el monto de la factura ($${input.montoFactura}).`;
  }

  return errors;
}
