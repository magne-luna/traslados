## Why

**Las cuatro listas de referencia de la app se vuelven a pedir a Supabase desde cero en cada
navegación, y a veces dos veces en la misma pantalla.** Verificado sobre el código real
(2026-08-12), no es hipotético:

| Lista | Quién la pide (fuera de tests) | Veces por sesión |
|---|---|---|
| `pacienteRepository.list()` | `HojaDeRutaPage:72`, `FacturacionPage:47`, `PresupuestosPage:33`, `useAlertasCud:34` (dashboard) | 1 por cada visita a cada una de las 4 pantallas |
| `obraSocialRepository.list()` | `ObraSocialesPage:21`, `PacientesPage:39`, `FacturacionPage:48`, `PresupuestosPage:34` | 1 por cada visita a cada una de las 4 pantallas |
| `vehiculoRepository.list()` | `VehiculosPage:21`, `HojaDeRutaPage:73`, `ConductoresList:32`, `AsignacionSemanalTabla:36`, `useAlertasMantenimiento:31` (dashboard) | **2 simultáneas** solo en Conductores + 1 por pantalla |
| `conductorRepository.list()` | `ConductoresPage:21`, `HojaDeRutaPage:74`, `useConductoresDashboard:36` (dashboard) | 1 por cada visita a cada una de las 3 pantallas |

**La causa raíz es estructural, no un descuido puntual.** Los repositories se inyectan como
singletons de módulo vía Context (`ObraSocialRepositoryContext`, etc.), pero **cada hook consumidor
mantiene su propio estado local de fetch** — `usePacientes`, `useConductores`, `useVehiculos` y
`useObrasSociales` son, línea por línea, el mismo `useState` + `useEffect` + `repository.list()`
parametrizado por tipo. Como react-router desmonta la ruta al navegar, el efecto de cada hook se
vuelve a disparar desde cero en cada visita. **No hay ninguna capa que recuerde nada entre montajes.**

Eso produce dos desperdicios distintos, que se arreglan con el mismo mecanismo:

1. **Duplicación intra-pantalla**: `ConductoresList` y `AsignacionSemanalTabla` son hermanos dentro
   de `ConductoresPage` y **cada uno llama `useVehiculos` por su cuenta** → dos `SELECT` idénticos y
   concurrentes contra la misma tabla, en el mismo tick de render.
2. **Re-fetch inter-pantalla**: ir a Presupuestos → Facturación → volver a Presupuestos vuelve a
   traer el padrón completo de pacientes y de obras sociales tres veces, aunque no haya cambiado
   nada. Y `/` (dashboard) es la ruta índice: se pasa por ella constantemente.

Son datos **casi estáticos dentro de una sesión** — el padrón de obras sociales, la flota, la
nómina de conductores y el padrón de pacientes cambian por una alta puntual, no minuto a minuto.
Pedirlos de nuevo en cada montaje es puro round-trip desperdiciado.

**Qué NO resuelve este change (para cerrar la expectativa de entrada):** el disparador original fue
un LCP de 3,24 s medido en Chrome DevTools sobre el deploy de Vercel. Una capa de caché **no mejora
el LCP de carga fría** — en la primera visita el dato no está cacheado por definición. Lo que este
change ataca es el costo **acumulado durante la sesión**: navegaciones posteriores, montajes
hermanos y vueltas al dashboard. Eso es real y medible, pero es otra métrica. El LCP de carga fría
es un problema de bundle/render inicial y es un change aparte.

Governance: **MEDIA-ALTA**. No toca auth, dinero ni auditoría, pero modifica la capa de obtención de
datos de la que dependen los selectores de Facturación y Presupuestos. Requiere revisión humana del
enfoque antes del apply, y **un checkpoint explícito de la usuaria sobre la decisión D1** (librería
externa vs. primitivo propio).

## What Changes

### 1. Checkpoint previo: ¿TanStack Query o un primitivo propio? — decisión D1

