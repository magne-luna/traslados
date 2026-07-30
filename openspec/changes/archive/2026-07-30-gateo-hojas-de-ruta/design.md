## Context

### El mecanismo ya existe y ya está rodado

`gateo-obrasocial` construyó el mecanismo compartido; `gateo-pacientes`, `gateo-facturacion` y `gateo-conductores` (rutas `/conductores` y `/vehiculos`) lo consumieron:

```
PuedeEscribirContext           lo puebla RequireAuth: moduloDeRuta(path) × usePermiso(modulo, 'write')
usePuedeEscribir(): boolean    hook sin argumentos, fallback `true` fuera del provider
                               (shared/auth/usePuedeEscribir.ts:15-18)
CamposSoloLectura              <fieldset disabled> nativo, sin props: deshabilita TODOS los controles
                               descendientes — inputs, selects, textareas, <button> nativos y los
                               campos de subcomponentes anidados (design-system/components.tsx:172)
Button.requiereEscritura       prop OPT-IN que declara que la acción escribe; NUNCA automática
                               (design-system/components.tsx:122)
AvisoSoloLectura               componente sin props, se auto-resuelve; null si hay escritura
                               (design-system/components.tsx:186)
```

**Este change no construye ni modifica nada de eso. Solo lo consume.** Si algo resultara insuficiente, se corrige en `gateo-obrasocial`, no acá.

### El módulo correcto: `pacientes`

Esta es la premisa que hay que fijar antes de escribir una línea, porque el intento anterior falló exactamente acá:

```
frontend/src/app/routes.ts:59-69
  { path: '/hojas-de-ruta', … modulo: 'pacientes' }
  // Corregido (antes 'conductores'): las tablas reales de recorridos
  // (pacientes.recorridos, pacientes.historial_recorridos) están gateadas por RLS con
  // tiene_permiso('pacientes', ...) — ver supabase/migrations/20260724100004_schema_pacientes.sql

supabase/migrations/20260724100004_schema_pacientes.sql:144-148
  CREATE POLICY "Write recorridos"            ON pacientes.recorridos            FOR ALL … tiene_permiso('pacientes','write')
  CREATE POLICY "Write historial_recorridos"  ON pacientes.historial_recorridos  FOR ALL … tiene_permiso('pacientes','write')
```

El cliente no elige el módulo: lo resuelve `RequireAuth` desde la ruta. **Ningún componente de esta feature debe nombrar un módulo**, ni `'pacientes'` ni ningún otro — igual que en los cuatro changes anteriores. El gateo se pide con `usePuedeEscribir()` y punto.

Corolario que hay que aceptar explícitamente: esta pantalla lee `PacienteRepository`, `VehiculoRepository` y `ConductorRepository` (`HojaDeRutaPage:22-25`, "Solo lectura — puebla selectores"), pero **escribe únicamente en el repositorio de hojas de ruta**. Por eso su permiso de escritura es `pacientes` y solo `pacientes`. Una cuenta con `write` en `conductores` y `read` en `pacientes` queda en solo lectura acá aunque pueda editar vehículos y conductores: es literalmente lo que hace la RLS.

### La superficie: una ruta, ~1500 líneas, 6 componentes a cablear

