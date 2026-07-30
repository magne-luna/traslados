import { useContext } from 'react';
import { PuedeEscribirContext } from './PuedeEscribirContext';

// Hook público del mecanismo compartido de gateo de escritura (design.md D2, permisos-modulo-
// frontend spec, Requirement "Permiso de escritura derivado de la ruta activa"). Sin argumentos
// a propósito: el componente declara que necesita escritura, no contra qué módulo del backend —
// eso lo determina la ruta activa, resuelto una única vez en RequireAuth. Devuelve un primitivo,
// no un objeto (mismo criterio que usePermiso.ts: un objeto solo cuando se exponen más de dos
// valores).
//
// Fallback `true` fuera de un proveedor: mismo criterio que usePermiso() al no estar dentro de
// una sesión autenticada — no es una frontera de seguridad, así que fallar hacia "habilitado"
// significa "el servidor rechaza", no "se filtró un permiso". Es lo que mantiene verdes los ~190
// tests existentes (formularios montados de forma aislada, sin RequireAuth) sin editarlos.
export function usePuedeEscribir(): boolean {
  const value = useContext(PuedeEscribirContext);
  return value ?? true;
}
