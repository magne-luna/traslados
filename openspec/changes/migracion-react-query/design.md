## Context

El frontend tiene ~21 hooks de lectura de datos que replican, línea por línea, el mismo patrón:
`useState` + `useEffect` + `repository.*()`, con `loading`/`error` locales y un `cargar()` imperativo
que se reutiliza tras cada mutación. Como react-router desmonta la ruta al navegar, ese estado muere
en cada transición y el dato se vuelve a pedir desde cero.

Los repositories ya aíslan todo el I/O de Supabase detrás de interfaces de dominio
(`ConductorRepository`, `PacienteRepository`, …) inyectadas por Context. **Esa es la razón por la que
esta migración es barata: solo se reemplaza la capa de estado, no la de I/O.**

Medición del 2026-08-29 sobre el código real: 21 hooks con fetch, ~1.500 líneas de hooks,
24 archivos de test con `renderHook`, 12 con `renderConSesion`, 114 con `render` pelado.

## Goals / Non-Goals

**Goals:**

- Una **única** capa de obtención de datos para toda la app, en vez de 21 implementaciones del mismo
  patrón.
- Que la migración sea **invisible** para pantallas y componentes: la forma del resultado de cada
  hook no cambia, así que ningún `*Page.tsx`, `*List.tsx`, `*Form.tsx`, `*Route.tsx` ni
  `*RepositoryContext.tsx` se toca.
- Frescura **diferenciada por clase de dato**: agresiva en listas de referencia, nula en datos
  transaccionales.
- Determinismo en tests: estado aislado por test, conteos de llamadas predecibles.
- Corrección bajo React 19 concurrente.

**Non-Goals:**

- No se optimiza el LCP de carga fría (change `code-splitting-rutas`).
- No se cambia qué columnas trae cada consulta (change `select-liviano-selectores`).
- No hay persistencia en disco, ni sincronización entre pestañas, ni modo offline.
- No hay actualizaciones optimistas en esta iteración (la puerta queda abierta, ver D5).

## Decisions

### D1 — Adoptar `@tanstack/react-query` v5 ✅ CHECKPOINT RESUELTO (2026-08-29)

**Decisión: se instala `@tanstack/react-query` v5. La usuaria resolvió el checkpoint a favor de la
librería y amplió el alcance a toda la aplicación.**

Esto **invierte** la recomendación original de este change (primitivo propio `useListaCacheada`). El
registro de por qué se invirtió importa tanto como la decisión:

**Motivo 1 — el gatillo documentado se disparó.** La versión original de D1 no decía "nunca", decía
"todavía no", y listaba gatillos explícitos de migración: (a) cachear resultados paginados/filtrados,
(b) updates optimistas, (c) scroll infinito, (d) offline/persistencia, **(e) más de ~8 dominios
cacheados**, (f) sync entre pestañas. Al ampliar el alcance de 4 listas a toda la app (~11 dominios,
~21 hooks), **(e) se cumple**. La decisión sigue la regla que el propio design escribió.

**Motivo 2 — el argumento principal en contra perdió su base fáctica.** D1 objetaba ~13 KB gzip en el
critical path, porque la consulta nació de un LCP de 3,24 s. Medición del 2026-08-29 sobre
`frontend/dist/assets/`:

```
index-*.js           1,4 MB    ← todas las rutas + pdfjs-dist + jszip + Google Maps
pdf.worker.min.mjs   1,2 MB
CuentasRoute.js       15 KB    ← única ruta con `lazy`, y por un motivo de tests
```

13 KB sobre 1,4 MB es menos del 1 %. El LCP no se arregla evitando dependencias chicas: se arregla
partiendo el bundle, que es otro change. **El costo que D1 temía es real pero irrelevante en
magnitud.**

**Motivo 3 — a 21 hooks, escribir el primitivo deja de ser barato.** 120 líneas propias para 4 claves
fijas era defendible. Para 11 dominios con paginación, filtros y mutaciones cruzadas, habría que
implementar a mano `queryKey` compuestas, `staleTime` por clave, `keepPreviousData` y un registro de
invalidación — es decir, reescribir React Query peor.

