// Lista declarativa de los ocho módulos del roadmap (Decisión 1 y 5 de
// openspec/changes/app-shell-navegacion/design.md): un único punto de verdad para el
// path, la etiqueta de navegación y el ícono de cada módulo. AppShell.tsx la recorre para
// construir la navegación, y router.tsx la recorre para montar las rutas placeholder.
// Cada FE-N reemplaza únicamente el `element` de su ruta en router.tsx — esta lista no cambia.
//
// Campo `modulo` (auth-frontend-real, design.md D4; permisos-modulos-granulares design.md D4,
// tasks.md 3.5): a qué módulo del backend corresponde cada ruta a efectos del guard de permisos
// (`RequireAuth`) — 8 rutas de frontend contra los 7 módulos reales seedeados (`pacientes`,
// `hojas_de_ruta`, `obra_social`, `facturacion`, `presupuestos`, `conductores`, `vehiculos`),
// cada ruta 1:1 con su propio módulo desde este change (antes 3 pares de rutas compartían módulo
// con otra: Vehículos con Conductores, Hojas de Ruta con Pacientes, Presupuestos con
// Facturación — ver supabase/migrations/20260730140000_split_modulos_permisos.sql). `null` =
// ruta declarada sin gate de módulo propio (solo requiere sesión activa) — el Dashboard es
// agregación pura sin tabla propia.

import type { Modulo } from '../shared/types/usuario';

export type IconKey =
  | 'dashboard'
  | 'obrasSociales'
  | 'vehiculos'
  | 'pacientes'
  | 'conductores'
  | 'presupuestos'
  | 'hojasDeRuta'
  | 'facturacion'
  | 'cuentas'
  | 'documentacionActividad';

export type NavSection = 'General' | 'Operación' | 'Administración';

/** Campos comunes de cualquier entrada de navegación del sidebar (AppShell.tsx, tasks.md 8.2).
 * `AppRoute` y `ADMIN_NAV_ROUTES` comparten esta forma para poder agruparse y renderizarse juntos
 * pese a tener criterios de visibilidad distintos (módulo vs. rol). */
export interface NavItem {
  path: string;
  label: string;
  icon: IconKey;
  section: NavSection;
}

export interface AppRoute extends NavItem {
  /** Módulo del backend requerido (nivel mínimo `read`) para acceder a esta ruta, o `null` si
   * la ruta no tiene módulo propio (ver design.md D4). */
  modulo: Modulo | null;
}

export const APP_ROUTES: readonly AppRoute[] = [
  { path: '/', label: 'Dashboard', icon: 'dashboard', section: 'General', modulo: null },
  { path: '/pacientes', label: 'Pacientes', icon: 'pacientes', section: 'Operación', modulo: 'pacientes' },
  {
    path: '/obras-sociales',
    label: 'Obras Sociales',
    icon: 'obrasSociales',
    section: 'Operación',
    modulo: 'obra_social',
  },
  { path: '/conductores', label: 'Conductores', icon: 'conductores', section: 'Operación', modulo: 'conductores' },
  {
    // Módulo propio 'vehiculos' desde permisos-modulos-granulares (antes agrupado bajo
    // 'conductores' — ver supabase/migrations/20260730140000_split_modulos_permisos.sql, que
    // reescribe la RLS de conductores.vehiculo/accesorios_vehiculo/documentacion_vehiculo/
    // mantenimiento/conductores_vehiculos para exigir tiene_permiso('vehiculos', ...)).
    path: '/vehiculos',
    label: 'Vehículos',
    icon: 'vehiculos',
    section: 'Operación',
    modulo: 'vehiculos',
  },
  {
    // Módulo propio 'hojas_de_ruta' desde permisos-modulos-granulares (antes agrupado bajo
    // 'pacientes' — ver supabase/migrations/20260730140000_split_modulos_permisos.sql, que
    // reescribe la RLS de pacientes.recorridos/historial_recorridos para exigir
    // tiene_permiso('hojas_de_ruta', ...)).
    path: '/hojas-de-ruta',
    label: 'Hojas de Ruta',
    icon: 'hojasDeRuta',
    section: 'Operación',
    modulo: 'hojas_de_ruta',
  },
  {
    // Módulo propio 'presupuestos' desde permisos-modulos-granulares (antes agrupado bajo
    // 'facturacion' — ver supabase/migrations/20260730140000_split_modulos_permisos.sql, que
    // reescribe la RLS de facturacion.presupuesto/autorizacion para exigir
    // tiene_permiso('presupuestos', ...)).
    path: '/presupuestos',
    label: 'Presupuestos',
    icon: 'presupuestos',
    section: 'Administración',
    modulo: 'presupuestos',
  },
  { path: '/facturacion', label: 'Facturación', icon: 'facturacion', section: 'Administración', modulo: 'facturacion' },
  {
    // documentos-checklist-items-por-actividad (tasks.md 5.2, design.md Checkpoint (a) sub-pregunta
    // /(d), veredictos 1.2/1.6): pantalla propia de administración, gateada por el módulo
    // `obra_social` (mismo módulo que gatea `requisitos_os`/`/obras-sociales` hoy) — NO por
    // `pacientes`, aunque la use la pantalla de Pacientes: quien administra checklists documentales
    // es el módulo obra_social, decidido explícitamente (no por descarte, precedente de
    // `integracion-documentos`: bucket `documentos-vehiculos` gateado por el módulo equivocado).
    path: '/documentacion-por-actividad',
    label: 'Documentación por Actividad',
    icon: 'documentacionActividad',
    section: 'Administración',
    modulo: 'obra_social',
  },
] as const;

