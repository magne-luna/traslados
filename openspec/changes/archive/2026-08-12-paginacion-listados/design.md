## Contexto

Change transversal de gobernanza **MEDIA** (lógica de negocio + capa de acceso a datos; no toca auth,
ni el dinero de facturación, ni auditoría). Se implementa por fases con checkpoints; las decisiones no
obvias se listan abajo y las que cambian comportamiento observable están marcadas **⚠️ CHECKPOINT** y
requieren OK explícito antes del apply.

### Estado verificado del código (2026-08-12)

| Hecho | Evidencia |
|---|---|
| Cero paginación en todo el repo | `grep -E '\.range\(\|\.limit\(\|count:'` sobre `shared/lib/**/Supabase*.ts` → 0 matches |
| Cero orden determinista en los listados | Único `.order()` en listados: `SupabaseHojaDeRutaRepository.ts:129` (`fecha` asc). `SELECT_PACIENTE_COMPLETO` no ordena |
| 8 listados con el mismo patrón client-side | `useState('')` + `useMemo(filter)` + `SearchInput` en Pacientes, Conductores, Vehículos, ObrasSociales, Cuentas, Presupuestos; Facturas con 3 filtros (paciente/mes/año) |
| `list()` tiene consumidores que necesitan TODO | `PresupuestosRoute.tsx:27` (combo de pacientes), `PacienteForm`, `FacturaForm`, `useAlertasCud`, `useAlertasMantenimiento`, `useDatosFinancieros`, `useConductoresDashboard` |
| Dos transportes distintos | PostgREST directo: pacientes, obra social, conductores, hojas de ruta, cuentas. Edge Function: **vehículos**, presupuestos, autorizaciones. Mock: facturas, cobros, documentos |
| Las Edge Functions no aceptan paginación | `grep -i 'limit\|range\|offset\|count\|searchParams'` sobre `supabase/functions/vehiculos/index.ts` → 0 matches |
| `HojaDeRutaPage` trae la historia entera para un día | `HojaDeRutaPage.tsx:70` `useHojasDeRuta(...)` → `list()`; `:80` `hojasDeRuta.find((h) => h.fecha === fecha)`. `getByFecha` existe y no se usa |

---

## D1 — Paginación **server-side**, no client-side

**Decisión.** La página se resuelve en la base. La UI nunca recibe filas que no va a mostrar.

**Por qué.** Paginar en el cliente sobre un array ya traído entero no resuelve **ningún** problema real:
la transferencia por red, el parseo fila-por-fila con type guards (`parsePacienteRow`, `ensamblarVehiculo`)
y la retención en memoria **ya se pagaron** antes de recortar. Sería cosmética.

**Descartado.** "Paginar visualmente primero y hacer server-side después" — implica escribir dos veces
la UI y deja el problema real intacto mientras tanto.

---

## D2 — Offset/limit (`.range()`), no keyset/cursor

**Decisión.** `supabase.from(...).select(cols, { count: 'exact' }).order(...).range(desde, hasta)`.

**Por qué offset.**
1. Son listados **CRUD administrativos**, no feeds. La usuaria espera "página 3 de 12", saltar a la
   última y ver un total. Keyset **no permite** salto directo a una página arbitraria ni total.
2. Keyset exige que el cursor incluya **todas** las columnas del `ORDER BY`; con orden por apellido +
   nombre + `id` el cursor se vuelve compuesto y frágil ante cualquier cambio de orden.
3. A escala de miles de filas con `ORDER BY` respaldado por índice, el costo de `OFFSET` es
   despreciable. Degrada recién en las decenas de miles con offsets profundos.

**Umbral de revisión (documentado, no implementado).** Si alguna tabla supera ~50.000 filas **y** se
observa degradación en páginas profundas, la respuesta es keyset **para esa tabla**, no para todas. El
contrato `Pagina<T>` no cambia; cambia la implementación del repository.

