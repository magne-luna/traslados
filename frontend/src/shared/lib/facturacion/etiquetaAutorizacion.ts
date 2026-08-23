import type { Paciente } from '../../types/paciente';
import type { Prestacion } from '../../types/prestacion';
import type { AutorizacionPendiente } from './autorizacionesPendientes';
import { etiquetaPeriodoMes } from '../presupuestos/periodoAutorizacion';

// Resuelve la `Prestacion` real de una autorización pendiente contra el catálogo del paciente
// (`presupuesto.prestacionId` → `paciente.prestaciones`), o `undefined` cuando no hay una
// resuelta (modalidad `general`, sin `prestacionId`, o un catálogo desactualizado que ya no
// tiene esa prestación). Extraído de `etiquetaAutorizacion` (feature
// `facturacion-derivar-prestacion`) para reusar el mismo criterio de resolución en dos lugares
// que necesitan cosas distintas: acá el objeto real (para derivar/bloquear el campo "Prestación"
// del Paso 3 de `FacturaForm`), en `etiquetaAutorizacion` el string ya formateado con fallback
// (para el selector del Paso 2).
export function prestacionRealAutorizacion(item: AutorizacionPendiente, paciente: Paciente | undefined): Prestacion | undefined {
  return paciente?.prestaciones?.find((p) => p.id === item.presupuesto.prestacionId);
}

// Etiqueta de cada opción del selector de autorizaciones del Paso 2 del wizard (change
// `facturacion-seleccion-autorizacion`, design.md D4). `design.md` proponía un fallback por
// fecha/monto/cupos porque, al escribirse, `Presupuesto.prestacionId` no existía en el repo. Esa
// premisa cambió: `presupuesto-prestaciones` ya se mergeó a esta rama y el campo SÍ existe hoy
// (`shared/types/presupuesto.ts`) — se usa el nombre real de la prestación cuando está disponible
// (resuelto contra `paciente.prestaciones`, catálogo propio de cada paciente) para distinguir
// autorizaciones simultáneas en modalidad `por-prestacion`, y se cae al fallback de `design.md`
// (fecha de emisión + monto + cupos) solo cuando no hay `prestacionId` o no se encuentra en el
// catálogo del paciente (modalidad `general`, o un catálogo desactualizado).
//
// `autorizacion-mensual` (design.md D6b, tasks.md 5.3): el período entra en la etiqueta SIEMPRE,
// como sufijo -- `{prestación o fallback} · {mes}`. NO es cosmética: bajo el modelo mensual, N
// filas del mismo presupuesto (misma prestación, mismo fallback) sin este sufijo renderizan la
// MISMA cadena -- N opciones idénticas en el `<select>`, exactamente el problema "presupuestos
// indistinguibles entre sí" que design.md señala. El sufijo reusa `etiquetaPeriodoMes`
// (`periodoAutorizacion.ts`, ya construida y testeada en Fase 3) en vez de reimplementar el
// mapeo mes→español acá: para `periodoMes: undefined` (legacy) devuelve `'Sin mes cargado'`,
// nunca un mes inventado -- mismo criterio D3 que el resto del change.
export function etiquetaAutorizacion(item: AutorizacionPendiente, paciente: Paciente | undefined): string {
  const prestacion = prestacionRealAutorizacion(item, paciente);
  const base = prestacion ? prestacion.nombre : etiquetaFallback(item);

  return `${base} · ${etiquetaPeriodoMes(item.autorizacion.periodoMes)}`;
}

function etiquetaFallback(item: AutorizacionPendiente): string {
  const partes: string[] = [`Presupuesto del ${item.presupuesto.fechaEmision}`, `$${item.presupuesto.monto.toLocaleString('es-AR')}`];
  if (item.autorizacion.cupoMensualDias !== undefined) partes.push(`${item.autorizacion.cupoMensualDias} días/mes`);
  if (item.autorizacion.cupoMensualKm !== undefined) partes.push(`${item.autorizacion.cupoMensualKm} km/mes`);
  return partes.join(' · ');
}
