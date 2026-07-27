## Why

El design system del proyecto (`frontend/src/design-system/components.tsx`) resolvió bien los primitivos que se detectaron temprano — `Section`, `Button`, `Chip`, `SearchInput`, `ProgressBar`, `SectionBadge`, `AvisoModeloDatos`, `VolverAlListado*` — pero **se quedó corto en los cinco patrones que más se repiten en pantalla**: campo de formulario, caja de error/aviso, contenedor tipo tarjeta, tabla y badge neutro. Al no existir esos primitivos, cada feature los reimplementó a mano con strings de clases Tailwind copiados.

Números medidos sobre `frontend/src/features/*` (auditoría completa, ver engram `architecture/design-system-status`):

| Patrón duplicado | Ocurrencias | Archivos |
|---|---|---|
| `fieldClasses` / `labelClasses` (campo + label de formulario) | 227 | 25 |
| Caja de error `role="alert"` con `border-danger-soft bg-danger-soft … text-danger` | 29 | 29 |
| Contenedor `rounded-sm border border-border bg-surface p-lg [shadow-sm]` | 21+ | 21 |
| Tabla manual (`px-sm py-xs`, `border-t border-border`, `tabular-nums`) | 4 | 4 |
| Badge neutro `rounded-pill bg-surface-soft … text-muted` / estado vacío | 3 + 4 | 7 |

El costo ya se está pagando: `hojas-de-ruta` tuvo que crear `formFieldClasses.ts` para que dos formularios del **mismo** feature no se vieran distintos, y `RecorridoStat.tsx` documenta explícitamente que existe "para que los tres bloques se vean idénticos". Son parches locales al mismo problema global. Cualquier ajuste de estilo hoy es un find-and-replace de 227 lugares, y cada feature nueva arranca copiando el string de otro feature — la deriva visual es cuestión de tiempo, no de si pasa.

Este change **no agrega funcionalidad de negocio**: cierra la deuda de infraestructura de UI antes de que entren más features encima. No lleva prefijo `C-NN` porque no es un módulo de `CHANGES.md` sino la base transversal que todos consumen.

> ## ⛔ RESTRICCIÓN DURA — CERO CAMBIO VISUAL. Leer esto antes que nada.
>
> Instrucción textual del usuario: **"los componentes y pantallas quiero que queden tal cual están ahora. Tenés que ajustar y crear los componentes pero que no cambien nada del diseño actual."**
>
> Este change es una **extracción / DRY refactor puro**. Después de aplicarlo, **ninguna pantalla puede verse distinta de como se ve hoy**, ni un píxel. Concretamente:
>
> 1. **Cada componente nuevo reproduce EXACTAMENTE las clases Tailwind que ya están en los sitios que reemplaza.** No se "mejoran", no se normalizan, no se homogeneizan, no se corrigen inconsistencias.
> 2. **Donde el mismo patrón hoy tiene variantes distintas en sitios distintos, el componente soporta TODAS las variantes vía prop** y cada pantalla conserva la suya. Ejemplo medido: el contenedor tipo tarjeta usa `rounded-sm` en formularios y detalles pero `rounded-md` en las tarjetas clickeables de los listados y en las sub-tarjetas anidadas → `Card` lleva `radius="sm" | "md"`. **Nunca** forzar todas las pantallas a un solo valor.
> 3. **No se agregan props/variantes/estados que hoy no existan en ningún sitio real**, salvo que sean estrictamente necesarios para que la migración sea posible sin cambiar el resultado visual — y en ese caso con el estilo exacto que el sitio ya tiene a mano (ej.: `Button` gana `disabled` con `disabled:cursor-not-allowed disabled:opacity-40`, que es literalmente lo que `ParadasList.tsx` escribe hoy; no se inventa un estilo de disabled nuevo).
> 4. **Cada task de migración tiene como criterio de aceptación que las clases finales aplicadas sean idénticas a las actuales**, constatado (snapshot de `className` o comparación visual), no asumido. "Usa el componente nuevo" no alcanza.
> 5. **Si consolidar de verdad exigiera un cambio visual, por mínimo que sea, NO se hace.** Queda documentado en `design.md` §"Casos que requerirían cambio visual" y en `tasks.md` como task **opcional, pendiente de aprobación explícita del usuario**, fuera del scope por defecto.
>
> **Base de diseño: el design system actual, NO `docs/design/prototype.html`.** Decisión previa del usuario (engram, preferencia registrada). La API y el markup se derivan de cómo ya están hechos `Button` / `Chip` / `Section` / `SearchInput` en `components.tsx` — misma convención de props (union de string literal + lookup estático `Record<Variante, string>`). `prototype.html` sirve solo como catálogo conceptual de qué patrones existen; **nunca** como fuente de CSS a portar.

