## Why

Feedback real de la clienta (Andrea Pastor), "Ronda 2" — punto 1 de la síntesis que Enzo compartió
2026-08-06, transcripta de notas de voz de WhatsApp. Resumen verbatim del punto:

> La lista de verificación documental permite un documento de cada tipo (un RHC, un presupuesto, una
> justificación, una declaración, etc.). Debe permitir múltiples documentos del mismo tipo —
> concretamente 2 o hasta 3 presupuestos y 2 RHC. Las prestaciones se autorizan por períodos que
> cortan a mitad de año (ejemplo textual: agosto a julio, renueva de agosto de este año a julio del
> siguiente). Cuando llega la renovación, conviven dos documentos vigentes. No se sobrescribe: se
> acumula. Debe quedar presente el documento vigente más el siguiente (la continuidad).

**Verificado contra el código, no asumido.** El checklist documental (`shared/types/documento.ts`,
`DocumentChecklist.tsx`, `DocumentoRepository`) es un componente y un modelo de datos **compartidos**
por las cuatro entidades que lo usan — Pacientes, Vehículos, Conductores y Facturas
(`EntidadDocumental`) — con el principio explícito escrito en el propio archivo: *"el mismo
checklist/documento se reusa... solo cambia la entidad y la lista de items, nunca la forma del
dato"*. Hoy esa forma es **1:1**: `DocumentoAdjunto` no tiene `id` propio (solo `itemId`),
`DocumentChecklist.tsx` hace `documentos.find((d) => d.itemId === item.id)` (búsqueda singular,
un único resultado posible) y `mockDocumentoRepository.upload()` **reemplaza** explícitamente
cualquier documento anterior con el mismo `itemId` antes de agregar el nuevo:

```ts
// mockDocumentoRepository.ts, upload()
const existing = (store.get(k) ?? []).filter((doc) => doc.itemId !== itemId);
const nuevo: DocumentoAdjunto = { itemId, nombreArchivo: file.name, subidoEn: new Date().toISOString() };
store.set(k, [...existing, nuevo]);
```

Esa restricción **nunca fue una decisión de diseño documentada** — no hay ninguna nota en
`openspec/changes/C-03-gestion-documental-core/` que la justifique; es, simplemente, cómo quedó
implementado el mock la primera vez (FE-1). Y **contradice el propio modelo de datos del proyecto**:
`knowledge-base/04_modelo_de_datos.md` (§Paciente) ya dice *"N documentos"* (relación uno-a-muchos),
no "1 documento". El backend real (`pacientes.documentos`, `C-03`, aplicado y pusheado desde
2026-07-28) tampoco tiene ninguna restricción 1:1 — ver hallazgo de schema abajo. La restricción es,
en concreto, un artefacto de implementación del frontend mock, no una regla de negocio ni un límite
de esquema.

**Hallazgo de schema en vivo (el más importante para el alcance de este change).** Se consultó
`pacientes.documentos` contra el proyecto real (`supabase db query --linked`, no contra las
migraciones a ojo — mismo criterio que el resto de la serie de integración):

```
column_name        | data_type                | is_nullable
--------------------+--------------------------+------------
id                  | uuid                     | NO   (PK)
paciente_id         | uuid                     | NO   (FK -> pacientes.paciente, ON DELETE CASCADE)
id_tipo_documento   | uuid                     | NO   (FK -> obra_social.tipos_documento, ON DELETE RESTRICT)
archivo_url         | text                     | NO
created_at          | timestamptz              | YES  (default now())

constraints: solo la PK (id) y las dos FK. NINGÚN UNIQUE ni CHECK sobre (paciente_id, id_tipo_documento).
```

**La base real ya permite múltiples filas por `(paciente_id, id_tipo_documento)` hoy.** No hace falta
ninguna migración para levantar la cardinalidad — el schema nunca la impuso. Coincide exactamente con
la migración (`20260724100004_schema_pacientes.sql:89-95`), sin desfasaje esta vez.

**Pero el backend real todavía no está conectado.** Existe una Edge Function
(`supabase/functions/pacientes-documentos/index.ts`, CRUD completo sobre `pacientes.documentos`) desde
`C-03`, pero **cero referencias en el frontend** (`rg` sobre `frontend/src` no encuentra ninguna
llamada a `pacientes-documentos` ni a `pacientes.documentos`) y **no existe** ningún
`SupabaseDocumentoRepository.ts` en el árbol del repo — confirmado con `find`, coincide con lo que
`CHANGES.md` línea 186-187 ya documenta: *"pendiente de que frontend lo conecte a Storage real"*. Hoy
Pacientes → Documentos corre 100% sobre `mockDocumentoRepository` (un `Map` en memoria, ni siquiera
persistido en `localStorage`, sin `SCHEMA_VERSION`). **Este change es, entonces, puramente frontend**:
el modelo mock + el componente compartido + la pantalla de Pacientes. No hay swap de repository real
en este propose — ese es un change de integración aparte, todavía sin proponer.

