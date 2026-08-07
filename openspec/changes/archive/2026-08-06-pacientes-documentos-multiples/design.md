## Context

**Arquitectura compartida (verificada leyendo los 5 archivos, no asumida).**
`frontend/src/shared/types/documento.ts` es el contrato de tipos para las cuatro entidades
documentales del proyecto (`EntidadDocumental = 'paciente' | 'vehiculo' | 'conductor' | 'factura'`),
con el principio escrito en su propio comentario de cabecera: *"el mismo checklist/documento se
reusa... solo cambia la entidad y la lista de items, nunca la forma del dato"*. Hoy:

```ts
export interface DocumentoAdjunto {
  itemId: string;
  nombreArchivo: string;
  subidoEn: string; // ISO date
}
```

Sin `id` propio — la única clave es `itemId`, y por eso solo puede existir **un** `DocumentoAdjunto`
por `itemId` en la práctica: no hay forma de distinguir dos documentos del mismo ítem entre sí.

Tres piezas del código imponen la restricción 1:1, ninguna documentada como decisión de diseño:

1. `DocumentChecklist.tsx:53` — `const doc = documentos.find((d) => d.itemId === item.id);` (`find`
   singular, siempre devuelve a lo sumo un resultado).
2. `mockDocumentoRepository.ts` `upload()` — filtra explícitamente cualquier documento existente con el
   mismo `itemId` antes de agregar el nuevo (reemplazo, no acumulación).
3. `useDocumentChecklist.ts` `upload()` — mismo patrón de filtro al actualizar el estado local:
   `setDocumentos((prev) => [...prev.filter((d) => d.itemId !== itemId), doc])`.

**El modelo de datos del proyecto ya modela esto como colección.**
`knowledge-base/04_modelo_de_datos.md` §Paciente: *"N documentos"* — relación uno-a-muchos, no 1:1. El
backend real (`pacientes.documentos`, migración `20260724100004_schema_pacientes.sql:89-95`, aplicada
y pusheada desde `C-03`, 2026-07-28) tampoco tiene restricción de cardinalidad:

