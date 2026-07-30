## Context

### Lo que ya existe

`auth-frontend-real` dejó tres piezas listas y probadas:

```
shared/lib/auth/permisos.ts   tienePermiso(rol, permisos, modulo, nivelMinimo) → boolean
                              jerarquía read(1) < write(2) < admin(3); rol 'admin' short-circuita a true
shared/auth/usePermiso.ts     usePermiso(modulo, nivelMinimo) → boolean
                              devuelve false si status !== 'authenticated'
app/routes.ts                 moduloDeRuta(path) → Modulo | null | undefined
                              null = ruta declarada sin módulo propio; undefined = ruta no declarada (sin acceso)
```

Los cuatro módulos del backend son exactamente `pacientes`, `obra_social`, `facturacion` y `conductores`, y `APP_ROUTES` ya mapea las 8 rutas del frontend contra ellos.

### Lo que falta

`usePermiso(_, 'write')` no se llama en ninguna parte. Los únicos dos llamadores piden `'read'`: `app/SidebarNav.tsx:45-47` (filtra el sidebar) y `shared/auth/RequireAuth.tsx:40` (bloquea la navegación a la ruta).

### Restricción de estructura que gobierna todo este diseño

La superficie total del gateo son ~40 componentes repartidos en 4 módulos, y están a distinta profundidad. En este módulo, `ObraSocialForm` es hijo de `ObraSocialesPage` (43 líneas, un switch entre lista y detalle), pero `ChecklistItemRow` y `PlantillaCampoRow` cuelgan de `ChecklistEditor` / `PlantillaFacturaEditor`, que a su vez cuelgan de `ObraSocialDetail`. **Ninguno de esos componentes sabe —ni tiene por qué saber— a qué módulo del backend pertenece la pantalla en la que está montado.** `ChecklistItemRow` es una fila de checklist; que su pantalla contenedora se gatee contra `obra_social` es una preocupación ajena a él.

Esto descarta de entrada pasar `modulo` por props (rompe la regla de "no prop drilling más de 2 niveles") y hacer que cada componente llame `usePermiso('obra_social', 'write')` a mano (disemina literales de módulo, cada uno una oportunidad de escribir el equivocado, y ningún test local lo detectaría: pasaría igual gateando contra el módulo errado).

### Frontera de seguridad (no negociable)

La autorización efectiva la impone la RLS: `modulos.tiene_permiso(mod, 'write')`, desplegada en `20260724100003..100006`. **Todo lo que este diseño construye es experiencia de uso.** El código nuevo debe llevar el mismo comentario explícito que ya llevan `permisos.ts` y `SidebarNav.tsx`, y el spec lo fija en un requisito propio.

## Goals / Non-Goals

**Goals:**

- Construir el mecanismo compartido de gateo de escritura que los otros tres changes del split van a consumir sin modificarlo.
- Estrenarlo cableando el módulo `obra_social` completo.
- Un único punto donde se resuelve "¿puede escribir en esta pantalla?".
- Que un componente exprese "esto requiere escritura" sin saber en qué módulo vive.
- Que los ~190 tests existentes sigan pasando **sin tocarlos**.
- Preservar operativas las acciones que una cuenta de solo lectura debe poder ejecutar.

**Non-Goals:**

- No es un cambio de seguridad: no se toca ninguna policy de RLS ni Edge Function.
- No se modifica `tienePermiso`, `usePermiso`, la jerarquía de niveles, ni el gateo de navegación por `read`.
- No se cablean los otros tres módulos (cada uno tiene su change).
- No se gatea `/cuentas` (rol `admin` vía `requiereRolAdmin`, ya funciona), ni el Dashboard, ni `/design-system`, ni `LoginPage`.
- No se traduce el error de RLS del servidor a un mensaje amigable — problema real, pero otro.

## Decisions

### D1 — Contexto de React por ruta, sembrado en `RequireAuth`

Un contexto expone un único booleano, `puedeEscribir`, a toda la pantalla activa, derivado del módulo de la ruta —el que `RequireAuth` **ya resuelve** con `moduloDeRuta(location.pathname)` para su gateo de `read`— cruzado con `usePermiso(modulo, 'write')`.

```
                       ┌─────────────────────────────────────┐
  location.pathname ──►│ moduloDeRuta()   (app/routes.ts)    │──► Modulo | null | undefined
                       └─────────────────────────────────────┘
                                        │
  useAuth() ─────────► usePermiso(modulo, 'write') ──► boolean
                                        │
                       ┌────────────────▼────────────────────┐
                       │ proveedor en RequireAuth (<Outlet/>) │  un solo lugar
                       └────────────────┬────────────────────┘
                                        │ context
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                               ▼
  ObraSocialForm            ChecklistItemRow             PlantillaCampoRow
  usePuedeEscribir()        usePuedeEscribir()           usePuedeEscribir()
   (no sabe el módulo)       (no sabe el módulo)          (no sabe el módulo)
```