**Tabla comparativa original, conservada para el registro:**

| Criterio | `@tanstack/react-query` | Primitivo propio |
|---|---|---|
| Resuelve el problema | ✅ De sobra | ✅ Para 4 claves; insuficiente a 11 dominios |
| Peso en el bundle | ~13 KB gzip | ~1 KB |
| Efecto sobre el LCP | <1 % del critical path actual | Neutro |
| Provider obligatorio | Sí, en `App.tsx` y en los tests que monten estos hooks | No |
| Superficie propia a mantener | ~10 líneas de wiring | ~120 líneas + tests, y creciendo con el alcance |
| Riesgo de concurrencia mal implementada | Nulo | Real |
| Precedente del proyecto | Contradice `paginacion-listados` §7 | Lo respeta |

**Sobre el precedente de `paginacion-listados` §7 ("cero dependencias nuevas"):** se revierte de forma
consciente y acotada a este caso. Aquella regla se escribió para un change de alcance local; esta es
una decisión de arquitectura transversal, tomada con la evidencia de bundle a la vista.

**Contrapartida aceptada:** una dependencia externa más en el critical path, y la obligación de
envolver en un provider los tests que monten componentes con hooks migrados (ver D7, donde se acota
el costo real).

### D2 — Un `QueryClient` por aplicación, creado por factory

**Decisión:** `frontend/src/app/queryClient.ts` exporta `crearQueryClient()` (factory) y una
instancia singleton para producción. `QueryClientProvider` se monta en `App.tsx` **por encima** de
`AuthProvider`.

Defaults explícitos, ninguno implícito:

```ts
{
  queries: {
    staleTime: 0,                  // conservador por defecto; se sube por query (D3)
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,   // decisión heredada del change original
    refetchOnReconnect: false,
    retry: 1,
  },
  mutations: { retry: 0 },
}
```

**Por qué `staleTime: 0` como default y no 5 minutos:** el default seguro es el que no miente. Un
dominio que se olvide de declarar su frescura se comporta como hoy (consulta siempre) en vez de
servir datos viejos en silencio. **La cacheabilidad se opta explícitamente, nunca por omisión.** Es
la misma lógica por la que el change original excluía los datos transaccionales.

**Por qué factory y no solo singleton:** los tests necesitan una instancia nueva por test (D7). Un
singleton importado desde los tests filtra caché entre ellos.

**Por encima de `AuthProvider` y no debajo:** el cierre de sesión debe poder llamar
`queryClient.clear()`; si el cliente viviera dentro del árbol de auth, se desmontaría junto con él.

### D3 — Frescura escalonada por clase de dato

**Decisión:** `frontend/src/shared/lib/query/frescura.ts` exporta las constantes, en un solo lugar.

```ts
export const FRESCURA = {
  referencia: 5 * 60 * 1000,  // padrones casi estáticos
  transaccional: 0,           // dinero y agenda
  paginado: 0,                // depende de página y filtro
  sensible: 0,                // cuentas y permisos
} as const;
```

| Clase | Dominios | `staleTime` | Comportamiento observable |
|---|---|---|---|
| Referencia | pacientes, vehículos, conductores, obras sociales (`list()`) | 5 min | Navegar y volver dentro del plazo: **0 requests** |
| Transaccional | facturas, cobros, presupuestos, autorizaciones, hojas de ruta | 0 | Consulta en cada montaje, **igual que hoy** |
| Paginado | todo `listPage()` | 0 | Consulta en cada cambio de página o filtro |
| Sensible | cuentas, permisos | 0 | Consulta en cada montaje |

**`staleTime: 0` no significa "sin React Query".** Esos dominios siguen ganando:
deduplicación de peticiones concurrentes en el mismo tick, invalidación automática por mutación, y
un único camino de manejo de error. Lo que no ganan —a propósito— es servir dato viejo desde memoria.

