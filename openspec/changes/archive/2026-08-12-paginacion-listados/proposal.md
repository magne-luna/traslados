## Why

**Hoy no hay una sola consulta paginada en todo el proyecto.** Verificado sobre el código real
(2026-08-12): `grep` de `.range(` / `.limit(` / `count:` sobre `frontend/src/shared/lib/**/Supabase*.ts`
devuelve **cero coincidencias**. Los 11 repositories exponen `list(): Promise<T[]>` sin parámetros,
traen la tabla entera en cada montaje de pantalla, y las 8 pantallas de listado filtran **client-side**
con un `useMemo` sobre el array completo (`PacientesList`, `ConductoresList`, `VehiculosList`,
`ObrasSocialesList`, `CuentasList`, `PresupuestosList`, `FacturasList`, más `HojaDeRutaPage`).

Con fixtures de 5-10 filas no se nota. Con datos reales de producción acumulándose (pacientes,
recorridos diarios, presupuestos por período) el costo es lineal y ya no es hipotético: cada apertura
de pantalla transfiere la tabla completa por la red, la parsea con type guards fila por fila, y la
mantiene en memoria.

**El peor caso NO es un listado.** `HojaDeRutaPage.tsx:70-80` llama `useHojasDeRuta(...)` →
`repository.list()` → `SELECT_HOJA_DE_RUTA_CON_RECORRIDOS` (embed de **tres niveles**: hoja →
`recorrido` → `historial_recorridos`) para **todas las fechas de la historia**, más una consulta batch
de coordenadas sobre `pacientes.direcciones`… y después hace `hojasDeRuta.find((h) => h.fecha === fecha)`
para quedarse con **un** día. `HojaDeRutaRepository` ya declara `getByFecha(fecha)` y **la pantalla no lo
usa**. Esto crece con cada día operado y es la lectura más cara de la app. No se arregla paginando: se
arregla consultando por fecha.

**Además hay un obstáculo de correctitud previo a todo lo demás**: ninguna de las consultas de listado
tiene `.order()`. Paginar por offset sin un orden total y determinista devuelve filas repetidas o
salteadas entre página y página (Postgres no garantiza orden estable sin `ORDER BY`). El orden es
prerrequisito, no un extra.

Este change es transversal (toca `shared/lib`, `design-system` y 4+ features) y de gobernanza
**MEDIA** — lógica de negocio y capa de acceso a datos, sin tocar auth, facturación-dinero ni
auditoría. Se implementa **por fases con checkpoints**, nunca las 8 pantallas de un saque.

## What Changes

### 1. Hallazgo que parte el alcance en dos: hay DOS transportes, no uno

| Transporte | Dominios | ¿Paginar acá? |
|---|---|---|
| **PostgREST directo** (`supabase.from(...).select(...)`) | pacientes, obra social, conductores, hojas de ruta, cuentas (lecturas) | ✅ **Sí** — `.range()` + `count` es 100% frontend, sin deploy de backend |
| **Edge Function** (`supabase.functions.invoke`) | **vehículos**, presupuestos, autorizaciones | ⛔ **No en este change** — requiere editar y **redesplegar** `supabase/functions/{vehiculos,presupuestos,autorizaciones}/index.ts` (verificado: ninguna acepta `limit`/`offset`/`page`). El deploy lo hace la usuaria/Enzo, no el agente |
| **Mock en `localStorage`** | **facturas**, **cobros**, documentos | ⛔ **No** — `FacturacionRoute.tsx` sigue inyectando `mockFacturaRepository`; el swap real es el change `integracion-facturacion`, **bloqueado en su portón de governance §C-07**. Paginar un array de `localStorage` no resuelve ningún problema real |

Esto contradice la intuición de "paginar los 8 listados de una": **vehículos y presupuestos, que
parecían candidatos obvios, quedan fuera** por dependencia de backend, y **facturación queda fuera**
por dependencia de un change bloqueado.

### 2. Contrato de paginación aditivo — `list()` NO se toca

Se agrega `listPage(query)` a los repositories de la fase 1; **`list()` sobrevive intacto**. No es
conservadurismo: `list()` tiene hoy **dos clases de consumidores con necesidades opuestas**, verificado
uno por uno:

- **Listados** (paginables): `usePacientes`, `useConductores`, `useObrasSociales`, …
- **Selectores y agregaciones que necesitan TODAS las filas**: `PresupuestosPage` recibe
  `pacienteRepository` para poblar el combo de pacientes (`PresupuestosRoute.tsx:27`),
  `FacturaForm`/`PacienteForm` idem, y el dashboard (`useAlertasCud`, `useAlertasMantenimiento`,
  `useDatosFinancieros`, `useConductoresDashboard`) agrega sobre el universo completo.