```sql
CREATE TABLE pacientes.documentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES pacientes.paciente(id) ON DELETE CASCADE,
    id_tipo_documento UUID NOT NULL REFERENCES obra_social.tipos_documento(id) ON DELETE RESTRICT,
    archivo_url TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Verificado en vivo** (`supabase db query --linked`, no contra la migración a ojo — mismo criterio que
el resto de la serie de integración de este proyecto): las columnas y constraints reales coinciden
exactamente con la migración. `pg_constraint` sobre `pacientes.documentos` solo devuelve la PK (`id`) y
las dos FK (`paciente_id`, `id_tipo_documento`) — **ningún `UNIQUE`** sobre
`(paciente_id, id_tipo_documento)`. La base real ya admite múltiples filas por combinación
paciente+tipo hoy mismo.

**Pero nada del frontend habla con esa tabla.** `rg` sobre `frontend/src` no encuentra ninguna
referencia a `pacientes.documentos` ni a la Edge Function `pacientes-documentos` (que sí existe y tiene
CRUD completo, `supabase/functions/pacientes-documentos/index.ts`, 88 líneas). No existe ningún
`SupabaseDocumentoRepository.ts` en el árbol del repo — coincide con `CHANGES.md` líneas 186-187:
*"el componente de UI reutilizable (`DocumentChecklist`) ya existe como mock (FE-1), pendiente de que
frontend lo conecte a Storage real"*. Pacientes → Documentos corre 100% sobre
`mockDocumentoRepository` (`Map` en memoria de sesión, sin `localStorage`, sin `SCHEMA_VERSION` —
distinto de los demás mocks del proyecto que sí persisten en `localStorage` con versión).

**Consecuencia directa para el alcance:** este change no swapea ningún repository real (no hay uno que
swapear) — es un change **puramente de frontend mock + tipo + componente compartido**. La pregunta "¿la
base soporta esto?" ya está contestada (sí, sin migración), pero es una respuesta que **importa para el
día que exista integración real**, no para poder aplicar este propose hoy.

**Precedente de vigencia ya existente en el proyecto** (`shared/types/presupuesto.ts`):

```ts
export interface Autorizacion {
  // ...
  /** independiente de fechaRespuesta: soporta la carga retroactiva (RN-PA-02)... */
  vigenciaDesde?: string;
  // ...
}
```

Un único campo opcional `vigenciaDesde` (ISO date), **sin** `vigenciaHasta` — el proyecto nunca modeló
un rango explícito de vigencia en ningún lado. Nota importante: ese mismo archivo dice explícitamente
por qué `Presupuesto`/`Autorizacion` usan un adjunto único (`ArchivoAdjunto`) y **no** reutilizan
`DocumentChecklist`/`EntidadDocumental` — *"el docx modela un solo 'Archivo'... NO una colección
multi-documento"*. Es el precedente inverso al que este change necesita (confirma que la separación
1-archivo vs. N-archivos ya es un eje de diseño reconocido en el proyecto), pero el nombre de campo
`vigenciaDesde` sí es un precedente de naming directamente reusable.

**Gobernanza — no mapea limpio a una fila de `CHANGES.md`.** Este change no es uno de los 11
`C-01`..`C-11` (esos ya están todos propuestos/archivados o en curso); es un refinamiento posterior
sobre trabajo ya archivado (`C-03-gestion-documental-core`, tipo/componente compartidos) y en curso
(`C-05-pacientes-fichas-clinicas`, dueño de la pantalla que más visiblemente cambia). La tabla de
`CHANGES.md` dice:

| Change | Governance |
|---|---|
| `C-03` gestion-documental-core (dueño del tipo/componente compartido que este change modifica) | **ALTO** |
| `C-05` pacientes-fichas-clinicas (dueño de la pantalla Pacientes → Documentos) | **CRÍTICO** |

Y hay precedente directo de tratar cambios de **frontend puro** sobre pantallas de Pacientes como
CRÍTICO: los cinco changes `gateo-*` (2026-07-29/30), que solo tocaban gateo de UI (deshabilitar
botones según permiso, sin RLS nueva ni migración), están registrados con *"Governance: CRÍTICO en los
5"* — el criterio no fue "¿toca la tabla real?" sino "¿toca una pantalla del dominio Pacientes con
datos de salud?". Este change encaja en ese mismo criterio. **Ver Checkpoint (d).**

---

## Goals / Non-Goals

**Goals**
- Que un mismo ítem del checklist documental de un paciente pueda tener más de un documento adjunto
  simultáneamente, sin que subir uno nuevo borre el anterior.
- Que, dado el ejemplo de la clienta (autorización agosto-julio que renueva agosto-julio del año
  siguiente), ambos documentos convivan visibles y distinguibles — no solo "acumulados sin
  información", sino con algo que permita saber cuál es el vigente y cuál el siguiente.
- Mantener el principio arquitectónico ya establecido: un solo componente/tipo compartido por las
  cuatro entidades, forma del dato única.
- Dejar el contrato (`DocumentoRepository`) listo para que, el día que exista un
  `SupabaseDocumentoRepository`, el swap sea mecánico — mismo criterio que toda la serie de
  integración de este proyecto.

**Non-Goals**
- **No implementa el punto 2 del feedback** (checklist por actividad/domicilio en vez de por
  paciente). Alcance explícitamente distinto y mayor, sin proponer.
- **No conecta backend real.** Sigue sobre `mockDocumentoRepository`.
- **No le agrega comportamiento nuevo a Vehículos, Conductores ni Facturas** — quedan técnicamente
  capaces de colección por el tipo compartido, pero ninguna pantalla de esos tres dominios cambia.
- **No decide quién administra `obra_social.tipos_documento`** (pregunta abierta preexistente,
  `10_preguntas_abiertas.md:129`) — sin relación directa con este change.
- **No escribe ni aplica ninguna migración SQL** — tarea propose-only; ver Checkpoint (c).

---

## Checkpoint (a) — Cardinalidad: ¿sin límite, o un tope (2 o 3)?

**El problema.** El propio documento de feedback deja esto marcado como no confirmado con la clienta:
*"Cardinalidad máxima de documentos por tipo (¿2? ¿3? ¿sin límite?)"*. La clienta mencionó ejemplos
concretos ("2 o hasta 3 presupuestos y 2 RHC"), pero un ejemplo no es lo mismo que un tope confirmado.

| Opción | Qué implica | A favor | En contra |
|---|---|---|---|
| **A. Sin límite** ✅ recomendada por este propose | `DocumentoAdjunto[]` es una colección real, sin `CHECK` ni validación de cantidad máxima en ningún nivel (tipo, componente, ni — el día de mañana — schema) | La propia redacción del feedback ("pasa a ser una colección 1:N") apunta a esto. Un tope fijo (2, 3) habría que re-justificarlo cada vez que cambie la cadencia real de renovación de la clienta (¿y si un año hay que cargar 3 presupuestos por una revisión judicial?). Cero costo de mantenimiento futuro | Ninguno funcional — el único "costo" es que la UI debe poder listar N documentos por ítem en vez de a lo sumo 3, que es un problema ya resuelto por cualquier lista |
| B. Tope fijo (2 o 3) | Se agrega una validación (en el componente y/o en el repository) que rechaza el N+1-ésimo documento de un tipo | Podría simplificar la UI si el diseño visual asumiera "como mucho 2 columnas" | Arbitrario y fragilizado: si la clienta necesita cargar un tercer documento por cualquier motivo operativo no previsto (ej. amparo judicial que exige un respaldo adicional), la aplicación se lo impediría sin ninguna razón de negocio real detrás del número |

**Recomendación de este propose: A (sin límite).** Es la lectura más fiel de "pasa a ser una
colección" en el propio texto del feedback, y evita comprometerse a un número que ni la clienta
confirmó como definitivo. **No es la decisión final** — queda para que Enzo/la clienta lo confirmen en
`tasks.md` §0 antes de `/opsx:apply`.

---

## Checkpoint (b) — Mecanismo de vigencia/período

**El problema.** El feedback pide que, ante dos documentos coexistiendo (ej. presupuesto
agosto-julio actual + presupuesto agosto-julio del año siguiente ya cargado), quede claro cuál es "el
vigente" y cuál "el siguiente". Se evaluaron tres formas, buscando el mínimo mecanismo que resuelva el
pedido sin inventar un concepto paralelo a los que ya existen en el proyecto.

| Opción | Forma | A favor | En contra |
|---|---|---|---|
| A. Solo orden de carga (`subidoEn`, ya existe) | Ningún campo nuevo — "vigente" se deriva como "el de `subidoEn` más reciente" en la UI, sin persistir el concepto | Cero cambio de tipo además del `id` que ya hace falta para la colección | No captura el caso real de la clienta: si alguien carga el documento *viejo* de forma tardía (escaneo atrasado) después de haber cargado ya el nuevo, "más reciente por fecha de carga" da el resultado incorrecto. `subidoEn` es fecha de **carga al sistema**, no fecha de **inicio del período real** — son cosas distintas y el feedback específicamente habla de períodos (agosto-julio), no de cuándo se subió el archivo |
| **B. `vigenciaDesde?: string` opcional por documento** ✅ recomendada por este propose | Un campo nuevo, mismo nombre y misma semántica opcional que el precedente ya existente `Autorizacion.vigenciaDesde` (`presupuesto.ts`) — el usuario puede indicar cuándo arranca el período que ese documento cubre. "Vigente" se deriva como el documento con `vigenciaDesde` más reciente que no sea futuro (fallback a `subidoEn` si no se cargó `vigenciaDesde`); todos los demás se muestran como historial/continuidad, ordenados por esa misma fecha | Resuelve el caso real (período, no fecha de carga); reusa naming y semántica ya validados en este mismo proyecto (no inventa un concepto paralelo); sigue siendo opcional — no bloquea a quien no quiere completarlo, se degrada a la opción A automáticamente | Requiere un campo nuevo en el tipo y un input de fecha nuevo en la UI de carga (pequeño, pero es superficie nueva) |
| C. `vigenciaDesde` + `vigenciaHasta` (rango explícito) | Dos campos, rango completo del período | Modela el período completo tal como lo describe el ejemplo (agosto-julio) | Sin precedente en el proyecto (ni `Autorizacion` ni ningún otro tipo tiene un rango de dos fechas para esto); agrega validación de solapamiento/consistencia de rango que el feedback no pide resolver automáticamente — la clienta solo pidió que ambos documentos **convivan visibles**, no que el sistema calcule vigencia por rango con lógica de solapamiento. Sobre-ingeniería para lo que se pidió |

**Recomendación de este propose: B.** Un solo campo opcional, mismo nombre que el precedente ya
existente en `presupuesto.ts`, sin rango — reusa "el espíritu del patrón" tal como pide el contexto de
este propose, sin duplicar un concepto paralelo. La derivación de "cuál es el vigente" queda como
lógica de presentación (no persistida como un flag `vigente: boolean` aparte, para no tener dos fuentes
de verdad que puedan desincronizarse). **Tampoco es la decisión final** — Checkpoint explícito para
Enzo/la clienta en `tasks.md` §0.

**Forma final propuesta de `DocumentoAdjunto`** (si se confirma B):

```ts
export interface DocumentoAdjunto {
  /** Identifica un documento puntual dentro de la colección del mismo itemId — antes no existía
   * porque solo podía haber uno. Necesario para que remove() apunte a un documento específico. */
  id: string;
  itemId: string;
  nombreArchivo: string;
  subidoEn: string; // ISO date — fecha de carga al sistema, sin cambios de semántica
  /** ISO date opcional — inicio del período que cubre este documento (mismo nombre y semántica que
   * Autorizacion.vigenciaDesde en presupuesto.ts). Si no se completa, "vigente" se deriva de subidoEn. */
  vigenciaDesde?: string;
}
```

---

## Checkpoint (c) — ¿Hace falta migración de base de datos?

**Respuesta corta: no para este propose.** Dos partes distintas:

1. **Cardinalidad múltiple**: la tabla real `pacientes.documentos` **ya la soporta** — verificado en
   vivo, sin `UNIQUE` sobre `(paciente_id, id_tipo_documento)` (ver Context). Cero migración necesaria
   para esta parte, sin importar qué se decida en (a).
2. **Campo de vigencia** (si se confirma Checkpoint (b) opción B): la tabla real **no tiene** ninguna
   columna de vigencia hoy. Pero como **no hay ningún repository real conectado** (todo corre sobre el
   mock, ver Context), no hace falta escribir esa migración para que este change funcione — el campo
   nuevo vive únicamente en el tipo/mock del frontend.

**Guía no vinculante para cuando exista integración real** (no se escribe ni se aplica en este
propose, y la decisión final de nombre/forma queda para ese change):

```sql
-- Ilustrativo — NO aplicar en este propose. A escribir en el futuro change de integración
-- de Documentos de Pacientes, si Checkpoint (b) se resolvió por la opción B.
ALTER TABLE pacientes.documentos
  ADD COLUMN vigencia_desde DATE;