**Revalidación en segundo plano sin parpadeo:** con `staleTime` vencido y dato en caché, React Query
devuelve el dato inmediatamente con `isPending: false` e `isFetching: true`, y refetchea en
background. Eso satisface el requisito de "sin parpadeo" del spec sin código propio.

**Paginación:** `usePaginaListado` usa `placeholderData: keepPreviousData` para no vaciar la tabla
al cambiar de página. Es el reemplazo directo de su manejo manual actual.

### D4 — `queryKey` centralizadas y tipadas, nunca literales sueltos

**Decisión:** `frontend/src/shared/lib/query/claves.ts` es el único lugar donde se construyen claves.

```ts
export const claves = {
  pacientes: {
    todos: () => ['pacientes'] as const,
    lista: () => ['pacientes', 'lista'] as const,
    pagina: (q: RangoPagina & { filtros: FiltrosPaciente }) => ['pacientes', 'pagina', q] as const,
  },
  // … un bloque por dominio
} as const;
```

**Por qué centralizarlas es el punto crítico de todo el change:** una clave mal escrita en una
invalidación **no falla** — simplemente no invalida nada, y el bug aparece como un dato viejo en un
selector, semanas después. Con un solo módulo tipado, `invalidateQueries({ queryKey:
claves.pacientes.todos() })` alcanza a `lista` y a todas las `pagina` por prefijo, y el compilador
atrapa los errores de tipeo.

**Jerarquía deliberada:** `[dominio]` → `[dominio, 'lista']` → `[dominio, 'pagina', query]`. Invalidar
el nivel `[dominio]` arrastra todo lo de abajo, que es exactamente lo que necesita una mutación.

### D5 — La invalidación vive en los hooks, no en un decorador de repository

**Decisión:** cada mutación usa `useMutation` con `onSuccess: () => queryClient.invalidateQueries(...)`.
Los repositories quedan intactos.

Razones:

- **Los repositories no deben saber que existe una caché.** Son la capa de I/O; meterles conocimiento
  de invalidación los acopla a React y rompe su testeabilidad actual sin DOM.
- **La granularidad correcta vive en el hook**, que sí sabe si una mutación afecta a un dominio o a
  varios (crear una autorización toca presupuestos *y* autorizaciones).
- Un decorador sobre el repository obligaría a envolver las instancias en los `*Route.tsx`, es decir,
  a tocar los composition roots — justo lo que el change promete no tocar.

**Puerta abierta:** las actualizaciones optimistas (`onMutate` + rollback en `onError`) encajan en
este mismo punto sin rediseño. Quedan fuera de alcance en esta iteración, no fuera del diseño.

### D6 — Los hooks conservan su API pública: adaptador, no reescritura de consumidores

**Decisión:** cada hook migrado devuelve exactamente la misma forma que hoy.

```ts
// El cuerpo cambia por completo; la firma no.
export function useConductores(repository: ConductorRepository): UseConductoresResult {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: claves.conductores.lista(),
    queryFn: () => repository.list(),
    staleTime: FRESCURA.referencia,
  });
  // … useMutation para crear/actualizar, con invalidación
  return { conductores: data ?? [], loading: isPending, error: aMensaje(error), recargar, crear, actualizar };
}
```

Tres traducciones que hay que hacer bien, y cada una tiene test:

1. **`error: Error | null` → `error: string | null`.** Los hooks exponen string; se centraliza en un
   único `aMensaje(err)` compartido, con el mismo texto castellano que hoy produce `toErrorMessage`.
2. **`data: T[] | undefined` → `T[]`.** Los consumidores nunca ven `undefined`; se normaliza a `[]`.
3. **`isPending` vs `isLoading` vs `isFetching`.** El `loading` actual significa "no hay dato para
   mostrar" → mapea a **`isPending`**. Usar `isFetching` provocaría el parpadeo que el spec prohíbe,
   porque también es `true` durante una revalidación en background.

**Los hooks siguen recibiendo el repository por parámetro/Context.** React Query no reemplaza la
inyección de dependencias: el `queryFn` cierra sobre el repository inyectado, y los tests siguen
pasando mocks igual que hoy.

