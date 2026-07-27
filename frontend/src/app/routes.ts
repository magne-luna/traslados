// Lista declarativa de los ocho módulos del roadmap (Decisión 1 y 5 de
// openspec/changes/app-shell-navegacion/design.md): un único punto de verdad para el
// path, la etiqueta de navegación y el ícono de cada módulo. AppShell.tsx la recorre para
// construir la navegación, y router.tsx la recorre para montar las rutas placeholder.
// Cada FE-N reemplaza únicamente el `element` de su ruta en router.tsx — esta lista no cambia.

export type IconKey =
  | 'dashboard'
  | 'obrasSociales'
  | 'vehiculos'
  | 'pacientes'
  | 'conductores'
  | 'presupuestos'
  | 'hojasDeRuta'
  | 'facturacion';

export type NavSection = 'General' | 'Operación' | 'Administración';

export interface AppRoute {
  path: string;
  label: string;
  icon: IconKey;
  section: NavSection;
}

export const APP_ROUTES: readonly AppRoute[] = [
  { path: '/', label: 'Dashboard', icon: 'dashboard', section: 'General' },
  { path: '/pacientes', label: 'Pacientes', icon: 'pacientes', section: 'Operación' },
  { path: '/obras-sociales', label: 'Obras Sociales', icon: 'obrasSociales', section: 'Operación' },
  { path: '/conductores', label: 'Conductores', icon: 'conductores', section: 'Operación' },
  { path: '/vehiculos', label: 'Vehículos', icon: 'vehiculos', section: 'Operación' },
  { path: '/hojas-de-ruta', label: 'Hojas de Ruta', icon: 'hojasDeRuta', section: 'Operación' },
  { path: '/presupuestos', label: 'Presupuestos', icon: 'presupuestos', section: 'Administración' },
  { path: '/facturacion', label: 'Facturación', icon: 'facturacion', section: 'Administración' },
] as const;