**`count: 'exact'`.** PostgREST devuelve el total en el mismo request (header `Content-Range`), sin
segunda ida. Cuesta un escaneo extra en el servidor. Se elige `'exact'` porque un total honesto es lo
que hace usable "página N de M". Degradación documentada: si el costo aparece, pasar a `'planned'` y el
`<Paginador>` deja de prometer el total exacto.

---

## D3 — `listPage()` es **aditivo**: `list()` no se toca

**Decisión.**

```ts
// frontend/src/shared/types/paginacion.ts
export interface RangoPagina {
  /** 1-based: la primera página es 1, nunca 0. */
  pagina: number;
  tamanio: number;
}

export interface Pagina<T> {
  items: T[];
  /** Total de filas que matchean el filtro, no las de esta página. */
  total: number;
  pagina: number;
  tamanio: number;
}
```

```ts
// PacienteRepository.ts — se AGREGA, no se reemplaza
export interface FiltrosPaciente {
  /** Término libre: matchea nombre(s), apellido(s) o DNI. Vacío = sin filtro. */
  busqueda: string;
}

export interface PacienteRepository {
  list(): Promise<Paciente[]>;                                  // ← intacto
  listPage(query: RangoPagina & { filtros: FiltrosPaciente }): Promise<Pagina<Paciente>>;
  getById(id: string): Promise<Paciente | null>;
  create(data: NuevoPaciente): Promise<Paciente>;
  update(id: string, data: ActualizacionPaciente): Promise<Paciente>;
}
```

**Por qué NO cambiar `list()`.** `list()` tiene hoy dos clases de consumidores con necesidades
**opuestas**, verificadas una por una:

| Consumidor | Necesita | Si `list()` paginara |
|---|---|---|
| `usePacientes` → `PacientesList` | una página | ✅ correcto |
| `PresupuestosPage` (combo de pacientes, `PresupuestosRoute.tsx:27`) | **todos** | ❌ el combo muestra 20 de 400 pacientes — bug silencioso, sin error |
| `PacienteForm` / `FacturaForm` (selectores) | **todos** | ❌ ídem |
| `useAlertasCud` (dashboard) | **todos** | ❌ alerta de CUD vencido calculada sobre 1/20 del padrón: **dato clínico falso** |
| `useAlertasMantenimiento`, `useDatosFinancieros`, `useConductoresDashboard` | **todos** | ❌ ídem |

El modo de falla de cambiar `list()` es el peor posible: **no rompe, miente**. Nada tira error; el
dashboard simplemente reporta menos alertas de las que hay.

**Descartado — `list(query?: RangoPagina)` con parámetro opcional.** Devolvería `T[]` y no puede
transportar el `total` (necesario para "de M"). Y un parámetro opcional invita exactamente al bug de
arriba: quien no lo pase obtiene la primera página en vez de todo, o al revés, según la implementación.
Dos métodos con nombres distintos hacen el contrato explícito en el sitio de llamada.

**Costo aceptado.** Dos caminos de lectura por repository. Se mitiga compartiendo el `SELECT` y el
mapeo (`parsePacienteRow` / `ensamblarPaciente` ya existen y no se duplican): lo único distinto entre
`list()` y `listPage()` es `.order().range()` y el `count`.

---

## D4 — Orden total determinista es **requisito**, no mejora

**Decisión.** Toda consulta paginada lleva `ORDER BY` con **desempate por `id`**:

```ts
.order('apellido_a', { ascending: true })
.order('nombre_a',   { ascending: true })
.order('id',         { ascending: true })   // desempate — obligatorio
```

**Por qué.** Postgres **no garantiza** orden estable entre queries sin `ORDER BY`, y un `ORDER BY` no
único tampoco desempata filas con la misma clave. Sin esto, offset produce filas **repetidas entre
páginas y filas que nunca aparecen**. Hoy ninguna consulta de listado ordena: es un bug que se
introduciría al paginar, no uno que ya exista.

