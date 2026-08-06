import { useEffect, useId, useRef, useState, type MouseEvent, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { SemanticStatus } from './tokens';
import { chipColors } from './semanticColors';
import { Alert } from './feedback';
import { usePuedeEscribir } from '../shared/auth/usePuedeEscribir';

// Primitivos reutilizables del design system. DesignSystem.tsx los importa para el catálogo
// visual; el resto de la app (src/shared, src/features) los importa para construir pantallas
// reales. No duplicar estos componentes en otro lado.
//
// Estilado 100% con clases Tailwind (Regla Dura del proyecto — ver CLAUDE.md): los tokens de
// diseño que antes vivían en ./tokens.ts como objeto JS ahora son variables de @theme en
// src/index.css (--color-ink, --spacing-lg, --radius-sm, --shadow-card, --font-heading, etc.),
// consumidas acá como clases utilitarias (text-ink, p-lg, rounded-sm, shadow-card, font-heading).
//
// Excepción de capa (gateo-obrasocial, design.md D3/D5): `Button`, `CamposSoloLectura` y
// `AvisoSoloLectura` son las únicas primitivas de este archivo que dependen de
// shared/auth/usePuedeEscribir — una excepción deliberada a "design-system es puramente
// presentacional", decidida en design.md para que un componente exprese "esto requiere
// escritura" sin que el caller tenga que resolver el permiso y pasarlo por props. No agregar
// esta dependencia a ninguna otra primitiva sin pasar por el mismo proceso de diseño.

export function Section({
  label,
  title,
  action,
  children,
}: {
  label: string;
  title: string;
  /** Contenido opcional alineado a la derecha del título (ej. un Chip de estado) — ver CudFields. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-xxxl">
      <div className="mb-lg flex items-baseline gap-sm">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-faint">{label}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="mb-lg flex flex-wrap items-start justify-between gap-sm">
        <h2 className="m-0 font-heading text-[21px] font-bold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

// bgClassName es una clase Tailwind estática (bg-ink, bg-primary, etc.), no un hex interpolado:
// Tailwind no puede generar clases a partir de strings armados en runtime (ej. `bg-[${hex}]`),
// así que el color de fondo del swatch se pasa como clase ya resuelta por el caller (que conoce
// el token en compile-time); `hex` queda solo como dato a mostrar como texto (no como estilo).
export function Swatch({ hex, bgClassName, name, usage }: { hex: string; bgClassName: string; name: string; usage: string }) {
  return (
    <div className="flex flex-col gap-xs">
      <div className={`h-16 w-full rounded-md border border-border ${bgClassName}`} />
      <div>
        <div className="font-body text-[13px] font-semibold text-ink">{name}</div>
        <div className="font-mono text-[11px] text-muted">{hex}</div>
        <div className="mt-0.5 font-body text-[11px] text-muted">{usage}</div>
      </div>
    </div>
  );
}

export type ButtonVariant = 'primary' | 'secondary' | 'secondary-accent' | 'success' | 'danger';
export type ButtonSize = 'md' | 'sm' | 'xs';

// Clases compartidas por todas las variantes/tamaños. El resto (layout de flex, borde, spacing,
// tipografía, transición) vive en buttonSizeClasses (tasks.md 8.1): size='md' reproduce
// buttonBaseClasses tal cual estaba antes del refactor (test de Evidencia A, se borra al cerrar
// la sección 8), size='sm'/'xs' reproducen el "mini botón secundario" duplicado 9 veces en los 5
// listados + DocumentChecklist + ParadasList (design.md Decisión 8) — un botón de ese tamaño no
// es un Button 'md' con menos padding, es una forma distinta (sin inline-flex/gap, borde fino en
// vez de border-[1.5px], sin transición), así que el eje "size" carga esas diferencias completas,
// no solo el padding/tamaño de fuente.
const buttonBaseClasses = 'w-fit rounded-sm font-body font-semibold cursor-pointer';

const buttonSizeClasses: Record<ButtonSize, string> = {
  md: 'inline-flex items-center gap-xs border-[1.5px] px-lg py-[9px] text-[13px] transition-[filter,background-color,border-color] duration-[120ms] ease-[ease]',
  sm: 'border px-md py-xs text-xs',
  xs: 'border px-sm py-xs text-xs',
};

const buttonVariantClasses: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-primary text-white shadow-[0_2px_6px_rgba(63,125,115,0.28)]',
  secondary: 'border-border-strong bg-surface text-text',
  // El "secondary" actual pero con label text-primary — absorbe el mini botón secundario que
  // Button hoy no puede producir (design.md Decisión 8), sin clonar un componente paralelo.
  'secondary-accent': 'border-border-strong bg-surface text-primary',
  success: 'border-transparent bg-success text-white',
  danger: 'border-[rgba(192,82,74,0.3)] bg-danger-soft text-danger',
};

// Copiado literal de ParadasList.tsx:82 / DocumentChecklist.tsx:85 (regla 3, design.md): no se
// inventa un estilo de disabled nuevo, es el que el repo ya usa donde hoy existe.
const BUTTON_DISABLED_CLASSES = 'disabled:cursor-not-allowed disabled:opacity-40';

// documentos-previsualizacion (fix "quiero poder descargarlo", 2026-08-06): `Button` solo
// renderiza `<button>`, pero un `<a download>` necesita ser una etiqueta `<a>` de verdad (regla
// del navegador para el atributo `download`, no una decisión de este componente) — no hay forma
// de lograrlo pasando por `Button`. Se exportan las mismas clases que arma `Button` para que un
// `<a>` se vea idéntico a un botón secundario sin reimplementar el estilo a mano (regla dura:
// nunca reinventar clases Tailwind que el design system ya resolvió).
export function buttonClassName(variant: ButtonVariant, size: ButtonSize): string {
  return [buttonBaseClasses, buttonSizeClasses[size], buttonVariantClasses[variant]].join(' ');
}

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  requiereEscritura = false,
  children,
  onClick,
  type = 'button',
  ariaLabel,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  // Prop opt-in de escritura (gateo-obrasocial, design.md D5): declara que la acción de este
  // botón escribe datos. Nunca automática — de los ~78 usos de Button en el proyecto, varios
  // (Cancelar, Volver al listado, conmutadores de vista, Reintentar) no escriben y deben seguir
  // funcionando para una cuenta de solo lectura, así que su ausencia (default false) preserva el
  // comportamiento actual sin excepción.
  //
  // IMPORTANTE (security-review): esto es UX, no una frontera de seguridad — la autorización
  // efectiva de escritura la impone la RLS del servidor vía modulos.tiene_permiso(modulo,
  // 'write'). Ver mismo comentario en permisos.ts y PuedeEscribirContext.tsx.
  requiereEscritura?: boolean;
  children: ReactNode;
  // Acepta el evento nativo (backward-compatible: los ~40 call sites existentes pasan
  // funciones sin parámetros, siguen siendo asignables) porque los botones mini dentro de una
  // Card clickeable (tasks.md 9.3) necesitan event.stopPropagation() para no disparar también
  // el onClick de la tarjeta contenedora — igual que el <button> nativo que reemplazan.
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit';
  // Mismo criterio que SearchInput.ariaLabel: nombre accesible propio cuando el texto visible
  // ("Editar") no alcanza para distinguir el botón dentro de una lista (regla 3 — necesario para
  // migrar los botones mini de listado sin perder accesibilidad, no un capricho).
  ariaLabel?: string;
}) {
  // Hook llamado incondicionalmente (regla de hooks): requiereEscritura=false simplemente
  // ignora el valor devuelto en el cálculo de abajo, sin condicionar la llamada al hook.
  const puedeEscribir = usePuedeEscribir();
  // Disyunción (design.md D5): el gateo de permiso nunca *habilita* un botón que su propia
  // lógica (`disabled`) ya quería bloquear; solo puede agregar una razón más para bloquearlo.
  const bloqueadoPorGateo = requiereEscritura && !puedeEscribir;
  const deshabilitado = disabled || bloqueadoPorGateo;

  const className = [
    buttonBaseClasses,
    buttonSizeClasses[size],
    buttonVariantClasses[variant],
    deshabilitado ? BUTTON_DISABLED_CLASSES : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} disabled={deshabilitado} className={className} onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  );
}

// Envoltorio de solo lectura sobre <fieldset disabled> nativo (gateo-obrasocial, design.md D3):
// deshabilita de una vez todos los controles descendientes (input, select, textarea, button),
// incluidos los <button> nativos de subcomponentes anidados que este envoltorio no conoce —
// ChecklistItemRow y PlantillaCampoRow son el caso que motivó esta primitiva. Es HTML nativo, no
// una emulación: los lectores de pantalla anuncian los controles como deshabilitados, el foco los
// saltea y los submit no disparan.
//
// `min-w-0 border-0 p-0 m-0` neutraliza los estilos de agente de usuario del <fieldset> (borde,
// padding, min-width: min-content) para no mover el layout ni un píxel — cero estilos inline
// (Regla Dura del proyecto).
//
// Sin props: como Button, se auto-resuelve contra usePuedeEscribir() — ningún caller tiene que
// saber a qué módulo pertenece la pantalla en la que está montado.
export function CamposSoloLectura({ children }: { children: ReactNode }): ReactElement {
  const puedeEscribir = usePuedeEscribir();
  return <fieldset disabled={!puedeEscribir} className="min-w-0 border-0 p-0 m-0">{children}</fieldset>;
}

// Aviso visible de modo solo lectura (gateo-obrasocial, design.md D6): controles deshabilitados
// sin explicación se leen como una aplicación rota (decisión 2 de la usuaria). Reutiliza Alert —
// no se crea un componente de aviso desde cero — con el mismo molde tone="info" que
// AvisoPendienteCliente. No aparece cuando la cuenta sí puede escribir, ni fuera de un
// RequireAuth (fallback true de usePuedeEscribir).
//
// Patrón de referencia para los otros 3 changes del split (gateo-pacientes, gateo-facturacion,
// gateo-conductores): cada uno monta este mismo componente, sin argumentos, en su propia página
// de módulo.
export function AvisoSoloLectura(): ReactElement | null {
  const puedeEscribir = usePuedeEscribir();
  if (puedeEscribir) return null;

  return (
    <Alert tone="info" emphasis="accent" role="note" title="Modo solo lectura:">
      Tu cuenta no tiene permiso de escritura sobre este módulo. Podés consultar los datos, pero
      las acciones que crean, editan o eliminan están deshabilitadas.
    </Alert>
  );
}

// Link de "volver" de arriba de cada pantalla de detalle (Conductores/Vehículos/Obras
// Sociales/Pacientes/Presupuestos/Facturación): antes duplicado idéntico en los 6 features.
// Único punto de cambio ahora — cualquier ajuste de estilo se aplica acá una sola vez.
export function VolverAlListadoLink({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex items-center gap-md">
      <button
        type="button"
        onClick={onClick}
        className="cursor-pointer border-none bg-transparent p-0 font-body text-[13px] font-semibold text-primary"
      >
        ← Volver al listado
      </button>
    </div>
  );
}

// Feedback de usuario: "en los módulos donde no se supere el alto de la pantalla, que solo
// aparezca el primer link (arriba) para volver al listado" — si la pantalla ya entra sin scroll,
// el botón de abajo es redundante (el de arriba ya está siempre visible). Recalcula en cada
// resize de ventana y cuando cambia el alto del documento (secciones que aparecen/desaparecen
// tras cargar datos async), vía ResizeObserver — con guarda porque jsdom (tests) no lo define.
function useDesbordaViewport(): boolean {
  const [desborda, setDesborda] = useState(false);

  useEffect(() => {
    function medir() {
      setDesborda(document.documentElement.scrollHeight > window.innerHeight);
    }
    medir();
    window.addEventListener('resize', medir);
    if (typeof ResizeObserver === 'undefined') {
      return () => window.removeEventListener('resize', medir);
    }
    const observer = new ResizeObserver(medir);
    observer.observe(document.documentElement);
    return () => {
      window.removeEventListener('resize', medir);
      observer.disconnect();
    };
  }, []);

  return desborda;
}

// Botón de "volver" de abajo de cada pantalla de detalle. `Button` incluye `w-fit` en su clase
// base, así que ya no necesita un <div> envolvente para no estirarse dentro de un `flex flex-col`
// (ver buttonBaseClasses) — y a diferencia de `self-start`, `w-fit` no le impone una alineación
// fija: el contenedor sigue decidiendo si el botón queda a la izquierda, centrado o a la derecha.
// Solo se renderiza si la pantalla no entra sin scroll (ver useDesbordaViewport) — si entra, el
// link de arriba (VolverAlListadoLink) ya alcanza.
export function VolverAlListadoButton({ onClick }: { onClick: () => void }) {
  const desborda = useDesbordaViewport();
  if (!desborda) return null;
  return (
    <Button variant="secondary" onClick={onClick}>
      Volver al listado
    </Button>
  );
}

// chipColors se movió a ./semanticColors.ts (design.md Decisión 1): feedback.tsx necesita el
// lookup y components.tsx (por AvisoModeloDatos/AvisoPendienteCliente, que pasan a usar Alert)
// también — importar directo de components.tsx desde feedback.tsx crearía un import circular.
// Se re-exporta acá para no tocar a sus 5 consumidores actuales (DocumentChecklist,
// VehiculoMantenimiento, anchoBarraClases, AlertaCupo, DesignSystem).
export { chipColors };

// Filtro de búsqueda de los 5 listados con grid de tarjetas (Pacientes/Conductores/Vehículos/
// ObrasSociales/Presupuestos): antes duplicado idéntico en cada feature, con `type="search"` —
// en Chrome/Safari eso aplica `-webkit-appearance: searchfield`, un control nativo de tamaño fijo
// que ignora `width`/`padding` de Tailwind y lo colapsaba a un cuadradito casi invisible (bug
// real reportado, no se arreglaba solo con `appearance: none` en CSS). `type="text"` con
// `inputMode="search"` da el mismo teclado/semántica en mobile sin heredar ese control nativo.
export function SearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  return (
    <input
      type="text"
      inputMode="search"
      autoComplete="off"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className="w-full rounded-sm border border-border bg-surface px-md py-sm font-body text-[13px] text-ink placeholder:text-muted"
    />
  );
}

export function Chip({ kind, children }: { kind: SemanticStatus; children: ReactNode }) {
  const c = chipColors[kind];
  return (
    <span
      className={`inline-flex w-fit items-center rounded-pill px-md py-xs font-body text-[12px] font-semibold ${c.bg} ${c.fg}`}
    >
      {children}
    </span>
  );
}

// Cartel de discrepancia contra el modelo de datos real (docs/core/Traslados-Modelo-Datos.docx),
// para que quien construya el backend vea en la propia UI qué campos/tablas del frontend todavía
// no están reconciliados con la BD real. Reutiliza el token semántico "warning" ya definido en
// chipColors — no inventa un color nuevo para esto.
//
// Wrapper fino sobre Alert (design.md Decisión 4): Alert no trae margen externo propio (un
// componente no decide su propio margen; lo pone el layout del caller), así que el `mb-md` que
// esta pantalla siempre tuvo se conserva acá en un div contenedor — la firma pública y el
// resultado visual quedan idénticos a antes del refactor, cero cambios en los consumidores.
export function AvisoModeloDatos({ children }: { children: ReactNode }) {
  return (
    <div className="mb-md">
      <Alert tone="warning" emphasis="accent" role="note" title="⚠ Modelo de datos:">
        {children}
      </Alert>
    </div>
  );
}

// Cartel de dato/regla pendiente de confirmar con el cliente (design.md "Open Question"): mismo
// molde que AvisoModeloDatos pero con el tono "info" (nunca se confunde con la discrepancia
// docx-vs-KB, que es siempre "warning").
export function AvisoPendienteCliente({ children }: { children: ReactNode }) {
  return (
    <div className="mb-md">
      <Alert tone="info" emphasis="accent" role="note" title="ⓘ Pendiente cliente:">
        {children}
      </Alert>
    </div>
  );
}

// Cartelito de hover pensado para el sidebar colapsado, donde el ítem queda reducido a un ícono
// sin label visible. `disabled` deja pasar `children` sin envoltorio cuando el caller no lo
// necesita (ej. sidebar expandido, donde el label ya se ve y un tooltip sería redundante), para
// no forzar un `if` en cada consumidor.
//
// Portal a document.body en vez de `position: absolute` dentro del propio flujo (bug reportado
// por el usuario: el cartel aparecía cortado en el borde del sidebar): el <aside> del sidebar
// tiene `overflow-hidden` (AppShell.tsx, necesario para el label que se desliza al costado
// durante la transición de ancho) y además siempre tiene un `transform` activo (las clases
// `translate-x-*` del drawer mobile), que por spec de CSS crea containing block para
// `position: fixed` — un tooltip `fixed` sin portal seguiría clippeado por el mismo overflow del
// <aside>. Mover el nodo del tooltip fuera del <aside> vía createPortal es la única forma de que
// no quede recortado, sea cual sea el ancho/posición del sidebar.
//
// Excepción puntual a la regla dura "nunca style={{}} inline" (CLAUDE.md): acá no hay ningún
// valor de diseño (color/spacing/tipografía) hardcodeado a mano, son coordenadas de layout
// calculadas en runtime con getBoundingClientRect() — Tailwind no tiene forma de expresar un
// valor que se conoce recién al hacer hover, así que no hay clase utilitaria posible.
export function Tooltip({ label, disabled, children }: { label: string; disabled?: boolean; children: ReactElement }) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  if (disabled) return children;

  const show = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.top + rect.height / 2, left: rect.right + 8 });
  };
  const hide = () => setCoords(null);

  return (
    <span ref={anchorRef} className="inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {coords &&
        createPortal(
          <span
            role="tooltip"
            style={{ top: coords.top, left: coords.left }}
            className="pointer-events-none fixed z-50 -translate-y-1/2 rounded-sm bg-text px-sm py-xs font-body text-[12px] font-semibold whitespace-nowrap text-surface shadow-card"
          >
            <span className="absolute top-1/2 -left-1 h-2 w-2 -translate-y-1/2 rotate-45 rounded-[1px] bg-text" />
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}

// Selector de elementos tabulables usado por la trampa de foco de Overlay (abajo). Copia
// deliberadamente acotada del set estándar de "elementos interactivos nativos" — no cubre
// `contenteditable` ni roles ARIA custom porque, siendo Overlay un contenedor de **solo
// lectura**, no hay ningún caso real en este proyecto que los necesite; si aparece uno, se amplía
// acá, en un solo lugar.
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Overlay — ventana centrada con backdrop (Checkpoint (d) de design.md, veredicto D-i): contenedor
// GENÉRICO y reutilizable para aislar del resto de la pantalla cualquier contenido que lo
// necesite (el primer y único consumidor hoy es la previsualización de documentos de
// `documentos-previsualizacion`, pero este componente no sabe nada de documentos — ver abajo).
// `createPortal` a `document.body`: mismo motivo y mismo precedente que `Tooltip` más arriba
// (escapa del stacking context / `overflow-hidden` de cualquier ancestro, para no quedar
// recortado ni mal posicionado sea cual sea la pantalla que lo monte).
//
// **Resolución escrita de la tensión con `knowledge-base/08_arquitectura_propuesta.md` líneas 28
// y 35** ("el detalle revela el formulario inline, en la misma pantalla — nunca como modal";
// "para sub-secciones embebidas: nunca inputs editables inline por default"): esa regla existe
// para prohibir usar un overlay/modal como vehículo de **formularios de edición** — el motivo
// documentado ahí es que los datos ya cargados "parecían campos editables" cuando no
// correspondía tocarlos ahí. Una superficie **de solo lectura, efímera y sin inputs** no es lo
// que esa regla prohíbe (design.md, Checkpoint (d)). Pero como este componente vive en el design
// system y cualquiera lo puede reusar, queda dicho acá explícitamente: **`Overlay` NO es un
// vehículo para formularios de edición.** No montar un `<form>`, ni `onSubmit`, ni inputs que
// escriban datos como `children` — si algún día hace falta eso, es una pantalla o un panel inline
// nuevo (siguiendo la convención de la KB), no este componente.
//
// Accesibilidad (WAI-ARIA Dialog Pattern): `role="dialog"` + `aria-modal="true"` +
// `aria-labelledby` apuntando al `<h2>` del título (id generado con `useId`, el caller no
// necesita saber nada de ids). Cierra con `Escape` y con click en el backdrop (click *dentro* del
// contenido no propaga cierre). Al abrir, mueve el foco al contenedor del diálogo; al cerrar,
// lo devuelve al elemento que tenía el foco antes de abrir (típicamente el botón que lo abrió).
// Mientras está abierto, una trampa de foco (`Tab`/`Shift+Tab` interceptados a nivel `document`)
// impide que la tabulación llegue al contenido de fondo — el resto de la pantalla queda
// inalcanzable por teclado hasta cerrar, como exige el patrón de diálogo modal de ARIA.
export function Overlay({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}): ReactElement | null {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const elementoQueAbrioRef = useRef<HTMLElement | null>(null);

  // Foco: guardar el elemento activo al momento de abrir (para devolvérselo al cerrar) y mover el
  // foco al diálogo. El cleanup del efecto (se dispara al cerrar/desmontar) es lo que devuelve el
  // foco — así funciona sea cual sea el camino de cierre (Escape, backdrop, o que el caller
  // cambie `open` por su cuenta).
  useEffect(() => {
    if (!open) return;
    elementoQueAbrioRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    return () => {
      elementoQueAbrioRef.current?.focus();
    };
  }, [open]);

  // Escape + trampa de foco, ambos a nivel `document` (no en el nodo del diálogo): Escape debe
  // funcionar tenga el foco lo que tenga el foco dentro del diálogo, y la trampa de Tab necesita
  // interceptar el evento antes de que el navegador mueva el foco por su cuenta.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const contenedor = dialogRef.current;
      if (!contenedor) return;
      const focusables = contenedor.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      const primero = focusables[0];
      const ultimo = focusables[focusables.length - 1];
      if (!primero || !ultimo) {
        // Nada tabulable dentro del diálogo (solo texto): el foco no puede salir de acá.
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === primero) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-lg"
      onMouseDown={(event: MouseEvent<HTMLDivElement>) => {
        // Solo cierra si el click fue directo sobre el backdrop, no si burbujeó desde adentro
        // del contenido (event.target === event.currentTarget es el chequeo estándar para esto).
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-[85vh] w-full max-w-[640px] flex-col gap-md rounded-md border border-border bg-surface p-lg shadow-card outline-none"
      >
        <div className="flex items-center justify-between gap-sm">
          <h2 id={titleId} className="m-0 font-heading text-[18px] font-bold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="cursor-pointer rounded-sm border-none bg-transparent p-xs text-muted hover:text-ink"
          >
            <InlineIcon size={18}>
              <line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
              <line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
            </InlineIcon>
          </button>
        </div>
        {/* min-w-0 (fix genérico de flexbox, 2026-08-06, hallado por documentos-previsualizacion
            con contenido zoomeable): sin esto, este flex item nunca se achica por debajo del
            ancho de SU contenido — un consumidor con algo ancho adentro (scrolleable o no)
            terminaría empujando el diálogo entero más allá de `max-w-[640px]` en vez de
            contenerse. No es específico de documentos, aplica a cualquier contenido futuro. */}
        <div className="min-w-0">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      {children}
    </svg>
  );
}

