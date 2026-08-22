// Función pura (tasks.md 8.5, design.md D2 "Lo que SÍ se hace para no retipear"): resuelve el
// contenido del botón "Traer de los destinos habituales del paciente" de PresupuestoForm.
// Copy-on-create, nunca referencia viva (D2) — el resultado es un objeto plano que el formulario
// mezcla en su propio estado editable; esta función no toca React ni el repository.
//
// RecorridoHabitual (RF-110) es una fila por (diaSemana, hora), con una sola hora y una sola
// dirección de origen/destino — no modela "ida/vuelta" como un par explícito. El bloque del
// presupuesto sí lo hace (origenIda/destinoIda + origenVuelta/destinoVuelta + horarioEntrada/
// horarioSalida). Esta función traduce lo primero a lo segundo con una heurística acotada y
// documentada, no inventada por adivinanza numérica (eso sigue prohibido, D3/Open Question 1):
//
//   1. `diasSemana` es la UNIÓN de los días presentes en cualquier recorrido del paciente (no solo
//      los del tramo elegido como "ida" más abajo) — el conjunto real de días que el paciente se
//      traslada, tal como Andrea lo describe ("días de la semana, resumible a una cantidad").
//   2. El recorrido con la `hora` más temprana se toma como el tramo de IDA (origen/destino/horario
//      de entrada) — es la lectura más simple de "llegada a la actividad".
//   3. Si existe otro recorrido cuyo origen/destino es el camino inverso exacto de ese tramo de ida
//      (mismo par de direcciones, sentido opuesto), se toma como el tramo de VUELTA (horario de
//      salida). Si no existe ese inverso exacto, el traslado se copia como solo-ida — no se
//      inventa un horario de vuelta que el paciente no tiene cargado.
//   4. Los kilómetros y `diasMensuales` NO se copian: `RecorridoHabitual` no los modela en absoluto
//      (RF-110 no tiene noción de km), así que no hay nada real que traer — quedan para carga
//      manual, igual que el resto del bloque (D2, "carga manual" del km del formulario de la
//      obra social).
//
// Los campos quedan editables tras la copia (spec "Copiar y luego editar"): esta función solo
// calcula el valor sugerido inicial.

import type { RecorridoHabitual, DiaSemana } from '../../shared/types/recorridoHabitual';
import type { Direccion } from '../../shared/types/paciente';
import type { DatosTraslado } from '../../shared/types/presupuesto';

const ORDEN_DIAS: DiaSemana[] = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

function textoDireccion(direcciones: Direccion[], direccionId: string): string {
  const direccion = direcciones.find((d) => d.id === direccionId);
  // Mismo criterio que FacturaResumen.tsx/HojaDeRutaImprimible.tsx/RecorridoCard.tsx: resolver una
  // dirección a texto legible, con el mismo fallback cuando el id no aparece en el catálogo.
  return direccion ? `${direccion.calle}, ${direccion.localidad}` : 'Dirección desconocida';
}

/**
 * Resultado parcial de `DatosTraslado` a partir de los `RecorridoHabitual` vigentes de un
 * paciente. `recorridos.length === 0` no debería llegar acá (el botón que lo dispara ya queda
 * deshabilitado en ese caso, spec "Paciente sin destinos habituales") — igual devuelve un bloque
 * vacío en vez de lanzar, para no depender de esa garantía externa.
 */
export function construirDatosTrasladoDesdeRecorridos(
  recorridos: RecorridoHabitual[],
  direcciones: Direccion[],
): Partial<DatosTraslado> {
  const diasSemana = ORDEN_DIAS.filter((dia) => recorridos.some((recorrido) => recorrido.diaSemana === dia));

  if (recorridos.length === 0) {
    return { diasSemana };
  }

  const [ida, ...resto] = [...recorridos].sort((a, b) => a.hora.localeCompare(b.hora));
  if (!ida) {
    // Inalcanzable en la práctica (ya se descartó `recorridos.length === 0` arriba) — angosta el
    // tipo sin `as` ni `!` para que TypeScript no marque `ida` como posiblemente `undefined` más
    // abajo (`noUncheckedIndexedAccess`).
    return { diasSemana };
  }

  const vuelta = resto.find(
    (recorrido) => recorrido.direccionInicialId === ida.direccionFinalId && recorrido.direccionFinalId === ida.direccionInicialId,
  );

  return {
    diasSemana,
    origenIda: textoDireccion(direcciones, ida.direccionInicialId),
    destinoIda: textoDireccion(direcciones, ida.direccionFinalId),
    horarioEntrada: ida.hora,
    ...(vuelta
      ? {
          origenVuelta: textoDireccion(direcciones, vuelta.direccionInicialId),
          destinoVuelta: textoDireccion(direcciones, vuelta.direccionFinalId),
          horarioSalida: vuelta.hora,
        }
      : {}),
  };
}
