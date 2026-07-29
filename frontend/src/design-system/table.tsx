import type { ReactElement, ReactNode } from 'react';

// Table / Tr / Th / Td (design.md Decisión 6): primitivos de ESTILO, no una data-table
// configurable por columnas — las 4 tablas del repo tienen semántica distinta entre sí
// (`scope="row"` en la primera columna, columnas numéricas con `tabular-nums`, `caption` sr-only,
// celdas con contenido arbitrario). `<thead>`/`<tbody>`/`<tfoot>` siguen siendo nativos del
// caller: no se envuelven, no aportan estilo y envolverlos solo agregaría indirección.
//
// `caption` obligatorio y sr-only es la única mejora de accesibilidad que entra en este change
// (regla de oro, design.md): no cambia nada visualmente, hoy solo 1 de 4 tablas lo tiene.
// `minWidth` es variante cerrada, no un número: `min-w-[${n}px]` no lo genera Tailwind en build
// time (mismo motivo que PROGRESS_WIDTH_CLASSES en components.tsx) — se escribe a mano.
export type CellAlign = 'left' | 'right' | 'center';
// 'xl' = min-w-120 (apply, sección 17): `FacturadoVsCobradoPanel.tsx` es la única tabla real que
// usa ese ancho — no hay valor exacto entre 'md' (105) y 'lg' (150) que lo reproduzca, y usar
// cualquiera de los dos movería el punto de scroll horizontal en viewports intermedios (viola
// REGLA 0). Medido en el único sitio real que lo necesita, mismo criterio que `CellPadding`.
export type TableMinWidth = 'none' | 'md' | 'lg' | 'xl';
// Corrección post-medición (apply, sección 10.2): `GastosVehiculo.tsx` es la 4ta tabla real del
// repo y su convención de celda difiere de la de `ResumenAnualPanel` (en la que se midió el Th/Td
// original) — `px-md` en vez de `px-sm`, y cada celda (thead y tbody) lleva su propio
// `border-b border-border` en vez de un único `border-t` en la fila de `tbody` (que es lo que
// resuelve `Tr divided`). Sin este eje, `Th`/`Td` forzarían el padding/borde de
// `ResumenAnualPanel` a `GastosVehiculo` y cambiarían su aspecto — viola la regla de oro. Medido
// en el único sitio real que lo usa.
export type CellPadding = 'sm' | 'md';

const alignClasses: Record<CellAlign, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

const minWidthClasses: Record<TableMinWidth, string> = {
  none: '',
  md: 'min-w-105',
  lg: 'min-w-150',
  xl: 'min-w-120',
};

const thPaddingClasses: Record<CellPadding, string> = {
  sm: 'px-sm py-xs',
  md: 'px-md py-xs',
};

// `ThWeight` (apply, sección 17): la celda `scope="row"` del mes en `ResumenAnualPanel.tsx` y
// `FacturadoVsCobradoPanel.tsx` trae `font-medium` en el original; ningún eje existente de `Th`
// lo reproducía. Lookup estático de 2 entradas, misma convención que `CellAlign`/`CellPadding`.
export type ThWeight = 'normal' | 'medium';

const thWeightClasses: Record<ThWeight, string> = {
  normal: '',
  medium: 'font-medium',
};

const tdPaddingClasses: Record<CellPadding, string> = {
  sm: 'px-sm py-xs',
  md: 'px-md py-sm',
};

// Literal de GastosVehiculo.tsx (border-b border-border en cada celda, thead y tbody).
const CELL_DIVIDED = 'border-b border-border';
// Literal del header de GastosVehiculo.tsx: 12px semibold muted, en vez de heredar el 13px/text
// normal que pone la base de `Table`.
const TH_MUTED = 'font-body text-[12px] font-semibold text-muted';

export function Table({
  caption,
  minWidth = 'none',
  scrollable = true,
  children,
}: {
  /** Obligatorio, se renderiza sr-only — hoy solo 1 de 4 tablas lo tiene. */
  caption: string;
  minWidth?: TableMinWidth;
  /** Default true. false para los sitios donde envolver en overflow-x-auto cambiaría lo que se ve. */
  scrollable?: boolean;
  /** <thead>/<tbody>/<tfoot> nativos del caller. */
  children: ReactNode;
}): ReactElement {
  const table = (
    <table className={['w-full', minWidthClasses[minWidth], 'border-collapse font-body text-[13px] text-text'].filter(Boolean).join(' ')}>
      <caption className="sr-only">{caption}</caption>
      {children}
    </table>
  );

  return scrollable ? <div className="overflow-x-auto">{table}</div> : table;
}

