## Context

Fase **FE-5** del `ROADMAP-FRONTEND.md`, lado UI de `C-10 hojas-de-ruta-recorridos` — la pantalla más pesada de UI del producto. El circuito de negocio (`07_flujos_principales.md §Flujo 2`, `06_funcionalidades.md §Épica 8 US-700): al inicio de la jornada la administradora/operadora arma la hoja de ruta del día agrupando pasajeros por vehículo/conductor según capacidad y compatibilidad de accesorios (RN-VE-01), el sistema sugiere un orden de recogida por cercanía (editable, RN-HR-01), el operador ajusta a mano (agrega/quita pasajeros, notas al pie), revisa la vista global para reasignar ante imprevistos (vehículo/conductor fuera de servicio, RN-VE-02) y exporta/imprime la hoja para el conductor. Se construye frontend + mock: el backend real (`C-10`: tablas `hoja_de_ruta`/`recorrido`, RLS, geolocalización real) es otra sesión/agente.

Estado actual del frontend (ya existe, se reutiliza como patrón):
- Stack: React 19 + TypeScript strict + Tailwind v4 (Vite 8) + React Router. Vitest + React Testing Library para tests.
- FE-1 estableció el patrón **contrato → mock → hook → componente presentacional**. `vehiculos-ui`, `obras-sociales-ui`, `conductores-ui`, `pacientes-ui` y `presupuestos-ui` lo consolidaron con persistencia en `localStorage`: `XRepository` (interfaz, en `shared/lib/<dominio>/`) + `mockXRepository` (localStorage + `schemaVersion` + fixture + `withLatency`, en `shared/lib/mocks/`) + `useX` (hook) + `XRepositoryContext` (inyección) + componentes presentacionales en `features/<dominio>/`.
- Los mocks de `PacienteRepository`, `VehiculoRepository` y `ConductorRepository` ya existen con sus fixtures — se **consumen** para los selectores y para resolver capacidad, accesorios, estado y direcciones.
- Tipos ya definidos y reutilizables: `Tramo` (`'ida' | 'vuelta'`) y `Direccion` (`paciente.ts`), `AccesorioMovilidad`/`EstadoVehiculo` (`vehiculo.ts`), `EstadoConductor` (`conductor.ts`). El `Paciente` ya trae `accesorioMovilidad: AccesorioMovilidad[]` y `direcciones: Direccion[]` con ida/vuelta como registros independientes (RN-HR-02, ya aplicado en pacientes-ui).
- `AvisoModeloDatos` (`frontend/src/design-system/components.tsx`) es el cartel reutilizable de discrepancias. `generateId(prefix)` (`shared/lib/id.ts`). Primitivos: `Section`, `Chip`, `Button`.
- Ruta `/hojas-de-ruta` ya declarada en `routes.ts` (label "Hojas de Ruta", icon `hojasDeRuta`), hoy renderizada por `PlaceholderPage`; la feature se monta reemplazando su `element` en `router.tsx` (patrón `PresupuestosRoute`), sin tocar `routes.ts`.
- **No hay librería de mapas instalada** todavía: este change agrega `@vis.gl/react-google-maps`.

Restricciones duras del proyecto (CLAUDE.md): TypeScript strict, prohibido `any` (usar `unknown` + narrowing); estilar SOLO con clases utilitarias de Tailwind v4, prohibido `style={{}}` inline (tokens en `@theme` de `frontend/src/index.css`); prohibido crear cliente Supabase real / RLS / migraciones en este change; Conventional Commits. **Governance de este dominio: ALTO** — este change entrega solo artefactos; el `apply` requiere revisión humana previa a escribir código.

Reglas de la skill `google-maps-platform` (compact rules, cumplimiento obligatorio): framework React DEBE ser `@vis.gl/react-google-maps` (nunca `@react-google-maps/api`/`google-map-react`); prohibido `google.maps.Marker` (usar `AdvancedMarkerElement`), `DirectionsService`/`DistanceMatrixService` (usar Routes API), `Autocomplete`/`PlacesService`/`Geocoder` JS legacy; `mapId` obligatorio para `AdvancedMarkerElement` (`"DEMO_MAP_ID"` en prototipo); `<Map>` necesita altura CSS explícita; nunca hardcodear la key (env var; Maps Demo Key sin billing en este change).

## Goals / Non-Goals

**Goals:**
- Contrato de datos `HojaDeRuta` + `Recorrido` + `ParadaRecorrido` + su repository que no haya que reescribir cuando llegue `C-10` backend (cruce docx §Recorridos/Historial de Recorridos + `04_modelo_de_datos.md §HojaDeRuta/Recorrido`).
- Mock con `localStorage` + latencia para loading/error/empty states reales, con fixture coherente: una hoja de ruta del día con recorridos ligados a vehículos habilitados, conductores operando y pacientes existentes, con coordenadas fixture para el mapa.
- Armado del día agrupando por vehículo/conductor respetando capacidad, con solo vehículos habilitados y conductores operando disponibles (RN-VE-02).
- Bloqueo de asignación de paciente a vehículo con accesorio incompatible (RN-VE-01) como función pura + alerta en UI.
- Mapa (`@vis.gl/react-google-maps` + Maps Demo Key + `AdvancedMarkerElement`) que visualiza paradas y sugiere orden de recogida por cercanía como **lista editable** (RN-HR-01).
- Edición manual (agregar/quitar pasajero + reacomodo, notas al pie), recorridos manuales sin turno fijo (RN-HR-03), direcciones ida/vuelta independientes por tramo (RN-HR-02), vista global del día.
- Exportación / vista imprimible de la hoja de ruta.
- Documentar y señalizar en UI la discrepancia con el docx.

**Non-Goals:**
- Cliente Supabase real, migraciones SQL (`hoja_de_ruta`, `recorrido`), RLS (es `C-10` backend, FE-8).
- Modificar `PacienteRepository`/`VehiculoRepository`/`ConductorRepository` o sus mocks: se **consumen** de solo lectura.
- Geolocalización/ETA de producción con billing y key propia, Routes API real, geocoding real de las direcciones de los pacientes: en el prototipo las coordenadas son fixtures y el orden por cercanía se calcula con haversine sobre esos fixtures (ver Decisión 6).
- Historial de traslados facturables (`asistencia_prestacion` de `C-07`): el recorrido efectivo es independiente de las prestaciones facturadas (RN-FA-01) y no se deriva de acá.
- Máquina de estados del viaje (realizado/ausente del "Historial de Recorridos" del docx): este change arma la planificación del día, no registra la ejecución (ver Open Questions).

## ⚠️ Discrepancias con Traslados-Modelo-Datos.docx

Comparación hecha 2026-07-24 entre `knowledge-base/04_modelo_de_datos.md §HojaDeRuta/Recorrido` (+ `05_/06_/07_` y el scope de `C-10` en `CHANGES.md`) y el modelo real del cliente (`docs/core/Traslados-Modelo-Datos.docx §Área Pacientes → Recorridos / Historial de Recorridos`). Esta discrepancia **ya está documentada** en `CHANGES.md §C-10` y en `knowledge-base/04_modelo_de_datos.md §Discrepancias` (entrada "Operación diaria / Recorridos"); acá se refuerza con la decisión concreta que toma este change y se señaliza en la UI con `AvisoModeloDatos` (Decisión 8).

**Campos reales según el docx:**
- **Recorridos** (docx, bajo el área Pacientes): `Paciente`, `Dirección inicial / final` (del catálogo de Direcciones del paciente), `Día de la semana`, `Hora`. Es el **recorrido habitual y recurrente** del paciente. **No tiene vehículo ni conductor.**
- **Historial de Recorridos** (docx): `Paciente`, `Fecha`, `Vehículo`, `Dirección inicial / final`, `Estado` (ej. realizado / ausente). Relación: 1 Paciente + (cuando aplica) 1 Vehículo. **No tiene campo Conductor.**
- **No existe** en el docx ninguna entidad "Hoja de Ruta" que agrupe recorridos de un día por vehículo/conductor.

**Discrepancias:**

1. **No hay entidad "Hoja de Ruta" en el docx (KNOWN, confirmada en `CHANGES.md §C-10`).** La KB (`04_modelo_de_datos.md`), `06_funcionalidades.md §Épica 8` y `07_flujos_principales.md §Flujo 2` describen el armado de una hoja de ruta diaria que agrupa recorridos por vehículo/conductor. El docx solo tiene el "Recorrido habitual" (plan recurrente del paciente) y el "Historial de Recorridos" (viaje realizado), ninguno de los cuales es la hoja de ruta operativa del día. **Decisión (ver Decisión 1):** se modela `HojaDeRuta` (fecha + franja horaria + notas + recorridos) como agregado del día. Este concepto **no existe como tal en el docx** → el backend `C-10` debe crear las tablas `hoja_de_ruta`/`recorrido` o reinterpretar el modelo del docx. **Pendiente de confirmar con el dueño del docx.** Cartel en UI.

2. **El "Historial de Recorridos" del docx NO tiene campo Conductor — no se podría auditar qué chofer hizo cada viaje.** RN-VE-01/02, US-700 y el Flujo 2 requieren agrupar y editar recorridos **por vehículo y conductor**; el docx liga el viaje realizado solo a Paciente + Vehículo. **Decisión (ver Decisión 2):** el contrato del frontend agrega `conductorId: string` en `Recorrido`, porque la regla de negocio y el flujo operativo real lo necesitan (es lo que reflejan `06_funcionalidades.md §Épica 8` y `07_flujos_principales.md §Flujo 2`). Este campo **no existe en el docx** → el backend `C-10` debe agregar `conductor` a la tabla de recorridos/historial, o confirmar que la auditoría de chofer por viaje no es requerida. **Pendiente de confirmar con el cliente/dueño del docx.** Cartel en UI. **Es el punto de discrepancia central de este change.**

3. **El docx no tiene "orden de recogida" ni coordenadas — el orden por cercanía es un agregado de UI.** El docx no modela un orden dentro de un recorrido ni coordenadas geográficas de las direcciones. RN-HR-01 pide una sugerencia editable de orden por cercanía. **Decisión (ver Decisión 5 y 6):** se agrega `orden: number` en `ParadaRecorrido` y `coordenadaOrigen?: Coordenada` (fixture) para el mapa. El orden es un dato de planificación; las coordenadas reales las resolvería el backend por geocoding en producción. Cartel dedicado en `RecorridoCard.tsx` (agregado 2026-07-25, a pedido explícito, antes solo cubierto por el cartel general).

4. **La franja horaria (~8:00-20:00) y las notas al pie no están en el docx.** La KB (`04_/06_`) las menciona como atributos de la hoja de ruta; el docx no tiene la entidad. Van dentro de la decisión 1 (parte del agregado `HojaDeRuta` inexistente en el docx). Cartel dedicado en `HojaDeRutaPage.tsx` (agregado 2026-07-25, a pedido explícito, antes solo cubierto por el cartel general).

> Estas discrepancias se devuelven también en el resumen del propose, por regla dura del proyecto. Las de impacto backend (1 y 2) deben coordinarse con quien implemente `C-10` **antes** de cerrar el esquema de las tablas `hoja_de_ruta`/`recorrido`. La discrepancia ya figura en `knowledge-base/04_modelo_de_datos.md §Discrepancias`; este change **actualiza esa entrada** para reflejar la decisión tomada (modelar `conductorId`) — ver tarea 10.1.

## Decisions

### Decisión 1 — `HojaDeRuta` como agregado del día, con `Recorrido` embebido
Se modela `HojaDeRuta` (`id`, `fecha`, `franjaInicio`, `franjaFin`, `notas?`, `recorridos: Recorrido[]`) como el agregado de la jornada operativa, con los `Recorrido` **embebidos** (no en un repository aparte), igual que `conductores-ui` embebió `asignaciones` en `Conductor`. Motivo: la unidad de trabajo del operador es "el día" — se arma, se edita y se exporta como un todo; embeber recorridos hace que agregar/quitar pasajeros y reacomodar sea una sola mutación atómica del agregado, y evita coordinar dos repositories en cada edición. El concepto "Hoja de Ruta" no existe en el docx (Discrepancia 1); se documenta y se señaliza.
- **Alternativa descartada:** `RecorridoRepository` separado — multiplica la coordinación en cada edición manual y no aporta en un mock; el swap a dos tablas Supabase (FE-8) sigue siendo posible desde el agregado.

### Decisión 2 — `conductorId` en `Recorrido` (campo agregado sobre el docx) — punto de discrepancia central
`Recorrido` lleva `vehiculoId: string` **y `conductorId: string`**. El docx no tiene Conductor en el "Historial de Recorridos" (Discrepancia 2), pero RN-VE-01/02, US-700 y el Flujo 2 exigen agrupar/editar por vehículo **y** conductor y poder auditar qué chofer hizo cada viaje. Motivo: la regla de negocio manda sobre la estructura cuando la estructura documentada no la soporta, y no se resuelve adivinando: se modela el campo que el flujo real necesita y se marca como pendiente de confirmar con el dueño del docx (cartel en UI + nota en `04_modelo_de_datos.md` + `CHANGES.md §C-10`). Referencia por id (no embebe el objeto `Conductor`), igual criterio que el resto del dominio.
- **Alternativa descartada:** omitir el conductor para calzar con el docx — rompería RN-VE-02 (excluir conductor fuera de servicio), el agrupamiento por conductor del Flujo 2 y la auditoría de chofer; contradice la regla de negocio, que es la fuente autoritativa sobre comportamiento.

### Decisión 3 — Reutilizar tipos existentes, nunca redefinirlos
`ParadaRecorrido` usa `Tramo` y referencia `Direccion` por id (ambos de `paciente.ts`); la disponibilidad usa `EstadoVehiculo`/`AccesorioMovilidad` (`vehiculo.ts`) y `EstadoConductor` (`conductor.ts`). Motivo: los maestros ya definen estos tipos; redefinirlos duplicaría el contrato y desincronizaría el frontend del backend cuando lleguen `C-05`/`C-08`/`C-09`. `hojaDeRuta.ts` importa, no copia.

### Decisión 4 — Direcciones de origen/destino independientes por tramo (RN-HR-02)
Cada `ParadaRecorrido` es de un `tramo` (`'ida' | 'vuelta'`) y referencia `direccionOrigenId` y `direccionDestinoId` de forma explícita e independiente — la UI **nunca** deriva la vuelta invirtiendo la ida. Motivo: RN-HR-02 y el modelo de `Direccion` de pacientes-ui (cada tramo es un registro autónomo). Las direcciones se toman del catálogo `Paciente.direcciones` (docx: "Dirección inicial/final tomadas del catálogo de Direcciones del paciente").
- **Alternativa descartada:** guardar un solo par origen/destino y derivar la vuelta — viola RN-HR-02 explícitamente.

### Decisión 5 — Orden de recogida como dato editable, nunca ruta impuesta (RN-HR-01)
`ParadaRecorrido.orden: number` define el orden de recogida dentro de un recorrido. La sugerencia por cercanía (`sugerirOrdenPorCercania`) devuelve una **propuesta** que el operador puede reordenar libremente; el sistema nunca fija la ruta. Motivo: RN-HR-01 es explícita ("no arma la ruta automáticamente; ayuda a ordenar, decisión y edición manual del operador"). La UI presenta la sugerencia como lista reordenable + marcadores en el mapa, con un botón "sugerir orden" que el operador acepta o ignora.
- **Alternativa descartada:** aplicar Routes API para trazar y fijar la ruta óptima — contradice RN-HR-01 e implicaría billing; además la skill prohíbe `DirectionsService` legacy.

### Decisión 6 — Mapa con `@vis.gl/react-google-maps` + Maps Demo Key; coordenadas fixture; orden por haversine
Se agrega `@vis.gl/react-google-maps` (framework obligatorio de la skill `google-maps-platform`) con la **Maps Demo Key** (sin billing, sin proyecto Cloud) vía env var (`VITE_GOOGLE_MAPS_API_KEY`, nunca hardcodeada) y `mapId="DEMO_MAP_ID"` para poder usar `AdvancedMarkerElement` (prohibido `google.maps.Marker`). El `<Map>` recibe una altura CSS explícita por clase Tailwind (si no, renderiza 0×0). Las coordenadas de los pacientes son **fixtures razonables, no reales** (documentado): en el mock no se geocodifica ni se inventan lugares reales. La sugerencia de orden se calcula con una función pura `sugerirOrdenPorCercania` (vecino más cercano por distancia haversine sobre las coordenadas fixture) — testeable, determinista y sin billing. En producción (FE-8) el orden puede pasar a Routes API (Compute Route Matrix) con key propia; el geocoding real lo resuelve el backend.
- **Alternativa descartada:** Routes API/DistanceMatrix en el prototipo — requiere billing y la Demo Key no lo cubre; haversine sobre fixtures es suficiente para prototipar la UX editable y mantiene la función pura y testeable.
- **Alternativa descartada:** cualquier otra librería de mapas React — la skill obliga a `@vis.gl/react-google-maps`.

### Decisión 7 — Disponibilidad y capacidad como funciones puras (RN-VE-01, RN-VE-02)
`validarCompatibilidadAccesorio({ accesoriosPaciente, accesoriosCompatiblesVehiculo })` → ok/error (RN-VE-01: todo accesorio del paciente debe estar en los compatibles del vehículo); `vehiculosDisponibles(vehiculos)` filtra `estado === 'habilitado'` y `conductoresDisponibles(conductores)` filtra `estado === 'operando'` (RN-VE-02); `capacidadDisponible(vehiculo, recorrido)` compara cantidad de pasajeros contra `vehiculo.capacidad`. Todas puras, sin efectos de red/localStorage, espejo client-side de reglas que el backend `C-10` re-valida. Motivo: reglas de governance ALTO que deben ser testeables por TDD y bloquear/alertar en UI antes de persistir.
- **Alternativa descartada:** validar solo en el submit contra el repository — pierde el bloqueo inmediato en UI y la testeabilidad aislada.

### Decisión 8 — Discrepancia del docx señalizada con `AvisoModeloDatos`, no solo en design.md
La pantalla de hoja de ruta muestra `AvisoModeloDatos` indicando que (a) el docx no tiene entidad "Hoja de Ruta" y (b) su "Historial de Recorridos" no tiene Conductor, por lo que `conductorId` es un campo agregado pendiente de confirmar. Motivo: mismo criterio ya aplicado en Pacientes/Conductores/Vehículos/Obras Sociales — que quien use la app (incluido backend) vea la ambigüedad sin leer la KB.
- **Alternativa descartada:** dejarlo solo en `design.md` — se pierde de vista al archivar el change.

### Decisión 9 — Inyección por context + estructura `features/hojas-de-ruta/`
La pantalla recibe `HojaDeRutaRepository` vía context (patrón `VehiculoRepositoryContext`) y consume `PacienteRepository`/`VehiculoRepository`/`ConductorRepository` inyectados para los selectores, nunca importando los mocks directamente. Contrato + mock + funciones puras en `shared/`; pantallas, mapa y hooks en `features/hojas-de-ruta/`. La feature se monta reemplazando el `element` de `/hojas-de-ruta` en `router.tsx`; `routes.ts` no se toca (ya declara la ruta).

### Decisión 10 — Persistencia del mock en `localStorage`, no in-memory
Se reutiliza el patrón `mockVehiculoRepository`: `localStorage` con clave `hojasDeRuta`, `StoredPayload { schemaVersion, ... }`, `withLatency`, y re-seed desde fixture ante payload corrupto o `schemaVersion` mismatch. Motivo: el armado del día se prueba a lo largo de varias recargas (armar → editar → reasignar → exportar); in-memory perdería el estado en cada reload.

## Governance ALTO — nota para el apply

`C-10` es **Governance ALTO** en `CHANGES.md` (afecta datos operativos reales de traslados de pacientes). Para este propose (solo generación de proposal/design/specs/tasks) no aplica bloqueo. En el **apply**, el governance ALTO rige: hay que **proponer y esperar revisión/aprobación humana antes de escribir código**, y ser explícito sobre cada decisión — en particular la Decisión 2 (`conductorId` agregado sobre el docx), que debe confirmarse con el dueño del docx antes de cerrar el esquema. El apply debe respetar Strict TDD (funciones puras primero: compatibilidad, disponibilidad, capacidad, orden por cercanía).

## Risks / Trade-offs

- **Divergencia de estructura con el backend real (`C-10`)** → `HojaDeRuta` y `conductorId` no existen en el docx; si el backend no los crea, el modelo de planificación diaria queda sin respaldo persistente. Mitigación: Discrepancias 1 y 2 marcadas como pendiente de confirmar con el dueño del docx **antes** de cerrar las tablas; carteles en UI; contrato hablado con interfaz, así el ajuste queda contenido en el adaptador FE-8.
- **Maps Demo Key limitada** → la Demo Key cubre un subconjunto de APIs y no billing; Routes API/ETA real no está disponible. Mitigación: el orden por cercanía usa haversine sobre fixtures (función pura), el mapa solo visualiza; la ruta editable no depende de Routes API. En producción se cambia la key y, si se quiere, se pasa a Routes API sin tocar componentes.
- **Coordenadas fixture no reales** → los marcadores del mapa no corresponden a ubicaciones reales de los pacientes. Mitigación: documentado explícitamente; en producción el geocoding real lo resuelve el backend. El mock no inventa lugares reales de Google (no llama a Places).
- **Pantalla pesada / componentes grandes** → riesgo de componentes > 200 líneas (regla `react-best-practices`). Mitigación: dividir en subcomponentes (lista de recorridos, tarjeta de recorrido, mapa, panel de edición, vista global, vista imprimible); keys por id estable (nunca índice de array).
- **`localStorage` sin versionado robusto** → cambios en la forma de `HojaDeRuta` podrían romper la deserialización. Mitigación: `schemaVersion` + re-seed desde fixture (solo mock, sin dato de producción).
- **Fixtures acoplados a otros maestros** → los recorridos del fixture referencian ids de vehículos/conductores/pacientes existentes. Mitigación: el fixture usa ids presentes en `vehiculosFixture`/`conductoresFixture`/`pacientesFixture`, con al menos un vehículo habilitado y un conductor operando.

## Migration Plan

No aplica migración de datos (frontend + mock, sin backend). Camino de reemplazo futuro (FE-8, cuando `C-10` backend se archive): escribir `SupabaseHojaDeRutaRepository` que cumpla la interfaz, inyectarlo en el context en lugar del mock; el orden por cercanía puede pasar de haversine a Routes API con key propia; el geocoding de direcciones lo resuelve el backend. Componentes, hooks y tipos no cambian. **Precondición del apply (governance ALTO):** resolver las Discrepancias 1 y 2 con el dueño del docx (entidad `hoja_de_ruta`, campo `conductor`) y obtener aprobación humana antes de escribir código.

## Open Questions

- **¿Existe/se crea la entidad "Hoja de Ruta" en la BD real?** El docx no la tiene. Confirmar con el dueño del docx si `C-10` backend agrega `hoja_de_ruta`/`recorrido` o reinterpreta el modelo (Discrepancia 1).
- **¿Se agrega Conductor al recorrido/historial?** El docx liga el viaje solo a Paciente + Vehículo. Se modela `conductorId`; confirmar que el backend agregará `conductor` (auditoría de chofer por viaje) — Discrepancia 2, punto central.
- **Alcance del ordenamiento por cercanía (RF-701, `10_preguntas_abiertas.md` prioridad Media)** → ¿la sugerencia considera solo distancia en línea recta, distancia de manejo (Routes API), o ventanas horarias? Se deja como **TODO/config no bloqueante**: en el prototipo es haversine sobre fixtures; el criterio real se confirma con el cliente y se hace configurable, nunca hardcodeado.
- **¿Registra este módulo la ejecución del viaje (estado realizado/ausente del "Historial de Recorridos")?** Este change arma la planificación del día; el registro de ejecución (y su relación con facturación, RN-FA-01) queda fuera de alcance. Confirmar si US-700 incluye marcar viajes como realizados/ausentes o si eso es otro módulo.
- **Franja horaria por defecto (~8:00-20:00)** → ¿es fija o configurable por la administradora? Se deja como default configurable, no hardcodeado.