Cambiarle la firma a `list()` rompería silenciosamente los combos (mostrarían solo la primera página)
y falsearía las alertas del dashboard. Tipos nuevos en `frontend/src/shared/types/paginacion.ts`:
`Pagina<T>` (`items`, `total`, `pagina`, `tamanio`) y `RangoPagina`, strict, sin `any`.

### 3. Paginación **server-side** por offset (`.range()` + `count: 'exact'`)

Paginar client-side sobre un array ya traído entero no arregla nada — el costo (transferencia + parseo)
ya se pagó. Va server-side o no va.

**Offset/limit sobre keyset (cursor)**, decidido y justificado en `design.md` D2: son listados CRUD
administrativos donde la usuaria espera "página 3 de 12" y saltar a la última; keyset prohíbe el salto
directo y se complica con orden multi-columna. A escala de miles de filas con `ORDER BY` indexado,
offset es correcto. Se documenta el umbral a partir del cual conviene revisar.

### 4. La búsqueda se muda al servidor junto con la página (no es opcional)

Paginar el resultado de un filtro client-side está **roto por construcción**: la página 1 de una
consulta sin filtrar no contiene los resultados del filtro. Cada `useMemo` de filtrado se muda a la
query.

**⚠️ CHECKPOINT — cambio de semántica en la búsqueda de Pacientes.** El filtro actual
(`PacientesList.tsx:48-54`) hace `nombreCompleto(paciente).toLowerCase().includes(termino)` sobre la
**concatenación de 4 columnas** (`nombre_a`, `nombre_b`, `apellido_a`, `apellido_b`). Ningún `ilike`
por columna reproduce eso: buscar `"juan pérez"` no matchea porque el término cruza dos columnas. La
propuesta (D5) es tokenizar el término y exigir que **cada token** matchee **alguna** columna, sin
tocar el schema. Es un cambio de comportamiento observable y **requiere confirmación explícita de la
usuaria antes del apply**.

### 5. Primitivo compartido, medido — no 8 copias

8 pantallas repiten el mismo patrón (`useState('')` + `useMemo` filtrado + `SearchInput`). Se construye
**una vez**: `usePaginaListado` (estado de página, reset al cambiar filtro, debounce ~300ms) en
`shared/lib/paginacion/`, y `<Paginador>` en `design-system/`. El debounce es **comportamiento nuevo**:
sin él, búsqueda server-side = un request por tecla.

`design-system/table.tsx` no se toca — su propia cabecera declara que son primitivos de **estilo**, no
una data-table configurable, y 6 de los 8 listados son grillas de tarjetas que ni siquiera usan `Table`.

### 6. Hojas de Ruta: se arregla, pero NO paginando

`HojaDeRutaPage` pasa a `getByFecha(fecha)` — método que **ya existe** en la interfaz y en
`SupabaseHojaDeRutaRepository`. Sin `listPage`, sin `<Paginador>`, sin cambio de UI. Es la mayor
reducción de payload del change y la más barata.

### 7. Lo que este change NO hace

- **NO pagina** vehículos, presupuestos, autorizaciones (Edge Function), ni facturas/cobros (mock).
- **NO toca ninguna Edge Function** ni agrega migraciones SQL. Cero deploy de backend.
- **NO pagina `ParadasList`** — las paradas de un recorrido están acotadas por la capacidad del
  vehículo (≤6, RN-VE-01). Paginar 6 filas es ruido.
- **NO pagina los selectores/combos.** Cuando pacientes crezca lo suficiente, la respuesta correcta es
  *typeahead* con búsqueda server-side, no paginación — se deja anotado, no se implementa.
- **NO toca el dashboard.** Sus agregaciones necesitan el universo completo; si escalan mal, la
  respuesta es un agregado SQL/vista, no paginación.
- **NO introduce TanStack Query** ni ninguna librería nueva. Cero dependencias.
- **NO agrega scroll infinito ni virtualización.**
- **NO persiste la página en la URL** (ver `design.md` §Preguntas abiertas).

## Capabilities

### New Capabilities

- `listado-paginado-contract`: contrato transversal de paginación — tipos `Pagina<T>`/`RangoPagina`,
  helper puro `rangoSupabase()`, convención `listPage(query)` **aditiva** que convive con `list()`,
  obligación de orden total determinista (`ORDER BY` + desempate por `id`) en toda consulta paginada, y
  `count: 'exact'` en la misma consulta.
- `listado-paginado-ui`: hook `usePaginaListado` (página, tamaño, término debounceado, reset de página
  al cambiar el filtro, estados de carga/vacío/error) y componente `<Paginador>` del design-system
  (anterior/siguiente, "página N de M", total de resultados, accesible por teclado y sin depender del
  color como único canal).

