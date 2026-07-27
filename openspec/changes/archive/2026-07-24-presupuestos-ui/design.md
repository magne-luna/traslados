## Context

Fase **FE-4** del `ROADMAP-FRONTEND.md`, lado UI de `C-06 presupuestos-autorizaciones`. El circuito de negocio (`07_flujos_principales.md §Flujo 1`, docx §Facturación): Facturación emite un **Presupuesto** dirigido a la obra social del paciente; la obra social responde con una **Autorización** que habilita el servicio bajo ciertos límites (cupo mensual de días y de km) y con un estado; ese cupo autorizado es la base del control de facturación (FE-6). Se construye frontend + mock: el backend real (`C-06`: tablas `presupuesto`/`autorizacion`, RLS, validación dura) es otra sesión/agente.

Estado actual del frontend (ya existe, se reutiliza como patrón):
- Stack: React 19 + TypeScript strict + Tailwind v4 (Vite) + React Router. Vitest + React Testing Library para tests.
- FE-1 estableció el patrón **contrato → mock → hook → componente presentacional**. `vehiculos-ui`, `obras-sociales-ui`, `conductores-ui` y `pacientes-ui` lo consolidaron con persistencia en `localStorage`: `XRepository` (interfaz) + `mockXRepository` (localStorage + `schemaVersion` + fixture) + `useX` (hook de wiring) + `XRepositoryContext` (inyección) + componentes presentacionales.
- Los mocks de `PacienteRepository` (`frontend/src/shared/lib/mocks/mockPacienteRepository.ts`) y `ObraSocialRepository` (`.../mockObraSocialRepository.ts`) ya existen con sus fixtures — se **consumen** para los selectores.
- `AvisoModeloDatos` (`frontend/src/design-system/components.tsx`) es el cartel reutilizable que ya señaliza discrepancias con el modelo de datos real en Pacientes/Conductores/Vehículos/Obras Sociales.
- Utilitarios: `generateId(prefix)` (`shared/lib/id.ts`). Design system: primitivos en `frontend/src/design-system/` (`Section`, `Chip`, `Button`).
- Convención de UI (`08_arquitectura_propuesta.md`): listado+detalle, fila clickeable completa (onClick en `<li>`, botón "Editar" con `stopPropagation`), detalle expandido — mismo patrón que Vehículos / Obras Sociales / Conductores.

Restricciones duras del proyecto (CLAUDE.md): TypeScript strict, prohibido `any` (usar `unknown` + narrowing); estilar SOLO con clases utilitarias de Tailwind v4, prohibido `style={{}}` inline (tokens en `@theme` de `frontend/src/index.css`); prohibido crear cliente Supabase real / RLS / migraciones en este change; Conventional Commits. **Governance de este dominio: ALTO** (dinero, plazos de cobro) — este change entrega solo artefactos; el apply requiere revisión humana previa a escribir código, y este documento debe ser explícito sobre cada decisión, en especial las que agregan campos ausentes en el docx.

## Goals / Non-Goals

**Goals:**
- Contrato de datos `Presupuesto` + `Autorizacion` + sus repositories que no haya que reescribir cuando llegue `C-06` backend (campos cruzados entre `04_modelo_de_datos.md §Presupuesto/Autorizacion` y `docs/core/Traslados-Modelo-Datos.docx §Facturación`).
- Mocks con `localStorage` + latencia para loading/error states reales, con fixtures coherentes: presupuestos ligados a pacientes/obras sociales del fixture existente y al menos una autorización por cada estado relevante.
- CRUD de presupuesto (paciente + obra social + monto + fecha emisión + archivo único).
- Formulario de autorización con máquina de estados (`pendiente/autorizada/judicializada/rechazada`), cupo mensual días/km editable y **fecha de vigencia** independiente de la fecha de carga (RN-PA-02).
- **Validación RN-PA-01 como función pura**: `montoAutorizado ≤ presupuesto.monto` (nunca mayor), espejo en UI de la regla, testeable en TDD.
- Exponer el cupo autorizado (`CupoAutorizado`) como dato consumible por FE-6.
- Documentar y señalizar en UI las discrepancias KB ↔ docx.

