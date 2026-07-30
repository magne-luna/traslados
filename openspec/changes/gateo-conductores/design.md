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

### La superficie: tres rutas, un solo permiso

```
módulo conductores  (~6800 líneas, 22 componentes a cablear)
│
├── /conductores → ConductoresPage (48)
│   ├── ConductoresList (190)        Crear :52 · Crear el primero :74 · Editar :171 · 1 <button> nativo
│   └── ConductorDetail (213)        Editar :153
│       ├── ConductorForm (210)      Cancelar :201 · Guardar :204
│       ├── AsignacionSemanalTabla (165)  envío :156 · campos
│       └── ConductorDocumentos (31)      carga/baja vs. consulta/descarga
│
├── /vehiculos → VehiculosPage (48)
│   ├── VehiculosList (194)          Crear :51 · Crear el primero :73 · Editar :175 · 1 <button> nativo
│   └── VehiculoDetail (228)         Editar :163
│       ├── VehiculoForm (178)       Cancelar :169 · Guardar :172
│       ├── GastosVehiculo (185)     alta de gasto :178 · campos
│       ├── VehiculoMantenimiento (131)   acciones + campos
│       └── VehiculoDocumentos (23)       carga/baja vs. consulta/descarga
│
└── /hojas-de-ruta → HojaDeRutaPage (212)
    ├── conmutadores de vista :131 armado · :135 global · :139 imprimir   ← NO se gatean
    ├── Crear hoja :161
    ├── NuevoRecorridoForm (236)     alta :212 · campos
    ├── RecorridoCard (234)          Sugerir orden :144 · aceptar :147 · editar :152
    ├── ParadasList (110)            reordenar :78 :87 · 1 <button> nativo
    ├── AsignacionPanel (138)        asignación :129 · campos
    ├── VistaGlobalHojaDeRuta (147)  mover fila :137
    ├── PacienteTramoCampos (95) · SelectorPaciente (30) · RecorridoVehiculoConductor (113)   campos
    │
    └── solo lectura, NO se tocan:
        HojaDeRutaImprimible (80) · RecorridoMapa (51) · RecorridoStat (26) · RequisitosPaciente (32)
```

`moduloDeRuta()` ya devuelve `conductores` para las tres rutas (`APP_ROUTES` en `app/routes.ts` agrupa `/vehiculos` y `/hojas-de-ruta` bajo `conductores`, siguiendo `seed_modulos.sql`), así que el mecanismo del change 1 resuelve el permiso correcto en las tres **sin ningún cambio**. Lo que hay que verificar es el cableado de cada pantalla, no la resolución del permiso.

**No hay `draggable` en este módulo** (verificado con grep: los dos únicos del proyecto están en `obra_social` y se cerraron en el change 1). `ParadasList` reordena con **botones** (`:78`, `:87`), no con arrastre, así que el envoltorio `<fieldset disabled>` alcanza — pero eso se verifica, no se asume.

### Frontera de seguridad (no negociable)

La autorización efectiva la impone la RLS: `modulos.tiene_permiso('conductores', 'write')`. **Este gateo es experiencia de uso.** El código nuevo lleva el mismo comentario que ya llevan `permisos.ts`, `SidebarNav.tsx` y el mecanismo del change 1.

## Goals / Non-Goals

**Goals:**

- Gatear por nivel `write` sobre `conductores` todas las acciones que persisten datos en **las tres** rutas del módulo.
- Preservar operativos los tres conmutadores de vista de Hojas de Ruta y las vistas de solo lectura.
- Que los tests existentes de las tres features sigan pasando **sin tocarlos**.

**Non-Goals:**

- No se construye ni se modifica el mecanismo compartido (change 1).
- No se cablean los otros tres módulos.
- No se exige `admin` para ninguna acción (decisión 5 de la usuaria: todo al nivel `write`).
- No se toca `tienePermiso`, `usePermiso`, la jerarquía, ni el gateo de navegación por `read`.
- No se toca ninguna policy de RLS ni Edge Function.
- No se rediseña el armado de hojas de ruta: se gatea lo que ya existe, tal como está.

## Decisions

### D1 — Los conmutadores de vista de Hojas de Ruta NO se gatean

`HojaDeRutaPage` (212) tiene tres `Button` que conmutan entre las vistas *armado*, *global* e *imprimir* (`:131`, `:135`, `:139`). **Ninguno escribe nada**: cambian estado local de la pantalla.

