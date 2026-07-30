## Context

### El mecanismo ya existe

`gateo-obrasocial` (change 1 del split) construyó y estrenó el mecanismo compartido:

```
contexto en RequireAuth      deriva puedeEscribir del módulo de la ruta (moduloDeRuta) × usePermiso(modulo, 'write')
usePuedeEscribir(): boolean  hook sin argumentos; el componente declara que necesita escritura,
                             no contra qué módulo (eso lo determina la ruta)
envoltorio de solo lectura   <fieldset disabled> nativo: deshabilita todos los controles descendientes,
                             incluidos <button> nativos y campos de subcomponentes anidados
prop opt-in en Button        declara que la acción escribe; NUNCA automática
aviso con Alert              patrón del indicador visible de modo solo lectura
```

**Este change no construye ni modifica nada de eso.** Solo lo consume. Si algo resultara insuficiente, se corrige en el change 1.

### Alcance corregido el 2026-07-30 — `/hojas-de-ruta` descoped

Este design se escribió asumiendo que **tres** rutas —`/conductores`, `/vehiculos` y `/hojas-de-ruta`— resolvían el módulo `conductores`. La verificación obligatoria de la tarea 1.5 refutó esa premisa:

- `moduloDeRuta('/hojas-de-ruta')` devuelve **`'pacientes'`**, no `'conductores'` (`frontend/src/app/routes.ts`, corrección deliberada con comentario fechado).
- La RLS real coincide: `pacientes.recorridos` y `pacientes.historial_recorridos` están gateadas por `modulos.tiene_permiso('pacientes', …)` (`supabase/migrations/20260724100004_schema_pacientes.sql`).

No es un bug del mapeo: el mapeo es correcto y la premisa del design era la equivocada. Por decisión de la usuaria, **`/hojas-de-ruta` sale del alcance de este change** y se trata en un change separado scopeado a `pacientes`. Nada de `features/hojas-de-ruta/` se toca acá.

Las decisiones que quedaron sin aplicación en este change (**D1**, y las partes de **D3**–**D7** referidas a hojas de ruta) se conservan abajo marcadas como **movidas**, porque el razonamiento sigue siendo válido y es el insumo directo del change de `pacientes`.

### La superficie: dos rutas, un solo permiso

```
módulo conductores  (~3460 líneas, 13 componentes a cablear)
│
├── /conductores → ConductoresPage (48)
│   ├── ConductoresList (190)        Crear :52 · Crear el primero :74 · Editar :171 · 1 <button> nativo
│   └── ConductorDetail (213)        Editar :153
│       ├── ConductorForm (210)      Cancelar :201 · Guardar :204
│       ├── AsignacionSemanalTabla (165)  envío :156 · campos
│       └── ConductorDocumentos (31)      carga/baja vs. consulta/descarga
│
└── /vehiculos → VehiculosPage (48)
    ├── VehiculosList (194)          Crear :51 · Crear el primero :73 · Editar :175 · 1 <button> nativo
    └── VehiculoDetail (228)         Editar :163
        ├── VehiculoForm (178)       Cancelar :169 · Guardar :172
        ├── GastosVehiculo (185)     alta de gasto :178 · campos
        ├── VehiculoMantenimiento (131)   acciones + campos
        └── VehiculoDocumentos (23)       carga/baja vs. consulta/descarga

fuera de alcance (change separado, módulo pacientes):
    /hojas-de-ruta → HojaDeRutaPage y todo features/hojas-de-ruta/   ← NO se toca acá
```

`moduloDeRuta()` devuelve `conductores` para **estas dos** rutas (`APP_ROUTES` en `app/routes.ts` agrupa `/vehiculos` bajo `conductores`), así que el mecanismo del change 1 resuelve el permiso correcto en ambas **sin ningún cambio**. Lo que hay que verificar es el cableado de cada pantalla, no la resolución del permiso — y esa verificación es exactamente la que descubrió que `/hojas-de-ruta` no pertenecía acá.

**No hay `draggable` en este módulo** (verificado con grep: los dos únicos del proyecto están en `obra_social` y se cerraron en el change 1), así que el envoltorio `<fieldset disabled>` alcanza en todos los casos.