**Non-Goals:**
- Cliente Supabase real, migraciones SQL (`presupuesto`, `autorizacion`), RLS, buckets de storage (es `C-06` backend, FE-8).
- Modificar `PacienteRepository`/`ObraSocialRepository` o sus mocks: se **consumen** de solo lectura para los selectores.
- Implementar el control de facturación contra el cupo (RN-FA-02): se **aplica** en FE-6 (`C-07`); acá solo se deja el cupo consultable.
- Generación/subida real de archivos a storage: el `archivo` es una referencia (nombre + placeholder); la subida real la resuelve el backend.
- Integración con ARCA, geolocalización, notificaciones o cualquier API externa.

## ⚠️ Discrepancias con Traslados-Modelo-Datos.docx

Comparación hecha 2026-07-24 entre `knowledge-base/04_modelo_de_datos.md §Presupuesto/Autorizacion` (+ scope de `C-06` en `CHANGES.md`) y el modelo de datos real del cliente (`docs/core/Traslados-Modelo-Datos.docx §5 Facturación`, entidades **Presupuesto** y **Autorización**). Mismo formato que la sección de discrepancias de `04_modelo_de_datos.md`. Las que afectan una decisión visible en pantalla se marcan además con `AvisoModeloDatos` en la UI (Decisión 7).

**Campos reales según el docx:**
- **Presupuesto** (docx): `id`, Obra social, Paciente, **Monto** (importe propuesto), **Fecha de emisión**, **Archivo** (uno solo). Relaciones: pertenece a 1 Paciente + 1 Obra Social; puede recibir 1 Autorización.
- **Autorización** (docx): `id`, Presupuesto, **Estado** (pendiente/autorizada/judicializada/rechazada), **Fecha de respuesta**, **Cupo mensual de días**, **Cupo mensual de kilómetros**, **Archivo** (uno solo). Relación: corresponde a 1 Presupuesto.

**Discrepancias:**

1. **Documentación adjunta: un solo "Archivo", NO multi-documento (KNOWN, confirmada).** El scope de `C-06` en `CHANGES.md` dice "documentación adjunta... usando el patrón de `C-03`" (el componente reutilizable `DocumentChecklist` de FE-1, multi-documento, usado en obras-sociales/vehículos/conductores/pacientes). El docx modela **un único campo "Archivo"** por Presupuesto y otro por Autorización — no una tabla de N documentos. `EntidadDocumental` en `documento.ts` (`'paciente' | 'vehiculo' | 'conductor' | 'factura'`) tampoco incluye presupuesto/autorización. **Decisión (ver Decisión 3):** se modela `archivo?: ArchivoAdjunto` (referencia a un solo archivo) por entidad y se usa un input de un único archivo, **NO** `DocumentChecklist`. Cartel en UI.

2. **Autorización NO tiene "monto autorizado" en el docx — RN-PA-01 no es directamente validable.** RN-PA-01 dice "la autorización puede coincidir con el presupuesto o ser menor, **nunca mayor**". Pero en el docx: el **Presupuesto** tiene un `Monto` (dinero) y **ningún** cupo; la **Autorización** tiene cupos (`días`/`km`) y **ningún** monto. No hay un campo numérico comparable presente en **ambas** entidades: no se puede comparar "autorización ≤ presupuesto" en dinero (la autorización no tiene monto) ni en cupos (el presupuesto no tiene cupos). RN-PA-01, tal como está redactada, **no está soportada por el modelo de datos real**. **Decisión (ver Decisión 4):** el contrato del frontend agrega `montoAutorizado?: number` en `Autorizacion` para poder ejercer la validación RN-PA-01 en UI (`montoAutorizado ≤ presupuesto.monto`). Este campo **no existe en el docx** → el backend `C-06` debe (a) agregar `monto_autorizado` a la tabla `autorizacion`, o (b) reinterpretar RN-PA-01 sobre los cupos, o (c) confirmar con el cliente qué magnitud compara la regla. **Pendiente de confirmar con backend/cliente.** Cartel en UI.

