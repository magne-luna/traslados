import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from 'react';
import { InlineIcon } from './components';
import { iconFlechaAbajo } from './icons';

// Primitivos de campo de formulario (design.md Decisión 3). Reemplazan los `fieldClasses`/
// `labelClasses` locales duplicados 227 veces en 25 archivos.
//
// `Input`/`Select`/`Textarea` envuelven el elemento nativo y reenvían sus props (`value`,
// `onChange`, `type`, `min`, `placeholder`, `id`, `required`, `aria-*`, `disabled`, etc.) tal
// cual — la migración es "sacar `className={fieldClasses}`" y nada más. `className`/`style`
// están prohibidos por tipo: el estilo es del design system, nunca un escape hatch por call site
// (regla dura del proyecto + ui-design-system: extender con variantes, no reabrir className).
//
// `density`/`tone`/`placeholderTone` existen porque el repo hoy tiene ejes reales que difieren
// entre pantallas (Inventario de variantes, design.md) — no son capricho, son la regla de oro de
// cero cambio visual: cada pantalla migra conservando su valor actual, nunca un canónico
// impuesto. `invalid` es la única variante que ningún sitio activa todavía (Open Question 7):
// la capacidad queda disponible sin cambiar el aspecto de ningún campo en este change.
//
// Convención de id del error: `FieldError` recibe `id` y `Field` lo arma como
// `${htmlFor}-error`; `Input`/`Select`/`Textarea` con `invalid` e `id` arman el mismo string para
// `aria-describedby`. Así el cableado ARIA queda cerrado sin `cloneElement` ni children-as-function.
//
// Todas las clases son lookups estáticos (nunca interpolación de string en runtime) — mismo
// criterio que `chipColors`/`Swatch` en components.tsx: Tailwind solo genera CSS de clases que
// aparecen como texto literal.

export type FieldDensity = 'comfortable' | 'compact' | 'tight';
export type FieldTone = 'default' | 'muted';
export type PlaceholderTone = 'default' | 'faint';

// Spacing por densidad: se aplica siempre, con cualquier `tone`.
const densitySpacingClasses: Record<FieldDensity, string> = {
  comfortable: 'px-md py-2',
  compact: 'px-sm py-1.5',
  tight: 'px-sm py-1',
};

// Tipografía por densidad: solo aplica con tone='default'. Los 2 selects `tone='muted'`
// (NuevoRecorridoForm/RecorridoVehiculoConductor) hoy son `px-md py-2 text-muted` — sin
// `font-body` ni tamaño propio — así que 'muted' suprime esta parte en vez de sumarse a ella.
const densityTypographyClasses: Record<FieldDensity, string> = {
  comfortable: 'font-body text-[13px]',
  compact: 'font-body text-[13px]',
  tight: 'font-body text-xs',
};

const toneClasses: Record<FieldTone, string> = {
  default: 'text-text',
  muted: 'text-muted',
};

const placeholderToneClasses: Record<PlaceholderTone, string> = {
  default: '',
  faint: 'placeholder:text-faint',
};

const invalidClasses: Record<'true' | 'false', string> = {
  true: 'border-danger',
  false: '',
};

const CONTROL_BASE = 'rounded-sm border border-border-strong bg-surface';

// `<select>` nativo: mismo padding vertical/izquierdo que Input, pero con `pl`/`pr` explícitos
// (nunca `px`) para poder reservarle a la flecha un padding derecho propio (`pr-xl`) sin pisarse
// con el de la izquierda. `appearance-none` saca la flecha nativa (su distancia al borde varía
// por navegador/SO y es lo que la pegaba al borde) — la reemplazamos por el chevron de
// `InlineIcon` posicionado a mano en `Select`.
const selectPaddingClasses: Record<FieldDensity, string> = {
  comfortable: 'pl-md pr-xl py-2',
  compact: 'pl-sm pr-xl py-1.5',
  tight: 'pl-sm pr-xl py-1',
};

