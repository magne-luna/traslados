// Tipo de transporte del recorrido (RN-HR-05, change viajes-tercerizados-hoja-de-ruta, design.md
// D4). Un único lugar para la etiqueta visible, el type guard y la validación: tarjeta, vista
// global, imprimible y dashboard usan esto en vez de armar "patente · conductor" cada uno.

import type { TransporteRecorrido } from '../../types/hojaDeRuta';

export const ETIQUETA_APLICACION = 'Uber / aplicación';

interface VehiculoEtiqueta {
  id: string;
  patente: string;
  modelo: string;
}

interface ConductorEtiqueta {
  id: string;
  apellido: string;
  nombre: string;
}

/** Type guard: solo un recorrido `propio` tiene vehículo y conductor (capacidad, accesorios y
 *  sugerencias solo tienen sentido para él). */
export function esPropio<T extends TransporteRecorrido>(transporte: T): transporte is Extract<T, { tipoTransporte: 'propio' }> {
  return transporte.tipoTransporte === 'propio';
}

/** Etiqueta de un tercerizado ("Uber / aplicación" / "Remis · París"), o `null` si es propio. */
export function etiquetaTercerizado(transporte: TransporteRecorrido): string | null {
  switch (transporte.tipoTransporte) {
    case 'propio':
      return null;
    case 'aplicacion':
      return ETIQUETA_APLICACION;
    case 'remis':
      return `Remis · ${transporte.agenciaRemis}`;
    default: {
      const exhaustivo: never = transporte;
      return exhaustivo;
    }
  }
}

/** "patente · modelo — Apellido, Nombre" para un propio; "Uber / aplicación" o "Remis · <agencia>"
 *  para un tercerizado. Nunca un id crudo. */
export function etiquetaTransporte(
  transporte: TransporteRecorrido,
  vehiculos: readonly VehiculoEtiqueta[],
  conductores: readonly ConductorEtiqueta[],
): string {
  if (transporte.tipoTransporte !== 'propio') return etiquetaTercerizado(transporte) ?? '';
  const vehiculo = vehiculos.find((v) => v.id === transporte.vehiculoId);
  const conductor = conductores.find((c) => c.id === transporte.conductorId);
  const textoVehiculo = vehiculo ? `${vehiculo.patente} · ${vehiculo.modelo}` : 'Vehículo desconocido';
  const textoConductor = conductor ? `${conductor.apellido}, ${conductor.nombre}` : 'Conductor desconocido';
  return `${textoVehiculo} — ${textoConductor}`;
}

/** Espejo en el cliente de la CHECK `recorrido_tipo_transporte_coherente`: mensaje en castellano o
 *  `null` si el transporte es válido. */
export function validarTransporte(transporte: TransporteRecorrido): string | null {
  switch (transporte.tipoTransporte) {
    case 'propio':
      if (transporte.vehiculoId === '') return 'Elegí un vehículo.';
      if (transporte.conductorId === '') return 'Elegí un conductor.';
      return null;
    case 'aplicacion':
      return null;
    case 'remis':
      return transporte.agenciaRemis.trim() === '' ? 'Escribí el nombre de la agencia de remis.' : null;
    default: {
      const exhaustivo: never = transporte;
      return exhaustivo;
    }
  }
}
