import type { ReactElement, ReactNode } from 'react';
import type { SemanticStatus } from './tokens';
import { chipColors } from './semanticColors';

// Alert (design.md Decisión 4): reemplaza la caja de error `role="alert"` duplicada ~29 veces
// (border-danger-soft bg-danger-soft … text-danger) y el molde `border-l-4` de AvisoModeloDatos/
// AvisoPendienteCliente/AlertaCupo. `emphasis='flat'` + `size='md'` (defaults) reproducen la caja
// de error actual byte a byte; `size='sm'` existe porque AsignacionPanel/VistaGlobalHojaDeRuta
// usan text-[12px] en vez de text-[13px] — inconsistencia real que se preserva (Open Question 5),
// no se unifica. `emphasis='accent'` reproduce el molde de los Aviso*. El `mb-md` que hoy traen
// los Aviso* hardcodeado NO va acá: un componente no decide su propio margen externo, lo pone el
// layout del caller (los wrappers Aviso* lo conservan).
export type AlertEmphasis = 'flat' | 'accent';
export type AlertSize = 'md' | 'sm';

const flatSizeTextClasses: Record<AlertSize, string> = {
  md: 'text-[13px]',
  sm: 'text-[12px]',
};

function defaultRole(tone: SemanticStatus): 'alert' | 'note' {
  return tone === 'danger' ? 'alert' : 'note';
}

export function Alert({
  tone,
  emphasis = 'flat',
  size = 'md',
  title,
  icon,
  role,
  children,
}: {
  tone: SemanticStatus;
  emphasis?: AlertEmphasis;
  size?: AlertSize;
  /** Prefijo en negrita dentro del mismo bloque (patrón Aviso*). */
  title?: string;
  /** Slot opcional a la izquierda. */
  icon?: ReactNode;
  /** Default: 'alert' si tone==='danger', si no 'note'. */
  role?: 'alert' | 'status' | 'note';
  children: ReactNode;
}): ReactElement {
  const c = chipColors[tone];
  const resolvedRole = role ?? defaultRole(tone);

  const className =
    emphasis === 'accent'
      ? `rounded-sm border ${c.border} border-l-4 ${c.borderLeft} ${c.bg} px-md py-sm font-body text-[12px] ${c.fg}`
      : `rounded-sm border ${c.borderSoft} ${c.bg} px-md py-sm font-body ${flatSizeTextClasses[size]} ${c.fg}`;

  return (
    <div role={resolvedRole} className={className}>
      {icon}
      {title && <span className="font-semibold">{title} </span>}
      {children}
    </div>
  );
}

// Pill (design.md Decisión 7): badge neutro (nombre de ítem de checklist, accesorio, contador
// "+N más") — deliberadamente distinto de Chip, que carga un SemanticStatus (comunica estado del
// negocio: vencido, al día, pendiente). Nadie debería usar Chip kind="secondary" como pill.
export function Pill({ emphasis = 'normal', children }: { emphasis?: 'normal' | 'strong'; children: ReactNode }): ReactElement {
  const strong = emphasis === 'strong';
  return (
    <span
      className={`rounded-pill bg-surface-soft px-md py-xs font-body text-[11px] text-muted${strong ? ' font-semibold' : ''}`}
    >
      {children}
    </span>
  );
}

// EmptyState (design.md Decisión 7): estado vacío explícito (frontend-ui-design compact rules)
// para listados sin datos, con acción opcional (típicamente un Button).
export function EmptyState({ message, action }: { message: string; action?: ReactNode }): ReactElement {
  return (
    <div className="flex flex-col items-start gap-md rounded-sm border border-border bg-surface-soft p-xl">
      <p className="m-0 font-body text-sm text-muted">{message}</p>
      {action}
    </div>
  );
}
