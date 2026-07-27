import type { HojaDeRuta } from '../../types/hojaDeRuta';
import type { ResumenDelDia } from '../../types/reportes';

// Función pura (design.md Decisión 1, tasks.md 4.7): conteo agregado de la jornada. Los
// pacientes se cuentan una sola vez aunque aparezcan en la parada de ida y de vuelta del mismo
// recorrido, o en dos recorridos distintos (Set por pacienteId).

export function resumenDelDia(hojaDeRuta: HojaDeRuta): ResumenDelDia {
  let cantidadParadas = 0;
  const pacientesUnicos = new Set<string>();

  for (const recorrido of hojaDeRuta.recorridos) {
    cantidadParadas += recorrido.paradas.length;
    for (const parada of recorrido.paradas) {
      pacientesUnicos.add(parada.pacienteId);
    }
  }

  return {
    fecha: hojaDeRuta.fecha,
    cantidadRecorridos: hojaDeRuta.recorridos.length,
    cantidadParadas,
    cantidadPacientes: pacientesUnicos.size,
  };
}
