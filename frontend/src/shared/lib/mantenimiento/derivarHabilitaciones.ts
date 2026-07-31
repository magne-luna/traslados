import type { MantenimientoRegistro, RegistroHabilitacion } from '../../types/vehiculo';

// Derivación pura de habilitaciones VTV/RTO desde el historial de mantenimiento (tasks.md 2B.1,
// design.md D3 opción B). `Vehiculo.habilitaciones` deja de persistirse aparte: la usan tanto el
// mock como `SupabaseVehiculoRepository` (4.7), para que las dos implementaciones muestren lo
// mismo en la misma pantalla.
//
// Regla exacta: por cada tipo ∈ {'vtv', 'rto'} (evaluados de forma independiente, RN-VE-04), se
// consideran únicamente las filas preventivas de ese sub-tipo con `proximoVencimientoFecha`
// informado, y se elige la de `fecha` más reciente — desempate determinista por `id` para que dos
// corridas sobre los mismos datos elijan siempre la misma. Sin candidatas → no se emite ninguna
// habilitación de ese tipo: nunca se inventa una fecha de vencimiento.

const TIPOS_HABILITACION = ['vtv', 'rto'] as const;

function esCandidataDe(tipo: (typeof TIPOS_HABILITACION)[number]) {
  return (
    registro: MantenimientoRegistro,
  ): registro is MantenimientoRegistro & { tipoIntervencion: 'preventivo'; subtipo: typeof tipo; proximoVencimientoFecha: string } =>
    registro.tipoIntervencion === 'preventivo' && registro.subtipo === tipo && Boolean(registro.proximoVencimientoFecha);
}

function elegirMasReciente<T extends { fecha: string; id: string }>(candidatas: T[]): T | undefined {
  return candidatas.reduce<T | undefined>((ganadora, candidata) => {
    if (!ganadora) return candidata;
    if (candidata.fecha > ganadora.fecha) return candidata;
    if (candidata.fecha === ganadora.fecha && candidata.id > ganadora.id) return candidata;
    return ganadora;
  }, undefined);
}

export function derivarHabilitaciones(mantenimientos: MantenimientoRegistro[]): RegistroHabilitacion[] {
  const habilitaciones: RegistroHabilitacion[] = [];

  for (const tipo of TIPOS_HABILITACION) {
    const candidatas = mantenimientos.filter(esCandidataDe(tipo));
    const elegida = elegirMasReciente(candidatas);
    if (!elegida) continue;

    habilitaciones.push({
      tipo,
      fechaEmision: elegida.fecha,
      fechaVencimiento: elegida.proximoVencimientoFecha,
    });
  }

  return habilitaciones;
}
