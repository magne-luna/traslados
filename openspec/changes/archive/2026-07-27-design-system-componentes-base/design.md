## Context

El design system vive en `frontend/src/design-system/` y hoy es un solo módulo de componentes (`components.tsx`, ~300 líneas) más `tokens.ts` (que ya solo conserva el tipo `SemanticStatus`, porque los valores se mudaron a `@theme` de `index.css`), `icons.tsx` y `DesignSystem.tsx` (catálogo visual navegable).

Los primitivos existentes ya fijaron un **lenguaje de estilo y una convención de API** que este change extiende, no reemplaza:

| Convención establecida | Dónde se ve hoy |
|---|---|
| Variante = union de string literal + `Record<Variante, string>` de clases estáticas | `ButtonVariant` + `buttonVariantClasses`; `chipColors`; `sectionBadgeToneClasses`; `PROGRESS_BG_CLASSES` |
| **Nunca** interpolar clases Tailwind en runtime (el scanner no las ve en build) | comentado explícitamente en `Swatch`, `chipColors` y `PROGRESS_WIDTH_CLASSES` |
| Props explícitas y acotadas, sin spread de `...rest` ni `className` como escape hatch | `Button`, `Chip`, `Section`, `SearchInput` |
| Superficie: `rounded-sm` + `border border-border` + `bg-surface`; radio de píldora `rounded-pill` | `SearchInput`, tarjetas de features |
| Tipografía: `font-body text-[13px]` cuerpo, `text-[12px]` label, `text-[11px]` metadato, `font-heading … font-bold text-ink` títulos | `Section`, `Button`, `Chip`, `Swatch` |
| Spacing: `px-md py-sm` en cajas, `px-lg py-[9px]` en botones, `p-lg` en tarjetas, `gap-xs/sm/md/lg` | todos |
| Comentario de cabecera explicando **por qué** existe el componente y qué duplicación mata | `VolverAlListadoLink`, `SearchInput`, `RecorridoStat`, `formFieldClasses.ts` |

**Restricciones duras del proyecto** (`CLAUDE.md`, no negociables): TypeScript strict, prohibido `any` (usar `unknown` + narrowing); estilar **solo** con clases utilitarias de Tailwind v4, prohibido `style={{}}` inline; verificar tipos con `npx tsc -b --noEmit` dentro de `frontend/` (nunca `tsc --noEmit` a secas — con el `tsconfig.json` de project references compila cero archivos y siempre da 0 errores); Conventional Commits.

**Restricción de skills** (compact rules inyectadas): jerarquía atómica (átomos → moléculas → organismos); sin barrel exports; sin prop drilling > 2 niveles; testear comportamiento, no implementación; WCAG 2.1 AA de piso (HTML semántico antes que ARIA, focus visible, contraste 4.5:1); estados de loading/error/empty explícitos; extender componentes existentes con variantes en vez de crear one-offs paralelos; nunca `!important`; nunca tokens primitivos crudos en componentes (siempre las clases semánticas de `index.css`).

### ⛔ Regla de oro de este change — CERO CAMBIO VISUAL

> Instrucción textual del usuario: **"los componentes y pantallas quiero que queden tal cual están ahora. Tenés que ajustar y crear los componentes pero que no cambien nada del diseño actual."**

Esto es una restricción dura, no una preferencia, y es lo primero que tiene que leer quien implemente. Las 5 reglas operativas:

1. **Reproducción exacta.** Cada componente nuevo emite las mismas clases Tailwind que hoy están en el sitio que reemplaza. Ni una clase de más, ni una de menos, ni una cambiada. No se "mejora", no se normaliza, no se corrige.
2. **Toda variante real se preserva vía prop.** Donde el mismo patrón hoy difiere entre pantallas, el primitivo expone ese eje como variante cerrada y cada pantalla conserva su valor actual. **Prohibido** elegir un valor "canónico" y aplicarlo a todos. El inventario medido de variantes está abajo y es normativo.
3. **No se inventan props.** Solo entran props que (a) existen ya en algún sitio real, o (b) son estrictamente necesarias para que la migración sea posible sin cambio visual — y en ese caso con el estilo literal que el sitio ya tiene (ej. `disabled:cursor-not-allowed disabled:opacity-40`, copiado de `ParadasList.tsx`, no inventado).
4. **Se constata, no se asume.** Cada migración se valida comparando las clases finales aplicadas contra las previas (snapshot de `className` o revisión visual lado a lado).
5. **Si consolidar exigiera cambio visual, no se consolida.** Va a §"Casos que requerirían cambio visual" y a `tasks.md` como opcional pendiente de aprobación del usuario. Nunca silenciosamente.

