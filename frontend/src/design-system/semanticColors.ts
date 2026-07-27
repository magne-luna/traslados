import type { SemanticStatus } from './tokens';

// Mapa cerrado (SemanticStatus tiene 5 valores fijos) de clases Tailwind estáticas por estado —
// resuelto por lookup, nunca por interpolación de string, para que Tailwind detecte las clases
// en build time (mismo criterio que bgClassName en Swatch, components.tsx).
//
// `borderSoft` (Decisión 2, design.md): la caja de error/alerta plana duplicada ~29 veces usa
// `border-danger-soft` (borde del mismo color que el fondo, se lee "sin borde"), no
// `border-danger` (borde fuerte, el que usan los Aviso* con barra de acento). Si `Alert` usara
// `border` para su variante plana, esas ~29 pantallas cambiarían de aspecto al migrar — viola la
// regla de oro de cero cambio visual. Los 5 tokens `--color-*-soft` ya existen en @theme
// (src/index.css), así que las 5 clases nuevas son válidas y estáticas.
export const chipColors: Record<
  SemanticStatus,
  { bg: string; fg: string; border: string; borderSoft: string; borderLeft: string }
> = {
  success: {
    bg: 'bg-success-soft',
    fg: 'text-success',
    border: 'border-success',
    borderSoft: 'border-success-soft',
    borderLeft: 'border-l-success',
  },
  warning: {
    bg: 'bg-warning-soft',
    fg: 'text-warning',
    border: 'border-warning',
    borderSoft: 'border-warning-soft',
    borderLeft: 'border-l-warning',
  },
  danger: {
    bg: 'bg-danger-soft',
    fg: 'text-danger',
    border: 'border-danger',
    borderSoft: 'border-danger-soft',
    borderLeft: 'border-l-danger',
  },
  info: {
    bg: 'bg-info-soft',
    fg: 'text-info',
    border: 'border-info',
    borderSoft: 'border-info-soft',
    borderLeft: 'border-l-info',
  },
  secondary: {
    bg: 'bg-surface-soft',
    fg: 'text-muted',
    border: 'border-muted',
    borderSoft: 'border-surface-soft',
    borderLeft: 'border-l-muted',
  },
};