`RequireAuth` es el punto de inyección correcto: ya está en el camino de **todas** las rutas protegidas, ya calculó el módulo, y ya garantizó `status === 'authenticated'` cuando renderiza su `<Outlet />`. Envolver ahí cubre las 8 rutas de una vez y ninguna página tiene que acordarse de montar un provider — lo que también significa que los otros tres changes del split **no tocan esta parte**.

**Resolución del valor:**

| `moduloDeRuta(path)` | `puedeEscribir` | Por qué |
|---|---|---|
| `Modulo` | `usePermiso(modulo, 'write')` | El caso normal |
| `null` (Dashboard, `/cuentas`, `/design-system`) | `true` | Sin módulo no hay nada que gatear por módulo. `/cuentas` ya está gateada por rol antes de llegar acá |
| `undefined` (ruta no declarada) | irrelevante | `RequireAuth` ya devolvió `AccesoDenegado` y nunca renderizó el provider |

El fallback fuera del provider también es `true`: preserva exactamente el comportamiento actual para un componente mal ubicado o para un test que monta un formulario aislado sin router. **Esto es lo que mantiene verdes los ~190 tests existentes sin editarlos.** Es defendible precisamente porque no es una frontera de seguridad: fallar hacia "habilitado" significa "el servidor rechaza", no "se filtró un permiso".

**Alternativa descartada — `usePermiso('obra_social', 'write')` en cada componente.** Cero infraestructura, pero disemina literales de módulo, obliga a subcomponentes genéricos a conocer su contenedor, y un módulo mal escrito pasaría los tests igual.

**Alternativa descartada — `puedeEscribir` por props desde cada página.** Cadenas de 3-4 niveles (`ObraSocialesPage → ObraSocialDetail → ChecklistEditor → ChecklistItemRow`), viola la regla de prop drilling, y olvidarse en un nivel intermedio es un fallo silencioso.

**Alternativa descartada — sembrar en `AppShell`.** No calcula el módulo de la ruta activa ni garantiza sesión autenticada; habría que duplicar la resolución que `RequireAuth` ya hace.

### D2 — `usePuedeEscribir()` sin argumentos

```ts
export function usePuedeEscribir(): boolean
```

Sin parámetros a propósito: el componente declara *que necesita escritura*, no *contra qué módulo*. Eso segundo es responsabilidad de la ruta. Devuelve un primitivo, no un objeto, con el mismo criterio ya documentado en `usePermiso.ts` (objeto solo cuando se exponen más de dos valores).

### D3 — `<fieldset disabled>` para bloques de formulario, no `disabled` campo por campo

Una primitiva del design system envuelve un bloque en un `<fieldset disabled>` nativo cuando la cuenta no puede escribir. El navegador deshabilita **todos** los controles descendientes —`input`, `select`, `textarea` y `button`, incluidos los `<button>` nativos— de una vez, incluso los de subcomponentes anidados que la primitiva no conoce.

Esto es lo que hace viable el alcance del split entero. En este módulo: `ObraSocialForm` tiene 8 campos `Field`/`Input`/`Select`, y `ChecklistItemRow` y `PlantillaCampoRow` traen 3 `<button>` nativos cada uno (`iconTacho`, `iconFlechaArriba`, `iconFlechaAbajo`) que **no** son componentes `Button` del design system. Un envoltorio los cubre todos sin tocar ninguna firma.

Es HTML nativo, no una emulación: los lectores de pantalla anuncian los controles como deshabilitados, el foco los saltea y los `submit` no disparan.

Costos aceptados: hay que neutralizar los estilos de agente de usuario del `<fieldset>` con utilidades Tailwind (`min-w-0 border-0 p-0 m-0`) para no mover el layout ni un píxel; y `disabled` no afecta al primer `<legend>`, que acá no se usa.

**Alternativa descartada — `disabled` en cada campo.** Cientos de campos en el split completo, cada uno un olvido posible, y obliga a que cada subcomponente acepte y propague un `disabled` propio.

**Alternativa descartada — `pointer-events: none` + opacidad.** Bloquea el mouse pero no el teclado ni el envío, y no comunica nada a la capa de accesibilidad. Es apariencia de deshabilitado, no deshabilitado.