La consulta original fue "¿React Query ayudaría?". La respuesta corta es **sí, resolvería
exactamente este patrón** — pero no es la única forma, y en este proyecto hay dos argumentos
concretos en contra que hay que poner sobre la mesa antes de instalar nada:

- **El disparador era el LCP.** `@tanstack/react-query` agrega ~13 KB gzip al bundle del *critical
  path*. Empeora marginalmente la métrica que originó la consulta, para mejorar una métrica
  distinta (navegación). El primitivo propio pesa ~1 KB.
- **Hay precedente escrito en contra.** `paginacion-listados` (en curso, 61/93) declara
  explícitamente en su §7: *"NO introduce TanStack Query ni ninguna librería nueva. Cero
  dependencias."* Revertir esa postura es legítimo, pero tiene que ser una decisión consciente y
  documentada, no un efecto colateral.

`design.md` §D1 compara las dos opciones con detalle y **recomienda el primitivo propio**
(`useListaCacheada`, ~120 líneas, testeable con TDD estricto, sin provider, sin tocar los 115
archivos de test que usan `render` pelado), con un **gatillo de migración documentado**: si en
adelante aparecen caché de páginas, updates optimistas, scroll infinito o modo offline, TanStack
Query pasa a estar justificada y la API del hook está deliberadamente moldeada para que la
migración sea un cambio dentro de un solo archivo.

**Esta decisión requiere OK explícito antes del apply.** Si la usuaria prefiere la librería, `D1` se
invierte y el resto del change (qué se cachea, cuándo se invalida, cómo se testea) sigue siendo
válido casi sin cambios.

### 2. Qué se cachea: SOLO las cuatro listas de referencia vía `list()`

Se introduce una caché compartida a nivel de módulo, con clave por dominio, para:

`pacientes` · `vehiculos` · `conductores` · `obrasSociales`

**Y solo por la vía `list()` (el universo completo).** Esto encaja limpio con el corte que
`paginacion-listados` **ya hizo**: ese change movió las pantallas de listado a `listPage()` y dejó
`list()` cumpliendo un único rol — poblar selectores/combos y alimentar agregaciones del dashboard.
Es decir, `list()` hoy ya es exactamente "el padrón completo, casi estático" — el caso de uso
canónico de una caché. No hay que inventar ninguna separación: ya está hecha.

### 3. Los cuatro hooks se reescriben por dentro, y su API pública NO cambia

`usePacientes`, `useConductores`, `useVehiculos` y `useObrasSociales` pasan a delegar en
`useListaCacheada`, **manteniendo byte a byte la forma de su resultado**
(`{ datos, loading, error, recargar, crear, actualizar }`). Consecuencia deliberada: **ninguna
pantalla cambia una línea**, y de los 247 archivos de test solo cambian los 4 unitarios de los
hooks. El resto (26 archivos que montan estas pantallas) solo necesita el reset de caché global.

Los tres hooks del dashboard que llaman `repository.list()` **directo** —`useAlertasCud`,
`useAlertasMantenimiento`, `useConductoresDashboard`— también pasan por la caché. Son de solo
lectura y comparten las mismas claves, así que el dashboard deja de pagar el fetch cuando ya se
visitó el módulo correspondiente (y viceversa).

### 4. Frescura: cache-first con TTL + revalidación en background

- **Fresco** (edad < TTL): se sirve de memoria, **cero requests**.
- **Ausente**: se pide, con `loading: true` (comportamiento actual, sin regresión).
- **Vencido pero con dato en memoria**: se sirve el dato cacheado **inmediatamente**
  (`loading: false`, sin flash de spinner en una pantalla que ya tenía contenido) y se revalida en
  segundo plano.
- **Montajes concurrentes**: la promesa en vuelo se comparte → `ConductoresList` y
  `AsignacionSemanalTabla` disparan **un** request, no dos.
- **Error con dato cacheado presente**: se conserva el dato y se expone `error` (no se vacía la
  pantalla por un fallo de refresco).

TTL propuesto: **5 minutos** (justificación y alternativas en `design.md` §D3).

### 5. Invalidación en mutación — el punto delicado