**Alcance explícito: solo el punto 1 del feedback.** Enzo confirmó "vamos con 1" — este propose cubre
únicamente la cardinalidad múltiple por tipo de documento. El punto 2 del mismo documento de feedback
(mover el checklist de nivel paciente a nivel actividad/domicilio — multiplica el alcance en
actividades × ítems × versiones) queda **explícitamente fuera**. Se menciona como nota de scope futuro
en "Lo que este change explícitamente NO hace", sin diseñarlo acá.

## What Changes

- **`DocumentoAdjunto` pasa de objeto único por `itemId` a colección por `itemId`** (`shared/types/
  documento.ts`): gana un `id` propio (para poder identificar y quitar un documento puntual dentro de
  la colección, no todos los del mismo tipo) y un campo de vigencia — ver Checkpoint (b) de
  `design.md` para la decisión exacta de qué campo.
- **`DocumentoRepository.remove()` cambia de firma**: hoy toma `(entidad, entidadId, itemId)` y borra
  "el" documento de ese ítem (hay uno solo). Con colección, tiene que apuntar a un documento puntual —
  pasa a `(entidad, entidadId, documentoId)`. Es un cambio de contrato que toca la única implementación
  real hoy existente (`mockDocumentoRepository`) y, en el futuro, a cualquier
  `SupabaseDocumentoRepository` que se escriba.
- **`DocumentChecklist.tsx` deja de reemplazar y pasa a acumular**: cada ítem del checklist muestra 0,
  1 o N documentos adjuntos (en vez de a lo sumo 1), cada uno con su propio "Quitar", y el botón
  "Reemplazar" se convierte en "Agregar otro" (nunca sobrescribe). El progreso (`X de Y cargados`)
  sigue siendo a nivel de ítem — "cargado" pasa a significar "al menos un documento", no cambia esa
  semántica.
- **`useDocumentChecklist.ts`**: `upload` deja de filtrar por `itemId` antes de agregar (ahí vivía el
  reemplazo); `remove` pasa a filtrar por el `id` del documento, no por `itemId`.
- **`mockDocumentoRepository.ts`**: implementa la nueva semántica de acumulación + `remove` por `id`.
- **Ningún cambio de base de datos requerido para la cardinalidad** — el schema real ya lo permite (ver
  Why). Si se confirma un campo de vigencia explícito (Checkpoint (b) de `design.md`) que deba
  persistirse el día que exista un `SupabaseDocumentoRepository` real, ese campo se agrega ahí,
  **documentado como guía en `design.md` pero sin escribirse ni aplicarse en este propose** — no hay
  ningún repository real conectado hoy que lo necesite.
- **Impacto estructural sobre Vehículos/Conductores/Facturas, sin cambio de comportamiento pedido para
  ellos.** Como el tipo y el componente son compartidos, los tres dominios restantes también quedan
  *técnicamente* capaces de tener N documentos por ítem apenas este change se mergea — pero ninguno de
  los tres specs existentes (`vehiculo-documentos`, `conductor-documentos`, `factura-documentacion`)
  afirma cardinalidad 1:1 como requisito, así que no hay contradicción que resolver ahí. Este propose
  no le pide a esos tres dominios ningún comportamiento nuevo — ver "Lo que este change explícitamente
  NO hace".

### Lo que este change explícitamente NO hace

- **No implementa el punto 2 del feedback** (checklist por actividad/domicilio en vez de por
  paciente) — cambio de alcance mucho mayor (actividades × ítems × versiones), sin proponer todavía.
  Queda anotado acá como nota de scope futuro, no diseñado.
- **No conecta un `SupabaseDocumentoRepository` real.** Sigue sobre `mockDocumentoRepository`. El día
  que exista ese change de integración, hereda la forma nueva de `DocumentoAdjunto`/`DocumentoRepository`
  que este propose deja escrita.
- **No le pide comportamiento nuevo a Vehículos, Conductores ni Facturas.** El impacto ahí es solo de
  tipo (la colección queda técnicamente disponible), no de negocio — ninguna pantalla de esos tres
  dominios cambia su UI en este change.
- **No define quién administra el catálogo `obra_social.tipos_documento`** — pregunta abierta ya
  existente en `knowledge-base/10_preguntas_abiertas.md` (línea 129), sin relación directa con la
  cardinalidad por documento, no se resuelve acá.
- **No decide un tope máximo de documentos por tipo sin antes confirmar con la clienta** — ver
  Checkpoint (a) de `design.md`. La recomendación de este propose es "sin límite" (colección real),
  pero es un checkpoint de aprobación explícito, no una decisión unilateral.

## Capabilities

