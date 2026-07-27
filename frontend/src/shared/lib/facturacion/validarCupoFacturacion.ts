import type { CupoAutorizado } from '../../types/presupuesto';

// Función pura (tasks.md 3.5, design.md Decisión 6, RN-FA-02): compara lo facturado del período
// contra el `CupoAutorizado` del paciente y devuelve un resultado explícito con mensaje
// comparativo. NO decide bloquear — solo informa; la UI es la que exige confirmación explícita
// sin impedir la emisión (design.md Decisión 6).
export interface ValidarCupoFacturacionInput {
  diasFacturados: number;
  kmFacturados: number;
  /** `undefined` = el paciente no tiene autorización con cupo cargado. */
  cupo: CupoAutorizado | undefined;
}

export interface ValidarCupoFacturacionResultado {
  /** `false` cuando no hay ninguna autorización o no tiene ni días ni km cargados. */
  cupoDisponible: boolean;
  excedeDias: boolean;
  excedeKm: boolean;
  mensaje: string;
}

export function validarCupoFacturacion({
  diasFacturados,
  kmFacturados,
  cupo,
}: ValidarCupoFacturacionInput): ValidarCupoFacturacionResultado {
  const cupoDisponible = cupo !== undefined && (cupo.cupoMensualDias !== undefined || cupo.cupoMensualKm !== undefined);

  if (!cupoDisponible) {
    return {
      cupoDisponible: false,
      excedeDias: false,
      excedeKm: false,
      mensaje: 'No hay cupo autorizado cargado para validar esta factura.',
    };
  }

  const excedeDias = cupo.cupoMensualDias !== undefined && diasFacturados > cupo.cupoMensualDias;
  const excedeKm = cupo.cupoMensualKm !== undefined && kmFacturados > cupo.cupoMensualKm;

  const partes: string[] = [];
  if (excedeDias) {
    partes.push(`tenés autorizados ${cupo.cupoMensualDias} días, estás facturando ${diasFacturados}`);
  }
  if (excedeKm) {
    partes.push(`tenés autorizados ${cupo.cupoMensualKm} km, estás facturando ${kmFacturados}`);
  }

  return {
    cupoDisponible: true,
    excedeDias,
    excedeKm,
    mensaje: partes.length > 0 ? `${partes.join('; ')}.` : 'Dentro del cupo autorizado.',
  };
}