```

Aditivo puro (columna nullable sobre tabla existente), consistente con el criterio "expand aditivo,
nunca se rompe una fila existente" que sigue toda la serie de integración de este proyecto.

---

## Checkpoint (d) — Nivel de gobernanza de este change

**El problema.** Este change no es uno de los `C-01`..`C-11` de `CHANGES.md`, así que no hereda un
nivel de gobernanza de una fila de esa tabla de forma directa. Dos changes relacionados tienen niveles
distintos: `C-03` (dueño del tipo/componente compartido que se modifica) es **ALTO**; `C-05` (dueño de
la pantalla Pacientes → Documentos, dominio con datos de salud de personas con discapacidad, incluidos
menores de edad) es **CRÍTICO**. Además, los cinco changes `gateo-*` — frontend puro sobre pantallas de
Pacientes, sin tocar RLS ni escribir migración — ya se trataron como CRÍTICO por tocar una pantalla del
dominio Pacientes, no por la profundidad técnica del cambio.

| Opción | Justificación |
|---|---|
| ALTO | El cambio técnico real es acotado: un tipo, un componente compartido, un mock — nada de RLS, nada de auth, nada de datos reales en juego (no hay backend conectado) |
| **CRÍTICO** ✅ recomendada por este propose | Sigue el precedente de `gateo-*`: el criterio de este proyecto para CRÍTICO no fue "¿es técnicamente complejo?" sino "¿la pantalla que cambia pertenece al dominio Pacientes (salud, menores de edad)?". Esta pantalla sí. Además, `C-05` (el dueño real de esa pantalla) es CRÍTICO, no ALTO |

**Recomendación de este propose: CRÍTICO**, por precedente directo (`gateo-*`) y por ser `C-05` el
dominio dueño de la pantalla — más estricto que la suposición inicial de "probablemente ALTO" con la
que arrancó este propose. **Queda para que Enzo lo confirme o lo baje a ALTO** en `tasks.md` §0 — si se
confirma CRÍTICO, aplica el mismo mecanismo que el resto de la serie: aprobación humana explícita antes
de que `/opsx:apply` escriba una sola línea, y verificación manual de cierre con cuenta real.

---

## Decisions

### D1 — `DocumentoRepository.remove()` cambia de firma: `itemId` → `documentoId`

```ts
// Antes
remove(entidad: EntidadDocumental, entidadId: string, itemId: string): Promise<void>;