```
/hojas-de-ruta → HojaDeRutaRoute (24) → HojaDeRutaPage (212)      módulo: pacientes
│
├── NO se gatean (no persisten nada) ─────────────────────────────────────────
│   ├── selector de fecha            :111   setFecha      ← D2
│   ├── conmutador «Armado»          :131   setVista      ← D1
│   ├── conmutador «Vista global»    :135   setVista      ← D1
│   └── conmutador «Imprimir»        :139   setVista      ← D1
│
├── SÍ se gatean ─────────────────────────────────────────────────────────────
│   ├── «Crear hoja de ruta para este día»  :161   → crear()
│   │
│   ├── NuevoRecorridoForm (236)
│   │   ├── «Crear recorrido»               :212   → onCrear → actualizar()
│   │   └── campos: SelectorPaciente · PacienteTramoCampos · select vehículo :167 ·
│   │              select conductor :186 · checkbox manual :202 · notas :222   ← D4
│   │
│   ├── RecorridoCard (234)
│   │   ├── «Sugerir orden»                 :144   → onUpdateRecorrido
│   │   ├── «Editar»                        :152   → entra al modo de escritura   ← D3
│   │   ├── «Listo»                         :147   → sale del modo. NO se gatea   ← D3
│   │   ├── textarea de notas          :201-209   → persiste en onBlur            ← D5
│   │   └── RecorridoVehiculoConductor (113)
│   │       ├── select vehículo             :78    → persiste en onChange         ← D5
│   │       └── select conductor            :97    → persiste en onChange         ← D5
│   │
│   ├── ParadasList (110)
│   │   ├── «Subir»                         :78    → onReordenar  (ya usa `disabled` propio)
│   │   ├── «Bajar»                         :87    → onReordenar  (ya usa `disabled` propio)
│   │   └── <button> nativo «Quitar»        :96    → onQuitar     ← no lo alcanza Button
│   │
│   ├── AsignacionPanel (138)
│   │   ├── «Agregar pasajero»              :129   → onAgregar
│   │   └── campos: SelectorPaciente · PacienteTramoCampos                        ← D4
│   │
│   └── VistaGlobalHojaDeRuta (147)
│       ├── «Mover»                         :137   → onReasignar
│       └── <select> recorrido destino      :122
│
└── solo lectura, NO se tocan ────────────────────────────────────────────────
    HojaDeRutaImprimible (80) · RecorridoMapa (51) · RecorridoStat (26) ·
    RequisitosPaciente (32) · los dos AvisoModeloDatos (:97, :148)
```

Componentes de campos que **no cambian ni una línea ni reciben props nuevas**: `PacienteTramoCampos` (95), `SelectorPaciente` (30), `RecorridoVehiculoConductor` (113). Los cubre el envoltorio de su contenedor (D4).

### Frontera de seguridad (no negociable)

La autorización efectiva la impone la RLS: `modulos.tiene_permiso('pacientes', 'write')`. **Este gateo es experiencia de uso, no una frontera de seguridad.** El código nuevo lleva el mismo comentario que ya llevan `permisos.ts`, `SidebarNav.tsx`, `usePuedeEscribir.ts` y las cinco pantallas ya cableadas.

## Goals / Non-Goals

**Goals:**

- Gatear por nivel `write` sobre `pacientes` todas las acciones de `/hojas-de-ruta` que persisten datos, incluidas las que no pasan por un `Button`.
- Preservar operativos los tres conmutadores de vista, el selector de fecha y las cuatro vistas de solo lectura.
- Dejar `/pacientes` y `/hojas-de-ruta` coherentes: mismo módulo, mismo modo con la misma sesión.
- Que los tests existentes de la feature sigan pasando **sin tocarlos**.

**Non-Goals:**

- No se construye ni se modifica el mecanismo compartido.
- No se toca `app/routes.ts`: el mapeo ya es correcto. Si algún test lo contradice, el test está mal, no el mapeo.
- No se tocan `gateo-conductores` ni `gateo-pacientes`, ni sus archivos, ni su código ya aplicado.
- No se cablea ninguna otra pantalla ni módulo.
- No se exige `admin` para ninguna acción.
- No se toca `tienePermiso`, `usePermiso`, la jerarquía, ni el gateo de navegación por `read`.
- No se toca ninguna policy de RLS ni Edge Function.
- No se rediseña el armado de hojas de ruta: se gatea lo que ya existe, tal como está.
- No se resuelven las discrepancias con el docx ya señaladas por los dos `AvisoModeloDatos` de la pantalla.

## Decisions

