// Función pura (tasks.md 4.1-4.6, design.md D4), sin red, sin React: deriva viajes y km mensuales a
// partir de los días hábiles cargados en el presupuesto. NO se persiste `viajes_mensuales` en
// Postgres (design.md D4) — sería una segunda fuente de verdad de `dias_mensuales`, que puede
// desincronizarse en cualquier edición. Se calcula en vivo en el formulario.
//
// Motivo de existir del módulo: el equipo usaba un doc de referencia a mano que calculaba 23 días
// hábiles con vuelta como 24 viajes mensuales. Es matemáticamente incorrecto: son 46 (23 × 2, ida +
// vuelta). `rg -i viaje` sobre el repo no devolvía ninguna lógica de cálculo, solo prosa — esta es la
// primera implementación, no un fix de bug.

export interface ParametrosViajes {
  diasMensuales: number;
  tieneVuelta: boolean;
}

function validarDiasMensuales(diasMensuales: number): void {
  if (diasMensuales < 0) {
    // Decisión (tasks.md 4.3): negativo no es un escenario de negocio válido — 0 ya cubre "sin días
    // cargados todavía". Devolver 0 en silencio enmascararía un dato corrupto aguas arriba; se lanza
    // para que el error sea visible en vez de propagar un número incorrecto al formulario.
    throw new RangeError(`diasMensuales no puede ser negativo (recibido: ${diasMensuales})`);
  }
}

/** 23 días hábiles con vuelta = 46 viajes (ida + vuelta), NO 24. */
export function calcularViajesMensuales({ diasMensuales, tieneVuelta }: ParametrosViajes): number {
  validarDiasMensuales(diasMensuales);
  return diasMensuales * (tieneVuelta ? 2 : 1);
}

export function calcularKmMensuales({
  diasMensuales,
  tieneVuelta,
  kmIda,
  kmVuelta,
}: ParametrosViajes & { kmIda: number; kmVuelta: number }): number {
  validarDiasMensuales(diasMensuales);
  return diasMensuales * (kmIda + (tieneVuelta ? kmVuelta : 0));
}