// Rutas transversales que no forman parte de la navegación de módulos (no aparecen en el
// sidebar generado desde APP_ROUTES) pero sí necesitan resolver su módulo para el guard:
// /cuentas se gobierna por rol (ver `requiereRolAdmin` y route-guard spec), no por módulo;
// /design-system es la vitrina interna del design system.
const RUTAS_SIN_MODULO_PROPIO: ReadonlyArray<{ path: string; modulo: null }> = [
  { path: '/cuentas', modulo: null },
  { path: '/design-system', modulo: null },
];

const MODULO_POR_RUTA: Record<string, Modulo | null> = Object.fromEntries(
  [...APP_ROUTES, ...RUTAS_SIN_MODULO_PROPIO].map((route) => [route.path, route.modulo]),
);

/**
 * Resuelve el módulo del backend asociado a una ruta del frontend (design.md D4). Devuelve:
 * - `Modulo`: la ruta requiere al menos nivel `read` sobre ese módulo (ver `tienePermiso`).
 * - `null`: la ruta está declarada pero no requiere ningún módulo (solo sesión activa).
 * - `undefined`: la ruta no está declarada en ningún punto de verdad — el guard MUST tratar
 *   esto como **sin acceso**, nunca como "sin módulo": una ruta no reconocida no debe otorgar
 *   acceso implícito solo porque no matchea ninguna entrada conocida.
 */
export function moduloDeRuta(path: string): Modulo | null | undefined {
  return MODULO_POR_RUTA[path];
}

// /cuentas es la única ruta que exige además rol === 'admin' (design.md D4): no es un módulo,
// se gobierna por rol. Declarado acá, junto al resto del mapeo ruta→acceso, para que RequireAuth
// no tenga que hardcodear el path en otro archivo.
const RUTAS_SOLO_ADMIN = new Set<string>(['/cuentas']);

export function requiereRolAdmin(path: string): boolean {
  return RUTAS_SOLO_ADMIN.has(path);
}

// Entrada de navegación de /cuentas (design.md D4/D10, tasks.md 8.2): NO forma parte de
// APP_ROUTES a propósito — ese arreglo también alimenta el mapeo de placeholders de router.tsx,
// y /cuentas ya tiene su propia ruta `lazy` registrada ahí (tasks.md 7.9). Se gobierna por rol,
// no por módulo (modulo: null en RUTAS_SIN_MODULO_PROPIO de arriba), así que AppShell la muestra
// solo cuando `usuario.rol === 'admin'`, nunca vía `tienePermiso`.
export const ADMIN_NAV_ROUTES: readonly NavItem[] = [
  { path: '/cuentas', label: 'Cuentas', icon: 'cuentas', section: 'Administración' },
];
