// Borrador del control "Viaje tercerizado" (RN-HR-05, viajes-tercerizados-hoja-de-ruta design.md
// D6): conversión pura entre lo que muestra el formulario y la variante `TransporteRecorrido`.

import type { TransporteRecorrido } from '../../types/hojaDeRuta';

/** Borrador del control "Viaje tercerizado" (design.md D6). Destildado = recorrido propio. */
export interface BorradorTercerizado {
  tercerizado: boolean;
  tipo: 'aplicacion' | 'remis';
  agencia: string;
}

export const BORRADOR_TERCERIZADO_INICIAL: BorradorTercerizado = { tercerizado: false, tipo: 'aplicacion', agencia: '' };

/** Borrador a partir de un recorrido ya cargado (edición en RecorridoCard). */
export function borradorDesdeTransporte(transporte: TransporteRecorrido): BorradorTercerizado {
  switch (transporte.tipoTransporte) {
    case 'propio':
      return BORRADOR_TERCERIZADO_INICIAL;
    case 'aplicacion':
      return { tercerizado: true, tipo: 'aplicacion', agencia: '' };
    case 'remis':
      return { tercerizado: true, tipo: 'remis', agencia: transporte.agenciaRemis };
    default: {
      const exhaustivo: never = transporte;
      return exhaustivo;
    }
  }
}

/** Arma la variante del transporte: un tercerizado ignora vehículo/conductor (RN-HR-05). */
export function transporteDesdeBorrador(borrador: BorradorTercerizado, vehiculoId: string, conductorId: string): TransporteRecorrido {
  if (!borrador.tercerizado) return { tipoTransporte: 'propio', vehiculoId, conductorId };
  if (borrador.tipo === 'remis') return { tipoTransporte: 'remis', agenciaRemis: borrador.agencia.trim() };
  return { tipoTransporte: 'aplicacion' };
}