> **Governance MEDIO.** Es una librería de UI consumida por lógica de negocio de 8 features, pero no toca datos sensibles, auth ni persistencia. Se implementa con checkpoints por bloque de migración (no hace falta aprobación humana paso a paso), surfaceando las decisiones no obvias documentadas en `design.md`.

## What Changes

- **Se agrega `frontend/src/design-system/semanticColors.ts`**: se mueve ahí `chipColors` (hoy en `components.tsx`) y se le agrega la clave **`borderSoft`** (`border-danger-soft`, `border-success-soft`, …). `components.tsx` lo re-exporta para no romper a los 5 consumidores actuales de `chipColors`. La clave nueva es lo que permite que `Alert` reproduzca **byte a byte** la caja de error actual, que usa borde *soft* (no el borde fuerte de `chipColors.border`).
- **Se agrega `frontend/src/design-system/form.tsx`** con `Label`, `Input`, `Select`, `Textarea`, `FieldError` y `Field` (molécula label + control + error). Los tres controles envuelven el elemento nativo y aceptan sus props nativas, de modo que la migración sea "sacar `className={fieldClasses}`" y nada más. Llevan **`density: 'comfortable' | 'compact' | 'tight'`** y **`placeholderTone`/`fullWidth`** porque los 25 archivos hoy **no** usan un único string de clases: conviven `px-md py-2 text-[13px]` (mayoría), `px-sm py-1.5 text-[13px]` (`PlantillaCampoRow`) y `px-sm py-1 text-xs/[12px]` (`FacturaCobrosSection`, `VistaGlobalHojaDeRuta`), más dos sitios con `placeholder:text-faint`. Se preserva cuál pantalla usa cuál. Se establece la convención de id de error `{idDelControl}-error` para el cableado ARIA.
- **Se agrega `frontend/src/design-system/feedback.tsx`** con `Alert` (`tone: SemanticStatus`, `emphasis: 'flat' | 'accent'`, `size: 'md' | 'sm'` para preservar los sitios que hoy usan `text-[12px]` en vez de `text-[13px]`, `icon`, `title`, `role`) más `EmptyState` y `Pill`. `AvisoModeloDatos` y `AvisoPendienteCliente` se **reescriben como wrappers finos sobre `Alert`** conservando su API pública actual **y su markup exacto**: cero churn en sus call sites y cero cambio visual.
- **Se agrega `frontend/src/design-system/layout.tsx`** con `Card` (`<div>`), `CardForm` (`<form onSubmit>`) y `Panel` (`<section aria-labelledby>` + `<h2>` + slot `action`) — los tres sobre la misma constante de clases interna, parametrizada por **`radius: 'sm' | 'md'`**, **`padding`**, **`gap`**, **`elevated`** e **`interactive`**. Los cinco ejes existen porque están medidos en el repo: `rounded-sm` en formularios/detalles vs `rounded-md` en las 4 tarjetas clickeables de listado (`cursor-pointer transition-colors hover:border-border-strong hover:bg-surface`) y en las sub-tarjetas anidadas de `DireccionesEditor`/`PersonasACargoEditor`/`DocumentChecklist`/`AsignacionSemanalTabla`; y `gap-sm`/`gap-md`/`gap-lg`/`gap-xl` conviven sobre el mismo contenedor. Ningún sitio cambia de valor.
- **Se agrega `frontend/src/design-system/table.tsx`** con `Table` (wrapper `overflow-x-auto` + `<table>` + `<caption className="sr-only">`), `Tr`, `Th` y `Td`. Son primitivos de **estilo**, no una data-table configurable por columnas: `<thead>`/`<tbody>` siguen siendo nativos y el caller conserva `scope="row"`, celdas de encabezado y contenido arbitrario.
- **Se extiende `Button`** (no se crea un botón paralelo) con `size: 'md' | 'sm' | 'xs'`, la variante `secondary-accent` y `disabled`, **exclusivamente** para poder absorber el "mini botón secundario" que hoy está duplicado 9 veces (`cursor-pointer rounded-sm border border-border-strong bg-surface px-md py-xs font-body text-xs font-semibold text-primary`, ±`px-sm`, ±`disabled:cursor-not-allowed disabled:opacity-40`) en los 5 listados, `DocumentChecklist` y `ParadasList`. `size='md'` reproduce el `Button` actual byte a byte y sigue siendo el default → los ~40 call sites existentes no cambian ni de API ni de aspecto.
- **Se migran los 25 archivos con `fieldClasses`/`labelClasses`, los 29 con la caja de error y los 21+ con el contenedor de tarjeta** a los primitivos nuevos, feature por feature, **cada uno conservando su variante actual**. Se **borra** `frontend/src/features/hojas-de-ruta/formFieldClasses.ts` (queda sin razón de ser).
- **Quedan fuera del scope por defecto, marcadas como opcionales pendientes de aprobación**, las pocas migraciones que exigirían un cambio visual (ver `design.md` §"Casos que requerirían cambio visual"): el campo mono de `CudFields`, el campo con prefijo `$` de `AutorizacionForm`, los botones-ícono de `ChecklistItemRow`/`PlantillaCampoRow` y el mini botón `danger` de `ParadasList`.
- **Se amplía `DesignSystem.tsx`** (catálogo visual) con las secciones de los componentes nuevos, para que el catálogo siga siendo el inventario real y no quede desfasado.
- **Fuera de alcance (NO se toca):** los tokens de `@theme` en `frontend/src/index.css` (ya sincronizados, no cambian ni un valor); el aspecto de `Chip`/`Section`/`SearchInput`/`ProgressBar`/`SectionBadge`/`NavIcon`/`InlineIcon`/`icons.tsx` (no se rediseñan, solo son la referencia de convención); el aspecto de `Button` en su uso actual (`size='md'` es byte-idéntico y default); cualquier cambio de comportamiento, validación o regla de negocio de las features migradas; `Modal`/`Tabs`/`Tooltip`/`Toast` (no hay uso real hoy — YAGNI); `loading` en `Button` (ningún sitio lo tiene hoy → agregarlo violaría la regla 3); librerías externas de UI (`shadcn`, `headlessui`, `cva`, `clsx`) — cero dependencias nuevas.
- **Explícitamente fuera de alcance: unificar inconsistencias.** Que `AsignacionPanel` use `text-[12px]` en su caja de error y `HojaDeRutaPage` use `text-[13px]` en la suya es una inconsistencia real — y se **preserva tal cual**. Detectarlas y anotarlas es parte del entregable; resolverlas, no.

