## Context

### Lo que ya existe

`auth-frontend-real` dejó tres piezas listas y probadas:

```
shared/lib/auth/permisos.ts   tienePermiso(rol, permisos, modulo, nivelMinimo) → boolean
                              jerarquía read(1) < write(2) < admin(3); rol 'admin' short-circuita a true
shared/auth/usePermiso.ts     usePermiso(modulo, nivelMinimo) → boolean
                              devuelve false si status !== 'authenticated'
app/routes.ts                 moduloDeRuta(path) → Modulo | null | undefined
                              null  = ruta declarada sin módulo propio (Dashboard, /cuentas, /design-system)
                              undefined = ruta no declarada → el guard la trata como SIN acceso
```

Los cuatro módulos del backend son exactamente `pacientes`, `obra_social`, `facturacion`, `conductores`, y `APP_ROUTES` ya mapea las 8 rutas del frontend contra ellos (Vehículos y Hojas de Ruta caen bajo `conductores`; Presupuestos bajo `facturacion`).

### Lo que falta

`usePermiso(_, 'write')` no se llama en ninguna parte. Los únicos dos llamadores piden `'read'`:

```
app/SidebarNav.tsx:45-47      filtra qué módulos aparecen en el sidebar
shared/auth/RequireAuth.tsx:40 bloquea la navegación entera a la ruta
```

### Restricción real de estructura

Los componentes que escriben no son 4, son ~40, y están a distinta profundidad. `PacienteForm` es hijo directo de `PacientesPage`, pero `DireccionesEditor`, `CudFields`, `PersonasACargoEditor`, `ChecklistEditor`, `PlantillaFacturaEditor`, `AsistenciasEditor`, `CobrosPanel`, `ParadasList` y `AsignacionSemanalTabla` viven a 3-4 niveles de la página. **Ninguno de ellos sabe —ni tiene por qué saber— a qué módulo del backend pertenece la pantalla en la que está montado.** `DireccionesEditor` es un editor de direcciones; que su pantalla contenedora se gatee contra el módulo `pacientes` es una preocupación ajena a él.

Esto descarta de entrada dos caminos: pasar `modulo` por props (rompe la regla de "no prop drilling más de 2 niveles") y hacer que cada componente llame `usePermiso('pacientes', 'write')` a mano (~40 literales de módulo dispersos, cada uno una oportunidad de escribir el módulo equivocado, y ninguna forma de detectarlo con tests locales).

### Frontera de seguridad (no negociable)

La autorización efectiva la impone la RLS del servidor: `modulos.tiene_permiso(mod, 'write')`, ya desplegada en `20260724100003..100006`. **Todo lo que este diseño construye es experiencia de uso.** Un cliente parcheado no escribe una fila más de las que la RLS permite. El código nuevo debe llevar el mismo comentario explícito que ya llevan `permisos.ts` y `SidebarNav.tsx`, y el spec debe decirlo en un requisito propio.

## Goals / Non-Goals

**Goals:**

- Que una cuenta con solo `read` sobre un módulo no vea ofrecidas acciones de escritura que el servidor va a rechazar.
- Un único punto donde se resuelve "¿puede escribir en esta pantalla?" — no ~40.
- Que un componente de feature exprese "esto requiere escritura" sin saber en qué módulo vive.
- Que las ~190 pruebas existentes sigan pasando sin tocarlas (el default de `renderConSesion` es admin con todos los permisos).
- Preservar intactas las acciones que una cuenta de solo lectura **debe** poder ejecutar: `Cancelar`, `Volver al listado`, conmutar vistas, `Reintentar`, buscar, navegar a un detalle.

**Non-Goals:**

- No es un cambio de seguridad. No se toca ninguna policy de RLS ni ninguna Edge Function.
- No se modifica `tienePermiso`, `usePermiso`, la jerarquía de niveles, ni el gateo de navegación por `read`.
- No se gatea `/cuentas` (se gobierna por rol `admin` vía `requiereRolAdmin`, ya funciona), ni el Dashboard (agregación de solo lectura sin módulo propio), ni `/design-system`, ni `LoginPage`.
- No se introduce un nivel de permiso nuevo ni se reasignan módulos a rutas.
- No se hace *optimistic UI*, ni se traduce el error de RLS del servidor a mensaje amigable — eso es otro problema (real, pero otro).

