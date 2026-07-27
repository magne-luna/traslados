import type { FormEvent, ReactElement, ReactNode } from 'react';

// Card / CardForm / Panel (design.md Decisión 5): tres componentes chicos sobre la misma
// constante de clases interna, en vez de un Card polimórfico con `as` (tipos genéricos pesados +
// `...rest`, rompe la convención de props acotadas del repo). El contenedor aparece hoy sobre 3
// elementos no intercambiables: <div> (resúmenes de detalle), <form onSubmit> (los 6
// formularios) y <section aria-labelledby> + <h2> (los 4 paneles de dashboard).
//
// Los 5 ejes (radius/padding/gap/elevated/interactive) son variantes reales medidas en el repo,
// no un canónico impuesto (regla 2, design.md): `radius='sm'` en formularios/detalles/resúmenes
// vs `radius='md'` en las 4 tarjetas clickeables de listado (byte-idénticas entre sí) y en las
// sub-tarjetas anidadas; `gap-sm/md/lg/xl` conviven sobre el mismo contenedor. Fijar un valor
// único en cualquiera de los cinco cambiaría el aspecto de pantallas ya aprobadas.
export type CardGap = 'sm' | 'md' | 'lg' | 'xl';
export type CardRadius = 'sm' | 'md';
export type CardPadding = 'md' | 'lg';
// Corrección post-medición (apply, sección 9.5): el panel "Vista previa" del patrón
// "Configuración | Vista previa" (ChecklistEditor.tsx:113, PlantillaFacturaEditor.tsx:174) usa
// bg-surface-soft en vez de bg-surface — mismo contenedor, mismos ejes radius/padding/gap, solo
// el fondo difiere. Sin este eje, Card forzaría bg-surface a ambos paneles y cambiaría el
// aspecto del panel de vista previa (viola la regla de oro). Medido en 2 sitios reales.
export type CardBackground = 'surface' | 'surface-soft';

const gapClasses: Record<CardGap, string> = {
  sm: 'gap-sm',
  md: 'gap-md',
  lg: 'gap-lg',
  xl: 'gap-xl',
};

const radiusClasses: Record<CardRadius, string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
};

const paddingClasses: Record<CardPadding, string> = {
  md: 'p-md',
  lg: 'p-lg',
};

const CARD_BASE = 'flex flex-col border border-border';
const backgroundClasses: Record<CardBackground, string> = {
  surface: 'bg-surface',
  'surface-soft': 'bg-surface-soft',
};
const CARD_ELEVATED = 'shadow-sm';
// Copiado literal de las 4 tarjetas clickeables de listado (PacientesList/ObrasSocialesList/
// ConductoresList/PresupuestosList), byte-idénticas entre sí — hover:bg-surface-soft, no
// hover:bg-surface (medido por grep antes de fijar la clase).
const CARD_INTERACTIVE = 'cursor-pointer transition-colors hover:border-border-strong hover:bg-surface-soft';

interface CardVariantProps {
  radius?: CardRadius; // default 'sm'
  padding?: CardPadding; // default 'lg'
  gap?: CardGap; // default 'md'
  background?: CardBackground; // default 'surface'
  elevated?: boolean; // default false → agrega shadow-sm
  interactive?: boolean; // default false → agrega cursor-pointer + hover
}

function cardClassName({
  radius = 'sm',
  padding = 'lg',
  gap = 'md',
  background = 'surface',
  elevated = false,
  interactive = false,
}: CardVariantProps): string {
  return [
    CARD_BASE,
    backgroundClasses[background],
    radiusClasses[radius],
    paddingClasses[padding],
    gapClasses[gap],
    elevated ? CARD_ELEVATED : '',
    interactive ? CARD_INTERACTIVE : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export function Card({
  radius,
  padding,
  gap,
  background,
  elevated,
  interactive,
  onClick,
  children,
}: CardVariantProps & { onClick?: () => void; children: ReactNode }): ReactElement {
  return (
    <div className={cardClassName({ radius, padding, gap, background, elevated, interactive })} onClick={interactive ? onClick : undefined}>
      {children}
    </div>
  );
}

export function CardForm({
  onSubmit,
  radius,
  padding,
  gap,
  elevated,
  children,
}: CardVariantProps & {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: ReactNode;
}): ReactElement {
  return (
    <form onSubmit={onSubmit} className={cardClassName({ radius, padding, gap, elevated })}>
      {children}
    </form>
  );
}

export function Panel({
  title,
  titleId,
  action,
  gap,
  elevated = true,
  children,
}: {
  title: string;
  titleId: string;
  /** Slot a la derecha del título — mismo contrato que Section.action (components.tsx). */
  action?: ReactNode;
  gap?: CardGap;
  /** Default true — los 4 paneles de dashboard hoy llevan shadow-sm. */
  elevated?: boolean;
  children: ReactNode;
}): ReactElement {
  return (
    <section aria-labelledby={titleId} className={cardClassName({ radius: 'sm', padding: 'lg', gap, elevated })}>
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <h2 id={titleId} className="m-0 font-heading text-[18px] font-bold text-ink">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
