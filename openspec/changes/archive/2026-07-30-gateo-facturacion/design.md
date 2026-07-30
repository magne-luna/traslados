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

### Lo que hace distinto a este módulo

Es el primero con **dos rutas gobernadas por un solo permiso** y el que concentra las **acciones de escritura que no son un CRUD limpio**.

```
módulo facturacion
├── /presupuestos → PresupuestosPage (81)
│   ├── PresupuestosList (159)     Crear :54 · Crear el primero :76 · Editar por fila :140 · 1 <button> nativo
│   └── PresupuestoDetail (270)
│       ├── PresupuestoResumen (65)    Editar :59
│       ├── PresupuestoForm (164)      Cancelar :155 · Guardar :158
│       └── AutorizacionForm (232)     entrada :233 (en Detail) · Cancelar :223 · Guardar :226
│
└── /facturacion → FacturacionPage (88)
    ├── FacturasList (191)         Nueva :72 · Crear la primera :102 · Editar por fila :172 · 1 <button> nativo
    └── FacturaDetail (223)        Editar :172
        ├── FacturaForm (201)      Cancelar :196 · Guardar :197
        │   ├── FacturaFormDatosBasicos (62)   campos
        │   └── FacturaFormEconomicos (51)     campos
        ├── FacturaAccionesEmision (52)   Emitir :38 · Confirmar emisión :46      ← no-CRUD
        ├── CobrosPanel (178)             Registrar cobro :170 · 1 <button> nativo ← no-CRUD
        ├── FacturaCobrosSection (65)     Aplicar corrección de estado :59        ← no-CRUD
        ├── AsistenciasEditor (125)       edición :119 · 1 <button> nativo        ← no-CRUD
        ├── DiasFacturablesSelector (85)  selección de días facturables           ← no-CRUD
        └── FacturaDocumentos (32)        carga/baja vs. consulta/descarga
        
        solo lectura, NO se tocan:
        FacturaResumen (165) · FacturaImprimible (85) · AlertaCupo (30) · FacturaAvisoDiscrepancias (20)
```

`moduloDeRuta()` ya devuelve `facturacion` para las dos rutas (`APP_ROUTES` en `app/routes.ts` agrupa `/presupuestos` bajo `facturacion`, siguiendo `seed_modulos.sql`), así que el mecanismo del change 1 resuelve el permiso correcto en ambas **sin ningún cambio**. Lo que hay que verificar es el cableado de cada pantalla, no la resolución del permiso.

### Frontera de seguridad (no negociable)

La autorización efectiva la impone la RLS: `modulos.tiene_permiso('facturacion', 'write')`. **Este gateo es experiencia de uso.** El código nuevo lleva el mismo comentario que ya llevan `permisos.ts`, `SidebarNav.tsx` y el mecanismo del change 1.

## Goals / Non-Goals

**Goals:**

- Gatear por nivel `write` sobre `facturacion` todas las acciones que persisten datos en **las dos** rutas del módulo.
- Cubrir las 5 acciones no-CRUD (emitir, cobrar, corregir estado, asistencias, días facturables) al mismo nivel `write` que el CRUD normal, por decisión 5 de la usuaria.
- Mantener intactas las vistas de solo lectura, en particular la vista imprimible.
- Que los tests existentes de las dos features sigan pasando **sin tocarlos**.

**Non-Goals:**

- No se construye ni se modifica el mecanismo compartido (change 1).
- No se cablean los otros tres módulos.
- No se exige `admin` para ninguna acción (decisión 5 de la usuaria: todo al nivel `write`).
- No se toca `tienePermiso`, `usePermiso`, la jerarquía, ni el gateo de navegación por `read`.
- No se toca ninguna policy de RLS ni Edge Function.
- No se traduce el error de RLS del servidor a un mensaje amigable.

## Decisions

### D1 — Las dos rutas se cablean por separado, pero se verifican juntas

`/presupuestos` y `/facturacion` son dos árboles de componentes independientes: no comparten ni la página, ni el listado, ni el formulario. El cableado es entonces trabajo separado, en dos secciones de tareas.