Se cubre con un test dedicado (dos páginas consecutivas, cero `id` en común, unión == total).

**Nota para backend (no bloqueante).** El `ORDER BY` conviene respaldado por índice. No se agrega
ninguna migración en este change; si el plan de consulta degrada, es un pedido de índice a Enzo,
documentado, no una migración escrita por el agente.

---

## D5 — La búsqueda se muda al servidor junto con la página

**Decisión.** El `useMemo` de filtrado de cada pantalla desaparece; el término viaja en `filtros` y se
resuelve en la query.

**Por qué es obligatorio, no opcional.** Paginar el resultado de un filtro client-side está **roto por
construcción**: se pide la página 1 *sin filtrar* (20 filas), se filtra en memoria y quedan 2 — la
usuaria ve "2 resultados" cuando hay 50 en la tabla. No hay forma de combinar filtro-cliente con
paginación-servidor que sea correcta.

### ⚠️ CHECKPOINT 1 — la búsqueda de Pacientes cambia de semántica

`PacientesList.tsx:48-54` hoy hace:

```ts
nombreCompleto(paciente).toLowerCase().includes(termino) || paciente.dni.includes(termino)
```

`nombreCompleto()` **concatena 4 columnas** (`nombre_a`, `nombre_b`, `apellido_a`, `apellido_b`). Un
`ilike` por columna **no puede** reproducir eso: buscar `"juan pérez"` falla porque el término cruza el
límite entre dos columnas.

**Propuesta (D5a).** Tokenizar por espacios y exigir que **cada token** matchee **alguna** columna
(AND de ORs):

```
"juan perez"  →  (nombre_a|nombre_b|apellido_a|apellido_b|dni ilike %juan%)
             AND (nombre_a|nombre_b|apellido_a|apellido_b|dni ilike %perez%)
```

Encuentra a "Juan Pérez" tanto escrito `"juan perez"` como `"perez juan"` — **más flexible** que hoy en
el orden, **menos** en subcadenas que cruzan el límite entre nombre y apellido (`"anpe"` sobre
"JuanPérez" hoy matchea, después no). Sin cambios de schema.

**Alternativas descartadas.** Columna generada + índice `pg_trgm` (migración → backend → fuera del
alcance) y búsqueda full-text (`tsvector` mal ajustado a nombres propios, ídem migración).

**⚠️ Requiere OK explícito de la usuaria antes del apply.** Es comportamiento observable.

### ⚠️ CHECKPOINT 2 — acentos

`ilike` **respeta acentos**: buscar `"perez"` no matchea `"Pérez"`. Hoy `.toLowerCase().includes()`
tampoco los ignora, así que **no es una regresión** — pero si la usuaria hoy escribe con acentos y
funciona, seguirá igual, y si quisiera insensibilidad a acentos hace falta `unaccent` (extensión →
backend). Se documenta como límite conocido, no se resuelve acá.

### Búsquedas simples (sin checkpoint)

- **Conductores** (`ConductoresList.tsx:35-38`) y **Obras Sociales** (`ObrasSocialesList.tsx:29-32`):
  el filtro cruza pocas columnas y se traduce a `.or(...ilike...)` con la misma tokenización, sin
  cambio de semántica relevante.

---

## D6 — Un primitivo compartido, medido en los sitios reales

**Decisión.** Dos piezas nuevas, construidas **una vez**:

1. **`usePaginaListado`** (`shared/lib/paginacion/`) — dueño del estado: `pagina`, `tamanio`,
   `busqueda` (crudo) y `busquedaAplicada` (debounceada ~300 ms), `total`, `loading`, `error`.
   Responsabilidad no obvia: **resetear `pagina` a 1 cada vez que cambia el filtro**. Sin eso, buscar
   algo con 3 resultados estando en la página 5 muestra una pantalla vacía que parece un bug.