**Des-alineación conocida, no resuelta acá**: `GastosVehiculo` está gateado en la RLS real por `facturacion` (`facturacion.gastos_vehiculos`), no `conductores`. Ya estaba documentado con `AvisoModeloDatos` en `VehiculoDetail.tsx` antes de este change; se cableó igual que el resto de `/vehiculos` por continuidad de la pantalla y queda señalado.

### Frontera de seguridad (no negociable)

La autorización efectiva la impone la RLS: `modulos.tiene_permiso('conductores', 'write')`. **Este gateo es experiencia de uso.** El código nuevo lleva el mismo comentario que ya llevan `permisos.ts`, `SidebarNav.tsx` y el mecanismo del change 1.

## Goals / Non-Goals

**Goals:**

- Gatear por nivel `write` sobre `conductores` todas las acciones que persisten datos en **las dos** rutas del módulo: `/conductores` y `/vehiculos`.
- Preservar la consulta y la descarga de documentos de conductor y de vehículo con nivel `read`.
- Que los tests existentes de las dos features sigan pasando **sin tocarlos**.

**Non-Goals:**

- **No se toca `/hojas-de-ruta`** ni ningún archivo de `features/hojas-de-ruta/`: pertenece al módulo `pacientes` y va en un change separado.
- No se corrige ni se toca `app/routes.ts`: el mapeo `/hojas-de-ruta → pacientes` es deliberado y coincide con la RLS.
- No se resuelve la des-alineación de `GastosVehiculo` (RLS real: `facturacion`): queda documentada, no resuelta.
- No se construye ni se modifica el mecanismo compartido (change 1).
- No se cablean los otros tres módulos.
- No se exige `admin` para ninguna acción (decisión 5 de la usuaria: todo al nivel `write`).
- No se toca `tienePermiso`, `usePermiso`, la jerarquía, ni el gateo de navegación por `read`.
- No se toca ninguna policy de RLS ni Edge Function.

## Decisions

### D0 — La verificación del módulo de la ruta es una compuerta, no un trámite

La tarea 1.5 —verificar que `moduloDeRuta()` devuelve el módulo esperado para **cada** ruta del change, antes de cablear nada— es lo único que impidió gatear `/hojas-de-ruta` contra el permiso equivocado. Sin ella, el cableado habría "funcionado" en los tests (todos escritos bajo la misma premisa falsa) y habría fallado contra la RLS real.

**Regla que queda fijada para los changes de gateo**: la resolución `ruta → módulo` se verifica contra `app/routes.ts` **y** contra la migración de RLS que gatea las tablas de esa pantalla, antes de escribir el primer test. Si discrepan, se detiene el change y se reporta; no se "arregla" el mapeo por cuenta propia.

### D1 — Los conmutadores de vista de Hojas de Ruta NO se gatean ⟶ **MOVIDA** al change de `pacientes`

> ⚠️ **No aplica a este change.** `/hojas-de-ruta` quedó fuera de alcance el 2026-07-30. Se conserva como contexto histórico y como insumo directo del change separado, donde esta decisión sigue vigente palabra por palabra — solo cambia el módulo del permiso (`pacientes`, no `conductores`). En este change **no se tocó `HojaDeRutaPage`**, así que no hubo riesgo de gatear los conmutadores por error.

`HojaDeRutaPage` (212) tiene tres `Button` que conmutan entre las vistas *armado*, *global* e *imprimir* (`:131`, `:135`, `:139`). **Ninguno escribe nada**: cambian estado local de la pantalla.

Gatearlos dejaría a una cuenta con solo `read` encerrada en la vista de armado, sin poder ver la global ni la imprimible — datos que su permiso `read` **sí** la autoriza a ver. Sería una regresión de usabilidad causada por el propio arreglo.

Este es el ejemplo canónico que justificó que la prop de escritura de `Button` sea **opt-in y nunca automática** en el change 1: un `Button` que se auto-deshabilitara al detectar solo-lectura atraparía estos tres.

### D2 — Las dos rutas se cablean por separado, pero se verifican juntas

`/conductores` y `/vehiculos` son dos árboles de componentes independientes: no comparten página, listado ni formulario. El cableado es trabajo separado, en secciones de tareas distintas.