### D1 — Los tres conmutadores de vista NO se gatean

`HojaDeRutaPage` tiene tres `Button` que conmutan entre las vistas *armado*, *global* e *imprimir* (`:131`, `:135`, `:139`). **Ninguno escribe nada**: cambian `vista`, estado local de la pantalla (`useState<Vista>`).

Gatearlos dejaría a una cuenta con solo `read` encerrada en la vista de armado, sin poder ver la global ni la imprimible — datos que su permiso `read` **sí** la autoriza a ver, y que la RLS le entrega. Sería una regresión de usabilidad causada por el propio arreglo, y la más costosa de todo el trabajo de gateo.

Este es el ejemplo canónico que justificó que `requiereEscritura` sea **opt-in y nunca automática**: un `Button` que se auto-deshabilitara al detectar solo-lectura atraparía estos tres. Acá se cobra ese diseño.

Consecuencias operativas, todas verificables:

- Los tres `Button` **no llevan** `requiereEscritura`.
- Ninguno de los tres queda dentro de un `CamposSoloLectura`. El bloque `:129-144` que los contiene queda fuera de cualquier envoltorio.
- Tiene ciclo TDD dedicado, en las dos direcciones: con solo `read` los tres conmutan y **las tres vistas se renderizan completas**.

> Esta decisión es heredada del análisis de `gateo-conductores` (su D1). Se re-declara acá porque el trabajo se mudó de change; la restricción no cambió, solo cambió el módulo contra el que se resuelve el permiso.

### D2 — El selector de fecha tampoco se gatea

`HojaDeRutaPage:111` es un `<input type="date">` que solo cambia `fecha`, el día que se está consultando (`:114-116`). No persiste nada: la hoja del día se busca en memoria (`hojaDelDia = hojasDeRuta.find(…)`).

Gatearlo tiene exactamente la misma forma de daño que D1 — encerraría a una cuenta de solo lectura en la hoja de hoy, sin poder consultar ningún otro día — pero es **más fácil de romper por accidente**, porque no es un `Button`: no se protege solo con la disciplina de no poner `requiereEscritura`. Basta con que un `CamposSoloLectura` puesto demasiado arriba en el árbol lo barra junto con lo demás.

Regla: el envoltorio de solo lectura **nunca envuelve el encabezado de la pantalla** (`:104-145`). Se aplica hacia adentro, en cada formulario o bloque de acciones, nunca hacia afuera. Ciclo TDD dedicado: con solo `read`, cambiar la fecha sigue funcionando y la pantalla muestra la hoja del día elegido.

### D3 — Se gatea la ENTRADA al modo de edición, no la SALIDA

`RecorridoCard` alterna entre resumen y edición con `editing` (estado local). *Editar* (`:152`) entra; *Listo* (`:147`) sale.

- ***Editar* se gatea.** No persiste por sí mismo, pero es la única puerta a todo el bloque de escritura de la tarjeta (reordenar, quitar, agregar pasajero, cambiar vehículo/conductor, notas). Gatear la puerta es lo que hace el resto del proyecto en todas las pantallas list+detail, y le da a la cuenta de solo lectura una señal inmediata y honesta.
- ***Listo* NO se gatea.** Sale del modo de edición sin persistir nada — es el análogo exacto de *Cancelar*, que `gateo-pacientes` dejó explícitamente operativo ("esa acción de cancelar se puede activar, porque no persiste ningún dato"). En la práctica es inalcanzable sin `write`, porque con *Editar* gateado nunca se entra al modo; se declara igual para que nadie lo marque "por las dudas" y para que el criterio quede escrito.

> **Divergencia explícita** respecto de la enumeración original de `gateo-conductores`, que listaba *Listo* (`:147`) como acción a gatear. Se corrige acá: no es una escritura, y marcarlo contradiría el criterio que `gateo-pacientes` ya fijó para *Cancelar*.

### D4 — Un solo envoltorio por formulario cubre sus bloques de campos