Gatearlos dejaría a una cuenta con solo `read` encerrada en la vista de armado, sin poder ver la global ni la imprimible — datos que su permiso `read` **sí** la autoriza a ver. Sería una regresión de usabilidad causada por el propio arreglo.

Este es el ejemplo canónico que justificó que la prop de escritura de `Button` sea **opt-in y nunca automática** en el change 1: un `Button` que se auto-deshabilitara al detectar solo-lectura atraparía estos tres. Acá se cobra ese diseño.

Tiene ciclo TDD dedicado, en las dos direcciones: con solo `read` los tres conmutadores funcionan y las tres vistas se renderizan.

### D2 — Las tres rutas se cablean por separado, pero se verifican juntas

`/conductores`, `/vehiculos` y `/hojas-de-ruta` son tres árboles de componentes independientes: no comparten página, listado ni formulario. El cableado es trabajo separado, en tres secciones de tareas.

Lo que **no** es separado es el permiso: las tres resuelven `conductores`, así que una cuenta con solo `read` sobre ese módulo queda en solo lectura en las tres simultáneamente. Un gateo que funcione en dos y no en la tercera es un fallo silencioso, así que hay un ciclo TDD de coherencia que verifica las tres con la misma sesión.

Es el mismo patrón que `gateo-facturacion` resolvió con dos rutas; acá son tres.

### D3 — Orden de cableado: lo convencional primero, Hojas de Ruta al final

Conductores y Vehículos son list+detail+form clásicos, iguales en forma a `obra_social` y `pacientes`. Hojas de Ruta es la pantalla más atípica del proyecto: tres vistas, armado interactivo, mapa, reordenamiento, asignación.

Cablear las dos convencionales primero significa que cuando se llega a Hojas de Ruta el patrón ya está rodado en cinco pantallas (las dos de este change más las tres de los changes anteriores), y cualquier fricción que aparezca es atribuible a la pantalla y no al mecanismo.

### D4 — Un solo envoltorio por formulario cubre sus bloques de campos

`NuevoRecorridoForm` (236) compone `PacienteTramoCampos` (95), `SelectorPaciente` (30) y `RecorridoVehiculoConductor` (113). Envolver **una vez** en el formulario deshabilita los campos de los tres, porque `<fieldset disabled>` alcanza a todos los descendientes. Los tres componentes de campos no cambian ni una línea ni reciben props nuevas.

Mismo criterio en `ConductorForm` y `VehiculoForm`, que son formularios de un solo bloque.

### D5 — Consultar no es escribir: la lectura se preserva explícitamente

`HojaDeRutaImprimible` (80), `RecorridoMapa` (51), `RecorridoStat` (26) y `RequisitosPaciente` (32) son de solo lectura y **no se tocan**. Deben seguir renderizándose completos con nivel `read`. La vista imprimible es el caso donde bloquear de más sería más visible: una cuenta que puede ver una hoja de ruta pero no imprimirla es un bug evidente.

`ConductorDocumentos` (31) y `VehiculoDocumentos` (23) mezclan las dos cosas: **cargar/dar de baja** (escritura, se gatea) y **consultar/descargar** los existentes (lectura, no se gatea). Bloquear la descarga a una cuenta con `read` sería más restrictivo que la RLS —que autoriza la lectura de los documentos del módulo con `read`— e inventaría una regla que el servidor no tiene. Mismo criterio que aplicaron `gateo-pacientes` y `gateo-facturacion`.

### D6 — El aviso de solo lectura va en cada página de módulo

Tres inserciones, en `ConductoresPage` (48), `VehiculosPage` (48) y `HojaDeRutaPage` (212), replicando el patrón que `gateo-obrasocial` fijó en `ObraSocialesPage`. Mismo tono, mismo texto, misma ubicación.

Son tres avisos porque son tres rutas, no porque sean tres permisos. Una cuenta con solo `read` sobre `conductores` ve el aviso en las tres pantallas.

En `HojaDeRutaPage` el aviso debe quedar visible en las tres vistas (armado, global, imprimir), no solo en la de armado — o al menos no debe desaparecer al conmutar, porque la cuenta sigue en modo solo lectura.

### D7 — Pruebas: dos direcciones por comportamiento, con `renderConSesion`

Cada comportamiento se prueba con `write` (habilitado) y con solo `read` (deshabilitado), el mínimo de triangulación del modo Strict TDD. `renderConSesion` ya permite declarar el escenario; su default (admin con todos los permisos) mantiene verdes los tests existentes sin editarlos.