// Después
remove(entidad: EntidadDocumental, entidadId: string, documentoId: string): Promise<void>;
```

Con colección, "quitar el documento de este ítem" deja de tener sentido (¿cuál de los N?) — hace falta
apuntar al documento puntual por su `id` nuevo (Checkpoint (b)). Es un breaking change de contrato,
pero su único implementador real hoy es `mockDocumentoRepository` — no hay ningún
`SupabaseDocumentoRepository` externo que se rompa (ver Context).

### D2 — `DocumentChecklist.tsx`: de "a lo sumo un documento por fila" a "N documentos por fila"

Cada fila de ítem pasa de mostrar un único bloque Subir/Reemplazar/Quitar a mostrar una lista chica de
documentos ya cargados (cada uno con su fecha, su vigencia si tiene, y su propio "Quitar") más un botón
"Agregar otro" que nunca reemplaza. El estado de progreso a nivel ítem (`cargados`/`pendientes`, la
barra de `X de Y`) no cambia de semántica: "cargado" sigue siendo "al menos un documento", 0 documentos
sigue siendo "falta"/"sin cargar". La distinción visual entre el documento vigente y el siguiente
(Checkpoint (b)) se resuelve con una etiqueta o chip adicional sobre el primero de la lista ordenada,
reusando el sistema de `Chip`/`chipColors` ya existente — sin componente nuevo.

### D3 — Sin `SCHEMA_VERSION` en `mockDocumentoRepository` porque no persiste en `localStorage`

A diferencia de otros mocks del proyecto (que si cambian de forma persistida en `localStorage`
necesitan bump de `SCHEMA_VERSION`, regla dura de `openspec/config.yaml`), `mockDocumentoRepository`
usa un `Map` en memoria de sesión — no hay `localStorage` de por medio, así que no hay versión que
migrar ni usuarios con datos viejos en el navegador que se rompan. Confirmado leyendo el archivo
completo: no declara ningún `SCHEMA_VERSION`.

---

## Open Questions

- **Checkpoint (a)** — cardinalidad sin límite (recomendado) vs. tope fijo. Sin confirmar con la
  clienta según el propio documento de feedback.
- **Checkpoint (b)** — `vigenciaDesde` opcional (recomendado) vs. solo orden de carga vs. rango
  explícito. Sin confirmar.
- **Checkpoint (c)** — confirmado que no hace falta migración para este propose; la forma de la
  columna futura (`vigencia_desde DATE`) es solo guía, a re-confirmar cuando exista el change de
  integración real.
- **Checkpoint (d)** — nivel de gobernanza CRÍTICO (recomendado, por precedente `gateo-*` y por ser
  `C-05` CRÍTICO) vs. ALTO. Sin confirmar.
- Relacionado, no bloqueante: `10_preguntas_abiertas.md:129` — quién administra
  `obra_social.tipos_documento` (catálogo compartido por Pacientes/Facturas/Vehículos-Conductores vía
  `ON DELETE RESTRICT`). No lo resuelve este change, pero si algún día se permite borrar/renombrar un
  tipo desde una pantalla de administración, esa pantalla tendría que lidiar con "este tipo tiene N
  documentos cargados de M pacientes", no solo 1 — vale la pena que quien lo resuelva lea este
  propose primero.
- Nota de scope futuro (no diseñada acá): el punto 2 del mismo feedback de la clienta (checklist por
  actividad/domicilio en vez de por paciente) probablemente derive en un change propio, más grande.
  Cuando se proponga, va a tener que decidir si hereda esta misma forma de `DocumentoAdjunto[]` por
  ítem o si necesita agregar otra dimensión (actividad) además de la de tipo — fuera de alcance acá.