Toda mutación (`crear` / `actualizar`) **invalida la clave de su dominio** antes de recargar. Es lo
que garantiza que dar de alta una obra social desde `ObraSocialesPage` se vea en el combo de
`PacienteForm` sin recargar el navegador.

**⚠️ Riesgo #1 y punto de acoplamiento con `paginacion-listados`:** las pantallas ya migradas a
paginación mutan por **otro** camino (`usePacientesPaginado.crear/actualizar`, que recarga solo su
página vía `listPage`). Si ese camino no invalida también la clave `pacientes`, un alta hecha desde
la pantalla de Pacientes **no aparecería** en los selectores de Presupuestos/Facturación hasta que
venza el TTL. Ese cableado es parte del alcance de este change y tiene test propio.

### 6. Aislamiento de tests (no negociable)

Una caché a nivel de módulo es estado global: sin reset, un test contamina al siguiente y las
suites empiezan a depender del orden. Se agrega `limpiarCacheDeReferencia()` a
`frontend/src/test/setup.ts` en un `beforeEach` global, con un test que demuestra la fuga si se
quita.

### 7. Lo que este change NO hace

- **NO** cachea `listPage()` ni ningún resultado paginado/filtrado (`usePaginaListado` sigue igual).
- **NO** cachea facturas, cobros, presupuestos, autorizaciones, hojas de ruta, documentos ni
  cuentas — son datos transaccionales que cambian dentro de la sesión y cuya frescura sí importa.
- **NO** mejora el LCP de carga fría (ver §Why).
- **NO** agrega persistencia en `localStorage`/`sessionStorage`: la caché vive en memoria y muere
  con la pestaña. Cachear datos de salud en disco del cliente es una decisión de privacidad aparte,
  y este change la evita a propósito.
- **NO** agrega refetch-on-window-focus ni reintentos automáticos.
- **NO** toca repositories, Edge Functions, RLS, migraciones SQL ni el design system.
- **NO** cambia ninguna firma de repository ni ninguna prop de componente.

## Capabilities

### New Capabilities

- `cache-listas-referencia`: contrato de la caché compartida de listas de referencia — qué dominios
  entran (`pacientes`, `vehiculos`, `conductores`, `obrasSociales`) y solo por la vía `list()`,
  deduplicación de peticiones concurrentes, política de frescura (cache-first + TTL + revalidación
  en background sin flash de carga), invalidación obligatoria en toda mutación del dominio
  (incluidas las que entran por el camino paginado), preservación del dato cacheado ante error de
  refresco, y reset obligatorio del estado global entre tests.

### Modified Capabilities

<!-- Ninguna. Los requisitos de comportamiento de `obra-social-crud`, `conductor-crud`,
     `vehiculo-crud`, `paciente-ficha` y `dashboard-tarjetas-alertas` no cambian: las pantallas
     siguen mostrando el universo completo, siguen reflejando las altas/ediciones de inmediato y
     siguen reportando carga y error. Lo único que cambia es de dónde sale el dato. El requisito
     nuevo y observable (frescura acotada, dedup, invalidación cruzada) vive entero en la
     capability nueva. -->

## Impact

**Código nuevo**
- `frontend/src/shared/lib/cache/cacheDeReferencia.ts` + `.test.ts` — store de módulo: entradas por
  clave (`datos`, `cargadoEn`, `enVuelo`, `error`), `obtener`, `invalidar`, `suscribir`,
  `limpiarCacheDeReferencia`. Sin React, 100% testeable sin DOM.
- `frontend/src/shared/lib/cache/useListaCacheada.ts` + `.test.ts` — hook genérico sobre el store
  (`useSyncExternalStore`, correcto bajo React 19 concurrente).
- `frontend/src/shared/lib/cache/clavesCache.ts` — claves como union de literales, sin strings
  sueltos en los sitios de llamada.

**Código modificado**
- `features/pacientes/usePacientes.ts`, `features/conductores/useConductores.ts`,
  `features/vehiculos/useVehiculos.ts`, `features/obras-sociales/useObrasSociales.ts` — el cuerpo
  delega en `useListaCacheada`; **la interfaz exportada no cambia**.
