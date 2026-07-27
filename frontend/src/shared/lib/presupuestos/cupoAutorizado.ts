import type { Autorizacion, CupoAutorizado } from '../../types/presupuesto';

// Función pura (tasks.md 7.1, design.md Decisión 9): deriva la proyección `CupoAutorizado`
// consumible por FE-6 (`C-07`, RN-PA-03, RN-FA-02) a partir de una `Autorizacion` + el
// `pacienteId` de su `Presupuesto` (Autorizacion no embebe el paciente — design.md Decisión 2).
// Solo deja el dato consultable; el control de facturación contra el cupo se implementa en FE-6.
export function derivarCupoAutorizado(autorizacion: Autorizacion, pacienteId: string): CupoAutorizado {
  return {
    pacienteId,
    cupoMensualDias: autorizacion.cupoMensualDias,
    cupoMensualKm: autorizacion.cupoMensualKm,
    vigenciaDesde: autorizacion.vigenciaDesde,
  };
}