`NuevoRecorridoForm` compone `SelectorPaciente` (30) y `PacienteTramoCampos` (95) además de sus propios selects, checkbox y textarea. `AsignacionPanel` compone los mismos dos. Envolver **una vez** en cada formulario deshabilita todos sus descendientes, porque `<fieldset disabled>` alcanza a todo el subárbol.

Los tres componentes de campos (`SelectorPaciente`, `PacienteTramoCampos`, `RecorridoVehiculoConductor`) **no cambian ni una línea ni reciben props nuevas**. Es el mismo criterio que ya aplicaron `ConductorForm`, `VehiculoForm` y `PacienteForm`.

En `VistaGlobalHojaDeRuta`, el `<select>` de recorrido destino (`:122`) y el botón *Mover* (`:137`) viven en la misma fila: un envoltorio por fila de reasignación, o uno por bloque de conflicto. Lo que **no** puede quedar dentro es el encabezado de la vista.

### D5 — Los caminos de escritura que no pasan por un `Button` son el riesgo técnico real

Tres puntos persisten sin que medie un botón de confirmación:

| Punto | Archivo:línea | Cómo escribe |
|---|---|---|
| Notas del recorrido | `RecorridoCard:201-209` | `onBlur` → `handleGuardarNotas` → `onUpdateRecorrido` |
| Vehículo del recorrido | `RecorridoVehiculoConductor:78` | `onChange` → `onChangeVehiculo` → `onUpdateRecorrido` |
| Conductor del recorrido | `RecorridoVehiculoConductor:97` | `onChange` → `onChangeConductor` → `onUpdateRecorrido` |

`Button.requiereEscritura` **no los alcanza**. Solo el envoltorio de campos los desactiva, y solo si está puesto donde corresponde. Por eso los ciclos TDD de estos tres afirman sobre el **repositorio mock**: con solo `read`, no debe recibir ninguna llamada. Una aserción de `toBeDisabled()` sola no probaría que el camino está cerrado.

`RecorridoVehiculoConductor` renderiza texto plano (`RecorridoStat`) cuando `editing` es `false` (`:50-65`) y selects cuando es `true`. Se monta en las dos ramas de `RecorridoCard` (`:187` y `:217`). El envoltorio va donde estén los selects, y hay que verificar que la rama de solo lectura **sigue renderizando el texto igual** — envolver un `RecorridoStat` en un `<fieldset disabled>` no rompe nada funcional, pero es ruido que no corresponde.

### D6 — Los `<button>` nativos y los `disabled` preexistentes

`ParadasList:96` (*Quitar*) es un `<button>` nativo, no el `Button` del design system: la prop opt-in no aplica. Lo cubre el envoltorio, que es justamente lo que `<fieldset disabled>` hace bien con los controles nativos.

`ParadasList:82` y `:91` ya usan `disabled` **por otra razón** (primera y última parada). Los tests del modo solo lectura deben afirmar sobre una parada **del medio**, donde el `disabled` preexistente es `false`: si no, el test pasaría sin que el gateo exista. Es la trampa más fácil de esta pantalla.

`ParadasList` solo renderiza controles cuando `editable` es `true` (`:30-55`, `:76`), y `editable` viene de `editing` de `RecorridoCard`. Con *Editar* gateado (D3) esos controles no llegan a montarse — el gateo igual se cablea y se prueba montando `ParadasList` con `editable` y sesión de solo lectura, porque depender de que un ancestro no te renderice no es un gateo.

**No hay `draggable` en esta feature** (verificado por grep en `gateo-conductores` tarea 1.6: los dos únicos del proyecto están en `obra_social` y ya se cerraron). `ParadasList` reordena con botones. Se re-verifica igual, no se asume.

### D7 — El aviso de solo lectura va en `HojaDeRutaPage` y sobrevive a las tres vistas