## Decisions

### D1 — Contexto de React por ruta, sembrado en `RequireAuth`, no props ni llamadas dispersas

Un contexto expone un único booleano, `puedeEscribir`, para toda la pantalla activa. El proveedor lo deriva del módulo de la ruta —el que `RequireAuth` **ya resuelve** con `moduloDeRuta(location.pathname)` para su gateo de `read`— cruzado con `usePermiso(modulo, 'write')`.

```
                       ┌─────────────────────────────────────┐
  location.pathname ──►│ moduloDeRuta()   (app/routes.ts)    │──► Modulo | null | undefined
                       └─────────────────────────────────────┘
                                        │
  useAuth() ─────────► usePermiso(modulo, 'write') ──► boolean
                                        │
                       ┌────────────────▼────────────────────┐
                       │ PermisoEscrituraProvider            │  un solo lugar
                       └────────────────┬────────────────────┘
                                        │ context
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                               ▼
  PacienteForm              DireccionesEditor              CobrosPanel
  usePuedeEscribir()        usePuedeEscribir()             usePuedeEscribir()
   (no sabe el módulo)       (no sabe el módulo)            (no sabe el módulo)
```

`RequireAuth` es el punto de inyección correcto porque ya está en el camino de **todas** las rutas protegidas, ya calculó el módulo, y ya garantizó `status === 'authenticated'` cuando renderiza su `<Outlet />`. Envolver ahí el `<Outlet />` cubre las 8 rutas de una sola vez, sin que ninguna página tenga que acordarse de montar un provider.

**Resolución del valor:**

| `moduloDeRuta(path)` | `puedeEscribir` | Por qué |
|---|---|---|
| `Modulo` | `usePermiso(modulo, 'write')` | El caso normal |
| `null` (Dashboard, `/cuentas`, `/design-system`) | `true` | Ruta sin módulo: no hay nada que gatear por módulo. `/cuentas` ya está gateada por rol antes de llegar acá; el Dashboard es de solo lectura por naturaleza |
| `undefined` (ruta no declarada) | irrelevante | `RequireAuth` ya devolvió `AccesoDenegado` y nunca llegó a renderizar el provider |

El default de `true` cuando no hay módulo es deliberado y es también lo que hace el fallback seguro: si el contexto se consume fuera del provider (un componente mal ubicado, o un test que monta un formulario aislado sin router), el hook devuelve `true` y el componente se comporta **exactamente como hoy**. Esto es lo que mantiene verdes las ~190 pruebas existentes sin editarlas. Es defendible precisamente porque no es una frontera de seguridad: fallar hacia "habilitado" acá significa "el servidor rechaza", no "se filtró un permiso".

**Alternativa descartada — `usePermiso('pacientes', 'write')` en cada componente.** Cero infraestructura nueva, pero disemina ~40 literales de módulo por el código, obliga a subcomponentes genéricos a conocer su contenedor, y no hay forma de detectar un módulo mal escrito con un test local (el test pasaría igual, gateando contra el módulo equivocado).

**Alternativa descartada — pasar `puedeEscribir` por props desde cada página.** Explícito y sin contexto nuevo, pero son cadenas de 3-4 niveles (`PacientesPage → PacienteDetail → PacienteResumen → CudFields`) y viola la regla de prop drilling del proyecto. Además cada página tendría que acordarse de propagarlo hasta la hoja; olvidarse en un nivel intermedio es un fallo silencioso.

**Alternativa descartada — sembrar el provider en `AppShell` en vez de `RequireAuth`.** `AppShell` no calcula el módulo de la ruta (`SidebarNav` sí, pero para todas las rutas a la vez, no para la activa) y no garantiza sesión autenticada. Habría que duplicar la resolución de módulo que `RequireAuth` ya hace.

### D2 — `usePuedeEscribir()` sin argumentos

```ts
export function usePuedeEscribir(): boolean
```

