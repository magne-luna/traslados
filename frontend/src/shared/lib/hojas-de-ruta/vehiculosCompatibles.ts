// Función pura (feedback de usuario, flujo pacientes-primero de FE-5): dado un grupo de
// pacientes ya elegido, devuelve qué vehículos disponibles le entran — combina capacidad y
// RN-VE-01 (accesorios) sobre TODO el grupo, no paciente por paciente. Sin efectos de red ni
// localStorage — testeable con valores fijos.

import type { AccesorioMovilidad } from '../../types/vehiculo';
import type { PacienteResumen } from '../../types/paciente';
import type { Vehiculo } from '../../types/vehiculo';
import { validarCompatibilidadAccesorio } from './validarCompatibilidadAccesorio';

/** Unión sin duplicados de los accesorios de movilidad que requiere el grupo de pacientes. */
export function accesoriosRequeridos(pacientes: PacienteResumen[]): AccesorioMovilidad[] {
  const vistos = new Set<AccesorioMovilidad>();
  const resultado: AccesorioMovilidad[] = [];
  for (const paciente of pacientes) {
    for (const accesorio of paciente.accesorioMovilidad) {
      if (!vistos.has(accesorio)) {
        vistos.add(accesorio);
        resultado.push(accesorio);
      }
    }
  }
  return resultado;
}

/**
 * Filtra `vehiculos` a los que tienen capacidad para todo el grupo y soportan la unión de
 * accesorios que requiere. Con `pacientes` vacío no hay nada que filtrar todavía: devuelve
 * `vehiculos` tal cual (el usuario todavía no eligió a nadie).
 */
export function vehiculosCompatibles(vehiculos: Vehiculo[], pacientes: PacienteResumen[]): Vehiculo[] {
  if (pacientes.length === 0) return vehiculos;

  const requeridos = accesoriosRequeridos(pacientes);
  return vehiculos.filter((vehiculo) => {
    if (vehiculo.capacidad < pacientes.length) return false;
    return validarCompatibilidadAccesorio({
      accesoriosPaciente: requeridos,
      accesoriosCompatiblesVehiculo: vehiculo.accesoriosCompatibles,
    }).ok;
  });
}