Lo que **no** es separado es el permiso: las dos resuelven `conductores`, así que una cuenta con solo `read` sobre ese módulo queda en solo lectura en ambas simultáneamente. Un gateo que funcione en una y no en la otra es un fallo silencioso, así que hay un ciclo TDD de coherencia que verifica las dos con la misma sesión.

Es el mismo patrón que `gateo-facturacion` resolvió con dos rutas.

> Nota: la redacción original de esta decisión hablaba de **tres** rutas e incluía `/hojas-de-ruta` en el ciclo de coherencia. Esa parte quedó anulada: afirmar coherencia entre rutas de módulos distintos habría sido una aserción falsa.

### D3 — Orden de cableado: lo convencional primero

Conductores y Vehículos son list+detail+form clásicos, iguales en forma a `obra_social` y `pacientes`, así que el patrón ya venía rodado de los changes anteriores del split y el cableado no presentó fricción propia.

> La justificación original de este orden era dejar Hojas de Ruta —la pantalla más atípica del proyecto— para el final. Ese razonamiento **se mueve** al change de `pacientes`, donde esa pantalla ahora vive.

### D4 — Un solo envoltorio por formulario cubre sus bloques de campos

`ConductorForm` (210) y `VehiculoForm` (178) son formularios de un solo bloque: envolver **una vez** el bloque de campos deshabilita todos sus controles, porque `<fieldset disabled>` alcanza a todos los descendientes. El envoltorio va sobre el bloque de campos y **no** sobre la barra de acciones, para que *Cancelar* siga operativo.

> El caso que motivó esta decisión —`NuevoRecorridoForm` componiendo `PacienteTramoCampos`, `SelectorPaciente` y `RecorridoVehiculoConductor`, cubiertos con una sola inserción— pertenece a `/hojas-de-ruta` y **se mueve** al change de `pacientes`. El principio es el mismo.

### D5 — Consultar no es escribir: la lectura se preserva explícitamente

`ConductorDocumentos` (31) y `VehiculoDocumentos` (23) mezclan las dos cosas: **cargar/dar de baja** (escritura, se gatea) y **consultar/descargar** los existentes (lectura, no se gatea). Bloquear la descarga a una cuenta con `read` sería más restrictivo que la RLS —que autoriza la lectura de los documentos del módulo con `read`— e inventaría una regla que el servidor no tiene. Mismo criterio que aplicaron `gateo-pacientes` y `gateo-facturacion`.

Mismo principio en las tablas y los historiales: la asignación semanal, los gastos y el mantenimiento de un vehículo siguen siendo **legibles** con `read`; solo se gatea la acción que persiste.

> El caso de `HojaDeRutaImprimible`, `RecorridoMapa`, `RecorridoStat` y `RequisitosPaciente` —solo lectura, no se tocan— **se mueve** al change de `pacientes`. En este change esos cuatro archivos no se tocaron.

### D6 — El aviso de solo lectura va en cada página de módulo

Dos inserciones, en `ConductoresPage` (48) y `VehiculosPage` (48), replicando el patrón que `gateo-obrasocial` fijó en `ObraSocialesPage`. Mismo tono, mismo texto, misma ubicación.

Son dos avisos porque son dos rutas, no porque sean dos permisos. Una cuenta con solo `read` sobre `conductores` ve el aviso en las dos pantallas.

> La tercera inserción, en `HojaDeRutaPage`, y el requisito de que el aviso sobreviva al conmutar entre vistas, **se mueven** al change de `pacientes`.

### D7 — Pruebas: dos direcciones por comportamiento, con `renderConSesion`

Cada comportamiento se prueba con `write` (habilitado) y con solo `read` (deshabilitado), el mínimo de triangulación del modo Strict TDD. `renderConSesion` ya permite declarar el escenario; su default (admin con todos los permisos) mantiene verdes los tests existentes sin editarlos.

Las aserciones van sobre comportamiento observable —`toBeDisabled()`, el `onSubmit` que no dispara, el repositorio mock que no recibe llamadas— nunca sobre el valor del contexto ni sobre clases CSS.

