// Copia los campos de un `RecorridoHabitual` del paciente (RF-110) a los campos del formulario de
// parada de la hoja de ruta (feedback de usuario: "que se llenen los campos de ese recorrido").
//
// COPY-ON-CREATE, nunca referencia viva: lo que devuelve esta función se mezcla en el estado
// EDITABLE del formulario — la `ParadaRecorrido` que se termine creando queda desligada del
// habitual de origen, y editar o borrar el habitual después no toca la hoja de ruta ya armada.
// Mismo criterio que "Traer de los destinos habituales" de PresupuestoForm (design.md D2 de
// presupuestos-vigencia-datos-traslado-vista-previa).
//
// NO invierte el par para el tramo de vuelta — RN-HR-02 (hojaDeRuta.ts): "la UI nunca deriva la
// vuelta invirtiendo la ida". La vuelta es su PROPIO `RecorridoHabitual` en la ficha del paciente
// (el editor deja cargar los dos sentidos como filas separadas), así que se copia tal cual y el
// operador elige el habitual que corresponda al tramo que está cargando.

import type { Direccion } from '../../types/paciente';
import type { RecorridoHabitual } from '../../types/recorridoHabitual';

export interface CamposDesdeRecorridoHabitual {
  direccionOrigenId: string;
  direccionDestinoId: string;
  horaEstimada: string;
}

/** `''` si el id no está en el catálogo actual del paciente — un `<select>` con un `value` que no
 *  existe entre sus `<option>` se ve vacío igual, pero al enviar arrastraría un id fantasma. */
function idVigente(direccionId: string, direcciones: readonly Direccion[]): string {
  return direcciones.some((d) => d.id === direccionId) ? direccionId : '';
}

export function camposDesdeRecorridoHabitual(
  recorrido: RecorridoHabitual,
  direcciones: readonly Direccion[],
): CamposDesdeRecorridoHabitual {
  return {
    direccionOrigenId: idVigente(recorrido.direccionInicialId, direcciones),
    direccionDestinoId: idVigente(recorrido.direccionFinalId, direcciones),
    horaEstimada: recorrido.hora,
  };
}