Las aserciones van sobre comportamiento observable —`toBeDisabled()`, el `onSubmit` que no dispara, el repositorio mock que no recibe llamadas— nunca sobre el valor del contexto ni sobre clases CSS.

El rol `admin` tiene ciclo propio: `tienePermiso` le da `true` sin consultar la matriz, así que un `admin` sin ninguna fila en `modulos.permisos` debe poder armar hojas de ruta en las tres rutas. Es el falso negativo más caro y un test de "solo read" no lo detecta.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Gatear los tres conmutadores de vista** de `HojaDeRutaPage` y encerrar a una cuenta con `read` en la vista de armado, sin poder ver la global ni la imprimible que su permiso sí la autoriza a ver | **D1** + ciclo TDD dedicado que verifica los tres conmutadores operativos con solo `read`. Es el riesgo más específico de todo el split |
| **Falso negativo: deshabilitar a quien sí puede escribir**, sobre todo al rol `admin` sin filas en la matriz | Ciclo TDD propio para `admin` sin filas, además del par `write`/`read` por comportamiento |
| **Gateo incoherente entre las tres rutas** — funciona en dos y no en la tercera: fallo silencioso | D2 + ciclo TDD de coherencia que verifica las tres rutas con la misma sesión |
| **Superficie más grande del split** (~6800 líneas, 22 componentes): fatiga y omisiones | D3 (orden: convencional primero) + enumeración explícita de cada punto de escritura con archivo y línea en `tasks.md` |
| **Bloquear de más la lectura**, en particular `HojaDeRutaImprimible`: poder ver una hoja pero no imprimirla es un bug evidente | D5 + ciclo TDD dedicado a la lectura preservada |
| **Bloquear la descarga de documentos** de conductor o vehículo a una cuenta con `read`, siendo más restrictivo que la RLS | D5 + ciclo TDD que verifica que consultar y descargar siguen disponibles |
| **El envoltorio no cubre los 3 `<button>` nativos** de `ConductoresList` / `VehiculosList` / `ParadasList` | Ciclo TDD por componente que afirma el estado deshabilitado. Si falla, el arreglo va en el change 1, no acá |
| **Asumir que `ParadasList` reordena por arrastre** y dejar vivo un camino de escritura | Verificado con grep: reordena con botones, no con arrastre; los 2 únicos `draggable` del proyecto están en `obra_social` y se cerraron en el change 1. Se verifica igual, no se asume |
| **Romper los tests existentes** de tres features grandes | Fallback `true` del mecanismo fuera del provider + prop opt-in de `Button`. Verificado contra la línea base en cada tarea |
| **OWASP A04 *Insecure Design*** — leer este gateo como la frontera de autorización | Comentario explícito en el código nuevo; el requisito ya está fijado por el change 1 |
| **Divergencia con la semántica del servidor** | No se toca `tienePermiso` ni `ORDEN_NIVEL`: se consume la misma función con `'write'` |

## Migration Plan

Cero SQL, cero Edge Functions, cero dependencias, cero estado persistido. Build normal del frontend.

**Rollback:** revertir el commit devuelve las tres pantallas a su comportamiento actual, sin afectar al mecanismo compartido ni a los otros módulos. Como son tres árboles independientes, revertir solo una de las tres rutas también es viable.

**Verificación manual (humana, no automatizable con mocks):** con una cuenta real de solo `read` sobre `conductores`, confirmar que (a) en **las tres** rutas las acciones de escritura están visibles pero bloqueadas, (b) el aviso de solo lectura aparece en las tres, (c) *Cancelar* y *Volver al listado* funcionan, (d) **los tres conmutadores de vista de Hojas de Ruta funcionan** y las tres vistas se renderizan, (e) la vista imprimible de la hoja de ruta se renderiza completa y los documentos de conductor y vehículo se pueden consultar y descargar, y (f) una cuenta con `write` puede armar hojas de ruta, reordenar paradas y asignar sin trabas. A cargo de la usuaria.

## Open Questions

Ninguna. Las cinco del análisis paraguas quedaron resueltas por la usuaria el 2026-07-29 — incluida la 4, que confirmó que este módulo gatea las tres rutas a la vez. Lo único pendiente es la aprobación humana de gobernanza CRÍTICO para empezar a escribir código.

## Governance

Dominio **auth/permisos → nivel CRÍTICO** en la tabla de Agent Governance del proyecto. **`/opsx:apply` requiere aprobación humana explícita antes de escribir una sola línea**, y el cierre requiere la verificación manual del Migration Plan.