### D7 — Infraestructura de tests: un `QueryClient` nuevo por test

**Decisión:** el aislamiento se resuelve en dos helpers compartidos, no test por test.

```ts
// shared/test/queryWrapper.tsx
export function crearQueryClientDeTest(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}
```

- **`renderConSesion` incorpora el provider** → los 12 archivos que ya lo usan quedan cubiertos sin
  editarlos.
- **`renderHookConQuery`** cubre los 24 archivos de test de hooks.
- **Los archivos con `render` pelado** (114 en total) solo necesitan el provider **si montan
  componentes que usan hooks migrados**. El subconjunto exacto se mide en la tarea 0.6, no se estima.

**Las tres trampas conocidas, todas prevenidas acá:**

1. **`QueryClient` compartido entre tests** ⇒ polución de caché ⇒ fallos según orden de ejecución. El
   peor tipo de fallo. → Instancia nueva por test, siempre.
2. **Sin `retry: false`** ⇒ los tests de error esperan reintentos y **cuelgan** hasta el timeout.
3. **`gcTime` por defecto** ⇒ datos sobreviviendo al desmontaje dentro del mismo test.

**Nota sobre estabilidad referencial:** React Query hace *structural sharing* por defecto, así que
devuelve la misma referencia cuando el dato no cambió. El riesgo R6 de la versión anterior
(`getSnapshot` inestable ⇒ bucle infinito de render) **desaparece** con la librería.

### D8 — Orden de fases y coexistencia ✅ DESBLOQUEADO

`paginacion-listados` se archivó el 2026-08-12 (`archive/2026-08-12-paginacion-listados`), así que el
bloqueo operativo de la versión anterior de este change ya no aplica.

**Decisión:** migración incremental por dominio, no big bang. React Query convive sin problema con
hooks de `useState` sin migrar: un hook migrado y uno sin migrar pueden coexistir en la misma
pantalla durante todo el proceso.

**Consecuencia asumida y comunicada:** durante las fases 2 a 5 el árbol queda **a medio migrar**, con
los dos patrones conviviendo. Compila y los tests pasan en cada commit, pero conviene rama propia y
un commit por fase para que el estado intermedio sea legible y reversible.