Lo que **no** es separado es el permiso: las dos rutas resuelven `facturacion`, así que una cuenta con solo `read` sobre ese módulo queda en solo lectura en ambas simultáneamente. Un gateo que funcione en una y no en la otra es un fallo silencioso —la cuenta creería que puede escribir presupuestos pero no facturas—, así que hay un ciclo TDD de coherencia que verifica las dos rutas con la misma sesión.

Esto vale también como advertencia para `gateo-conductores`, que tiene el mismo patrón con **tres** rutas.

### D2 — Las acciones no-CRUD se gatean igual que el CRUD, al nivel `write`

Por decisión 5 de la usuaria: *emitir factura*, *registrar cobro*, *corregir estado de asistencia*, *editar asistencias* y *seleccionar días facturables* son escrituras y se gatean con `usePuedeEscribir()`, exactamente igual que un *Guardar*. **Ninguna requiere `admin`.**

Rationale de mantenerlo simple: la jerarquía `read < write < admin` ya está implementada y probada, y `tienePermiso` acepta cualquier nivel mínimo sin modificarse. Si más adelante se decide que *emitir factura* requiere `admin`, es cambiar el nivel en el call site —una línea— no un cambio estructural. Introducir hoy un segundo nivel de gateo por acción agregaría complejidad para un requisito que la usuaria no pidió.

Riesgo real que esto acepta: una cuenta con `write` puede emitir facturas y registrar cobros. Es exactamente lo que hace la RLS del servidor hoy, así que el cliente no está siendo más permisivo que el backend — sería peor lo contrario.

**Alternativa descartada — nivel `admin` para las acciones de dinero.** Defendible en abstracto, pero la usuaria lo decidió explícitamente en la otra dirección y la RLS del servidor no lo exige. Implementarlo igual sería inventar una restricción que el backend no tiene y que dejaría a cuentas con `write` legítimo trabadas en la UI mientras el servidor les permite la operación.

### D3 — Un solo envoltorio por formulario, no uno por bloque de campos

`FacturaForm` (201) compone `FacturaFormDatosBasicos` (62) y `FacturaFormEconomicos` (51). Envolver **una vez** en `FacturaForm` deshabilita los campos de los dos, porque `<fieldset disabled>` alcanza a todos los descendientes. Los dos componentes de campos no cambian ni una línea ni reciben props nuevas.

Mismo criterio en `PresupuestoForm` y `AutorizacionForm`, que son formularios de un solo bloque.

### D4 — Consultar no es escribir: la lectura se preserva explícitamente

`FacturaResumen` (165), `FacturaImprimible` (85), `AlertaCupo` (30) y `FacturaAvisoDiscrepancias` (20) son de solo lectura y **no se tocan**. Deben seguir renderizándose completos con nivel `read`.

`FacturaDocumentos` (32) mezcla las dos cosas: **cargar/dar de baja** documentos (escritura, se gatea) y **consultar/descargar** los existentes (lectura, no se gatea). Bloquear la descarga a una cuenta con `read` sería más restrictivo que la RLS —que autoriza la lectura de los documentos del módulo con `read`— e inventaría una regla que el servidor no tiene. Mismo criterio que `gateo-pacientes` aplicó a `PacienteDocumentos`.

La vista imprimible es el caso donde bloquear de más sería más visible: una cuenta con `read` que no puede imprimir una factura que sí puede ver es un bug evidente. Tiene ciclo TDD propio.

### D5 — El aviso de solo lectura va en cada página de módulo

Dos inserciones, una en `PresupuestosPage` (81) y otra en `FacturacionPage` (88), replicando el patrón que `gateo-obrasocial` fijó en `ObraSocialesPage`. Mismo tono, mismo texto, misma ubicación: la consistencia entre módulos es el punto.

Son dos avisos porque son dos rutas, no porque sean dos permisos. Una cuenta con solo `read` sobre `facturacion` ve el aviso en las dos pantallas.

### D6 — Pruebas: dos direcciones por comportamiento, con `renderConSesion`

Cada comportamiento se prueba con `write` (habilitado) y con solo `read` (deshabilitado), el mínimo de triangulación del modo Strict TDD. `renderConSesion` ya permite declarar el escenario; su default (admin con todos los permisos) mantiene verdes los tests existentes sin editarlos.