El rol `admin` tiene ciclo propio: `tienePermiso` le da `true` sin consultar la matriz, así que un `admin` sin ninguna fila en `modulos.permisos` debe poder escribir en las dos rutas. Es el falso negativo más caro y un test de "solo read" no lo detecta.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Gatear una ruta contra el módulo equivocado** — el riesgo que se materializó con `/hojas-de-ruta` | **D0**: la verificación `ruta → módulo` de la tarea 1.5 es compuerta bloqueante, contra `app/routes.ts` **y** contra la migración de RLS. Detectado antes de escribir código; la ruta se descoped en vez de gatearse mal |
| **Falso negativo: deshabilitar a quien sí puede escribir**, sobre todo al rol `admin` sin filas en la matriz | Ciclo TDD propio para `admin` sin filas, además del par `write`/`read` por comportamiento |
| **Gateo incoherente entre las dos rutas** — funciona en una y no en la otra: fallo silencioso | D2 + ciclo TDD de coherencia que verifica ambas rutas con la misma sesión |
| **Bloquear la descarga de documentos** de conductor o vehículo a una cuenta con `read`, siendo más restrictivo que la RLS | D5 + ciclo TDD que verifica que consultar y descargar siguen disponibles |
| **Bloquear de más la lectura** de tablas e historiales (asignación semanal, gastos, mantenimiento) | D5 + triangulación que afirma que siguen legibles con solo `read` |
| **El envoltorio no cubre los `<button>` nativos** de `ConductoresList` / `VehiculosList` | Ciclo TDD por componente que afirma el estado deshabilitado. Si falla, el arreglo va en el change 1, no acá |
| **Romper los tests existentes** de dos features grandes | Fallback `true` del mecanismo fuera del provider + prop opt-in de `Button`. Verificado contra la línea base en cada tarea |
| **OWASP A04 *Insecure Design*** — leer este gateo como la frontera de autorización | Comentario explícito en el código nuevo; el requisito ya está fijado por el change 1 |
| **Divergencia con la semántica del servidor** | No se toca `tienePermiso` ni `ORDEN_NIVEL`: se consume la misma función con `'write'`. La única des-alineación viva (`GastosVehiculo` → RLS `facturacion`) queda documentada con `AvisoModeloDatos`, no resuelta acá |

## Migration Plan

Cero SQL, cero Edge Functions, cero dependencias, cero estado persistido. Build normal del frontend.

**Rollback:** revertir los commits (`feat(conductores): …` y `feat(vehiculos): …`) devuelve las dos pantallas a su comportamiento anterior, sin afectar al mecanismo compartido ni a los otros módulos. Como son dos árboles independientes y los commits van separados por ruta, revertir solo una también es viable.

**Verificación manual (humana, no automatizable con mocks):** con una cuenta real de solo `read` sobre `conductores`, confirmar que (a) en **las dos** rutas las acciones de escritura están visibles pero bloqueadas, (b) el aviso de solo lectura aparece en ambas, (c) *Cancelar* y *Volver al listado* funcionan, (d) los documentos de conductor y de vehículo se pueden consultar y descargar, y las tablas de asignación semanal, gastos y mantenimiento siguen legibles, y (e) una cuenta con `write` sobre `conductores` puede crear, editar y guardar en ambas rutas sin trabas. A cargo de la usuaria.

## Open Questions

Ninguna abierta en este change.

- Las cinco del análisis paraguas quedaron resueltas por la usuaria el 2026-07-29. La 4 (agrupación módulo→pantalla) fue **corregida el 2026-07-30**: `/hojas-de-ruta` no pertenece a `conductores` y sale del alcance.
- La aprobación humana de gobernanza CRÍTICO ya fue otorgada (tarea 0.1); el código de `/conductores` y `/vehiculos` está aplicado y commiteado.
- **Queda pendiente**, fuera de este change: el gateo de `/hojas-de-ruta` bajo el módulo `pacientes`, y la des-alineación de `GastosVehiculo` con la RLS de `facturacion` — ninguna de las dos bloquea el cierre de este change.

## Governance

Dominio **auth/permisos → nivel CRÍTICO** en la tabla de Agent Governance del proyecto. **`/opsx:apply` requiere aprobación humana explícita antes de escribir una sola línea**, y el cierre requiere la verificación manual del Migration Plan.