### Modified Capabilities
- `paciente-documentos` (`openspec/specs/paciente-documentos/spec.md`, capability ya existente):
  el requisito "reutilizar `DocumentChecklist`/`DocumentoRepository`" sigue vigente sin cambios; se
  agrega el requisito nuevo de cardinalidad múltiple y no-sobrescritura por tipo de documento.

### Capabilities compartidas afectadas a nivel de tipo (sin requisito nuevo)
- `vehiculo-documentos`, `conductor-documentos`, `factura-documentacion`: consumen el mismo
  `ChecklistItem`/`DocumentoAdjunto`/`DocumentChecklist`. Ninguno de los tres specs declara
  cardinalidad como requisito propio, así que no reciben delta spec en este change — quedan
  técnicamente habilitados para colección, sin pedido de negocio que lo active todavía.

## Impact

**Código a modificar** (todo dentro de `frontend/src/shared/` y `frontend/src/features/pacientes/`,
nada de backend real porque no hay backend real conectado):
- `frontend/src/shared/types/documento.ts` — `DocumentoAdjunto` gana `id` + campo de vigencia (ver
  Checkpoint (b) de `design.md`).
- `frontend/src/shared/lib/documentos/DocumentoRepository.ts` — firma de `remove()`.
- `frontend/src/shared/lib/documentos/mockDocumentoRepository.ts` — semántica de acumulación.
- `frontend/src/shared/lib/documentos/useDocumentChecklist.ts` — `upload`/`remove` al nuevo contrato.
- `frontend/src/shared/components/DocumentChecklist.tsx` — render de colección por ítem, botón
  "Agregar otro" en vez de "Reemplazar", "Quitar" por documento puntual.
- Tests existentes de los cuatro dominios que montan `DocumentChecklist`
  (`PacienteDocumentos.test.tsx` y análogos de Vehículos/Conductores/Facturas) — ajuste mecánico al
  nuevo contrato, sin cambio de comportamiento esperado fuera de Pacientes.

**Sin impacto**
- `PacienteDocumentos.tsx` / `PacienteDocumentosChecklist.tsx` — no cambian de forma, siguen pasando
  `items`/`documentos`/`upload`/`remove` tal cual al componente compartido.
- `ObraSocialRepository`, `ChecklistEditor.tsx`, `obra_social.tipos_documento` — sin cambios, el
  catálogo de tipos sigue siendo 1 fila por tipo, lo que cambia es cuántos documentos puede tener el
  paciente **por** tipo.
- `pacientes.documentos` (tabla real) — sin migración en este propose (ver Why).
- `supabase/functions/pacientes-documentos/index.ts` — sin cambios, sigue sin consumidor en el
  frontend.

**Base de datos**
- **Ninguna migración se escribe ni se aplica en este propose** (regla dura del proyecto para tareas
  propose-only, y además no hace falta: ver hallazgo de schema en Why). Si en el futuro un change de
  integración conecta `SupabaseDocumentoRepository` y se confirma un campo de vigencia persistido, ese
  change escribe una migración aditiva de una sola columna sobre `pacientes.documentos` — la forma
  exacta queda documentada como guía no vinculante en `design.md`.

**Dependencias**
- Requiere (ya cumplido): `C-03-gestion-documental-core` (el tipo/componente/mock compartidos existen).
- No depende de ningún change de integración pendiente — es autocontenido dentro del mock.
- Es un prerequisito conceptual (no técnico-bloqueante) de una futura integración real de Documentos de
  Pacientes: si esa integración se propone antes de que este change se aplique, hereda la forma vieja
  (1:1) y tendría que re-abrir el mismo problema.

**Riesgo y rollback**
- Riesgo principal: el cambio de firma de `DocumentoRepository.remove()` es un breaking change de
  contrato — pero su único implementador real hoy es el mock, así que el blast radius es interno al
  propio change (no hay un `SupabaseDocumentoRepository` externo que se rompa).
- Riesgo de UX: "Agregar otro" en vez de "Reemplazar" cambia un flujo que la clienta ya vio en el
  modelo — se lista explícitamente como parte de lo que ella pidió corregir, no una sorpresa.
- Riesgo de gobernanza: ver Checkpoint (d) de `design.md` — el nivel de gobernanza de este change no
  mapea limpio a una fila de `CHANGES.md` (no es uno de los 11 changes C-01..C-11, es un refinamiento
  posterior sobre `C-03`/`C-05`), y `C-05` (Pacientes, dueño del dominio que más visiblemente cambia
  acá) es **CRÍTICO** en la tabla de gobernanza, no ALTO — se confirma con Enzo antes de aplicar.
- Rollback: revertir los 5 archivos de código a su forma anterior; ningún dato real se pierde porque no
  hay backend real conectado (el mock es memoria de sesión, se resetea solo).
