import type { ReactNode } from 'react';
import type { Modulo } from '../../shared/types/usuario';

// Mismos paths que app/navIcons.tsx (sidebar) para los 7 módulos reales (antes 4 — ver
// permisos-modulos-granulares) — duplicados acá en vez de importar de app/ (features no depende
// de app/, mismo criterio de set de íconos local por feature que features/hojas-de-ruta/icons.tsx).
// Se consumen con InlineIcon (design-system/components.tsx). Los 3 módulos nuevos reutilizan
// exactamente el mismo path que su módulo padre usaba antes en el sidebar, para que el ícono de
// identidad de la matriz de permisos siga coincidiendo con el ícono del ítem de navegación.
export const MODULO_ICON_PATH: Record<Modulo, ReactNode> = {
  pacientes: (
    <path
      d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm11 10v-2a4 4 0 0 0-3-3.87m-4-12a4 4 0 0 1 0 7.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  hojas_de_ruta: (
    <path d="M9 20 3 17V4l6 3 6-3 6 3v13l-6-3-6 3zM9 7v13m6-16v13" strokeLinecap="round" strokeLinejoin="round" />
  ),
  obra_social: (
    <>
      <rect x={2} y={5} width={20} height={14} rx={2} />
      <line x1={2} y1={10} x2={22} y2={10} />
      <line x1={6} y1={15} x2={10} y2={15} />
    </>
  ),
  facturacion: (
    <>
      <line x1={12} y1={1} x2={12} y2={23} />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  presupuestos: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="14 2 14 8 20 8" />
      <line x1={16} y1={13} x2={8} y2={13} />
      <line x1={16} y1={17} x2={8} y2={17} />
    </>
  ),
  conductores: (
    <>
      <circle cx={12} cy={8} r={4} />
      <path d="M4 21c0-3.5 3.5-6 8-6s8 2.5 8 6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  vehiculos: (
    <>
      <path
        d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={7} cy={17} r={2} />
      <path d="M9 17h6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={17} cy={17} r={2} />
    </>
  ),
};