- `features/dashboard/useAlertasCud.ts`, `useAlertasMantenimiento.ts`, `useConductoresDashboard.ts`
  — pasan a leer por la caché en vez de `repository.list()` directo.
- `features/pacientes/usePacientesPaginado.ts` — sus mutaciones invalidan además la clave
  `pacientes` (**punto de acoplamiento con `paginacion-listados`**).
- `frontend/src/test/setup.ts` — `beforeEach(limpiarCacheDeReferencia)`.
- Los 4 tests unitarios de hooks (`usePacientes.test.ts`, `useConductores.test.ts`,
  `useVehiculos.test.ts`, `useObrasSociales.test.ts`) — hoy asumen "un montaje = un `list()`".

**Sin impacto (explícito)**
- Ninguna pantalla (`*Page.tsx`, `*List.tsx`, `*Detail.tsx`, `*Form.tsx`), ningún `*Route.tsx`,
  ningún `*RepositoryContext.tsx`.
- Ningún repository (interfaz ni implementación Supabase/mock), ninguna Edge Function, cero SQL,
  cero RLS, cero cambios de permisos.
- `design-system/` entero. `usePaginaListado`, `rangoSupabase`, `<Paginador>` y todo lo demás de
  `paginacion-listados`.

**Dependencias**
- **Convive con `paginacion-listados` (61/93, en curso)** — no lo bloquea ni lo requiere, pero
  **comparten archivos**: `usePacientes.ts` y `usePacientesPaginado.ts`. Ver riesgo #2.
- No depende de ningún change bloqueado. No requiere backend nuevo. No entra en el camino crítico
  `C-01 → C-02 → C-04 → C-05 → C-06 → C-07` de `CHANGES.md` (es transversal, como
  `paginacion-listados`).

**Riesgo y rollback**
- **Riesgo #1 (alto, correctitud):** una mutación que no invalide deja selectores desactualizados
  hasta el TTL — silencioso, y en Facturación/Presupuestos sería confuso. Mitigado con invalidación
  obligatoria como requisito del contrato + test específico del camino paginado (§5).
- **Riesgo #2 (alto, coordinación):** `paginacion-listados` está a mitad de camino y sus fases
  pendientes migran `ConductoresPage` y `ObraSocialesPage` a `listPage`. Si ambos changes editan
  `usePacientes.ts`/`usePacientesPaginado.ts` en paralelo hay conflicto de merge **y**, peor, el
  riesgo de que una fase nueva de paginación introduzca un camino de mutación sin invalidación.
  **Mitigación: no aplicar este change hasta cerrar `paginacion-listados`, o coordinar
  explícitamente el orden.** Es la decisión operativa más importante del change.
- **Riesgo #3 (medio, tests):** estado global entre tests → suites dependientes del orden.
  Mitigado con el reset global en `setup.ts` (§6) y un test que lo prueba.
- **Riesgo #4 (medio, concurrencia real):** con la caché, la usuaria A no ve el alta de la usuaria B
  hasta que venza el TTL. Hoy la ve al navegar. Es una **regresión de frescura aceptada
  conscientemente**, acotada por el TTL; se documenta y `recargar()` sigue disponible como escape.
- **Riesgo #5 (bajo):** claves compartidas entre repositories distintos (mock vs. Supabase) si
  alguna vez conviven dos instancias del mismo dominio. Hoy no ocurre (un singleton por dominio,
  `*Route.tsx`), y el reset de tests cubre el caso de test.
- **Rollback:** completamente reversible y sin migración de datos. Cada hook migrado es un commit
  independiente; revertirlo es volver el cuerpo del hook al `useState`+`useEffect` original — la
  API pública nunca cambió, así que ninguna pantalla ni test de pantalla se entera. Si se revierten
  todos, `shared/lib/cache/` queda sin llamadores e inerte, o se borra. Nada que revertir del lado
  del servidor: este change no escribe, no migra y no toca Supabase.