## Capabilities

### New Capabilities
- `design-system-campos-formulario`: primitivos de campo de formulario (`Label`, `Input`, `Select`, `Textarea`, `FieldError`, `Field`) con una única fuente de verdad de estilo, estado inválido y cableado ARIA (`aria-invalid` + `aria-describedby`) por convención de id.
- `design-system-feedback`: componente `Alert` con tono semántico y dos énfasis (plano y con barra de acento), más `EmptyState` y `Pill`; `AvisoModeloDatos`/`AvisoPendienteCliente` pasan a construirse sobre `Alert` sin cambiar su API.
- `design-system-contenedores`: contenedores `Card` / `CardForm` / `Panel` con espaciado y elevación por variante cerrada, cubriendo los tres elementos HTML en que el patrón aparece hoy (`div`, `form`, `section` con encabezado accesible).
- `design-system-tabla`: primitivos de tabla (`Table`, `Tr`, `Th`, `Td`) que aportan estilo, scroll horizontal y `caption` accesible conservando la semántica nativa de la tabla del caller.

### Modified Capabilities
<!-- Ninguna. Es un refactor de infraestructura de UI: no cambia ningún requirement de negocio de las capabilities existentes (obra-social-*, paciente-*, vehiculo-*, conductor-*, presupuesto-*, factura-*, hoja-de-ruta-*). Su comportamiento observable queda idéntico y sus tests existentes son la red de seguridad. -->

