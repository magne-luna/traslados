## Why

> **Historia de este change.** Nació el 2026-08-12 como `cache-listas-referencia`, con el alcance
> acotado a cuatro listas y una recomendación explícita de **no** usar TanStack Query (decisión D1).
> El 2026-08-29 la usuaria resolvió el checkpoint D1 **a favor de la librería** y amplió el alcance
> a **toda la aplicación**. El diagnóstico de abajo es el original y sigue vigente; lo que cambió es
> el remedio y su alcance. Ver `design.md` §D1 para el registro completo de la decisión.

**Los datos se vuelven a pedir a Supabase desde cero en cada navegación, y a veces dos veces en la
misma pantalla.** Verificado sobre el código real (2026-08-12), no es hipotético:

| Lista | Quién la pide (fuera de tests) | Veces por sesión |
|---|---|---|
| `pacienteRepository.list()` | `HojaDeRutaPage`, `FacturacionPage`, `PresupuestosPage`, `useAlertasCud` (dashboard) | 1 por cada visita a cada una de las 4 pantallas |
| `obraSocialRepository.list()` | `ObraSocialesPage`, `PacientesPage`, `FacturacionPage`, `PresupuestosPage` | 1 por cada visita a cada una de las 4 pantallas |
| `vehiculoRepository.list()` | `VehiculosPage`, `HojaDeRutaPage`, `ConductoresList`, `AsignacionSemanalTabla`, `useAlertasMantenimiento` (dashboard) | **2 simultáneas** solo en Conductores + 1 por pantalla |
| `conductorRepository.list()` | `ConductoresPage`, `HojaDeRutaPage`, `useConductoresDashboard` (dashboard) | 1 por cada visita a cada una de las 3 pantallas |

**La causa raíz es estructural, no un descuido puntual.** Los repositories se inyectan como
singletons de módulo vía Context, pero **cada hook consumidor mantiene su propio estado local de
fetch**. Los ~21 hooks que leen datos son, línea por línea, el mismo `useState` + `useEffect` +
`repository.list()` parametrizado por tipo. Como react-router desmonta la ruta al navegar, el efecto
de cada hook se vuelve a disparar desde cero en cada visita. **No hay ninguna capa que recuerde nada
entre montajes.**

Eso produce tres desperdicios distintos, que se arreglan con el mismo mecanismo:

1. **Duplicación intra-pantalla**: `ConductoresList` y `AsignacionSemanalTabla` son hermanos dentro
   de `ConductoresPage` y **cada uno llama `useVehiculos` por su cuenta** → dos `SELECT` idénticos y
   concurrentes contra la misma tabla, en el mismo tick de render.
2. **Re-fetch inter-pantalla**: ir a Presupuestos → Facturación → volver a Presupuestos vuelve a
   traer el padrón completo de pacientes y de obras sociales tres veces, aunque no haya cambiado
   nada. Y `/` (dashboard) es la ruta índice: se pasa por ella constantemente.
3. **Recarga total tras cada mutación**: dar de alta un registro dispara un `cargar()` que vuelve a
   traer el listado entero, aunque solo haya cambiado una fila.

**Qué NO resuelve este change (para cerrar la expectativa de entrada):** el disparador original fue
un LCP de 3,24 s medido en Chrome DevTools sobre el deploy de Vercel. **Una capa de caché no mejora
el LCP de carga fría** — en la primera visita el dato no está cacheado por definición.

El LCP tiene otra causa, medida el 2026-08-29 sobre `frontend/dist/`: **el bundle principal pesa
1,4 MB** (`index-*.js`) porque **solo una ruta usa `lazy`** (`CuentasRoute`, y por un motivo de
tests, no de performance). `pdfjs-dist`, `jszip` y Google Maps viajan en el critical path aunque la
pantalla inicial no los use. Eso se ataca en el change **`code-splitting-rutas`**, no acá.

Governance: **MEDIA-ALTA**. No toca auth, dinero ni auditoría, pero modifica la capa de obtención de
datos de la que dependen los selectores de Facturación y Presupuestos. Requiere revisión humana del
enfoque y checkpoint explícito al cierre de la Fase 2.

## What Changes

### 1. Checkpoint D1 — RESUELTO: se adopta `@tanstack/react-query` v5

La versión anterior de este change recomendaba un primitivo propio (`useListaCacheada`, ~120 líneas)
y documentaba un **gatillo de migración**: si aparecía *"(e) más de ~8 dominios cacheados"*, TanStack
Query pasaba a estar justificada.

**Ese gatillo se disparó al ampliar el alcance a toda la aplicación** (~11 dominios, ~21 hooks). La
decisión queda invertida de forma consciente y documentada, no por inercia.

Además, el argumento principal en contra perdió su base fáctica: D1 objetaba **~13 KB gzip en el
critical path**. Medido el 2026-08-29, ese critical path ya pesa **1,4 MB**. El costo relativo es
inferior al 1 %, y el problema real de bundle se resuelve en un change aparte.

Ver `design.md` §D1 para el registro completo con la tabla comparativa original.

### 2. Alcance: toda la capa de lectura de datos del frontend