3. **Autorización NO tiene "fecha de vigencia" en el docx — la carga retroactiva (RN-PA-02) no tiene dónde guardarse.** RN-PA-02: "las autorizaciones pueden cargarse con vigencia retroactiva (ej. autorizada en abril, habilita facturar traslados de enero a marzo)". El docx solo tiene **"Fecha de respuesta"** en la Autorización — no hay un campo separado "vigencia desde" distinto de la fecha de carga/respuesta. **Decisión (ver Decisión 5):** el contrato del frontend agrega `vigenciaDesde?: string` (ISO date) separado de `fechaRespuesta`, para soportar la carga retroactiva que exigen RN-PA-02, US-200 y el scope de `C-06`. Este campo **no existe en el docx** → el backend `C-06` debe agregar `vigencia_desde` a la tabla `autorizacion`. **Pendiente de confirmar con backend.** Cartel en UI.

4. **Presupuesto es un `Monto` único, NO "estimación anual por prestación".** La KB y `CHANGES.md` describen el presupuesto como "estimación anual solicitada por paciente/prestación". El docx modela un **único `Monto`** + `Fecha de emisión`, sin desglose por prestación ni concepto explícito de "anual". **Decisión:** se respeta el docx — `Presupuesto.monto: number` es un importe único; la interpretación "anual/por prestación" queda como etiqueta funcional del formulario (label + ayuda), no como estructura de datos. Menor; sin cartel dedicado (se cubre con el label del campo).

5. **Estado vive solo en la Autorización, no en el Presupuesto.** Coherente entre KB y docx (el docx pone `Estado` únicamente en Autorización). Sin discrepancia — se documenta para dejar explícito que el Presupuesto **no** tiene estado propio en este contrato.

6. **Obra social en el Presupuesto (docx) vs. ERD de la KB.** El docx dice explícitamente que el Presupuesto pertenece a **1 Paciente + 1 Obra Social**. El ERD de `04_modelo_de_datos.md` solo modela `Paciente 1---N Presupuesto` (no dibuja el vínculo a ObraSocial). **Decisión:** se sigue el docx — `Presupuesto.obraSocialId` es parte del contrato (el presupuesto se dirige a una obra social concreta). Sin cartel (es un agregado, no un conflicto visible).

> Estas discrepancias se devuelven también en el resumen del propose, por pedido explícito del usuario. Las de impacto backend (2 y 3) deben coordinarse con quien implemente `C-06` **antes** de cerrar el esquema de la tabla `autorizacion`.

## Decisions

### Decisión 1 — Persistencia del mock en `localStorage`, no in-memory
Se reutiliza el patrón de `mockVehiculoRepository`/`mockConductorRepository`: `localStorage` con claves `presupuestos` y `autorizaciones`, envoltorio `StoredPayload { schemaVersion, ... }`, `withLatency` para simular red, y re-seed desde fixture ante payload corrupto o `schemaVersion` mismatch. Motivo: presupuestos y autorizaciones son datos acumulados que se prueban a lo largo de varias recargas (cargar presupuesto → cargar autorización → cambiar estado → revalidar). La (de)serialización queda encapsulada en cada mock; el resto de la app solo ve las interfaces.
- **Alternativa descartada:** in-memory — se perderían presupuestos/autorizaciones en cada reload, empobreciendo la prueba de la máquina de estados y la validación de monto.