**Base de diseño: el design system actual, no `docs/design/prototype.html`** (preferencia previa del usuario, engram obs #726). `prototype.html` es catálogo conceptual de qué patrones existen; nunca fuente de CSS. Consecuencia práctica: donde el estilo actual y el "canónico" difieren, gana el actual — por eso existe `chipColors.borderSoft` (Decisión 2).

## Goals / Non-Goals

**Goals**
- Una única fuente de verdad **de código** para campo de formulario, alerta, tarjeta, tabla, badge neutro y estado vacío — sin que eso implique una única fuente de verdad *visual* (las variantes actuales sobreviven).
- Migración de las ~35 pantallas duplicadas **sin ningún cambio visual ni de comportamiento observable** (los tests existentes son el contrato y no se tocan).
- API consistente con `Button`/`Chip`/`Section`: variantes cerradas por lookup estático, props acotadas, sin `className` público.
- Dejar **documentadas** las inconsistencias visuales que la extracción saca a la luz, para que unificarlas sea después una decisión deliberada del usuario y de una línea.

**Non-Goals**
- **Rediseñar o unificar nada.** Si algo se ve distinto después de migrar, es un bug de la migración, no una mejora.
- Homogeneizar las inconsistencias detectadas (`text-[12px]` vs `text-[13px]` en cajas de error, `gap-sm/md/lg/xl` en tarjetas, `rounded-sm` vs `rounded-md`). Se detectan, se anotan, se preservan.
- Mejorar accesibilidad más allá de lo que sea invisible. `caption sr-only` obligatorio en `Table` entra porque **no cambia nada visualmente**; cualquier mejora con impacto visual (focus rings nuevos, asteriscos de requerido) queda afuera.
- Componentes sin uso real hoy (`Modal`, `Tabs`, `Tooltip`, `Toast`, `Drawer`).
- `loading` en `Button` (ningún sitio lo usa hoy → regla 3).
- Dependencias nuevas (`cva`, `clsx`, `tailwind-merge`, `headlessui`, `shadcn`). El lookup estático ya resuelve variantes sin runtime extra.
- Tocar `@theme` de `index.css`.

## Inventario de variantes reales (medido — normativo)

Relevado por grep sobre `frontend/src` antes de diseñar la API. **Este inventario es el que define qué props existen.** Cada fila que aparece acá tiene que seguir siendo renderizable después del refactor, en el mismo sitio en que está hoy.

**Control de formulario** (`border border-border-strong bg-surface`, `rounded-sm`):

| Clases de densidad/tipografía | Sitios | Variante que lo cubre |
|---|---|---|
| `px-md py-2 font-body text-[13px] text-text` | ~20 (mayoría: los 6 forms, editores, `formFieldClasses.ts`) | `density='comfortable'` (default) |
| `px-sm py-1.5 font-body text-[13px] text-text` | `PlantillaCampoRow` ×2 | `density='compact'` |
| `px-sm py-1 font-body text-xs text-text` | `FacturaCobrosSection` | `density='tight'` |
| `px-sm py-1 font-body text-[12px]` (sin color de texto) | `VistaGlobalHojaDeRuta` | `density='tight'` + verificar el color heredado |
| `… + placeholder:text-faint` | `DireccionesEditor`, `PersonasACargoEditor` | `placeholderTone='faint'` |
| `px-md py-2 text-muted` (sin `font-body`/tamaño) | `NuevoRecorridoForm`, `RecorridoVehiculoConductor` | `tone='muted'` (2 sitios idénticos entre sí) |
| `px-md py-2 font-mono text-[16px] font-bold tracking-wide text-ink` | `CudFields` ×1 | **NO se migra** — ver §Casos límite |
| `py-2 pl-xl pr-md font-body text-[13px] text-text` | `AutorizacionForm` ×1 (campo con prefijo `$`) | **NO se migra** — ver §Casos límite |

**Caja de alerta/error:**

| Clases | Sitios | Variante |
|---|---|---|
| `rounded-sm border border-danger-soft bg-danger-soft px-md py-sm font-body text-[13px] text-danger` | ~25 | `emphasis='flat'` + `size='md'` (default) |
| idem con `text-[12px]` | `AsignacionPanel`, `VistaGlobalHojaDeRuta` | `emphasis='flat'` + `size='sm'` |
| `border {tono} border-l-4 {tonoLeft} {bg} px-md py-sm text-[12px]` | `AvisoModeloDatos`, `AvisoPendienteCliente` (+ `AlertaCupo`, `FacturaCobrosSection` a mano) | `emphasis='accent'` |
| `<p role="alert" class="m-0 font-body text-sm text-danger">` (sin caja) | `RecorridoVehiculoConductor` | **NO se migra** — no es el patrón de caja |
| `<span class="font-body text-xs text-danger">` (error inline de campo) | 53 en 34 archivos | `FieldError` |

**Contenedor tipo tarjeta** (`border border-border bg-surface`):

| Clases | Sitios | Variante |
|---|---|---|
| `rounded-sm … p-lg` + `flex flex-col gap-{sm\|md\|lg\|xl}` | ~15 (forms, detalles, resúmenes, editores) | `radius='sm'` + `gap` |
| `rounded-sm … p-lg shadow-sm` + `<section aria-labelledby>` | 4 paneles de dashboard | `Panel` (`elevated` default `true`) |
| `rounded-md … p-lg shadow-sm cursor-pointer transition-colors hover:border-border-strong hover:bg-surface-soft` | 6 tarjetas clickeables (`PacientesList`, `ObrasSocialesList`, `ConductoresList`, `PresupuestosList`, `VehiculosList`, `FacturasList`) — **idénticas entre sí** (corregido post-medición: `hover:bg-surface-soft`, no `hover:bg-surface`) | `radius='md'` + `elevated` + `interactive` |
| `bg-surface-soft` en vez de `bg-surface` (mismo `radius`/`padding`/`gap` que el resto) | Panel "Vista previa" de `ChecklistEditor.tsx:113`, `PlantillaFacturaEditor.tsx:174` | `background='surface-soft'` (agregado post-medición, apply sección 9.5) |
| `rounded-md …` sub-tarjeta anidada (padding propio) | `DireccionesEditor` ×2, `PersonasACargoEditor` ×2, `DocumentChecklist`, `AsignacionSemanalTabla` | `radius='md'` + `padding` |
| `rounded-lg …` | `LoginPage`, `DesignSystem` | **fuera de alcance** (no es duplicación de features) |

**Mini botón secundario** (patrón que hoy `Button` no cubre):

| Clases | Sitios |
|---|---|
| `cursor-pointer rounded-sm border border-border-strong bg-surface px-md py-xs font-body text-xs font-semibold text-primary` | `PacientesList`, `ObrasSocialesList`, `ConductoresList`, `PresupuestosList`, `FacturasList` |
| idem + `disabled:cursor-not-allowed disabled:opacity-40` | `DocumentChecklist` ×2 |
| idem con `px-sm` + `disabled:…` | `ParadasList` ×2 |
| `… px-xs py-xs disabled:…` (sin `font-body`/tamaño/color) | `ChecklistItemRow` ×2, `PlantillaCampoRow` ×2 → **NO se migran**, ver §Casos límite |
| `border-danger-soft bg-danger-soft px-sm py-xs text-xs font-semibold text-danger` | `ParadasList` ×1 → **NO se migra**, ver §Casos límite |

## Estructura de archivos

```
frontend/src/design-system/
├── tokens.ts            (sin cambios — solo el tipo SemanticStatus)
├── semanticColors.ts    NUEVO — chipColors (movido) + clave borderSoft
├── components.tsx       MODIFICADO — re-exporta chipColors; Aviso* pasan a usar Alert;
│                                     Button gana size/disabled/'secondary-accent' (Decisión 8)
├── form.tsx             NUEVO — Label, Input, Select, Textarea, FieldError, Field
├── feedback.tsx         NUEVO — Alert, EmptyState, Pill
├── layout.tsx           NUEVO — Card, CardForm, Panel
├── table.tsx            NUEVO — Table, Tr, Th, Td
├── icons.tsx            (sin cambios)
└── DesignSystem.tsx     MODIFICADO — catálogo de lo nuevo
```

**Sin `index.ts` barrel** (regla `senior-frontend`: rompe tree-shaking). Cada feature importa del módulo específico: `import { Input, Field } from '../../design-system/form'`.

`components.tsx` no se convierte en un archivo de 700 líneas: se parte por dominio funcional. Los primitivos que ya están ahí **no se mueven** (mover `Button`/`Chip`/`Section` obligaría a tocar los imports de ~40 archivos por cero beneficio).

## Decisiones

### Decisión 1 — `chipColors` se muda a `semanticColors.ts` (y `components.tsx` lo re-exporta)

`feedback.tsx` necesita `chipColors` y `components.tsx` (por `AvisoModeloDatos`) necesita `Alert` → import circular entre módulos. Se rompe extrayendo el lookup, que no tiene JSX, a `semanticColors.ts`. `components.tsx` mantiene `export { chipColors } from './semanticColors'` para no tocar a sus 5 consumidores actuales (`DocumentChecklist`, `VehiculoMantenimiento`, `anchoBarraClases`, `AlertaCupo`, `DesignSystem`).

### Decisión 2 — `chipColors` gana la clave `borderSoft` (y `Alert` plano la usa)

La caja de error duplicada 29 veces usa `border-danger-soft` (borde del mismo color que el fondo → se lee sin borde). `chipColors.border` es `border-danger` (borde fuerte, el que usan los `Aviso*` con barra de acento). Si `Alert` usara `border`, las 29 pantallas migradas **cambiarían de aspecto** — violando la regla de oro. Por eso el lookup crece a 5 claves:

```ts
export const chipColors: Record<SemanticStatus, {
  bg: string; fg: string; border: string; borderSoft: string; borderLeft: string;
}> = {
  success:   { bg: 'bg-success-soft', fg: 'text-success', border: 'border-success', borderSoft: 'border-success-soft', borderLeft: 'border-l-success' },
  warning:   { bg: 'bg-warning-soft', fg: 'text-warning', border: 'border-warning', borderSoft: 'border-warning-soft', borderLeft: 'border-l-warning' },
  danger:    { bg: 'bg-danger-soft',  fg: 'text-danger',  border: 'border-danger',  borderSoft: 'border-danger-soft',  borderLeft: 'border-l-danger'  },
  info:      { bg: 'bg-info-soft',    fg: 'text-info',    border: 'border-info',    borderSoft: 'border-info-soft',    borderLeft: 'border-l-info'    },
  secondary: { bg: 'bg-surface-soft', fg: 'text-muted',   border: 'border-muted',   borderSoft: 'border-surface-soft', borderLeft: 'border-l-muted'   },
};
```

Los 5 tokens `--color-*-soft` ya existen en `@theme`, así que las 5 clases nuevas son válidas y estáticas (el scanner las ve).

### Decisión 3 — Campos: átomos que envuelven el elemento nativo + molécula `Field` opcional

Los 227 usos se reparten en dos formas: (a) el bloque completo label + control + error dentro de un `flex flex-col gap-xs` (formularios), y (b) un `<input>`/`<select>` **suelto** dentro de una celda de tabla o una fila de editor (`AsignacionSemanalTabla`, `AsistenciasEditor`, `GastosVehiculo`, `FacturasList`, el selector de año de `ResumenAnualPanel`). Una sola molécula gorda no cubre (b); solo átomos no elimina el `div`+`label`+`span` duplicado de (a). Se exportan las dos capas.

```ts
// form.tsx

export type FieldDensity = 'comfortable' | 'compact' | 'tight';   // ver Inventario de variantes
export type FieldTone = 'default' | 'muted';
export type PlaceholderTone = 'default' | 'faint';

interface ControlVariantProps {
  density?: FieldDensity;            // default 'comfortable'
  tone?: FieldTone;                  // default 'default'
  placeholderTone?: PlaceholderTone; // default 'default'
  fullWidth?: boolean;               // default true (w-full); false para los sitios que hoy no lo tienen
  invalid?: boolean;                 // default false
}

type InputProps = Omit<ComponentPropsWithoutRef<'input'>, 'className' | 'style'> & ControlVariantProps;
export function Input(props: InputProps): ReactElement;

type SelectProps = Omit<ComponentPropsWithoutRef<'select'>, 'className' | 'style'> & ControlVariantProps;
export function Select(props: SelectProps): ReactElement;

type TextareaProps = Omit<ComponentPropsWithoutRef<'textarea'>, 'className' | 'style'> & ControlVariantProps;
export function Textarea(props: TextareaProps): ReactElement;

export function Label(props: { htmlFor: string; children: ReactNode }): ReactElement;
export function FieldError(props: { id: string; children: ReactNode }): ReactElement;

export function Field(props: {
  label: string;
  htmlFor: string;          // mismo valor que el `id` del control hijo
  error?: string;           // undefined = sin error
  hint?: string;            // texto auxiliar opcional, debajo del control
  children: ReactNode;      // el control (Input/Select/Textarea/checkbox nativo/etc.)
}): ReactElement;
```

- `Input`/`Select`/`Textarea` **spreadean las props nativas** (`value`, `onChange`, `type`, `min`, `placeholder`, `id`, `required`, `aria-*`, `disabled`…) pero prohíben `className` y `style` por tipo — el estilo es del design system, punto. Es lo que vuelve la migración mecánica: se borra `className={fieldClasses}` y el resto de la línea queda igual.
- Clases base compartidas: `rounded-sm border border-border-strong bg-surface`, más `w-full` si `fullWidth`. `Textarea` agrega lo que hoy tenga cada textarea (verificar en el sitio antes de fijar `min-h`/`resize`; si no hay un patrón común, no se inventa).
- **`density` es lookup estático de 3 entradas** (regla 2 — variantes medidas, no un canónico impuesto):
  - `comfortable` → `px-md py-2 font-body text-[13px]` (la mayoría, incluido `fieldClasses` actual)
  - `compact` → `px-sm py-1.5 font-body text-[13px]` (`PlantillaCampoRow`)
  - `tight` → `px-sm py-1 font-body text-xs` (`FacturaCobrosSection`, `VistaGlobalHojaDeRuta`; `text-xs` y `text-[12px]` compilan al mismo 12px, así que ambos sitios quedan idénticos a hoy)
- `tone` → `default` = `text-text`; `muted` = `text-muted` sin `font-body` ni tamaño (los 2 selects de `NuevoRecorridoForm`/`RecorridoVehiculoConductor`, que hoy son byte-idénticos entre sí).
- `placeholderTone='faint'` → `placeholder:text-faint` (los 2 editores de pacientes). Es un prop feo para 2 sitios, y existe **exactamente por la regla 2**: la alternativa era normalizar y cambiarles el aspecto.
- `invalid` es lookup estático de dos entradas, nunca interpolación: `true` → borde `border-danger` + `aria-invalid="true"` + `aria-describedby="{id}-error"`. **Ojo con la regla 1**: hoy ningún campo cambia de borde al fallar (el error se muestra solo como texto debajo). Por eso `invalid` **arranca en `false` en todas las migraciones** y ningún sitio lo activa en este change: la capacidad queda disponible, el aspecto no cambia. Activarlo es una decisión visual posterior del usuario.
- **Convención de id del error:** `FieldError` recibe `id` y `Field` lo arma como `` `${htmlFor}-error` ``. `Input` con `invalid` e `id` presente arma el mismo string. Así el cableado ARIA queda cerrado sin `cloneElement`, sin function-children y sin que el caller escriba `aria-describedby` a mano. Queda documentado en el comentario de cabecera del módulo porque es una convención implícita entre dos componentes.
- **Se descartó** que `Field` genere el id con `useId()` internamente: obligaría a pasarlo al hijo con `cloneElement` (frágil, sin tipos) o con children-as-function (reestructura los 25 archivos). Los formularios del repo ya hacen `const formId = useId()` y arman `` `${formId}-nombre` `` — mantener eso hace la migración un swap 1:1.
- **Se descartó** un `TextField`/`SelectField` "todo en uno" (`label` + `value` + `onChange` + `error`): duplica la superficie de API, obliga a re-exponer cada prop nativa una por una y es exactamente la prop-explosion que la regla de `react-best-practices` manda evitar.
- El checkbox se deja nativo (hoy vive dentro de un `<label>` en línea, no del patrón `Field`): son 3 usos con markup distinto, no hay duplicación que matar. Se revisa en un change futuro si aparecen más.

Markup que produce `Field` (idéntico al actual):

```html
<div class="flex flex-col gap-xs">
  <label for="{htmlFor}" class="font-body text-[12px] font-semibold text-muted">{label}</label>
  {children}
  <span id="{htmlFor}-error" class="font-body text-xs text-danger">{error}</span>   <!-- solo si error -->
</div>
```

### Decisión 4 — `Alert`: un componente, dos énfasis, y los `Aviso*` construidos encima

```ts
// feedback.tsx
export type AlertEmphasis = 'flat' | 'accent';

export function Alert(props: {
  tone: SemanticStatus;              // success | warning | danger | info | secondary
  emphasis?: AlertEmphasis;          // default 'flat'
  size?: 'md' | 'sm';                // default 'md' → text-[13px]; 'sm' → text-[12px]
  title?: string;                    // prefijo en negrita dentro del mismo bloque (patrón Aviso*)
  icon?: ReactNode;                  // opcional, a la izquierda
  role?: 'alert' | 'status' | 'note';// default: 'alert' si tone==='danger', si no 'note'
  children: ReactNode;
}): ReactElement;
```

- `emphasis='flat'` + `size='md'` → `rounded-sm border {borderSoft} {bg} px-md py-sm font-body text-[13px] {fg}` = **la caja de error actual, byte a byte** (~25 sitios).
- **`size` existe por la regla 2**: `AsignacionPanel.tsx:107` y `VistaGlobalHojaDeRuta.tsx:95` usan `text-[12px]` donde el resto usa `text-[13px]`. Es una inconsistencia real del repo — se **preserva** (esos dos migran con `size='sm'`), no se unifica. Anotada como Open Question 5.
- `emphasis='accent'` → `rounded-sm border {border} border-l-4 {borderLeft} {bg} px-md py-sm font-body text-[12px] {fg}` = **el molde actual de `AvisoModeloDatos`/`AvisoPendienteCliente`**, y también lo que `AlertaCupo` y `FacturaCobrosSection` arman a mano.
- El `mb-md` que hoy traen los `Aviso*` hardcodeado **no** va en `Alert` (un componente no decide su propio margen externo; lo pone el layout del caller). Los wrappers `Aviso*` lo conservan para no cambiar sus call sites.
- `AvisoModeloDatos` y `AvisoPendienteCliente` quedan como wrappers de 5 líneas (`<Alert tone="warning" emphasis="accent" title="⚠ Modelo de datos:" role="note">`), con su firma pública actual intacta: cero cambios en sus consumidores.
- `role`: hoy el 100% de las cajas de error usa `role="alert"` y los `Aviso*` usan `role="note"`; el default derivado del tono reproduce ambos sin que nadie tenga que pensarlo, y el prop explícito queda para el caso raro (ej. un mensaje de éxito que conviene como `status`).
- **Se descartó** `variant` como nombre (colisiona conceptualmente con `ButtonVariant`, que mezcla color y jerarquía). Acá el color es `tone` y la forma es `emphasis` — dos ejes ortogonales, ambos cerrados.

### Decisión 5 — `Card` / `CardForm` / `Panel`: tres componentes chicos, no uno polimórfico

El contenedor aparece hoy sobre tres elementos distintos y no intercambiables: `<div>` (resúmenes de detalle), `<form onSubmit>` (los 6 formularios) y `<section aria-labelledby>` + `<h2>` (los 4 paneles de dashboard). Un `Card` polimórfico con `as` obliga a tipos genéricos pesados y a un `...rest` que rompe la convención de props acotadas del repo.

```ts
// layout.tsx
export type CardGap = 'sm' | 'md' | 'lg' | 'xl';    // lookup estático → gap-sm | gap-md | gap-lg | gap-xl
export type CardRadius = 'sm' | 'md';               // lookup estático → rounded-sm | rounded-md
export type CardPadding = 'md' | 'lg';              // lookup estático → p-md | p-lg
export type CardBackground = 'surface' | 'surface-soft'; // ver corrección post-medición, sección 9.5

export function Card(props: {
  radius?: CardRadius;    // default 'sm'
  padding?: CardPadding;  // default 'lg'
  gap?: CardGap;          // default 'md'
  background?: CardBackground; // default 'surface'
  elevated?: boolean;     // default false → agrega shadow-sm
  interactive?: boolean;  // default false → agrega cursor-pointer transition-colors hover:border-border-strong hover:bg-surface-soft
  onClick?: () => void;   // solo tiene sentido con interactive
  children: ReactNode;
}): ReactElement;

export function CardForm(props: {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  radius?: CardRadius;    // default 'sm'
  padding?: CardPadding;  // default 'lg'
  gap?: CardGap;          // default 'md'
  elevated?: boolean;
  children: ReactNode;
}): ReactElement;

export function Panel(props: {
  title: string;
  titleId: string;        // para el aria-labelledby; los paneles ya lo derivan de useId()
  action?: ReactNode;     // slot a la derecha del título (mismo contrato que Section.action)
  gap?: CardGap;          // default 'md'
  elevated?: boolean;     // default true — los 4 paneles de dashboard hoy llevan shadow-sm
  children: ReactNode;
}): ReactElement;
```

- Clase base compartida (constante interna del módulo): `flex flex-col border border-border bg-surface` + los lookups de `radius`, `padding`, `gap`, `elevated` e `interactive`.
- **Corrección post-medición (apply, sección 6):** `interactive` es `cursor-pointer transition-colors hover:border-border-strong hover:bg-surface-soft` — no `hover:bg-surface` como decía la primera redacción de esta sección. Confirmado por grep sobre las 6 tarjetas clickeables reales (`PacientesList`, `ObrasSocialesList`, `ConductoresList`, `PresupuestosList`, `VehiculosList`, `FacturasList`), las 6 idénticas entre sí con `hover:bg-surface-soft`. Implementado así en `layout.tsx`.
- **Los cinco ejes son variantes y no valores fijos por la regla 2**, y cada uno está medido (ver Inventario):
  - `gap`: conviven `gap-sm`, `gap-md`, `gap-lg`, `gap-xl` sobre este contenedor.
  - `radius`: `rounded-sm` en formularios/detalles/resúmenes vs `rounded-md` en las 4 tarjetas clickeables de listado y en las sub-tarjetas anidadas (`DireccionesEditor`, `PersonasACargoEditor`, `DocumentChecklist`, `AsignacionSemanalTabla`). **Es exactamente el caso que el usuario señaló**: no se fuerza un radio único.
  - `padding`: las sub-tarjetas anidadas no usan `p-lg`.
  - `elevated` / `interactive`: las 4 tarjetas clickeables de listado son byte-idénticas entre sí (`shadow-sm cursor-pointer transition-colors hover:border-border-strong hover:bg-surface-soft`) → `<Card radius="md" elevated interactive>` las reproduce las 4 sin tocar su aspecto.
- **`background` (corrección post-medición, apply sección 9.5):** eje agregado durante la migración de `ChecklistEditor.tsx`/`PlantillaFacturaEditor.tsx`. El panel "Vista previa" del patrón "Configuración | Vista previa" usa `bg-surface-soft` en vez de `bg-surface` (`ChecklistEditor.tsx:113`, `PlantillaFacturaEditor.tsx:174`) — mismo contenedor, mismos ejes `radius`/`padding`/`gap`, solo el fondo difiere. No estaba en el Inventario original porque no se había medido este patrón de dos columnas al diseñar `Card`; se agrega ahora en vez de forzar `bg-surface` a ambos paneles (que hubiera cambiado el aspecto del panel de vista previa).
- Fijar un valor "canónico" en cualquiera de los seis ejes cambiaría la densidad, el radio o el fondo de pantallas ya aprobadas — violaría la regla de oro. Se migra cada sitio con el valor que tiene hoy; unificar es una decisión posterior del usuario (Open Question 2) y, una vez centralizado, cuesta una línea.
- `Panel` renderiza `<h2 class="m-0 font-heading text-[18px] font-bold text-ink" id={titleId}>` — el heading exacto de `ResumenAnualPanel`/`TarjetaResumen`. `titleId` es obligatorio (no opcional con fallback) para que el `aria-labelledby` no pueda quedar colgando por olvido.
- `Panel` reusa el contrato del slot `action` que `Section` ya tiene — misma idea, mismo nombre de prop, sin inventar `headerRight`/`extra`.
- **Se descartó** exportar `cardClasses` como string: sería reconstruir exactamente el problema de `formFieldClasses.ts` que este change viene a borrar.
- **No** se hace `Card.Header`/`Card.Body` (compound): el uso real no lo pide hoy — `Panel` ya cubre el único caso con encabezado. Sobre-diseñar acá contradice la regla de `react-best-practices` ("solo si el uso real lo requiere").

### Decisión 6 — `Table`: primitivos de estilo, no data-table configurable

Las 4 tablas del repo tienen semántica distinta entre sí (`<th scope="row">` en la primera columna, columnas numéricas con `tabular-nums`, `caption` sr-only, celdas con `<Chip>` adentro). Una data-table con `columns: ColumnDef[]` obligaría a modelar render de celda, alineación, scope y accesibilidad como configuración — más superficie, menos control, y hoy sin ningún consumidor que la justifique.

```ts
// table.tsx
export type CellAlign = 'left' | 'right' | 'center';   // lookup estático → text-left | text-right | text-center
export type TableMinWidth = 'none' | 'md' | 'lg' | 'xl';  // lookup estático → '' | min-w-105 | min-w-150 | min-w-120
export type ThWeight = 'normal' | 'medium';            // lookup estático → '' | font-medium
export type TrEmphasis = 'total';                      // lookup estático → border-t-2 border-border-strong font-semibold

export function Table(props: {
  caption: string;                 // obligatorio, se renderiza sr-only (accesibilidad, hoy solo 1 de 4 lo tiene)
  minWidth?: TableMinWidth;        // default 'none'
  children: ReactNode;             // <thead>/<tbody> nativos del caller
}): ReactElement;

export function Tr(props: { divided?: boolean; emphasis?: TrEmphasis; children: ReactNode }): ReactElement;  // divided → border-t border-border; emphasis='total' → border-t-2 border-border-strong font-semibold
export function Th(props: { scope: 'col' | 'row'; align?: CellAlign; numeric?: boolean; weight?: ThWeight; children: ReactNode }): ReactElement;  // weight='medium' → font-medium
export function Td(props: { align?: CellAlign; numeric?: boolean; children: ReactNode }): ReactElement;
```

**Cierre de gobernanza (apply, sección 17 — 3 bloqueos resueltos por decisión explícita del usuario, no re-preguntados):**

- **`TableMinWidth` gana `'xl'` = `min-w-120`.** Único sitio real: el wrapper `<table>` de `FacturadoVsCobradoPanel.tsx`, que no encajaba en `'md'` (105) ni `'lg'` (150) — usar cualquiera de los dos movía el punto de scroll horizontal en viewports intermedios (viola REGLA 0). Se agrega el valor exacto medido, no se fuerza a un canónico existente.
- **`Th` gana `weight?: ThWeight`** (`'normal'` default, `'medium'` → `font-medium`). Único caso real: la celda `<th scope="row">` del mes en `ResumenAnualPanel.tsx` y `FacturadoVsCobradoPanel.tsx`, que hoy llevan `font-medium` y que ningún eje de `Th` reproducía. Las 2 celdas migraron de `<th>` nativo a `Th weight="medium"`.
- **`Tr` gana `emphasis?: TrEmphasis`** (única variante `'total'` → `border-t-2 border-border-strong font-semibold`). Único caso real: la fila de `<tfoot>` ("Total del rango") de `FacturadoVsCobradoPanel.tsx`, que `divided` (`border-t border-border`, 1px sin negrita) no reproducía. Migrada de `<tr className="...">` nativo a `Tr emphasis="total"`.

Los 3 ejes se agregaron test-first (Strict TDD: RED con el caso que usa el prop nuevo → GREEN con la implementación mínima → triangulación con el caso sin el eje/con el valor por defecto), en `frontend/src/design-system/table.test.tsx`. Ninguno de los tres es especulativo: cada uno cubre exactamente el sitio real que lo necesitaba, medido antes de nombrarlo (regla 2/3 del change).

**`TarjetaResumen.tsx` — excepción permanente, no bloqueo pendiente.** Confirmado por el usuario: su encabezado (`<h3 class="font-body text-[13px] font-semibold text-muted">` + contador `text-[24px]`) es una mini-card de estadística, no el patrón `Panel` (`<h2 class="font-heading text-[18px] font-bold text-ink">`). No migra a `Panel` ahora ni en el futuro — documentado inline en el componente y en `tasks.md`.

- `Table` renderiza `<div class="overflow-x-auto"><table class="w-full {minWidth} border-collapse font-body text-[13px] text-text"><caption class="sr-only">…</caption>{children}</table></div>` — el markup actual de `ResumenAnualPanel`, con el wrapper de scroll incluido (que hoy algunas tablas tienen y otras no: pasa a ser gratis para todas).
- `caption` obligatorio es una mejora deliberada de accesibilidad (WCAG): hoy 3 de 4 tablas no lo tienen. **Es la única mejora que entra en este change, y entra porque `sr-only` no cambia absolutamente nada visualmente.** Cualquier otra mejora de accesibilidad con impacto visual queda afuera por la regla de oro.
- El wrapper `overflow-x-auto`: hoy `ResumenAnualPanel` lo tiene y otras tablas no. Agregar un `div` con `overflow-x-auto` **no cambia el aspecto en desktop**, pero sí puede cambiar el comportamiento en viewport angosto (scroll interno en vez de desbordar). **Verificar sitio por sitio en la migración**; si en alguno cambia lo que se ve, ese sitio migra con `Table` sin wrapper (prop `scrollable={false}`) o queda fuera y se anota.
- `numeric` → `tabular-nums`; separado de `align` porque son cosas distintas (una columna numérica puede alinearse a la derecha o al centro).
- `scope` en `Th` es **obligatorio**: es exactamente el atributo que un `Th` no debe poder olvidarse.
- `minWidth` como variante cerrada y no como número: `min-w-[${n}px]` no lo genera Tailwind (mismo motivo documentado en `PROGRESS_WIDTH_CLASSES`).
- `<thead>`, `<tbody>`, `<tfoot>` siguen siendo nativos — no se envuelven, no aportan estilo y envolverlos solo agregaría indirección.

### Decisión 7 — `Pill` y `EmptyState`

```ts
// feedback.tsx
export function Pill(props: { emphasis?: 'normal' | 'strong'; children: ReactNode }): ReactElement;
export function EmptyState(props: { message: string; action?: ReactNode }): ReactElement;
```

- `Pill` = `rounded-pill bg-surface-soft px-md py-xs font-body text-[11px] text-muted` (+ `font-semibold` con `emphasis='strong'`, que es el "+N más" de los listados). **Es deliberadamente distinto de `Chip`**: `Chip` carga un `SemanticStatus` (comunica estado del negocio: vencido, al día, pendiente), `Pill` es una etiqueta neutra (nombre de ítem de checklist, accesorio, contador). Se documenta la diferencia en el comentario de cabecera para que nadie use `Chip kind="secondary"` como pill.
- `EmptyState` = `flex flex-col items-start gap-md rounded-sm border border-border bg-surface-soft p-xl` con `<p class="m-0 font-body text-sm text-muted">{message}</p>` y el slot `action` (típicamente un `<Button variant="secondary">`). Cubre el estado *empty* que la regla de `frontend-ui-design` exige explícito; los estados *loading* y *error* ya quedan cubiertos por el `<p>` de carga existente y por `Alert`.

### Decisión 8 — `Button` se extiende (no se clona) para absorber el "mini botón secundario"

Hay un patrón de botón duplicado 9 veces que el `Button` actual **no** puede producir: `cursor-pointer rounded-sm border border-border-strong bg-surface px-md py-xs font-body text-xs font-semibold text-primary` (±`px-sm`, ±`disabled:cursor-not-allowed disabled:opacity-40`). Difiere del `Button variant="secondary"` actual en tres cosas: padding (`px-md py-xs` vs `px-lg py-[9px]`), tamaño de fuente (`text-xs` vs `text-[13px]`) y color de label (`text-primary` vs `text-text`).

Por la regla `ui-design-system` ("extender componentes existentes con variantes, no crear one-offs paralelos"), se extiende `Button`:

```ts
export type ButtonVariant = 'primary' | 'secondary' | 'secondary-accent' | 'success' | 'danger';
export type ButtonSize = 'md' | 'sm' | 'xs';   // lookup estático

export function Button(props: {
  variant?: ButtonVariant;   // default 'primary' (sin cambios)
  size?: ButtonSize;         // default 'md' → EXACTAMENTE el Button actual
  disabled?: boolean;        // default false
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
}): ReactElement;
```

- **`size='md'` (default) reproduce el `Button` actual byte a byte**: `px-lg py-[9px] font-body text-[13px] font-semibold`. Se refactoriza `buttonBaseClasses` moviendo esas tres clases al lookup de `size`, con test que verifica que el resultado no cambió. Los ~40 call sites existentes no se tocan y no cambian de aspecto.
- `size='sm'` → `px-md py-xs font-body text-xs font-semibold`; `size='xs'` → `px-sm py-xs font-body text-xs font-semibold`.
- `variant='secondary-accent'` → `border-border-strong bg-surface text-primary` (el `secondary` actual pero con label `text-primary`).
- `disabled` → pasa el atributo nativo y agrega `disabled:cursor-not-allowed disabled:opacity-40`, **copiado literal** de `ParadasList.tsx:82` / `DocumentChecklist.tsx:85`. Regla 3: es una prop nueva, pero necesaria para migrar sin cambio visual, y con el estilo que el sitio ya tiene — no un disabled inventado.
- El `cursor-pointer` de los sitios actuales: `buttonBaseClasses` ya lo trae, así que no hace falta prop.
- **Se descartó** crear un `MiniButton`/`ActionButton` aparte: sería el one-off paralelo que la regla prohíbe, y duplicaría el manejo de `disabled`/`type`/`onClick`.
- **Corrección post-medición (apply, sección 9.3):** al migrar el botón "Editar" de `ObrasSocialesList` (mini-botón dentro de una `Card interactive`), aparecieron dos necesidades funcionales que el `Button` original no cubría — ninguna cambia una clase Tailwind, ambas son estrictamente necesarias para migrar sin romper comportamiento (regla 3):
  - `onClick` pasa a `(event: MouseEvent<HTMLButtonElement>) => void` en vez de `() => void`: el botón nativo que reemplaza llamaba `event.stopPropagation()` para no disparar también el `onClick` de la tarjeta contenedora (bubbling). Backward-compatible: los ~40 call sites existentes pasan callbacks sin parámetros, que siguen siendo asignables.
  - `ariaLabel?: string` (mismo nombre que `SearchInput.ariaLabel`): el botón "Editar" necesita un nombre accesible propio (`Editar {nombre}`) porque el texto visible no alcanza para distinguirlo dentro de una lista — es exactamente el `aria-label` que el `<button>` nativo ya tenía en los 5 listados.

### Decisión 9 — Casos que requerirían cambio visual: NO se hacen (regla 5)

Estos sitios comparten "familia" con un primitivo nuevo pero **no** se pueden migrar sin que algo se vea distinto. Quedan **fuera del scope por defecto**, documentados acá y marcados en `tasks.md` como opcionales pendientes de aprobación explícita del usuario. Ninguno se migra "de paso".

| Sitio | Qué tiene hoy | Por qué no se migra |
|---|---|---|
| `CudFields.tsx:15` (N° de CUD) | `px-md py-2 font-mono text-[16px] font-bold tracking-wide text-ink` | Es un campo con tipografía propia (mono, 16px, bold). Soportarlo en `Input` sería una variante usada **una sola vez** — no es deduplicación, es acomodar el primitivo a un caso único. Migrarlo con `density='comfortable'` le cambiaría fuente, tamaño, peso y color. |
| `AutorizacionForm.tsx:144` (monto con prefijo `$`) | `py-2 pl-xl pr-md` | El padding izquierdo grande deja lugar al `$` superpuesto. Migrar con el padding estándar pisaría el símbolo. Requeriría un `prefix` en `Input` (composición nueva, no extracción). |
| `ChecklistItemRow.tsx:74,83` y `PlantillaCampoRow.tsx:89,98` (botones ↑/↓) | `border-border-strong bg-surface px-xs py-xs disabled:…`, **sin** `font-body`, sin tamaño de fuente, sin color de texto | `Button` trae `font-body … font-semibold` y un color de label en su base. Migrarlos les cambiaría la tipografía del glifo. Habría que agregar un `size='icon'` que además anule el color — deja de ser el mismo componente. |
| `ParadasList.tsx:98` (quitar parada) | `border-danger-soft bg-danger-soft px-sm py-xs text-xs font-semibold text-danger` | El `Button variant="danger"` actual usa `border-[rgba(192,82,74,0.3)]`, no `border-danger-soft`. Migrarlo cambiaría el borde. Habría que agregar un 6º variant usado una vez. |
| `RecorridoVehiculoConductor.tsx:66` | `<p role="alert" class="m-0 font-body text-sm text-danger">` (sin caja) | No es el patrón de caja de `Alert`: es texto suelto. Migrarlo le agregaría fondo y borde. |
| `LoginPage.tsx:27`, `DesignSystem.tsx:20,261` | `rounded-lg` | Fuera del universo de duplicación de features; agregar `radius='lg'` para 3 sitios de contextos distintos no aporta. |

**Cómo se cierran:** al terminar el apply, se le presentan al usuario como lista de decisiones visuales pendientes. Si aprueba unificar alguno, entra como change aparte (`design-system-unificacion-visual`), nunca acá.

### Decisión 10 — Orden de migración y checkpoints (Governance MEDIO)

Se migra **por feature**, no por componente, y en orden de riesgo creciente:

`obras-sociales` → `vehiculos` → `conductores` → `pacientes` → `presupuestos` → `dashboard` → `hojas-de-ruta` → `facturacion`

Razón: `obras-sociales` es el feature con el patrón más limpio y la mejor cobertura de tests (sirve de piloto y valida la API antes de escalar); `facturacion` va último porque es el dominio de governance CRITICO y el que más superficie tiene. Entre bloques hay checkpoint: `npx tsc -b --noEmit` + `npm test` verdes antes de seguir. Si un bloque revela que la API del primitivo no alcanza, se corrige el primitivo **antes** de migrar el siguiente feature, no después.

### Decisión 11 — Cómo se constata "cero cambio visual" (regla 4)

La verificación no puede ser "lo miré y me pareció igual". Cada task de migración cierra con **al menos una** de estas dos evidencias, y la elección se anota:

- **A — Comparación de clases (preferida, objetiva).** Antes de tocar el archivo, se captura el `className` renderizado de los nodos afectados (test temporal con `container.innerHTML` / `element.className`, o simplemente copiando el string del JSX actual). Después de migrar, se compara. Deben coincidir como **conjunto de clases** (el orden dentro del `class` no importa; la presencia/ausencia de cada clase sí). El test temporal se borra al cerrar la task — no queda un test acoplado al estilo (ver Decisión 12).
- **B — Comparación visual lado a lado.** Para los casos donde A es impráctico (composición con muchos nodos), se abre la pantalla antes y después y se compara. Válido, pero se documenta explícitamente que se usó B y en qué pantalla.

La evidencia elegida se anota en el resumen del apply, por task. **"Usa el componente nuevo" no es evidencia y no cierra la task.**

Nota sobre orden de clases: Tailwind resuelve por especificidad de la utilidad, no por orden en el atributo, así que un `class` reordenado renderiza igual. Lo que hay que garantizar es el **mismo conjunto**.

### Decisión 12 — Strict TDD aplica a los componentes nuevos, no a la migración

Los componentes nuevos (`form.tsx`, `feedback.tsx`, `layout.tsx`, `table.tsx`) se escriben **test-first** con Vitest + RTL, testeando comportamiento observable: que el label esté asociado al control (`getByLabelText`), que el error se anuncie (`role="alert"` / `aria-describedby`), que `caption` exista, que `scope` se emita, que `Panel` tenga nombre accesible. **Nunca** se asserta contra strings de clases Tailwind en los tests permanentes — eso es testear implementación y ataría la suite al estilo.

Excepción acotada y deliberada: los **tests temporales de la Decisión 11** sí comparan clases, porque su objeto es justamente el estilo. Viven lo que dura la task y se borran antes del commit.

La migración de las features **no lleva tests permanentes nuevos**: su red de seguridad son las 152 suites existentes, que se corren *antes* de tocar cada archivo (baseline) y después. Un test existente que rompe es una regresión a arreglar en el código, nunca un test a ajustar.

## Riesgos

| Riesgo | Prob. | Mitigación |
|---|---|---|
| **Deriva visual al migrar** (un `gap`, un radio, un tamaño de fuente que cambia sin querer) — el riesgo central del change | Alta | Los primitivos exponen como prop **cada eje en que el repo hoy varía** (Inventario de variantes, normativo); criterio de aceptación por task con evidencia constatada (Decisión 11); migración feature por feature con checkpoint |
| Tentación de "aprovechar y unificar" mientras se migra | Alta | Regla de oro escrita al tope de los 3 artefactos; §Casos que requerirían cambio visual lista explícitamente qué NO tocar; Open Questions 2/5/6 canalizan las unificaciones a un change posterior |
| Los primitivos terminan con demasiadas props por preservar variantes | Media | Es el costo aceptado de la regla 2 y es **temporal**: una vez que el usuario decida unificar, borrar un prop es trivial. Ninguna variante entra sin estar medida en el Inventario |
| Rompe un test existente por cambio de estructura DOM (un `<div>` de más/menos) | Media | `Field` reproduce el `div.flex.flex-col.gap-xs` exacto; los tests consultan por rol/label, no por estructura; checkpoint de tests por feature |
| La API de `Field` no cubre algún caso raro (campo con dos controles, grupo de radios) | Media | Los átomos (`Input`/`Select`/`Label`/`FieldError`) quedan exportados sueltos: el caso raro compone a mano sin forzar la molécula |
| El diff gigante (~35 archivos) se vuelve irrevisable | Media | Un commit `refactor:` por feature, encima de commits `feat:` que solo agregan; nunca un commit "migrar todo" |
| `Omit<…, 'className'>` molesta en algún call site legítimo | Baja | Si aparece, la respuesta correcta es agregar una variante al primitivo, no reabrir `className` (regla `ui-design-system`: extender con variantes, no one-offs) |
| `min-w-105` / `min-w-150` no existen como clases válidas en Tailwind v4 | Baja | Verificar en el primer uso; si no, se agregan al lookup como `min-w-[420px]` literal estático (válido, escrito a mano, no interpolado) |

## Open Questions

> Las preguntas 2, 5, 6 y 7 son **decisiones visuales que este change deliberadamente NO toma**. Se listan para que el usuario las resuelva después, con el costo ya reducido a una línea gracias a la centralización.

1. **¿`Field` debería soportar `required` visual (asterisco)?** Hoy ningún formulario lo marca y la validación es post-submit. Fuera por regla 3 (no se inventan props). Si se pide, es aditivo.
2. **¿Unificar los `gap` de las tarjetas (`sm`/`md`/`lg`/`xl` → uno solo)?** Decisión visual, no de refactor. Este change los preserva; unificarlos después es cambiar el default y borrar el prop en los call sites.
3. **¿`loading` en `Button`?** Ningún sitio lo tiene hoy → fuera por regla 3.
4. **¿El checkbox merece un `CheckboxField`?** Con 3 usos y markup distinto entre sí, hoy no. Revisar si aparece un cuarto.
5. **¿Unificar el tamaño de fuente de las cajas de error (`text-[12px]` en `AsignacionPanel`/`VistaGlobalHojaDeRuta` vs `text-[13px]` en las otras ~25)?** Inconsistencia real detectada. Se preserva vía `Alert size`. Unificarla es borrar dos `size='sm'`.
6. **¿Unificar el radio de las tarjetas (`rounded-sm` vs `rounded-md`)?** Probablemente sea intencional (las tarjetas clickeables de listado se distinguen del contenedor de formulario), pero no está documentado. Se preserva vía `Card radius`.
7. **¿Se activa el borde `border-danger` en campos inválidos?** `Input` soporta `invalid` pero **ningún sitio lo usa** en este change (hoy el error es solo texto debajo). Activarlo sería una mejora de UX con impacto visual → decisión del usuario.
8. **Los 6 sitios de §"Casos que requerirían cambio visual"**: ¿se unifican en un change posterior (`design-system-unificacion-visual`) o se dejan como están para siempre? Requiere respuesta explícita del usuario.
