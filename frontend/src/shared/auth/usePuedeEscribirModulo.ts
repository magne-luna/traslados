import { useContext } from 'react';
import { AuthContext } from './AuthContext';
import { tienePermiso } from '../lib/auth/permisos';
import type { Modulo } from '../types/usuario';

// Variante parametrizada de usePuedeEscribir (recorridos-habituales-paciente, RF-110): existe
// para el caso de gateo CRUZADO de módulo — una sección que vive en la pantalla de un módulo
// (Pacientes) pero cuya escritura real depende del permiso de OTRO módulo (Hojas de Ruta,
// porque `pacientes.recorridos` es la tabla que arma la hoja de ruta). usePuedeEscribir() no
// sirve acá: no acepta argumentos a propósito (design.md de gateo-obrasocial D1) porque se
// resuelve contra el módulo de la RUTA activa, que en esta pantalla es siempre `pacientes`.
//
// Lee `AuthContext` directo (useContext, no useAuth()) a propósito: useAuth() lanza fuera de un
// AuthProvider (Decisión 3 de AuthContext.tsx), lo que rompería cualquier test que monte esta
// sección de forma aislada (mismo caso que ~20 tests de PacienteDetail.test.tsx que hacen
// render() sin AuthProvider). Mismo criterio de "UX, no frontera de seguridad" que
// usePuedeEscribir/usePermiso: fuera de sesión autenticada, `true` — la RLS real
// (`modulos.tiene_permiso('hojas_de_ruta', 'write')`) es la que de verdad bloquea la escritura.
export function usePuedeEscribirModulo(modulo: Modulo): boolean {
  const estado = useContext(AuthContext);
  if (estado === null || estado.status !== 'authenticated') return true;
  return tienePermiso(estado.usuario.rol, estado.permisos, modulo, 'write');
}