Una sola inserción de `AvisoSoloLectura`, en `HojaDeRutaPage`, replicando el patrón de `ObraSocialesPage` / `PacientesPage`. Debe quedar **arriba del switch de vistas** (`:165-209`), no dentro de una rama, para que siga visible al conmutar entre armado, global e imprimir: la cuenta sigue en modo solo lectura en las tres.

Convive con los dos `AvisoModeloDatos` existentes (`:97`, `:148`), que no se tocan ni se reordenan.

### D8 — Coherencia con `/pacientes`: mismo módulo, mismo modo

`/pacientes` y `/hojas-de-ruta` resuelven **el mismo** `moduloDeRuta` → `pacientes`. Una cuenta con solo `read` sobre ese módulo debe quedar en solo lectura en **las dos** pantallas simultáneamente; un gateo que funcione en una y no en la otra es un fallo silencioso.

`gateo-pacientes` ya cableó `/pacientes` y está archivado. Este change **no lo toca**: agrega un ciclo TDD de coherencia que verifica las dos pantallas con la misma sesión, contra `RequireAuth` real. Si esa verificación fallara del lado de `/pacientes`, es un hallazgo para reportar, no para parchear acá.

Es el mismo patrón de coherencia que `gateo-facturacion` resolvió con dos rutas y `gateo-conductores` con `/conductores` + `/vehiculos`.

### D9 — Pruebas: dos direcciones por comportamiento, con `renderConSesion`

Cada comportamiento se prueba con `write` (habilitado) y con solo `read` (deshabilitado): el mínimo de triangulación del modo Strict TDD. `renderConSesion` ya permite declarar el escenario; su default (admin con todos los permisos) mantiene verdes los tests existentes **sin editarlos**, gracias además al fallback `true` de `usePuedeEscribir()` fuera del provider.

Las aserciones van sobre comportamiento observable —`toBeDisabled()`, el handler que no dispara, el repositorio mock que no recibe llamadas— nunca sobre el valor del contexto ni sobre clases CSS.

El rol `admin` tiene ciclo propio: `tienePermiso` le da `true` sin consultar la matriz, así que un `admin` sin ninguna fila en `modulos.permisos` debe poder armar hojas de ruta. Es el falso negativo más caro y un test de "solo read" no lo detecta.