Sin parámetros a propósito: el componente que la llama declara *que necesita escritura*, no *contra qué módulo*. Eso segundo es responsabilidad de la ruta. Devuelve un primitivo, no un objeto, siguiendo el mismo criterio ya documentado en `usePermiso.ts` (un hook devuelve objeto cuando expone más de dos valores; acá alcanza un booleano).

### D3 — `<fieldset disabled>` para bloques de formulario, no `disabled` campo por campo

Una primitiva de design system envuelve un bloque de formulario en un `<fieldset disabled>` nativo cuando la cuenta no puede escribir. El navegador deshabilita **todos** los controles descendientes —`input`, `select`, `textarea`, `button`— de una sola vez, incluidos los de subcomponentes anidados que la primitiva no conoce.

Esto es lo que hace viable el alcance: `PacienteForm` no necesita tocar sus 6 campos ni saber que `DireccionesEditor` tiene los suyos adentro; envuelve una vez y queda. Es HTML nativo, no una emulación: la semántica de accesibilidad es la real (los lectores de pantalla anuncian los controles como deshabilitados, el foco los saltea, los `submit` no disparan), sin `aria-disabled` a mano ni interceptar eventos.

Costos aceptados: `<fieldset>` trae estilos por defecto de agente de usuario que hay que neutralizar con utilidades Tailwind (`min-w-0`, `border-0`, `p-0`, `m-0`) para no alterar el layout existente ni un píxel; y `disabled` en `fieldset` **no** afecta al primer `<legend>` — que acá no se usa, así que no aplica.

**Alternativa descartada — pasar `disabled` a cada campo.** Explícito y localizado, pero son cientos de campos, cada uno un olvido posible, y obliga a que cada subcomponente-editor acepte y propague un `disabled` propio. El fieldset lo resuelve sin firma nueva en ningún componente de campo.

**Alternativa descartada — `pointer-events: none` + opacidad.** Bloquea el mouse pero no el teclado ni el envío del formulario, y no comunica nada a la capa de accesibilidad. Es apariencia de deshabilitado, no deshabilitado.

**Alternativa descartada — renderizar una vista de solo lectura paralela** (los datos como texto plano en vez del formulario). Es la mejor experiencia de las tres, y es lo que uno construiría con tiempo ilimitado, pero duplica el árbol de render de cada formulario. Queda anotado como mejora futura, fuera de este change.

### D4 — En `Button`, opt-in explícito; jamás automático

`Button` recibe una capacidad nueva para declarar que la acción escribe (nombre exacto a fijar en apply; la forma es una prop booleana). Cuando está declarada y `usePuedeEscribir()` es `false`, el botón se renderiza deshabilitado reutilizando `BUTTON_DISABLED_CLASSES`, el estilo de deshabilitado que el componente ya tiene.

**Es opt-in y nunca automático.** De los ~78 usos de `Button` en el código, una porción grande no escribe nada y **debe** seguir funcionando para una cuenta de solo lectura:

| Botón | Archivo | Escribe |
|---|---|---|
| `Cancelar` | `PacienteForm:98`, `ConductorForm:201`, `FacturaForm:196`, `ObraSocialForm:154`, `PresupuestoForm:155`, `AutorizacionForm:223`, `CuentaForm:102` | no |
| `Volver al listado` | `VolverAlListadoLink` / `VolverAlListadoButton` | no |
| Conmutadores de vista `armado` / `global` / `imprimir` | `HojaDeRutaPage:131,135,139` | no |
| `Reintentar` | `CuentasList:45` | no |
| `Crear` / `Editar` / `Guardar` / `Emitir` / `Registrar cobro` | listados, detalles, formularios | **sí** |

Un `Button` que se auto-deshabilita al detectar solo-lectura atraparía las cuatro primeras filas y dejaría a la cuenta encerrada en un formulario sin poder cancelar. El opt-in cuesta una prop por call site de escritura; el automático cuesta una regresión de usabilidad difícil de ver en tests.

**Retrocompatibilidad:** la prop es opcional y su ausencia mantiene el comportamiento actual, así que ninguno de los ~78 call sites existentes cambia de conducta hasta que se lo edite. También se preserva `disabled` como está: si un call site ya pasa `disabled` (por ejemplo `MatrizPermisos:53,56` con `!hayCambios || guardando`), el resultado es la disyunción de ambas condiciones — el gateo de permiso nunca *habilita* un botón que su propia lógica quería deshabilitado.