// `TrEmphasis` (apply, sección 17): la fila de `tfoot` ("Total del rango",
// `FacturadoVsCobradoPanel.tsx`) necesita `border-t-2 border-border-strong font-semibold`, que
// `divided` no reproduce (`divided` es `border-t border-border`, un borde de 1px sin negrita).
// Lookup estático de string-literal (misma convención que el resto del módulo), no interpolación.
export type TrEmphasis = 'total';

const trEmphasisClasses: Record<TrEmphasis, string> = {
  total: 'border-t-2 border-border-strong font-semibold',
};

// `interactive` (cuentas-gestion, tasks.md 7.2): "fila 100% clickeable, como el resto de la app"
// — mismo criterio de click-por-conveniencia-de-mouse que `Card interactive` (./layout.tsx): el
// `onClick` en el `<tr>` es un atajo de mouse, no la vía de accesibilidad; la fila NO toma
// `role="button"`/`tabIndex` (un `<tr>` no es semánticamente un botón) — la operación por teclado
// la resuelve un control real dentro de la fila (ver CuentasList.tsx, que pone el nombre como
// `<button>`), exactamente como las Card interactive de listado resuelven su "Ver detalle".
const TR_INTERACTIVE_CLASSES = 'cursor-pointer transition-colors hover:bg-surface-soft';

export function Tr({
  divided,
  emphasis,
  interactive,
  onClick,
  children,
}: {
  divided?: boolean;
  /** 'total' — borde superior de 2px + negrita, fila de cierre en `tfoot`. */
  emphasis?: TrEmphasis;
  /** Default false. Agrega `cursor-pointer`/hover y cablea `onClick` sobre el `<tr>`. */
  interactive?: boolean;
  /** Solo se cablea cuando `interactive` es true (evita filas "clickeables" por accidente). */
  onClick?: () => void;
  children: ReactNode;
}): ReactElement {
  const className =
    [emphasis ? trEmphasisClasses[emphasis] : divided ? 'border-t border-border' : '', interactive ? TR_INTERACTIVE_CLASSES : '']
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <tr className={className} onClick={interactive ? onClick : undefined}>
      {children}
    </tr>
  );
}

export function Th({
  scope,
  align,
  numeric,
  padding = 'sm',
  divided,
  muted,
  weight = 'normal',
  children,
}: {
  /** Obligatorio: es exactamente el atributo que un Th no debe poder olvidarse. */
  scope: 'col' | 'row';
  align?: CellAlign;
  numeric?: boolean;
  /** 'sm' (default, `px-sm py-xs`, `ResumenAnualPanel`/`FacturadoVsCobradoPanel`) | 'md' (`px-md py-xs`, `GastosVehiculo`). */
  padding?: CellPadding;
  /** `border-b border-border` — `GastosVehiculo` divide con línea inferior en cada celda en vez de `Tr divided`. */
  divided?: boolean;
  /** 12px semibold muted — header de `GastosVehiculo`, no el tamaño heredado de `Table`. */
  muted?: boolean;
  /** 'normal' (default) | 'medium' (`font-medium`) — celda `scope="row"` del mes en `ResumenAnualPanel`/`FacturadoVsCobradoPanel`. */
  weight?: ThWeight;
  children: ReactNode;
}): ReactElement {
  return (
    <th
      scope={scope}
      className={[
        thPaddingClasses[padding],
        align ? alignClasses[align] : '',
        numeric ? 'tabular-nums' : '',
        divided ? CELL_DIVIDED : '',
        muted ? TH_MUTED : '',
        thWeightClasses[weight],
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </th>
  );
}

export function Td({
  align,
  numeric,
  padding = 'sm',
  divided,
  children,
}: {
  align?: CellAlign;
  numeric?: boolean;
  /** 'sm' (default, `px-sm py-xs`) | 'md' (`px-md py-sm`, `GastosVehiculo`). */
  padding?: CellPadding;
  /** `border-b border-border` — `GastosVehiculo`. */
  divided?: boolean;
  children: ReactNode;
}): ReactElement {
  return (
    <td
      className={[
        tdPaddingClasses[padding],
        align ? alignClasses[align] : '',
        numeric ? 'tabular-nums' : '',
        divided ? CELL_DIVIDED : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </td>
  );
}
