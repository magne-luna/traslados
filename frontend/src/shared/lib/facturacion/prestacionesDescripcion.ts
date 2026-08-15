import type { Paciente } from '../../types/paciente';
import type { Presupuesto } from '../../types/presupuesto';

// WU2 de `facturacion-cambios-ui` (decisión usuaria 2026-08-16, opción a del brief): resuelve los
// nombres de las prestaciones del bloque "Prestaciones:" de la descripción desde las LÍNEAS del
// presupuesto de la autorización elegida (`presupuesto.lineas` — REAPERTURA #13, persiste desde el
// WU1) contra el catálogo `paciente.prestaciones`. Mismo criterio de fallback que
// `prestacionRealAutorizacion` de `etiquetaAutorizacion.ts` ("Prestación desconocida" cuando el
// id ya no está activo, sin romper).
export function prestacionesDePresupuesto(presupuesto: Presupuesto | undefined, paciente: Paciente): string[] {
  if (!presupuesto?.lineas?.length) return [];
  return presupuesto.lineas.map((linea) => {
    const prestacion = paciente.prestaciones?.find((p) => p.id === linea.prestacionId);
    return prestacion?.nombre ?? 'Prestación desconocida';
  });
}