**Alternativa descartada — vista de solo lectura paralela** (datos como texto plano). Mejor experiencia, pero duplica el árbol de render de cada formulario. Anotada como mejora futura, fuera del split.

### D4 — El arrastre NO lo cubre el fieldset: hay que bloquearlo aparte

`<fieldset disabled>` deshabilita controles de formulario, pero **un elemento `draggable` sigue arrastrándose dentro de un fieldset deshabilitado**. En este módulo eso importa concretamente: `ChecklistItemRow.tsx:39` y `PlantillaCampoRow.tsx:53` ponen `draggable` sobre el `<li>` con `onDragStart` / `onDragOver` / `onDrop`, y reordenar por arrastre **es** una escritura.

Son los **dos únicos componentes con `draggable` en todo el proyecto** (verificado con grep sobre `features/` y `shared/`), así que el hueco se descubre y se cierra acá, en el change más chico, en vez de aparecer como un bug en el más grande.

Solución: el atributo `draggable` y los handlers de arrastre se condicionan a `usePuedeEscribir()`. Sin permiso, la fila no es arrastrable (`draggable={false}` y handlers ausentes), de modo que no queda un arrastre que "parece funcionar" y no persiste nada.

Esta decisión es una advertencia explícita para los otros tres changes del split: **el fieldset no es una red que atrape todo**. Cualquier escritura que no pase por un control de formulario (arrastre, atajos de teclado, gestos) necesita su propio gateo. `ParadasList` en `gateo-conductores` reordena con botones (`:78`, `:87`), no con arrastre, así que ahí el fieldset sí alcanza — pero eso se verifica, no se asume.

### D5 — En `Button`, opt-in explícito; jamás automático

`Button` recibe una prop booleana opcional que declara que la acción escribe. Cuando está declarada y `usePuedeEscribir()` es `false`, el botón se renderiza deshabilitado reutilizando `BUTTON_DISABLED_CLASSES`, el estilo de deshabilitado que el componente ya tiene.

**Es opt-in y nunca automático.** De los ~78 usos de `Button` en el proyecto, muchos no escriben y **deben** seguir funcionando con solo `read`:

| Botón | Ejemplos | Escribe |
|---|---|---|
| `Cancelar` | `ObraSocialForm:154` y 6 formularios más | no |
| `Volver al listado` | `VolverAlListadoLink` / `VolverAlListadoButton` | no |
| Conmutadores de vista | `HojaDeRutaPage:131,135,139` | no |
| `Reintentar` | `CuentasList:45` | no |
| `Crear` / `Editar` / `Guardar` | listados, detalles, formularios | **sí** |

Un `Button` que se auto-deshabilita al detectar solo-lectura atraparía las cuatro primeras filas y dejaría a la cuenta encerrada en un formulario sin poder cancelar. El opt-in cuesta una prop por call site de escritura; el automático cuesta una regresión de usabilidad difícil de ver en tests.

**Retrocompatibilidad:** la prop es opcional y su ausencia mantiene el comportamiento actual, así que ninguno de los ~78 call sites cambia de conducta hasta que se lo edite — condición necesaria para que los otros tres changes puedan avanzar sin que este los rompa.

**Interacción con `disabled`:** si un call site ya pasa `disabled` (por ejemplo `MatrizPermisos:53,56` con `!hayCambios || guardando`), el resultado es la disyunción de ambas condiciones. El gateo de permiso nunca *habilita* un botón que su propia lógica quería deshabilitado.

### D6 — Un aviso visible por pantalla de módulo, reutilizando `Alert`

Controles deshabilitados sin explicación se leen como una aplicación rota (decisión 2 de la usuaria: sí al indicador). Cuando `puedeEscribir` es `false`, la pantalla del módulo muestra un aviso con `Alert` (`design-system/feedback.tsx`), en el mismo molde que `AvisoModeloDatos` / `AvisoPendienteCliente`. No se crea un componente de aviso desde cero: `Alert` ya cubre tono, énfasis, `role` y título en negrita.

El aviso va en `ObraSocialesPage` (43 líneas, el switch lista/detalle), que es el punto donde cubre tanto la lista como el detalle con una sola inserción. **Este es el patrón que los otros tres changes replican en su propia página de módulo.**

### D7 — Pruebas: dos direcciones por comportamiento, con `renderConSesion`

Cada comportamiento se prueba en las dos direcciones, que es también el mínimo de triangulación del modo Strict TDD del proyecto:

- cuenta con `write` (o rol `admin`) sobre el módulo → la acción está habilitada;
- cuenta con solo `read` → la acción está deshabilitada.