Los ~21 hooks que hoy hacen `useState` + `useEffect` + `repository.*` pasan a `useQuery` /
`useMutation`. **Ningún hook conserva estado de fetch propio.**

### 3. Frescura escalonada por clase de dato — el punto que evita el bug caro

"Toda la app usa React Query" **NO** significa "todo se cachea por igual". `staleTime` se define por
dominio:

| Clase de dato | Dominios | `staleTime` | Por qué |
|---|---|---|---|
| Referencia | pacientes, vehículos, conductores, obras sociales (vía `list()`) | **1 min** | Casi estáticos dentro de una sesión |
| Transaccional | facturas, cobros, presupuestos, autorizaciones, hojas de ruta | **0** | Es dinero y agenda: la frescura es requisito funcional |
| Paginado / filtrado | todo `listPage()` | **0** | El resultado depende de página y filtro vigentes |
| Sensible | cuentas, permisos | **0** | Seguridad |

Con `staleTime: 0` se conservan igual la **deduplicación de peticiones concurrentes** y la
**invalidación automática por mutación**. Lo que no se hace es servir un cobro viejo desde memoria.
Este escalonamiento preserva íntegro el criterio de la versión anterior del change, que excluía los
datos transaccionales de la caché.

### 4. Los hooks se reescriben por dentro, y su API pública NO cambia

Cada hook conserva **byte a byte la forma de su resultado** (`{ datos, loading, error, recargar,
crear, actualizar }`). Consecuencia deliberada: **ninguna pantalla cambia una línea**, y ningún
`*Page.tsx`, `*List.tsx`, `*Form.tsx`, `*Route.tsx`, `*RepositoryContext.tsx` ni interfaz de
repository se toca.

### 5. Invalidación en mutación — el punto delicado

Toda mutación invalida la `queryKey` de su dominio vía `queryClient.invalidateQueries`.

**⚠️ Riesgo #1 (heredado, sigue siendo el riesgo principal):** las pantallas migradas a paginación
mutan por **otro** camino (`usePacientesPaginado.crear/actualizar`, que recarga solo su página vía
`listPage`). Si ese camino no invalida también la clave del padrón completo, un alta hecha desde la
pantalla de Pacientes **no aparecería** en los selectores de Presupuestos/Facturación hasta que venza
el `staleTime`. Ese cableado es parte del alcance y tiene test propio.

### 6. Aislamiento de tests (no negociable)

El `QueryClient` es estado compartido: sin aislamiento, un test contamina al siguiente y las suites
empiezan a depender del orden. **Cada test recibe un `QueryClient` nuevo**, con `retry: false` y
`gcTime: 0`. Sin `retry: false`, los tests de error cuelgan esperando reintentos.

### 7. Lo que este change NO hace

- **NO** mejora el LCP de carga fría (ver §Why) → change `code-splitting-rutas`.
- **NO** cambia qué columnas pide `list()` (sigue trayendo `SELECT_*_COMPLETO` con sus embeds para
  poblar combos) → change `select-liviano-selectores`.
- **NO** toca repositories, interfaces de repository, Edge Functions, RLS, migraciones SQL ni el
  design system.
- **NO** cambia ninguna prop de componente ni ninguna pantalla.
- **NO** agrega persistencia en `localStorage`/`sessionStorage`/IndexedDB: la caché vive en memoria y
  muere con la pestaña. Cachear datos de salud en disco del cliente es una decisión de privacidad
  aparte, y este change la evita a propósito.
- **NO** agrega refetch-on-window-focus (se desactiva explícitamente).
- **NO** instala React Query Devtools en el bundle de producción.

## Capabilities

### New Capabilities

- `cache-datos-cliente`: contrato de la capa de caché de datos del cliente — qué lecturas entran y
  con qué política de frescura según su clase (referencia / transaccional / paginada / sensible),
  deduplicación de peticiones concurrentes, revalidación en segundo plano sin parpadeo, invalidación
  obligatoria en toda mutación del dominio (incluidas las que entran por el camino paginado),
  preservación del dato cacheado ante error de refresco, prohibición de persistencia en disco, y
  aislamiento obligatorio del estado entre tests.

### Modified Capabilities

<!-- Ninguna. Los requisitos de comportamiento de los módulos existentes no cambian: las pantallas
     siguen mostrando lo mismo, siguen reflejando altas/ediciones de inmediato y siguen reportando
     carga y error. Lo único que cambia es de dónde sale el dato. -->

## Riesgo y rollback

Sin migración de datos, sin cambios de servidor, sin cambios de API pública. Cada fase es un commit
independiente: revertir cualquiera es `git revert` de su commit. La Fase 1 (fundación) no cambia
comportamiento observable porque todavía no tiene consumidores.

## Dependencias

- **`paginacion-listados`**: archivado el 2026-08-12. El bloqueo operativo de la versión anterior
  (§D8) **queda levantado**.
- **Changes derivados de este diagnóstico, independientes entre sí:** `code-splitting-rutas`
  (arregla el LCP), `select-liviano-selectores` (arregla el payload de los combos),
  `preconnect-indices-supabase` (latencia). Ninguno bloquea a este ni es bloqueado por este.