### Decisión 2 — Presupuesto y Autorización como dos entidades/repositories separados, relación por id
`Presupuesto` y `Autorizacion` son entidades distintas con repositories distintos (`PresupuestoRepository`, `AutorizacionRepository`); la autorización referencia `presupuestoId: string` (no embebe el `Presupuesto`). Motivo: es la relación 1---1 que modela el docx (`Autorización corresponde a un único Presupuesto`), y el backend `C-06` las crea como dos tablas — mantener dos contratos evita que FE-8 tenga que desarmar una estructura embebida. `AutorizacionRepository` expone `getByPresupuestoId(id)` para resolver la autorización de un presupuesto sin listar todo.
- **Alternativa descartada:** embeber `autorizacion` dentro de `Presupuesto` — dificulta el swap a dos tablas Supabase y mezcla dos ciclos de vida (el presupuesto se emite antes de que exista la autorización).

### Decisión 3 — Documentación adjunta: archivo único por entidad, NO `DocumentChecklist`
Se modela `archivo?: ArchivoAdjunto` (`{ nombre: string; cargadoEn: string }`, referencia a un solo archivo) en `Presupuesto` y en `Autorizacion`, con un input de un único archivo cada uno. **No** se reutiliza `DocumentChecklist` (multi-documento) ni se agrega `'presupuesto'`/`'autorizacion'` a `EntidadDocumental`. Motivo: el docx modela un solo "Archivo" por entidad (Discrepancia 1); usar el checklist multi-doc introduciría un modelo de datos que el backend real no tiene. La subida real de archivos es responsabilidad del backend/storage; en el mock el `archivo` es solo la referencia.
- **Alternativa descartada:** reutilizar `DocumentChecklist` como pedía el scope de `C-06` (patrón `C-03`) — contradice el modelo de datos real; se generaría una tabla de N documentos inexistente en el docx.

### Decisión 4 — `montoAutorizado` en el contrato del frontend para poder validar RN-PA-01
`Autorizacion.montoAutorizado?: number` se agrega al contrato (ausente en el docx, Discrepancia 2) para que la validación RN-PA-01 (`montoAutorizado ≤ presupuesto.monto`, nunca mayor) sea posible en UI. Es opcional: mientras el estado es `pendiente` puede no haber monto. La validación es una **función pura** `validarAutorizacion({ montoAutorizado, montoPresupuesto })` → ok/error, espejo client-side de la regla que el backend re-valida (RN-PA-01). Motivo: sin un campo numérico comparable en ambas entidades la regla no se puede ejercer; el frontend necesita el dato para bloquear/alertar. Se marca como pendiente de confirmar con backend (agregar `monto_autorizado`, reinterpretar sobre cupos, o confirmar la magnitud con el cliente).
- **Alternativa descartada:** validar RN-PA-01 sobre cupos (días/km) — el Presupuesto del docx no tiene cupos, así que no hay contra qué comparar. Descartada: omitir la validación — RN-PA-01 es explícita y de governance ALTO (dinero).

### Decisión 5 — `vigenciaDesde` separado de `fechaRespuesta` para la carga retroactiva (RN-PA-02)
`Autorizacion.vigenciaDesde?: string` (ISO date) se agrega al contrato (ausente en el docx, Discrepancia 3), independiente de `fechaRespuesta`, para soportar RN-PA-02 (autorizada en abril con vigencia desde enero). El formulario permite fijar una `vigenciaDesde` **anterior** a la fecha de carga sin bloquear. Motivo: la carga retroactiva es un requisito duro (RN-PA-02, US-200, tests de `C-06`) y el docx no tiene dónde guardarla. Se marca pendiente de confirmar con backend (agregar `vigencia_desde`).
- **Alternativa descartada:** reutilizar `fechaRespuesta` como vigencia — perdería la distinción entre "cuándo respondió la obra social" y "desde cuándo habilita facturar", que es justamente lo que RN-PA-02 necesita.

