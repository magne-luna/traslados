// Validación del formulario de alta de cobro (tasks.md 9.3): monto positivo y fecha
// obligatorios (errores duros, bloquean el submit), más una alerta NO bloqueante cuando la suma
// cobrada superaría el monto de la factura (RN-FA-02 aplica el mismo criterio de "avisar, no
// impedir" que la validación de cupo — design.md Decisión 6). Función pura, test-first.
//
// RF-306: si la obra social del paciente de la factura no admite pagos parciales, un cobro por
// menos del saldo pendiente se bloquea (error duro) — a diferencia de `alertaExceso`, que solo
// avisa. `admitePagosParciales` es obligatorio: el caller siempre debe resolverlo desde la obra
// social (con `true` como fallback seguro si no puede determinarse — evita falsos bloqueos).
export interface CobroFormInput {
  montoPagado: number;
  fecha: string;
  montoFactura: number;
  /** Suma de los cobros ya registrados en la factura, sin contar este nuevo cobro. */
  totalCobradoActual: number;
  /** Configuración de la obra social del paciente de la factura (RF-306). */
  admitePagosParciales: boolean;
}

export interface CobroFormErrors {
  montoPagado?: string;
  fecha?: string;
  /** Aviso informativo, no bloqueante. */
  alertaExceso?: string;
  /** Error duro (RF-306): la obra social no admite pagos parciales y el cobro no salda la factura. */
  pagoParcialNoAdmitido?: string;
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

  const saldoPendiente = input.montoFactura - input.totalCobradoActual;
  if (
    input.montoPagado > 0 &&
    !input.admitePagosParciales &&
    input.montoPagado < saldoPendiente
  ) {
    errors.pagoParcialNoAdmitido = `Esta obra social no admite pagos parciales — el cobro debe completar el saldo pendiente de la factura ($${saldoPendiente}).`;
  }

  return errors;
}