## Impact

- **Código nuevo:** `frontend/src/design-system/semanticColors.ts`, `form.tsx`, `feedback.tsx`, `layout.tsx`, `table.tsx` y sus tests (`*.test.tsx`, Vitest + React Testing Library).
- **Código modificado:** `frontend/src/design-system/components.tsx` (mueve `chipColors`, reescribe los dos `Aviso*` sobre `Alert`), `DesignSystem.tsx` (catálogo) y ~35 archivos de `frontend/src/features/*` migrados (obras-sociales, pacientes, vehículos, conductores, presupuestos, hojas de ruta, facturación, dashboard).
- **Código borrado:** `frontend/src/features/hojas-de-ruta/formFieldClasses.ts`.
- **Sin impacto en:** tipos del dominio, repositories, mocks, hooks, contexts, router, Supabase, RLS, `knowledge-base/`, `CHANGES.md`.
- **Red de seguridad:** las 152 suites de test existentes (`npm test`) cubren las pantallas migradas y quedan **sin modificar** — si una migración cambia comportamiento observable, rompen. Los tests que consultan por `getByLabelText`/`getByRole` deben seguir pasando sin tocarlos; si alguno necesita cambiar, es señal de regresión, no de test desactualizado.
- **Habilita aguas abajo:** cualquier feature nueva arranca con campos, alertas, tarjetas y tablas ya resueltos; y un cambio de estilo global (radios, densidad, tono de error) pasa a ser una edición en un archivo en vez de 227.
- **Riesgo principal:** deriva visual accidental durante la migración (un `gap-md` que era `gap-lg`, un `rounded-md` que se vuelve `rounded-sm`, un `text-[13px]` que era `text-[12px]`). Es *el* riesgo del change, porque la restricción dura es justamente cero cambio visual. Se mitiga con tres controles: (a) los primitivos exponen como prop cada eje en que el repo hoy varía, (b) migración feature por feature con checkpoint, (c) criterio de aceptación por task de que las clases finales coincidan, constatado y no asumido.

## Success Criteria

- [ ] **Cero cambio visual en toda la app.** Para cada sitio migrado, las clases finales aplicadas son idénticas a las previas (verificado por comparación de `className` renderizado contra el estado previo, o por revisión visual lado a lado de la pantalla). Cualquier diferencia es un bug a corregir, nunca un rediseño a aceptar.
- [ ] Cero ocurrencias de `fieldClasses`/`labelClasses` en `frontend/src` (constante y string literal), y `formFieldClasses.ts` borrado.
- [ ] Cero ocurrencias del literal `border-danger-soft bg-danger-soft` fuera de `design-system/`.
- [ ] Cero ocurrencias del literal `rounded-sm border border-border bg-surface p-lg` ni de `rounded-md border border-border bg-surface p-lg shadow-sm cursor-pointer` fuera de `design-system/`.
- [ ] Los ~40 call sites existentes de `Button` no cambiaron ni una línea (el default `size='md'` es byte-idéntico al `Button` actual).
- [ ] `npx tsc -b --noEmit` (dentro de `frontend/`) sin errores y sin un solo `any` nuevo.
- [ ] `npm test` verde con las suites existentes **sin modificar** (`git diff --stat` no muestra ningún `*.test.*` preexistente tocado).
- [ ] `npm run lint` (oxlint) sin errores nuevos.
- [ ] `DesignSystem.tsx` muestra los componentes nuevos **con todas sus variantes**, para que la comparación visual sea posible de un vistazo.
- [ ] Ningún `style={{}}` inline y ninguna clase Tailwind armada por interpolación de string en el código nuevo.
- [ ] Las migraciones que requerirían cambio visual quedaron **sin hacer** y listadas como pendientes de aprobación, no coladas en el diff.

## Rollback

Cada bloque de migración es un commit `refactor:` independiente y aislado por feature, encima de commits `feat:` que solo **agregan** archivos nuevos al design system. Revertir es `git revert` del bloque afectado: los componentes nuevos pueden quedar en el repo sin consumidores (inertes, no rompen nada) mientras el feature vuelve a su markup anterior. No hay migración de datos, ni cambio de esquema, ni flag de despliegue que revertir.