**Orden por riesgo creciente:** referencia (mayor beneficio, menor riesgo) → paginado (Riesgo #1) →
transaccional (mayor sensibilidad) → dashboard.

### D9 — TDD estricto, y el safety net antes de cada dominio

Regla dura del proyecto (`openspec/config.yaml`: `strict_tdd: true`). Orden por dominio:

1. **Safety net:** correr los tests del dominio y anotar la línea base en verde. Un fallo previo se
   reporta como preexistente, **no se arregla dentro de este change**.
2. **RED:** el test que expresa el comportamiento nuevo — típicamente "dos montajes sucesivos ⇒ una
   sola llamada al repository".
3. **GREEN:** reescribir el cuerpo del hook.
4. **TRIANGULACIÓN:** invalidación por mutación, dedup entre hermanos, ausencia de parpadeo.
5. **REFACTOR:** con tests en verde después de cada paso.

**El criterio de éxito de cada dominio es que sus tests de componente pasen SIN editarlos.** Si un
`*Page.test.tsx` necesita cambios (más allá del provider), es señal de que la API pública del hook
cambió y hay que corregir el hook, no el test.

## Risks / Trade-offs

- **R1 — Un camino de mutación sin invalidar deja un selector desactualizado, en silencio (ALTO).**
  Es el riesgo principal, heredado de la versión anterior: no rompe nada, no tira error, solo muestra
  datos viejos en pantallas sensibles (Facturación, Presupuestos). → **Mitigación:** (a) claves
  centralizadas y tipadas (D4), que hacen que invalidar el prefijo del dominio alcance todo lo de
  abajo; (b) requisito de spec con escenario explícito para el camino paginado; (c) test dedicado
  sobre `usePacientesPaginado.crear/actualizar`; (d) el `staleTime` acota cualquier fuga a 5 minutos
  en los dominios de referencia, y a **cero** en el resto.

- **R2 — Cachear un dato transaccional por error (ALTO).** Poner `staleTime` de referencia sobre
  facturas o cobros haría que la usuaria vea plata desactualizada. → **Mitigación:** el default global
  es `staleTime: 0` (D2); la cacheabilidad se opta explícitamente por dominio. Un olvido produce el
  comportamiento actual, nunca uno peor.

- **R3 — Estado global filtrándose entre tests (MEDIO).** Con 284 archivos de test, un test que
  hereda caché ajena produce fallos intermitentes dependientes del orden. → **Mitigación:**
  `QueryClient` nuevo por test desde la Fase 1 (D7), con un test que demuestra la fuga si se comparte
  la instancia.

- **R4 — Regresión de frescura frente a otra usuaria (MEDIO, aceptada).** En los cuatro dominios de
  referencia, un alta hecha por **otra** persona puede tardar hasta 5 minutos en verse. →
  **Mitigación:** plazo corto y configurable en un solo lugar; `recargar()` como escape manual; toda
  mutación **propia** se ve al instante por invalidación. Los datos transaccionales no tienen esta
  regresión porque su `staleTime` es 0. Es un intercambio consciente y está en el spec.

- **R5 — Los tests con `render` pelado necesitan provider (MEDIO, de esfuerzo).** El número exacto se
  mide en 0.6. → **Mitigación:** `renderConSesion` absorbe 12 archivos sin tocarlos; el resto recibe
  un wrapper de una línea. Es trabajo mecánico, no de diseño.

- **R6 — Una dependencia externa más en el critical path (BAJO).** ~13 KB gzip. → **Mitigación:**
  menos del 1 % del bundle actual, y el change `code-splitting-rutas` lo compensa con creces.

- **Trade-off asumido:** este change **no** mejora el LCP de carga fría. Si esa sigue siendo la
  preocupación, el trabajo que corresponde es `code-splitting-rutas`, y es más barato que este.

## Migration Plan

Cinco fases, cada una uno o más commits independientes y reversibles. Después de cada fase:
`npx tsc -b --noEmit` y `npx vitest run` dentro de `frontend/`, ambos en verde.

1. **Fase 1 — Fundación** (código nuevo, cero consumidores, cero cambio de comportamiento):
   instalación, `queryClient.ts`, `claves.ts`, `frescura.ts`, `aMensaje.ts`, provider en `App.tsx`,
   helpers de test.
2. **Fase 2 — Piloto de punta a punta: `obrasSociales`.** El más estático, pedido por 4 pantallas,
   con el hook más simple. Valida el diseño completo. **Checkpoint de revisión humana acá.**
3. **Fase 3 — Resto de dominios de referencia:** `vehiculos` (incluye el dedup entre hermanos de
   `ConductoresPage`), `conductores`, `pacientes`, y el cableado de invalidación en los tres hooks
   paginados (**R1**).
4. **Fase 4 — Dominios transaccionales** con `staleTime: 0`: facturas, cobros, presupuestos,
   autorizaciones, hojas de ruta, recorridos habituales, cuentas, documentos.
5. **Fase 5 — Dashboard** (5 hooks) y verificación final de la reducción de requests.

**Rollback:** sin migración de datos, sin cambios de servidor, sin cambios de API pública. Revertir
cualquier fase es `git revert` de su commit.

## Open Questions

Ninguna bloquea el apply. Todas son ajustes de constante o trabajo posterior:

1. **¿5 minutos es el plazo correcto para los dominios de referencia?** Es una constante en un solo
   lugar; se ajusta con evidencia de uso real.
2. **¿Conviene React Query Devtools en desarrollo?** Ayuda mucho a depurar invalidaciones. Se puede
   agregar tras la Fase 2, importado dinámicamente y solo en `import.meta.env.DEV`, sin tocar el
   bundle de producción.
3. **¿Actualizaciones optimistas en formularios?** El diseño las admite (D5) sin rediseño. Se evalúa
   cuando haya evidencia de que la espera molesta.