### D5 — Un indicador visible por pantalla de módulo, reutilizando `Alert`

Controles deshabilitados sin explicación se leen como una aplicación rota. Cuando `puedeEscribir` es `false`, la pantalla del módulo muestra un aviso con `Alert` (`design-system/feedback.tsx`), en el mismo molde que `AvisoModeloDatos` / `AvisoPendienteCliente` — tono y ubicación exactos pendientes de la Open Question 2. No se crea un componente de aviso desde cero: `Alert` ya cubre tono, énfasis, `role` y título en negrita.

### D6 — Fases por módulo del backend, no por ruta del frontend

El cableado se agrupa por los 4 módulos reales, no por las 7 rutas, porque el módulo es la unidad de permiso:

| Fase | Módulo | Rutas |
|---|---|---|
| 1 | (infraestructura) | contexto + hook + primitivas de design system |
| 2 | `pacientes` | `/pacientes` |
| 3 | `obra_social` | `/obras-sociales` |
| 4 | `conductores` | `/conductores`, `/vehiculos`, `/hojas-de-ruta` |
| 5 | `facturacion` | `/presupuestos`, `/facturacion` |

Consecuencia visible a confirmar con la usuaria (Open Question 4 del proposal): una cuenta con solo `read` en `conductores` queda en solo lectura en las tres pantallas de la fase 4 simultáneamente. Es exactamente lo que hace la RLS del servidor —la agrupación viene de `seed_modulos.sql`—, así que el frontend no está inventando una regla; está reflejando la que ya existe.

### D7 — Pruebas: dos direcciones por comportamiento, con `renderConSesion`

Cada comportamiento se prueba en las dos direcciones, que es también el mínimo de triangulación que exige el modo Strict TDD del proyecto:

- cuenta con `write` (o rol `admin`) sobre el módulo → la acción está habilitada;
- cuenta con solo `read` → la acción está deshabilitada.

`renderConSesion(ui, opciones)` ya permite declarar el escenario de permisos, y su default (admin con todos los permisos) es lo que mantiene verdes las ~190 pruebas existentes. Las aserciones van sobre comportamiento observable —`toBeDisabled()`, el `onSubmit` que no se dispara— nunca sobre el valor del contexto ni sobre la presencia de una clase CSS.

El caso del rol `admin` merece su propia prueba en cada fase: `tienePermiso` le da `true` sin consultar la matriz, así que un `admin` **sin ninguna fila** en `modulos.permisos` debe tener todo habilitado. Es el falso negativo más caro de este change (dejar a la administradora sin poder escribir) y el que un test de "solo read" no detecta.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Falso negativo: deshabilitar a quien sí puede escribir** — el peor resultado posible, sobre todo si le pasa al rol `admin`, que short-circuita en `tienePermiso` y puede no tener ninguna fila en la matriz de permisos | Prueba explícita de rol `admin` sin filas de permisos en cada fase, además del par `write` → habilitado / `read` → deshabilitado por comportamiento |
| **Deshabilitar de más** — atrapar `Cancelar`, `Volver al listado`, conmutadores de vista o `Reintentar` y encerrar a la cuenta en una pantalla sin salida | D4: opt-in explícito, nunca automático. La tabla de D4 es el inventario de lo que **no** se toca |
| **Alcance** — ~40 componentes en 7 rutas es un change grande, y dejarlo a mitad de camino (unas acciones gateadas y otras no) es peor que no gatear nada, porque vuelve el comportamiento impredecible | D6 hace cada fase completa por módulo: un módulo entero gateado o entero como hoy, nunca a medias. Ver además Open Question 3 del proposal sobre partirlo en dos changes |
| **OWASP A04 *Insecure Design*** — que alguien lea este gateo como la frontera de autorización y mañane relaje una policy de RLS "porque el frontend ya lo controla" | Un requisito propio en el spec, más el comentario explícito en el código nuevo, con el mismo lenguaje que ya usan `permisos.ts` y `SidebarNav.tsx` |
| **Divergencia con la semántica del servidor** — que la jerarquía del cliente se separe de la de las migraciones | No se toca `tienePermiso` ni `ORDEN_NIVEL`. Este change solo *consume* la función existente con `'write'` en vez de `'read'`. La semántica es la misma porque el código es el mismo |
| **`<fieldset>` altera el layout** — trae estilos de agente de usuario (borde, padding, `min-width: min-content`) | Neutralizados con utilidades Tailwind en la primitiva (`min-w-0 border-0 p-0 m-0`), verificado contra las capturas actuales de cada formulario. Cero estilos inline |
| **El fieldset deshabilita algo que no debía** — un `Cancelar` que quedó dentro del bloque envuelto | El envoltorio se aplica al bloque de campos, no a la barra de acciones. Cada fase verifica que `Cancelar` sigue clickeable con una cuenta de solo `read` |
| **Confusión sin indicador visible** — formulario entero gris sin explicación se lee como bug | D5. Sujeto a Open Question 2 |