interface ControlVariantProps {
  /** Densidad de padding/tipografía. Default 'comfortable' (la mayoría de los sitios). */
  density?: FieldDensity;
  /**
   * 'muted' reproduce los 2 selects de NuevoRecorridoForm/RecorridoVehiculoConductor
   * (`px-md py-2 text-muted`, sin font-body ni tamaño propio). 'default' = `text-text`.
   */
  tone?: FieldTone;
  /** 'faint' reproduce DireccionesEditor/PersonasACargoEditor (`placeholder:text-faint`). */
  placeholderTone?: PlaceholderTone;
  /** Default true (w-full); false para los sitios que hoy no lo tienen. */
  fullWidth?: boolean;
  /**
   * Default false. Ningún sitio lo activa en este change (Open Question 7) — la capacidad
   * queda disponible sin cambiar el aspecto de ningún campo migrado.
   */
  invalid?: boolean;
}

function controlClassName({
  density = 'comfortable',
  tone = 'default',
  placeholderTone = 'default',
  fullWidth = true,
  invalid = false,
  forSelect = false,
}: ControlVariantProps & { forSelect?: boolean }): string {
  return [
    CONTROL_BASE,
    fullWidth ? 'w-full' : '',
    forSelect ? selectPaddingClasses[density] : densitySpacingClasses[density],
    forSelect ? 'appearance-none' : '',
    tone === 'default' ? densityTypographyClasses[density] : '',
    toneClasses[tone],
    placeholderToneClasses[placeholderTone],
    invalid ? invalidClasses.true : invalidClasses.false,
  ]
    .filter(Boolean)
    .join(' ');
}

function errorIdFor(id: string | undefined): string | undefined {
  return id ? `${id}-error` : undefined;
}

export type InputProps = Omit<ComponentPropsWithoutRef<'input'>, 'className' | 'style'> & ControlVariantProps;

export function Input({ density, tone, placeholderTone, fullWidth, invalid, id, ...rest }: InputProps): ReactElement {
  return (
    <input
      id={id}
      className={controlClassName({ density, tone, placeholderTone, fullWidth, invalid })}
      aria-invalid={invalid ? 'true' : undefined}
      aria-describedby={invalid ? errorIdFor(id) : undefined}
      {...rest}
    />
  );
}

export type SelectProps = Omit<ComponentPropsWithoutRef<'select'>, 'className' | 'style'> & ControlVariantProps;

export function Select({ density, tone, placeholderTone, fullWidth, invalid, id, children, ...rest }: SelectProps): ReactElement {
  return (
    <div className={`relative ${fullWidth === false ? '' : 'w-full'}`}>
      <select
        id={id}
        className={controlClassName({ density, tone, placeholderTone, fullWidth, invalid, forSelect: true })}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={invalid ? errorIdFor(id) : undefined}
        {...rest}
      >
        {children}
      </select>
      <span className="pointer-events-none absolute inset-y-0 right-sm flex items-center text-muted">
        <InlineIcon size={14}>{iconFlechaAbajo}</InlineIcon>
      </span>
    </div>
  );
}

export type TextareaProps = Omit<ComponentPropsWithoutRef<'textarea'>, 'className' | 'style'> & ControlVariantProps;

export function Textarea({ density, tone, placeholderTone, fullWidth, invalid, id, ...rest }: TextareaProps): ReactElement {
  return (
    <textarea
      id={id}
      className={controlClassName({ density, tone, placeholderTone, fullWidth, invalid })}
      aria-invalid={invalid ? 'true' : undefined}
      aria-describedby={invalid ? errorIdFor(id) : undefined}
      {...rest}
    />
  );
}

export function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }): ReactElement {
  return (
    <label htmlFor={htmlFor} className="font-body text-[12px] font-semibold text-muted">
      {children}
    </label>
  );
}

export function FieldError({ id, children }: { id: string; children: ReactNode }): ReactElement | null {
  if (!children) return null;
  return (
    <span id={id} className="font-body text-xs text-danger">
      {children}
    </span>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  /** undefined = sin error. */
  error?: string;
  /** Texto auxiliar opcional, debajo del control (no pisa el error cuando ambos están). */
  hint?: string;
  children: ReactNode;
}): ReactElement {
  return (
    <div className="flex flex-col gap-xs">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && (
        <span id={`${htmlFor}-hint`} className="font-body text-xs text-muted">
          {hint}
        </span>
      )}
      {error && <FieldError id={errorIdFor(htmlFor) as string}>{error}</FieldError>}
    </div>
  );
}
