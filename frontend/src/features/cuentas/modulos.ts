import type { SemanticStatus } from '../../design-system/tokens';
import type { MapaPermisos, Modulo, NivelAcceso, Permiso } from '../../shared/types/usuario';

// Helpers compartidos por MatrizPermisos.tsx (edición) y CuentaForm.tsx (permisos iniciales de
// alta) — extraído en el REFACTOR de tasks.md 7.3 para no duplicar el mapeo módulo↔fila entre
// los dos componentes que arman un `Permiso[]` a partir de 4 <Select>.

// Los 4 módulos reales, en un orden estable (design.md D4/D9) — no Object.keys(permisos), que
// dependería de qué módulos tiene la cuenta y omitiría los que no tiene ninguna fila.
export const MODULOS: readonly Modulo[] = ['pacientes', 'obra_social', 'facturacion', 'conductores'];

export const ETIQUETA_MODULO: Record<Modulo, string> = {
  pacientes: 'Pacientes',
  obra_social: 'Obras Sociales',
  facturacion: 'Facturación',
  conductores: 'Conductores',
};

/** Nivel de una fila de la matriz, incluyendo la opción explícita "sin acceso" (design.md D9) —
 * `NivelAcceso` (el tipo de dominio) no la modela porque un módulo ausente de `MapaPermisos` ya
 * significa "sin acceso"; acá hace falta un valor de `<Select>` real para esa opción. */
export type NivelDeFila = NivelAcceso | 'sin_acceso';

export function mapaAFilas(permisos: MapaPermisos): Record<Modulo, NivelDeFila> {
  const filas = {} as Record<Modulo, NivelDeFila>;
  for (const modulo of MODULOS) {
    filas[modulo] = permisos[modulo] ?? 'sin_acceso';
  }
  return filas;
}

export function filasVacias(): Record<Modulo, NivelDeFila> {
  return mapaAFilas({});
}

export function filasAPermisos(filas: Record<Modulo, NivelDeFila>): Permiso[] {
  const permisos: Permiso[] = [];
  for (const modulo of MODULOS) {
    const nivel = filas[modulo];
    if (nivel !== 'sin_acceso') permisos.push({ modulo, nivelAcceso: nivel });
  }
  return permisos;
}

export function filasSonIguales(a: Record<Modulo, NivelDeFila>, b: Record<Modulo, NivelDeFila>): boolean {
  return MODULOS.every((modulo) => a[modulo] === b[modulo]);
}

/** Orden de los 3 niveles reales (excluye "sin_acceso", que no es una opción de nivel sino la
 * ausencia de fila) — jerarquía read < write < admin (design.md D5), usado para construir las
 * <option> del <Select> de cada módulo en PermisosMatrizFields. */
export const ORDEN_NIVELES: readonly NivelAcceso[] = ['read', 'write', 'admin'];

export const ETIQUETA_NIVEL: Record<NivelAcceso, string> = {
  read: 'Lectura',
  write: 'Escritura',
  admin: 'Administrador',
};

/** Aclaración de qué pantallas del sidebar (routes.ts) agrupa cada módulo — un módulo no es 1:1
 * con una pantalla: "pacientes" también gatea Hojas de Ruta, y "facturacion" también gatea
 * Presupuestos (ver moduloDeRuta() en app/routes.ts, alineado con la RLS real de cada tabla).
 * Lista solo nombres de pantalla tal como aparecen en el sidebar, sin detalle interno de tablas —
 * quien asigna el nivel de un módulo necesita reconocer qué va a habilitar, no el modelo de
 * datos. */
export const SUBMODULOS_MODULO: Record<Modulo, string> = {
  pacientes: 'Incluye Pacientes y Hojas de Ruta.',
  obra_social: 'Incluye Obras Sociales.',
  facturacion: 'Incluye Presupuestos y Facturación.',
  conductores: 'Incluye Conductores y Vehículos.',
};

/** Color de identidad de cada módulo — fijo por módulo, usado SOLO por el ícono de
 * PermisosMatrizFields (identifica qué módulo es cada fila del formulario, no su nivel de
 * acceso). Limitado a los 5 tonos de SemanticStatus (chipColors) — sin violeta disponible en el
 * design system, "Obras Sociales" usa `secondary` en vez del lila de la referencia visual del
 * cliente. */
export const MODULO_COLOR: Record<Modulo, SemanticStatus> = {
  pacientes: 'success',
  obra_social: 'secondary',
  facturacion: 'warning',
  conductores: 'info',
};

/** Color por NIVEL de acceso — usado por los Chips de módulo en CuentaDetail: el color comunica
 * qué tipo de permiso tiene la cuenta en ese módulo (jerarquía read < write < admin, design.md
 * D5), no qué módulo es. Rojo para "sin acceso" es intencional (mismo criterio que `danger` para
 * estados de alerta en el resto del design system) — hace evidente de un vistazo qué módulos NO
 * tiene habilitados esta cuenta. */
export const NIVEL_COLOR: Record<NivelDeFila, SemanticStatus> = {
  sin_acceso: 'danger',
  read: 'warning',
  write: 'info',
  admin: 'success',
};