Ciclo propio también para el cruce de módulos: `write` sobre `conductores` + `read` sobre `pacientes` → **solo lectura acá**. Es la consecuencia menos intuitiva de la corrección del mapeo y merece quedar codificada, no solo documentada.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Gatear los tres conmutadores de vista** y encerrar a una cuenta con `read` en la vista de armado, sin poder ver la global ni la imprimible que su permiso sí la autoriza a ver | **D1** + ciclo TDD dedicado en las dos direcciones + revisión manual del diff de `HojaDeRutaPage` |
| **Gatear el selector de fecha** y encerrar a una cuenta de solo lectura en la hoja de hoy | **D2** + ciclo TDD dedicado + regla de que el envoltorio nunca envuelve el encabezado |
| **Cablear contra el módulo equivocado** — repetir el error que originó este change | Tarea de verificación **bloqueante** de `moduloDeRuta('/hojas-de-ruta') === 'pacientes'` antes de escribir el primer test, contra `routes.ts` y contra la RLS. Grep de control: ningún componente de la feature nombra un módulo |
| **Caminos de escritura que no pasan por un `Button`** (notas en `onBlur`, vehículo y conductor en `onChange`): la prop opt-in no los alcanza | **D5** + ciclos TDD que afirman que el repositorio mock **no recibe ninguna llamada**, no solo que un control está deshabilitado |
| **Falso positivo en `ParadasList`**: probar sobre la primera o la última parada, donde `disabled` ya es `true` por el borde de la lista, y creer que el gateo funciona | **D6** — los tests van sobre una parada **del medio**, con al menos tres paradas en el fixture |
| **Falso negativo: deshabilitar a quien sí puede escribir**, sobre todo al rol `admin` sin filas en la matriz | Ciclo TDD propio para `admin` sin filas, además del par `write`/`read` por comportamiento |
| **Incoherencia con `/pacientes`** — mismo módulo, distinto modo: fallo silencioso | **D8** + ciclo TDD de coherencia entre las dos rutas con la misma sesión, contra `RequireAuth` real |
| **Bloquear de más la lectura**, en particular `HojaDeRutaImprimible`: poder ver una hoja pero no imprimirla es un bug evidente | Ciclo TDD dedicado a las cuatro vistas de solo lectura + verificación de que esos cuatro archivos no cambiaron ni una línea |
| **`<button>` nativo de `ParadasList`** fuera del alcance de la prop opt-in | **D6** + ciclo TDD que afirma su estado deshabilitado. Si el envoltorio no lo alcanzara, el arreglo va en `gateo-obrasocial`, no acá |
| **Romper los tests existentes** de la feature más grande del frontend (~1500 líneas de componentes, 6 archivos de test) | Fallback `true` de `usePuedeEscribir()` fuera del provider + prop opt-in. Línea base registrada antes de tocar nada y verificada en cada sección |
| **Tocar `gateo-conductores` por accidente** mientras se descopa en paralelo | Non-Goal explícito + verificación por `git diff --name-only` al cierre |
| **OWASP A04 *Insecure Design*** — leer este gateo como la frontera de autorización | Comentario explícito en el código nuevo; el requisito ya está fijado por `gateo-obrasocial` |
| **Divergencia con la semántica del servidor** | No se toca `tienePermiso` ni `ORDEN_NIVEL`: se consume la misma función con `'write'` |

## Migration Plan

Cero SQL, cero Edge Functions, cero dependencias, cero estado persistido, cero migración de datos. Build normal del frontend.

**Rollback:** revertir el commit devuelve la pantalla a su comportamiento actual, sin afectar al mecanismo compartido ni a ningún otro módulo. `/hojas-de-ruta` es un árbol de componentes independiente del resto.

**Verificación manual (humana, no automatizable con mocks):** con una cuenta real de solo `read` sobre `pacientes` contra Supabase, confirmar que:

- (a) las acciones de escritura de la pantalla están **visibles pero bloqueadas**: crear hoja, crear recorrido, sugerir orden, editar recorrido, subir/bajar/quitar parada, agregar pasajero, mover fila en la vista global;
- (b) el aviso de solo lectura aparece y **sigue visible al conmutar** entre las tres vistas;
- (c) **los tres conmutadores de vista funcionan** y las tres vistas se renderizan completas;
- (d) **el selector de fecha funciona** y se puede consultar la hoja de otro día;
- (e) la vista imprimible se renderiza completa y se puede imprimir;
- (f) no se puede escribir una nota de recorrido ni cambiar vehículo o conductor desde los selects;
- (g) una cuenta con `write` sobre `pacientes` puede armar hojas, reordenar paradas y asignar sin trabas;
- (h) una cuenta con `write` sobre `conductores` pero solo `read` sobre `pacientes` queda en **solo lectura** acá, aunque pueda editar conductores y vehículos.

A cargo de la usuaria.

## Open Questions

Ninguna abierta. La única que había —a qué módulo pertenece `/hojas-de-ruta`— quedó resuelta por el código (`app/routes.ts`) y por la RLS (`20260724100004_schema_pacientes.sql`), y la usuaria decidió el 2026-07-30 atenderla en un change propio.

Lo único pendiente es la **aprobación humana de gobernanza CRÍTICO** para empezar a escribir código.

## Governance

Dominio **auth/permisos → nivel CRÍTICO** en la tabla de Agent Governance del proyecto. **`/opsx:apply` requiere aprobación humana explícita antes de escribir una sola línea**, y el cierre requiere la verificación manual del Migration Plan.
