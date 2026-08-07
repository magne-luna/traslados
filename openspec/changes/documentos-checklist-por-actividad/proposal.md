## Why

Feedback real de la clienta (Andrea Pastor), "Ronda 2" — **punto 2 de 7** de la síntesis transcripta
de notas de voz de WhatsApp (`docs/cambios/cambios2-requerimientos.pdf`, 2026-08-06). Resumen
verbatim del punto:

> **Hallazgo**: en la carga del paciente se cargan varios domicilios/actividades — escuela,
> terapia(s), club, etc. El cliente aclara que cada actividad tiene su propio juego de documentación
> (su propio checklist de ~10 ítems).
>
> **Cambio**: el checklist de documentación no es único por paciente. Se repite por cada
> actividad/domicilio que tenga el paciente. Si el paciente tiene varias terapias, habrá varios
> bloques de ~10 ítems — "más de 10 ítems", dicen explícitamente.
>
> Combinado con el punto 1: la cantidad total de documentos es (actividades del paciente) × (ítems
> del checklist) × (versiones por renovación). El modelo de datos debe soportar esta multiplicidad en
> tres niveles.

**Alcance explícito: solo el punto 2.** El punto 1 ya está aplicado y archivado
(`2026-08-06-pacientes-documentos-multiples`: N documentos por ítem, con vigencia); el punto 4
también (`2026-08-06-documentos-previsualizacion`). El **punto 3** del mismo PDF (vincular la
actividad seleccionada con su documentación + exportar/transferir a otro domicilio) queda
**explícitamente fuera**: el cliente prometió un video mostrando ese flujo y todavía no llegó — no se
diseña una funcionalidad sobre una descripción incompleta.

### Verificado contra el código, no asumido