// Ícono chico para uso inline (dentro de texto/filas/badges) — mismo criterio que NavIcon
// (trazo, hereda color del texto vía currentColor) pero en 14px por default en vez de 18px, para
// no competir visualmente con texto de 11-13px. Regla del proyecto: nunca emojis como ícono,
// siempre SVG con este componente (ver ./icons.tsx para el set de paths ya armados).
export function InlineIcon({ children, size = 14 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
      className="shrink-0"
    >
      {children}
    </svg>
  );
}

// Tarjeta clickeable de un checklist multi-selección (feedback de usuario: "en todos los
// formularios donde haya checklists, que se vean así, mucho más amigables" — reemplaza el
// `<input type="checkbox">` suelto en cualquier selector donde el usuario elige varios ítems de
// una lista: accesorios de movilidad, obras sociales vinculadas, etc.). El input nativo se
// mantiene (accesibilidad, semántica de formulario) pero chico y con `accent-primary`, en vez de
// depender solo del checkbox por defecto del navegador para mostrar la selección.
export function ChecklistOption({
  id,
  label,
  icon,
  selected,
  onChange,
  ariaLabel,
}: {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  selected: boolean;
  onChange: () => void;
  ariaLabel?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-center gap-xs rounded-sm border px-md py-sm font-body text-[13px] transition-colors ${
        selected
          ? 'border-primary bg-primary-softer/30 text-primary'
          : 'border-border bg-surface text-text hover:border-border-strong'
      }`}
    >
      {icon && <InlineIcon size={18}>{icon}</InlineIcon>}
      <span className="flex-1">{label}</span>
      <input id={id} type="checkbox" className="h-4 w-4 accent-primary" checked={selected} onChange={onChange} aria-label={ariaLabel} />
    </label>
  );
}

// Encabezado de subsección dentro de un form (título + línea divisoria) — variante más liviana
// de <Section>: esa lleva además un label mono superior que acá no aplica, son agrupaciones de
// campos dentro de una sola card, no secciones de página. Antes vivía duplicado idéntico en
// varios forms (feedback de usuario: "que todos los formularios tengan los títulos de cada
// sección con el separador") — ahora es la única fuente para cualquier form con más de un bloque
// de campos.
export function FieldGroupHeading({ children }: { children: string }) {
  return (
    <div className="mb-lg flex items-baseline gap-sm">
      <h3 className="m-0 font-heading text-[15px] font-bold text-ink">{children}</h3>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

const sectionBadgeToneClasses: Record<'config' | 'preview', string> = {
  config: 'bg-ink text-white',
  preview: 'bg-success-soft text-success',
};

// Rótulo de las dos columnas del patrón "Configuración | Vista previa" (ChecklistEditor,
// PlantillaFacturaEditor de obras-sociales-ui): editor a la izquierda, resultado de solo
// lectura a la derecha, siempre visibles en simultáneo (nunca uno detrás de un toggle).
export function SectionBadge({ tone, icon, children }: { tone: 'config' | 'preview'; icon?: ReactNode; children: ReactNode }) {
  return (
    <span
      className={`flex w-fit items-center gap-xs rounded-pill px-md py-xs font-body text-[11px] font-semibold tracking-[0.04em] uppercase ${sectionBadgeToneClasses[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}

// Ancho de barra de progreso: Tailwind solo genera CSS de clases que aparecen como texto literal
// en el código fuente, nunca de un string armado en runtime (`w-[${pct}%]` no compila a nada) —
// mismo criterio que chipColors/Swatch más arriba. Se redondea a múltiplos de 5 y se resuelve por
// lookup contra esta tabla estática con las 21 clases ya escritas.
const PROGRESS_WIDTH_CLASSES: Record<number, string> = {
  0: 'w-0',
  5: 'w-[5%]',
  10: 'w-[10%]',
  15: 'w-[15%]',
  20: 'w-[20%]',
  25: 'w-[25%]',
  30: 'w-[30%]',
  35: 'w-[35%]',
  40: 'w-[40%]',
  45: 'w-[45%]',
  50: 'w-[50%]',
  55: 'w-[55%]',
  60: 'w-[60%]',
  65: 'w-[65%]',
  70: 'w-[70%]',
  75: 'w-[75%]',
  80: 'w-[80%]',
  85: 'w-[85%]',
  90: 'w-[90%]',
  95: 'w-[95%]',
  100: 'w-full',
};

const PROGRESS_BG_CLASSES: Record<'success' | 'warning' | 'danger' | 'info', string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
};

export function redondearProgreso(pct: number): number {
  return Math.min(100, Math.max(0, Math.round(pct / 5) * 5));
}

// Barra de progreso genérica (service preventivo de vehículos, % de documentos cargados, etc.) —
// un solo lugar que resuelve el problema de ancho dinámico descripto arriba.
export function ProgressBar({ pct, kind = 'success' }: { pct: number; kind?: 'success' | 'warning' | 'danger' | 'info' }) {
  const pctRedondeado = redondearProgreso(pct);
  return (
    <div className="h-2 w-full overflow-hidden rounded-pill bg-surface-soft">
      <div className={`h-full rounded-pill ${PROGRESS_BG_CLASSES[kind]} ${PROGRESS_WIDTH_CLASSES[pctRedondeado]}`} />
    </div>
  );
}