2. **`<Paginador>`** (`design-system/paginador.tsx`) — presentacional puro: anterior / siguiente,
   "Página N de M", total de resultados. Sin estado propio.

**Por qué compartido y no a medida.** 8 pantallas repiten hoy **el mismo** patrón
(`useState('')` + `useMemo` + `SearchInput`). Reimplementarlo 4 veces garantiza 4 variantes del bug de
reset-de-página. Y hay una regla dura del proyecto: revisar el design system y reusar antes de escribir
markup nuevo.

**Límite explícito (regla de oro del design system).** `design-system/table.tsx` **no se toca**. Su
propia cabecera declara que `Table`/`Tr`/`Th`/`Td` son primitivos de **estilo**, no una data-table
configurable por columnas — y además **6 de los 8 listados son grillas de tarjetas** que no usan
`Table`. Meter paginación ahí serviría a 2 de 8 pantallas y rompería la regla del módulo.

**Debounce = comportamiento nuevo.** Con búsqueda server-side, sin debounce hay **un request por
tecla**. 300 ms es el default; el hook lo recibe como parámetro inyectable para poder testearlo con
timers falsos en vez de esperas reales.

**A11y.** El `<Paginador>` opera por teclado, deshabilita "anterior"/"siguiente" en los extremos (no
los oculta: no mover el layout), y no usa el color como único canal — misma convención que el resto del
design system. Se registra en el catálogo vivo `DesignSystem.tsx` (regla dura del proyecto).

---

## D7 — Hojas de Ruta se arregla **sin** paginar

**Decisión.** `HojaDeRutaPage` deja de usar `useHojasDeRuta(...)` → `list()` + `.find()` y pasa a
resolver el día con `getByFecha(fecha)`.

**Por qué.** Es la lectura más cara de la app y no es un listado: hoy trae **todas** las hojas de ruta
de la historia con el embed de tres niveles (`hoja → recorrido → historial_recorridos`), más la consulta
batch de coordenadas sobre `pacientes.direcciones`, **para quedarse con un solo día**. Crece con cada
día operado.

**Por qué NO paginar.** La pantalla no muestra una lista de hojas de ruta: muestra **el día
seleccionado**. La respuesta correcta a "traigo todo y me quedo con uno" es **consultar uno**, no
mostrar de a 20. `getByFecha` ya existe en `HojaDeRutaRepository` y en `SupabaseHojaDeRutaRepository`:
no hay que escribir nada nuevo en la capa de datos.

**Cuidado en el apply.** `useHojasDeRuta` expone `crear`/`actualizar` con recarga silenciosa
(`{ silencioso: true }`, agregada por el fix "Sugerir orden no hace nada" del 2026-08-11). Ese
comportamiento **debe preservarse** en la variante por fecha: si el refetch vuelve a tildar `loading`,
se desmontan los `RecorridoCard` y la usuaria pierde el modo edición en cada mutación — es un bug ya
arreglado una vez y este change puede reintroducirlo. Test de regresión obligatorio.

---

## D8 — Alcance recortado por transporte, no por intuición

**Decisión.** Solo se pagina lo que llega por **PostgREST directo**.

| Dominio | Transporte | Fase |
|---|---|---|
| Pacientes | PostgREST | ✅ Fase 2 |
| Conductores | PostgREST | ✅ Fase 3 |
| Obras Sociales | PostgREST | ✅ Fase 3 |
| Hojas de Ruta | PostgREST | ✅ Fase 1 (`getByFecha`, no paginación) |
| **Vehículos** | **Edge Function** `vehiculos` | ⛔ diferido |
| Presupuestos / Autorizaciones | **Edge Function** `presupuestos`/`autorizaciones` | ⛔ diferido |
| Facturas / Cobros | **mock en `localStorage`** | ⛔ diferido |
| Cuentas | PostgREST, pero N+1 de permisos y padrón chico (admin) | ⛔ diferido |
| Documentos | mock | ⛔ diferido |