### Decisión 6 — Estado de la autorización como unión de literales + transiciones documentadas
`EstadoAutorizacion = 'pendiente' | 'autorizada' | 'judicializada' | 'rechazada'` (unión cerrada, nunca `string` libre), calcado del docx y de US-200. El selector de estado ofrece los cuatro valores; el flujo esperado `pendiente → autorizada → judicializada → rechazada` se documenta y se testea (fixture con un caso por estado), pero **no** se implementa una máquina de estados que bloquee transiciones "hacia atrás" en este change (una autorización puede volver a `pendiente` o pasar directo a `rechazada` — las transiciones reales las confirma el cliente). Motivo: US-200 pide "manejar los estados", no un workflow rígido; sobre-restringir transiciones sin confirmación del cliente sería adivinar.
- **Alternativa descartada:** máquina de estados con transiciones fijas — no está especificada; se deja como Open Question.

### Decisión 7 — Discrepancias con impacto visible se muestran como cartel `AvisoModeloDatos`, no solo en design.md
Las discrepancias 1, 2 y 3 (archivo único, `montoAutorizado` inventado, `vigenciaDesde` inventado) se señalizan con `AvisoModeloDatos` en la pantalla correspondiente, reutilizando el estilo ya establecido (mismo criterio que `PacienteDetail`/`ConductorDetail`/`VehiculoDetail`/`ObraSocialDetail`). Motivo: que quien implemente `C-06` backend (y la usuaria) vea la ambigüedad al usar la pantalla, no solo leyendo este documento — criterio ya aplicado en todo el frontend. Las discrepancias 4-6 (menores/agregados) van solo en este documento.
- **Alternativa descartada:** dejarlas solo en `design.md` — se pierden de vista una vez archivado el change.

### Decisión 8 — Selectores de paciente y obra social consumen sus repositories inyectados, guardando solo ids
La pantalla de presupuesto lee pacientes vía `PacienteRepository` y obras sociales vía `ObraSocialRepository`, ambos inyectados por sus contexts, y guarda solo `pacienteId`/`obraSocialId` (strings) — NO embebe los objetos. Motivo: mantener el contrato de presupuestos desacoplado de los de paciente/obra social (solo ids), evitar datos duplicados/obsoletos, y que el swap de cualquiera a Supabase (FE-8) sea independiente. La feature monta los tres providers (Presupuesto + Autorizacion mock, más Paciente + ObraSocial mock consumidos) en su punto de composición.
- **Alternativa descartada:** embeber el `Paciente`/`ObraSocial` completo — duplica datos y se desincroniza si cambian.

### Decisión 9 — `CupoAutorizado` como proyección explícita para FE-6
Se define `CupoAutorizado` (`{ pacienteId, cupoMensualDias?, cupoMensualKm?, vigenciaDesde? }`) como el shape que FE-6 (`C-07`) consumirá para el control de facturación (RN-PA-03, RN-FA-02). Se puede derivar de `Autorizacion` + `Presupuesto.pacienteId`. Motivo: dejar el contrato de consumo explícito ahora evita que FE-6 tenga que hurgar en la estructura interna de la autorización; es el mismo criterio de "dejar el dato listo y consultable" que `conductores-ui` usó para las asignaciones que consume FE-5.
- **Alternativa descartada:** que FE-6 lea directamente `Autorizacion` — acopla FE-6 a la forma interna de la autorización.

### Decisión 10 — Inyección por context + estructura `features/presupuestos/`
Las pantallas reciben `PresupuestoRepository`/`AutorizacionRepository` vía contexts (mismo patrón que `VehiculoRepositoryContext`), nunca importan los mocks directamente. Contrato + mocks en `shared/` (reusables), pantallas y hooks específicos en `features/presupuestos/`. La feature se monta reemplazando el `element` de `/presupuestos` en `router.tsx`; `routes.ts` no se toca. Patrón de UI listado+detalle (fila clickeable, "Editar" con `stopPropagation`) calca el de Conductores/Vehículos.

## Risks / Trade-offs