### Modified Capabilities

- `paciente-ficha`: el requisito "Listado de pacientes" pasa de `list()` completo + filtro client-side
  a `listPage()` server-side con búsqueda por nombre/DNI en la query; se agrega el requisito de orden
  determinista y el estado "sin resultados en esta página".
- `conductor-crud`: el listado de conductores pasa a `listPage()` con búsqueda server-side.
- `obra-social-crud`: el listado de obras sociales pasa a `listPage()` con búsqueda server-side.
- `hoja-de-ruta-armado`: el armado del día pasa a resolverse con `getByFecha(fecha)` en vez de traer
  todas las hojas de ruta con sus recorridos y paradas y filtrar en memoria.

## Impact

**Código nuevo**
- `frontend/src/shared/types/paginacion.ts` — `Pagina<T>`, `RangoPagina`.
- `frontend/src/shared/lib/paginacion/rangoSupabase.ts` + `.test.ts` — función pura `pagina/tamanio → {desde, hasta}`.
- `frontend/src/shared/lib/paginacion/usePaginaListado.ts` + `.test.ts`.
- `frontend/src/design-system/paginador.tsx` + `.test.tsx`.

**Código modificado (fase por fase, nunca todo junto)**
- `PacienteRepository.ts` / `SupabasePacienteRepository.ts` / `mockPacienteRepository.ts` (+ tests) — `listPage`.
- `ConductorRepository.ts` / `ObraSocialRepository.ts` y sus implementaciones — `listPage`.
- `usePacientes.ts`, `useConductores.ts`, `useObrasSociales.ts` — variante paginada.
- `PacientesList.tsx`, `ConductoresList.tsx`, `ObrasSocialesList.tsx` — el `useMemo` de filtrado se retira.
- `HojaDeRutaPage.tsx` — `getByFecha` en lugar de `list()` + `find`.
- `DesignSystem.tsx` — el catálogo vivo suma `<Paginador>` (regla dura del proyecto).

**Sin impacto (explícito)**
- `design-system/table.tsx`, `SearchInput`, `Card`, y el resto del design system.
- `VehiculoRepository`, `PresupuestoRepository`, `AutorizacionRepository`, `FacturaRepository`,
  `CobroRepository`, `DocumentoRepository`, `CuentaRepository` — **ninguna firma cambia**.
- Todos los composition roots (`*Route.tsx`) salvo lo estrictamente necesario.
- El dashboard entero, `ParadasList`, y todos los combos/selectores.
- Cero migraciones SQL, cero Edge Functions, cero RLS, cero dependencias nuevas.

**Dependencias**
- Requiere (ya cumplido): `integracion-pacientes` ✅, `integracion-obra-social` ✅ y
  `SupabaseConductorRepository` sobre PostgREST directo ✅.
- **Bloquea a / bloqueado por**: la paginación de vehículos/presupuestos/autorizaciones depende de un
  change de Edge Functions (no propuesto). La de facturación depende de `integracion-facturacion`
  (bloqueado en governance §C-07).
- No bloquea ni depende de `hojas-de-ruta-geocoding` ni de `integracion-hojas-de-ruta` (en progreso):
  el cambio a `getByFecha` es en la pantalla, no en el repository.

**Riesgo y rollback**
- Riesgo #1 (**alto, correctitud**): offset sin orden total → filas repetidas/salteadas entre páginas.
  Mitigado haciendo del `ORDER BY` con desempate por `id` un requisito del contrato, con test propio.
- Riesgo #2 (**⚠️ checkpoint, requiere OK de la usuaria**): la búsqueda de pacientes cambia de semántica
  (concatenación en memoria → tokens vs. columnas). Puede dejar de encontrar lo que hoy encuentra.
- Riesgo #3: `count: 'exact'` es un segundo escaneo por consulta. A esta escala es correcto y da un
  total real; si molesta, se degrada a `'planned'` y el `<Paginador>` deja de prometer "de M".
- Riesgo #4: sin debounce, un request por tecla. Mitigado en el hook compartido, con test.
- Riesgo #5: romper un combo por confundir `list()` con `listPage()`. Mitigado porque `list()` no se
  toca y por un test que verifica que los selectores siguen recibiendo el universo completo.
- **Rollback**: cada fase es un commit independiente y reversible. `listPage()` es **aditivo** — revertir
  una fase es volver el hook y la pantalla a `list()`; el método nuevo queda sin llamador e inerte.
  Ningún dato se transforma, ninguna migración se aplica, nada que revertir del lado del servidor.
</content>
</invoke>