**Por qué se difieren los Edge Function.** Paginar `vehiculos`/`presupuestos` exige editar
`supabase/functions/*/index.ts` (verificado: ninguna acepta `limit`/`offset`) **y redesplegarlas**. El
deploy es de la usuaria/Enzo, no del agente. Meterlo acá convertiría un change de frontend en un change
con dependencia de deploy y otro nivel de gobernanza.

**Por qué se difiere facturación.** `FacturacionRoute.tsx` sigue inyectando `mockFacturaRepository`
(`localStorage`). Paginar un array en memoria del navegador no resuelve nada. El swap real es
`integracion-facturacion`, **bloqueado en el portón de governance §C-07** (5 decisiones de Enzo). Cuando
se desbloquee, `SupabaseFacturaRepository` nace ya con `listPage` — el contrato de D3 lo espera.

**Por qué se difiere Cuentas.** Padrón chico (cuentas de la empresa), pantalla solo-admin, y su lectura
mezcla `usuarios.usuarios` con `modulos.permisos` × `modulos.modulos`: paginar ahí es más riesgo que
beneficio hoy.

---

## D9 — Los mocks también implementan `listPage`

**Decisión.** `mockPacienteRepository`, `mockConductorRepository` y `mockObraSocialRepository` implementan
`listPage` cortando el array en memoria, con el **mismo orden y la misma semántica de búsqueda** que la
implementación Supabase.

**Por qué.** Son los dobles de test de toda la suite y el modo de desarrollo sin backend. Si el mock
ordena distinto que Supabase, los tests de UI pasan en verde contra un comportamiento que producción no
tiene. La semántica de tokenización de D5 vive en una **función pura compartida** (`construirFiltroBusqueda`),
testeada una sola vez, usada por ambas implementaciones — no dos copias que se desincronizan.

**Sin `SCHEMA_VERSION` bump**: `listPage` no cambia la **forma persistida** de ningún mock, solo agrega
una lectura.

---

## Fases y checkpoints

| Fase | Qué | Governance |
|---|---|---|
| **0** | Tipos, `rangoSupabase`, `construirFiltroBusqueda`, `usePaginaListado`, `<Paginador>` — todo puro/aislado, ningún consumidor | LOW, autónomo |
| **1** | Hojas de Ruta → `getByFecha`. Mayor ganancia, menor riesgo, sin UI nueva | MEDIUM, checkpoint al cerrar |
| **2** | Pacientes: `listPage` + búsqueda server-side + `<Paginador>` | MEDIUM — **requiere OK del CHECKPOINT 1** |
| **3** | Conductores y Obras Sociales (patrón ya validado en fase 2) | MEDIUM, checkpoint al cerrar |

Cada fase es un commit reversible por separado. **No se arranca la fase 2 sin respuesta al CHECKPOINT 1.**

---

## Preguntas abiertas (para la usuaria, no las decide el agente)

1. **CHECKPOINT 1 — semántica de la búsqueda de pacientes.** ¿Se acepta el cambio a tokens vs. columnas
   (§D5)? Sin respuesta, la fase 2 no arranca.
2. **Tamaño de página.** Propuesta: **20** para grillas de tarjetas, sin selector de tamaño en la
   primera iteración (menos superficie, menos estado). ¿Alcanza, o quiere elegir 10/20/50?
3. **Página en la URL.** Hoy `?pagina=3` **no** se persiste: recargar vuelve a la página 1 y no se puede
   compartir un link a una página. Es una decisión de producto; la propuesta es **no** hacerlo ahora
   (agrega acoplamiento con `react-router` en 3 pantallas) y evaluarlo con uso real.
4. **Vehículos y Presupuestos.** ¿Se abre un change aparte para paginar las Edge Functions, o se espera
   a ver si el volumen lo justifica? (Vehículos y presupuestos crecen mucho más lento que pacientes.)
</content>