`renderConSesion(ui, opciones)` (`shared/test/renderConSesion.tsx`) ya permite declarar el escenario de permisos, y su default (admin con todos los permisos) mantiene verdes los ~190 tests existentes. Las aserciones van sobre comportamiento observable —`toBeDisabled()`, el `onSubmit` que no dispara, el repositorio mock que no recibe llamadas— nunca sobre el valor del contexto ni sobre la presencia de una clase CSS.

El caso del rol `admin` tiene su propio ciclo: `tienePermiso` le da `true` sin consultar la matriz, así que un `admin` **sin ninguna fila** en `modulos.permisos` debe tener todo habilitado. Es el falso negativo más caro (dejar a la administradora sin poder escribir) y un test de "solo read" no lo detecta.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Falso negativo: deshabilitar a quien sí puede escribir**, sobre todo al rol `admin`, que short-circuita en `tienePermiso` y puede no tener filas en la matriz | Ciclo TDD propio para `admin` sin filas de permisos, además del par `write` → habilitado / `read` → deshabilitado por comportamiento |
| **Deshabilitar de más** — atrapar `Cancelar` o `Volver al listado` y encerrar a la cuenta sin salida | D5: opt-in explícito, nunca automático. La tabla de D5 es el inventario de lo que **no** se toca, y hay un ciclo TDD dedicado a `Cancelar` |
| **El arrastre se escapa del fieldset** y el reordenamiento sigue vivo para una cuenta de solo lectura | D4: `draggable` y handlers condicionados al permiso. Los 2 únicos componentes con `draggable` del proyecto son de este módulo, así que se cierra acá |
| **El mecanismo compartido nace mal y los otros 3 changes heredan el error** | Se estrena en la superficie más chica (8 puntos de escritura, 1 ruta, sin documentos), y las primitivas quedan registradas en la vitrina `/design-system` antes de que los otros changes las consuman |
| **Romper los ~190 tests existentes** al cambiar `Button` o `RequireAuth` | D1 (fallback `true` fuera del provider) + D5 (prop opcional, ausencia = comportamiento actual). Verificado contra la línea base en cada tarea |
| **OWASP A04 *Insecure Design*** — que se lea este gateo como la frontera de autorización y mañana se relaje una policy "porque el frontend ya lo controla" | Requisito propio en el spec + comentario explícito en el código nuevo, con el mismo lenguaje de `permisos.ts` y `SidebarNav.tsx` |
| **Divergencia con la semántica del servidor** | No se toca `tienePermiso` ni `ORDEN_NIVEL`. Este change solo *consume* la función existente con `'write'` en vez de `'read'`: la semántica es la misma porque el código es el mismo |
| **`<fieldset>` altera el layout** (borde, padding, `min-width: min-content` del agente de usuario) | Neutralizado con utilidades Tailwind en la primitiva. Cero estilos inline |
| **El fieldset atrapa un `Cancelar`** que quedó dentro del bloque envuelto | El envoltorio se aplica al bloque de campos, no a la barra de acciones. Verificado con un ciclo TDD propio |

## Migration Plan

Cero SQL, cero Edge Functions, cero dependencias nuevas, cero estado persistido. Se despliega con el build normal del frontend.

**Rollback:** revertir el commit devuelve Obras Sociales a su comportamiento actual. Como el contexto arranca en `true` sin módulo y las primitivas son opt-in, revertir solo el cableado y dejar el mecanismo tampoco rompe nada. No hay feature flag que limpiar.

**Verificación manual (humana, no automatizable con mocks):** con una cuenta real de solo `read` sobre `obra_social` contra el proyecto Supabase, confirmar que (a) *Crear*/*Editar*/*Guardar* están visibles pero bloqueados, (b) el aviso de solo lectura aparece, (c) `Cancelar` y *Volver al listado* siguen funcionando, (d) las filas de checklist y de plantilla no se pueden arrastrar, y (e) una cuenta con `write` no ve nada deshabilitado. A cargo de la usuaria; mismo patrón de cierre que `auth-frontend-real`.

## Open Questions

Ninguna. Las cinco del análisis paraguas quedaron resueltas por la usuaria el 2026-07-29 (ver `proposal.md` §Decisiones ya cerradas). Lo único pendiente es la aprobación humana de gobernanza CRÍTICO para empezar a escribir código.

## Governance

Dominio **auth/permisos → nivel CRÍTICO** en la tabla de Agent Governance del proyecto. **`/opsx:apply` requiere aprobación humana explícita antes de escribir una sola línea**, y el cierre requiere la verificación manual del Migration Plan.