## Migration Plan

No hay migración de datos ni de esquema: cero SQL, cero Edge Functions, cero dependencias nuevas, cero estado persistido.

**Despliegue:** las fases de D6 son commits independientes y aditivos, en orden (1 antes que 2-5; las fases 2-5 son independientes entre sí y podrían ir en cualquier orden o en paralelo). Se despliega con el build normal del frontend.

**Rollback:** revertir el commit de una fase de módulo devuelve ese módulo a su comportamiento actual (todo habilitado) sin afectar a los otros, porque el contexto arranca en `true` y las primitivas son opt-in. Revertir la fase 1 apaga el gateo entero de una vez. No hay feature flag que limpiar ni estado que reconciliar.

**Verificación manual (humana, no automatizable con mocks):** con una cuenta real de solo `read` contra el proyecto Supabase, recorrer las 7 rutas y confirmar que (a) las acciones de escritura están gateadas, (b) `Cancelar` / `Volver` / conmutadores de vista siguen funcionando, y (c) una cuenta con `write` no ve nada deshabilitado. Mismo patrón que `auth-frontend-real` usó para su propio cierre; queda a cargo de la usuaria.

## Open Questions — todas resueltas (2026-07-29)

Las cinco viven resueltas en `proposal.md` §Open Questions. Impacto sobre este diseño:

1. **Deshabilitar, nunca ocultar.** Confirma D4 tal como está escrito: los controles de escritura siguen en el DOM, deshabilitados. No hace falta una variante de ocultamiento.
2. **Sí al indicador visible.** Confirma D5. Tono y ubicación se fijan en el change 1 del split y los otros tres los reutilizan.
3. **Cuatro changes, uno por módulo.** D6 ya estaba escrito para que partirlo costara poco: cada fase de módulo se convierte en un change independiente, y la fase 1 (infraestructura) pasa a ser parte del primero. Ver `proposal.md` §Split.
4. **Agrupación módulo→pantalla confirmada.** El diseño ya reflejaba la agrupación del servidor; no cambia nada.
5. **Acciones no-CRUD al nivel `write`.** Elimina la única indeterminación que quedaba en el cableado de `facturacion` y `conductores`: todo lo que escribe se gatea igual, sin casos especiales de `admin`. Como `tienePermiso` acepta cualquier nivel mínimo sin modificarse, subir alguna acción a `admin` más adelante es un cambio de una línea en el call site, no un cambio estructural.

## Estado de este documento

Este design es el **análisis paraguas**. Por la decisión 3 no se implementa como un solo change: su contenido se reparte entre los cuatro changes del split, con D1-D5 (el mecanismo compartido) viviendo en `gateo-escritura-obra-social` y los otros tres consumiéndolo. Se conserva como registro del análisis completo de la superficie (~40 componentes) y de las alternativas descartadas.

## Governance

Dominio **auth/permisos → nivel CRÍTICO** en la tabla de Agent Governance del proyecto. Este change está autorizado hasta la etapa de propuesta (artefactos y análisis, sin código). **`/opsx:apply` requiere aprobación humana explícita antes de escribir una sola línea**, y el cierre requiere la verificación manual descrita en el Migration Plan.