Las aserciones van sobre comportamiento observable —`toBeDisabled()`, el `onSubmit` que no dispara, el repositorio mock que no recibe llamadas— nunca sobre el valor del contexto ni sobre clases CSS.

El rol `admin` tiene ciclo propio: `tienePermiso` le da `true` sin consultar la matriz, así que un `admin` sin ninguna fila en `modulos.permisos` debe poder emitir, cobrar y guardar. Es el falso negativo más caro y un test de "solo read" no lo detecta.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| **Falso negativo: deshabilitar a quien sí puede escribir**, sobre todo al rol `admin` sin filas en la matriz | Ciclo TDD propio para `admin` sin filas, además del par `write`/`read` por comportamiento |
| **Olvidar una acción no-CRUD** — están dispersas en 5 componentes chicos (52, 178, 65, 125, 85 líneas) y son fáciles de pasar por alto | D2 + un ciclo TDD por acción, enumeradas con archivo y línea en `tasks.md` |
| **Gateo incoherente entre las dos rutas** — funciona en `/facturacion` y no en `/presupuestos`, o al revés: fallo silencioso | D1 + ciclo TDD de coherencia que verifica las dos rutas con la misma sesión |
| **Bloquear de más la lectura**, en particular la vista imprimible: una cuenta con `read` que no puede imprimir una factura que sí ve es un bug evidente | D4 + ciclo TDD dedicado a la lectura preservada, con `FacturaImprimible` explícito |
| **Bloquear la descarga de documentos** a una cuenta con `read`, siendo más restrictivo que la RLS | D4 + ciclo TDD que verifica que consultar y descargar siguen disponibles |
| **El envoltorio no cubre los 4 `<button>` nativos** de `FacturasList` / `CobrosPanel` / `AsistenciasEditor` / `PresupuestosList` | Ciclo TDD por componente que afirma el estado deshabilitado. Si falla, el arreglo va en el change 1, no acá |
| **Romper los tests existentes** de dos features grandes (~2800 + ~2000 líneas) | Fallback `true` del mecanismo fuera del provider + prop opt-in de `Button`. Verificado contra la línea base en cada tarea |
| **Ser más restrictivo que el servidor** al exigir `admin` para acciones de dinero que la RLS permite con `write` | D2: decisión explícita de la usuaria, alineada con lo que la RLS ya hace |
| **OWASP A04 *Insecure Design*** — leer este gateo como la frontera de autorización | Comentario explícito en el código nuevo; el requisito ya está fijado por el change 1 |
| **Divergencia con la semántica del servidor** | No se toca `tienePermiso` ni `ORDEN_NIVEL`: se consume la misma función con `'write'` |

## Migration Plan

Cero SQL, cero Edge Functions, cero dependencias, cero estado persistido. Build normal del frontend.

**Rollback:** revertir el commit devuelve las dos pantallas a su comportamiento actual, sin afectar al mecanismo compartido ni a los otros módulos. Como son dos árboles independientes, revertir solo una de las dos rutas también es viable.

**Verificación manual (humana, no automatizable con mocks):** con una cuenta real de solo `read` sobre `facturacion`, confirmar que (a) en **las dos** rutas las acciones de escritura están visibles pero bloqueadas, (b) el aviso de solo lectura aparece en las dos, (c) *Cancelar* y *Volver al listado* funcionan, (d) *Emitir factura*, *Registrar cobro*, *Aplicar* corrección de estado y la edición de asistencias están bloqueados, (e) `FacturaResumen` y la **vista imprimible** se renderizan completas y los documentos se pueden consultar y descargar, y (f) una cuenta con `write` puede hacer todo, incluidas las acciones de dinero. A cargo de la usuaria.

## Open Questions

Ninguna. Las cinco del análisis paraguas quedaron resueltas por la usuaria el 2026-07-29 — incluida la 5, que fijaba el nivel de las acciones no-CRUD de este módulo en `write`. Lo único pendiente es la aprobación humana de gobernanza CRÍTICO para empezar a escribir código.

## Governance

Dominio **auth/permisos → nivel CRÍTICO** en la tabla de Agent Governance del proyecto. **`/opsx:apply` requiere aprobación humana explícita antes de escribir una sola línea**, y el cierre requiere la verificación manual del Migration Plan.