**1. No existe ninguna entidad "actividad" en el modelo — lo más cercano es `Direccion`.**
`frontend/src/shared/types/paciente.ts` modela `Direccion { id, tipo, calle, localidad, descripcion?,
dias?, horario? }` con `TipoDireccion = 'domicilio' | 'escuela' | 'escuela-especial' | 'terapia' |
'cet' | 'otro'` — una unión cerrada que ya cubre literalmente los ejemplos que da la clienta
(escuela, terapia, CET), salvo "club" (que caería en `otro`). El campo `descripcion` existe
justamente para distinguir dos direcciones del mismo `tipo` (comentario del propio tipo: *"dos
`terapia`: 'Kinesióloga' vs 'Fonoaudióloga'"*) — o sea, el modelo **ya soporta N actividades del
mismo tipo diferenciables**, que es la parte más difícil del pedido. `grep` de `actividad` sobre
`frontend/src/features/pacientes/` y `frontend/src/shared/types/` no devuelve ninguna entidad con ese
nombre. **Ver Checkpoint (a) de `design.md`.**

**2. El checklist de hoy se ancla al paciente entero, en un solo punto.**
`PacienteDetail.tsx:216-222` monta **una** `<PacienteDocumentos pacienteId={paciente.id} …>` dentro de
una `Section` "Checklist documental", hermana de la `Section` "Direcciones" que monta
`DireccionesEditor`. Las dos secciones hoy **no se conocen entre sí**. El wiring baja
`pacienteId` → `PacienteDocumentosChecklist` → `useDocumentChecklist('paciente', pacienteId, …)` →
`repository.listByEntity('paciente', pacienteId)`. La única clave de agrupación del dato es
`(entidad, entidadId)`; no hay ningún nivel intermedio.

**3. El contrato documental es compartido por CUATRO dominios y ya se tocó dos veces este mes.**
`shared/types/documento.ts` (`EntidadDocumental = 'paciente' | 'vehiculo' | 'conductor' | 'factura'`)
declara en su cabecera: *"el mismo checklist/documento se reusa… solo cambia la entidad y la lista de
items, **nunca la forma del dato**"*. `DocumentoRepository` ya pasó de 3 a 4 métodos
(`resolverPrevisualizacion`, por `documentos-previsualizacion`) y `DocumentoAdjunto` ya ganó `id`,
`vigenciaDesde?` y `tipoMime?`. **Vehículos, Conductores y Facturas no tienen "actividades"
repetibles** — un vehículo no tiene escuela ni terapia. Meter la dimensión "actividad" en el contrato
compartido sin cuidado le impone a 3 de 4 dominios un concepto que no usan. **Ver Checkpoint (b) de
`design.md`.**

**4. La tabla real NO soporta esta dimensión — a diferencia del punto 1.**
`pacientes.documentos` (`20260724100004_schema_pacientes.sql:89-95`) es
`(id, paciente_id, id_tipo_documento, archivo_url, created_at)`: **ninguna columna de dirección o
actividad**. Para el punto 1 la respuesta fue "la base ya lo permite, cero migración"; acá es lo
contrario — el día que exista integración real hace falta una columna nueva
(`direccion_id UUID NULL REFERENCES pacientes.direcciones(id)`) y su decisión de `ON DELETE`.
Precedente directo de que esa FK es viable y ya se usa: `facturacion.facturas.domicilio_id UUID
REFERENCES pacientes.direcciones(id)` (`20260730100000_schema_factura_gaps.sql:29`). **Ninguna
migración se escribe ni se aplica en este propose** (tarea propose-only) — queda como guía en
`design.md`.

**5. Sigue sin haber backend documental conectado.** No existe `SupabaseDocumentoRepository.ts` en el
árbol (confirmado por glob), y `openspec/changes/integracion-documentos/` está **propuesto pero no
aplicado**. Pacientes → Documentos corre 100 % sobre `mockDocumentoRepository` (dos `Map` en memoria
de sesión, sin `localStorage`, sin `SCHEMA_VERSION`). **Este change es puramente frontend + mock**,
igual que sus dos hermanos. Riesgo de coordinación real, no hipotético: `integracion-documentos`
todavía no escrito (~1250-1450 líneas estimadas) tendría que heredar la forma que salga de acá — es
la tercera vez consecutiva que el contrato compartido se mueve por debajo de ese change.

## What Changes

- **El checklist documental del paciente deja de ser uno y pasa a ser uno por actividad.** La pantalla
  Pacientes → "Checklist documental" pasa de un bloque único a N bloques, uno por cada actividad del
  paciente, cada uno con su propio juego de ~10 ítems (los de la obra social) y su propio progreso.
- **Se define qué es una "actividad"** — hoy no existe como entidad. La recomendación de este propose
  es reusar `Direccion` (que ya modela escuela/terapia/CET con `descripcion` para diferenciar dos del
  mismo tipo), sin entidad nueva. **Checkpoint (a), sin veredicto.**
- **Se define dónde vive la dimensión "actividad"**: si en el contrato compartido
  (`DocumentoAdjunto`/`DocumentoRepository` ganan una agrupación opcional), o por composición en la
  pantalla de Pacientes sin tocar el contrato. **Checkpoint (b), sin veredicto** — es la decisión de
  arquitectura central de este change y la que define si Vehículos/Conductores/Facturas se enteran o
  no.
- **Se define qué pasa con la documentación que hoy cuelga del paciente entero** (sin actividad):
  bloque "general" que sobrevive, o asignación forzada a una actividad. **Checkpoint (c).**
- **Se define si el checklist por actividad es siempre el mismo** (el de la obra social, replicado) o
  puede variar por tipo de actividad. **Checkpoint (d).**
- **Se define qué pasa al quitar o editar una actividad que ya tiene documentación cargada** — hoy
  `DireccionesEditor` permite "Quitar" una dirección sin ninguna consecuencia; con documentos colgando
  de ella deja de ser una operación inocua. **Checkpoint (e).**
- **Se define cómo se calcula el progreso** ("X de Y cargados"): por actividad, global, o ambos.
  **Checkpoint (f).**
- **Guía de migración futura documentada, sin escribirla ni aplicarla**: `pacientes.documentos`
  necesitará una columna de actividad el día que exista `SupabaseDocumentoRepository`.

### Lo que este change explícitamente NO hace

- **No implementa el punto 3 del feedback** (vincular la actividad seleccionada con su documentación
  al facturar/operar, y exportar/transferir documentación a otro domicilio). El cliente prometió un
  video de ese flujo que todavía no llegó — no se diseña sobre una descripción incompleta. Este change
  se limita a la **multiplicidad** del checklist por actividad, no a cómo se consume esa multiplicidad
  desde otros módulos.
- **No conecta backend real ni escribe migraciones.** Sigue sobre `mockDocumentoRepository`.
- **No le agrega comportamiento a Vehículos, Conductores ni Facturas.** Ninguno de los tres tiene
  actividades repetibles; el objetivo explícito del Checkpoint (b) es que ninguna de sus pantallas
  cambie.
- **No crea una pantalla nueva ni una ruta nueva.** Todo ocurre dentro de la `Section` "Checklist
  documental" ya existente de `PacienteDetail.tsx`.
- **No decide quién administra `obra_social.tipos_documento`** (pregunta abierta preexistente,
  `10_preguntas_abiertas.md:129`).
- **No resuelve unilateralmente ninguno de los siete checkpoints.** Todos quedan abiertos en
  `design.md` con su trade-off escrito y bloqueados en `tasks.md` §0.

## Capabilities

### Modified Capabilities

- `paciente-documentos` (`openspec/specs/paciente-documentos/spec.md`, capability existente): los
  requisitos actuales (reutilizar `DocumentChecklist`, derivar ítems de la obra social, cardinalidad
  múltiple sin sobrescritura, previsualización) siguen vigentes **sin cambios**; se agrega el
  requisito nuevo de que el checklist se instancia **por actividad del paciente**, no una sola vez por
  paciente.

### Capabilities posiblemente modificadas (dependen de un checkpoint)

- `paciente-direcciones` (`openspec/specs/paciente-direcciones/spec.md`): solo si el **Checkpoint (e)**
  se resuelve pidiendo protección/advertencia al quitar una dirección con documentación cargada. Si se
  resuelve por "sin protección", esta capability no recibe delta.

### Capabilities compartidas afectadas a nivel de tipo (sin requisito nuevo)

- `vehiculo-documentos`, `conductor-documentos`, `factura-documentacion`: consumen el mismo
  `ChecklistItem`/`DocumentoAdjunto`/`DocumentChecklist`. Si el **Checkpoint (b)** se resuelve por una
  agrupación **opcional** en el contrato compartido, los tres quedan técnicamente capaces sin pedido
  de negocio que lo active — sin delta spec, igual que en `pacientes-documentos-multiples`.

### New Capabilities

Ninguna.

## Impact

**Código a modificar** (todo frontend, nada de backend real porque no hay backend documental conectado
— el alcance exacto depende de los Checkpoints (a) y (b)):

- `frontend/src/features/pacientes/PacienteDocumentos.tsx` — hoy resuelve la obra social y monta **un**
  checklist; pasaría a resolver también las actividades del paciente y montar N.
- `frontend/src/features/pacientes/PacienteDocumentosChecklist.tsx` — wrapper delgado que hoy llama a
  `useDocumentChecklist('paciente', pacienteId, …)`; pasaría a recibir la actividad.
- `frontend/src/features/pacientes/PacienteDetail.tsx` — pasa las direcciones/actividades del paciente
  a la `Section` "Checklist documental", que hoy solo recibe `paciente.id`.
- `frontend/src/shared/types/documento.ts` — **solo si Checkpoint (b) = agrupación en el contrato**.
- `frontend/src/shared/lib/documentos/DocumentoRepository.ts` + `mockDocumentoRepository.ts` +
  `useDocumentChecklist.ts` — **ídem**.
- `frontend/src/shared/components/DocumentChecklist.tsx` — **solo si Checkpoint (b) = agrupación dentro
  del componente compartido**; la recomendación de este propose es que este archivo **no cambie**.
- `frontend/src/features/pacientes/DireccionesEditor.tsx` — **solo si Checkpoint (e)** pide advertencia
  al quitar una dirección con documentos.
- Tests: `PacienteDocumentos.test.tsx` y, si el contrato cambia, los de los otros tres dominios
  (ajuste mecánico, sin comportamiento nuevo).

**Sin impacto esperado**

- `ObraSocialRepository` / `ChecklistEditor.tsx` / `obra_social.tipos_documento` — el catálogo de tipos
  no cambia; lo que cambia es **cuántas veces** se instancia el checklist, no su contenido (salvo que
  el Checkpoint (d) se resuelva por "checklist variable por tipo de actividad", que sí lo tocaría).
- `pacientes.documentos` (tabla real) y `supabase/functions/pacientes-documentos/index.ts` — sin
  cambios en este propose; ver "Base de datos".
- Hojas de Ruta (`pacientes.recorridos`) — este change no toca recorridos ni el tramo ida/vuelta.

**Base de datos**

- **Ninguna migración se escribe ni se aplica en este propose** (regla dura del proyecto para tareas
  propose-only). A diferencia del punto 1, acá la base **no** soporta la dimensión nueva: el día que
  exista `SupabaseDocumentoRepository`, `pacientes.documentos` va a necesitar una columna de actividad
  (`direccion_id UUID NULL REFERENCES pacientes.direcciones(id)`) y una decisión explícita de
  `ON DELETE`. Forma ilustrativa y trade-offs en `design.md` — no vinculante.
- RLS: no aplica en este propose (no se crea ninguna tabla). Cuando se escriba esa columna,
  `pacientes.documentos` ya tiene RLS habilitada con `Read/Write documentos` gateadas por
  `modulos.tiene_permiso('pacientes', …)` — una columna aditiva no requiere policies nuevas, mismo
  criterio que `20260805140000_direcciones_geocoding.sql`.

**Dependencias**

- Requiere (ya cumplido): `C-03-gestion-documental-core` (tipo/componente/mock compartidos),
  `pacientes-documentos-multiples` (N documentos por ítem — este change agrega la **tercera**
  dimensión sobre esa segunda), `documentos-previsualizacion` (4.º método del repository).
- **Coordinación con `integracion-documentos`** (propuesto, **no aplicado**, 1/55 tasks): si el
  Checkpoint (b) se resuelve tocando el contrato compartido, ese change hereda la forma nueva y su
  `design.md` vuelve a quedar desactualizado — sería la tercera corrección consecutiva. Hay que
  anotarlo ahí explícitamente, como ya se hizo con `documentos-previsualizacion`.
- Bloquea conceptualmente (no técnicamente) al futuro change del **punto 3**: no tiene sentido
  "vincular la actividad con su documentación" antes de que la documentación tenga actividad.

**Riesgo y rollback**

- **Riesgo principal (arquitectura)**: el Checkpoint (b) puede terminar imponiéndole a tres dominios
  que no tienen actividades un concepto que no usan. Mitigación: la agrupación se diseña **opcional** y
  la UI de agrupación vive en Pacientes, no en el componente compartido.
- **Riesgo de datos (futuro)**: los documentos ya cargados no tienen actividad. Hoy no hay datos reales
  (mock de sesión, y `pacientes.documentos` con 0 filas según `integracion-documentos/design.md:38`),
  pero el diseño tiene que dejar definido el caso "documento sin actividad" — Checkpoint (c).
- **Riesgo de UX**: multiplicar ~10 ítems por N actividades hace la pantalla mucho más larga (la
  clienta lo anticipa: *"más de 10 ítems"*). El diseño debe resolver colapsado/agrupación visual
  reusando el design system existente (`Section`, `Chip`, `ProgressBar`), nunca markup ad-hoc.
- **Riesgo de gobernanza**: dominio Pacientes (salud, menores de edad) — mismo criterio CRÍTICO que sus
  dos hermanos. Checkpoint (g).
- **Rollback**: revertir los archivos de frontend a su forma anterior. Ningún dato real se pierde: el
  mock es memoria de sesión y no hay backend documental conectado. Si el Checkpoint (b) tocó el
  contrato compartido, el revert incluye los cuatro dominios (ajuste mecánico), igual que
  `pacientes-documentos-multiples`.
