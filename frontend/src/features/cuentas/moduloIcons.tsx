import type { ReactNode } from 'react';
import type { Modulo } from '../../shared/types/usuario';

// Mismos paths que app/navIcons.tsx (sidebar) para los 4 módulos reales — duplicados acá en vez de
// importar de app/ (features no depende de app/, mismo criterio de set de íconos local por feature
// que features/hojas-de-ruta/icons.tsx). Se consumen con InlineIcon (design-system/components.tsx).
export const MODULO_ICON_PATH: Record<Modulo, ReactNode> = {
  pacientes: (
    <path
      d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm11 10v-2a4 4 0 0 0-3-3.87m-4-12a4 4 0 0 1 0 7.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
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
  conductores: (
    <>
      <circle cx={12} cy={8} r={4} />
      <path d="M4 21c0-3.5 3.5-6 8-6s8 2.5 8 6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};