- **Divergencia de campos con el backend real (`C-06`)** → `montoAutorizado` y `vigenciaDesde` no existen en el docx; si el backend no los agrega, la validación RN-PA-01 y la carga retroactiva RN-PA-02 quedan sin respaldo persistente. Mitigación: discrepancias 2 y 3 marcadas como pendiente de confirmar con backend **antes** de cerrar la tabla `autorizacion`; carteles en UI; contrato hablado con interfaz, así un ajuste queda contenido en el adaptador FE-8.
- **RN-PA-01 sin magnitud clara** → si el cliente confirma que la regla compara cupos y no dinero, `montoAutorizado` sobra y la validación cambia de forma. Mitigación: la validación es una función pura aislada; cambiar la magnitud comparada es un cambio local. Open Question abierta.
- **Estados sin workflow confirmado** → permitir cualquier transición podría dejar datos incoherentes (ej. `rechazada` con monto autorizado). Mitigación: se documenta el flujo esperado y se deja Open Question; no se bloquean transiciones sin confirmación del cliente (Decisión 6).
- **`localStorage` sin versionado robusto** → si cambia la forma de `Presupuesto`/`Autorizacion`, los datos viejos podrían romper la deserialización. Mitigación: `schemaVersion` en el payload y re-seed desde fixture ante mismatch (es solo un mock, sin dato de producción que preservar).
- **Fixtures acoplados a pacientes/obras sociales existentes** → los presupuestos del fixture referencian ids que deben existir en `pacientesFixture`/`osecacFixture`. Mitigación: el fixture de presupuestos usa ids que existen en esos fixtures; los selectores solo ofrecen lo que los repositories devuelven.

## Migration Plan

No aplica migración de datos (frontend + mock, sin backend). Camino de reemplazo futuro (FE-8, cuando `C-06` backend se archive): escribir `SupabasePresupuestoRepository`/`SupabaseAutorizacionRepository` que cumplan las interfaces, inyectarlos en los contexts en lugar de los mocks. Las funciones puras (`validarAutorizacion`) pueden quedar como espejo client-side o delegarse al backend; componentes, hooks y tipos no cambian. **Precondición del apply**: resolver las discrepancias 2 y 3 con backend (campos `monto_autorizado`, `vigencia_desde`) — governance ALTO.

Governance ALTO: dominio de alta criticidad (dinero, plazos). Este change entrega proposal/design/specs/tasks; la implementación (apply) requiere revisión/aprobación humana antes de escribir código, y debe respetar las decisiones aquí tomadas.

## Open Questions

- **RN-PA-01 — ¿qué magnitud compara la regla "autorización ≤ presupuesto"?** El docx no tiene un campo numérico común: Presupuesto tiene `Monto` (dinero), Autorización tiene cupos (días/km). Se asume comparación por dinero con `montoAutorizado` agregado al contrato; confirmar con el cliente/backend si es dinero (agregar `monto_autorizado` a la tabla) o cupos.
- **RN-PA-02 — ¿dónde persiste la vigencia retroactiva?** El docx solo tiene `Fecha de respuesta`. Se agrega `vigenciaDesde` al contrato; confirmar que el backend agregará `vigencia_desde` a la tabla `autorizacion`.
- **Documentación adjunta — ¿un archivo o varios?** El docx dice un solo "Archivo" por entidad; `CHANGES.md` asumía multi-doc (patrón `C-03`). Se implementa archivo único; confirmar con el cliente si en la práctica adjuntan más de un documento por presupuesto/autorización.
- **Estados — ¿hay un workflow con transiciones restringidas?** US-200 pide "manejar los estados" sin especificar transiciones válidas. Se permiten todas; confirmar con el cliente si `judicializada`/`rechazada` son estados terminales o reversibles.
- **Nombres de campo con backend (`C-06`)** — coordinar los nombres exactos (`monto`, `monto_autorizado`, `vigencia_desde`, `cupo_mensual_dias`, `cupo_mensual_km`, `estado`) antes de cerrar la interfaz, para minimizar el adaptador de FE-8 (interna, sin cartel en UI).
