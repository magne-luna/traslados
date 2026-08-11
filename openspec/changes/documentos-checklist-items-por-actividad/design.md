## Context

Motivación en `proposal.md` §Why. Acá solo el estado actual verificado y las restricciones que
condicionan el diseño.

**La composición actual, leída del archivo, no asumida.** `PacienteDocumentos.tsx` (154 líneas)
resuelve **una sola** lista de ítems y la reparte igual a todos los bloques:

```
PacienteDocumentos
├── useEffect → obraSocialRepository.getById(obraSocialId)      ← ÚNICA fuente de ítems (l. 55-63)
│     └── setResolucion({ status: 'listo', items: obraSocial.checklist })
│
├── [total agregado: X de Y]                                     ← ya existe
├── PacienteDocumentosChecklist(General)     items={resolucion.items}   ← l. 127
└── actividades.map(direccion =>
      PacienteDocumentosChecklist(actividad)  items={resolucion.items}) ← l. 144  ⬅ el problema
```

`actividades = obtenerActividadesConChecklist(direcciones)` (l. 84) ya devuelve las `Direccion` no
domicilio. Cada bloque ya está aislado por `agrupacionId={direccion.id}` y ya reporta su progreso.
**Lo único que falta es que `items` sea distinto por bloque.**

**El patrón "checklist configurable relacional" ya existe y está integrado contra Supabase real.**

```sql
obra_social.tipos_documento (id UUID PK, tipo TEXT UNIQUE)          -- catálogo compartido
obra_social.requisitos_os   (id, obra_social_id FK, tipo_documento_id FK, UNIQUE(os, td))
```

`tipos_documento` es compartido por **tres** dominios con `ON DELETE RESTRICT`:
`pacientes.documentos.id_tipo_documento`, `facturacion.documento_factura.id_tipo_documento`, y las
propias `requisitos_os`. La escritura pasa por RPC con get-or-create normalizado
(`20260731120001_obra_social_rpc.sql`, D3 de `integracion-obra-social`, confirmado por la usuaria
2026-07-31). Cualquier tabla de "ítems por tipo de actividad" que **no** reuse este catálogo crea un
segundo universo de nombres de documento — y con él, la posibilidad de que "Autorización" exista dos
veces escrita distinto.

**El enum de tipos de actividad ya existe en los dos lados.** Frontend:
`TipoDireccion = 'domicilio' | 'escuela' | 'escuela-especial' | 'terapia' | 'cet' | 'otro'`
(`shared/types/paciente.ts:20`). Base: enum `pacientes.tipo_direccion`, con cast explícito requerido
(bug ya encontrado y corregido en `20260807000000_crear_paciente_completo_tipo_lugar_cast.sql`). Son
**seis** valores, uno de los cuales (`domicilio`) queda fuera por definición de actividad, y otro
(`otro`) es un cajón de sastre — "club", el ejemplo que dio la clienta, cae ahí. Ver Checkpoint (b).

**Este change ya NO es frontend+mock, a diferencia de sus tres antecesores.**
`integracion-documentos` está archivado (2026-08-07): Pacientes corre contra
`SupabaseDocumentoRepository` real, `pacientes.documentos.direccion_id` existe
(`20260807010000_documentos_direccion_id.sql`, `ON DELETE RESTRICT`). Cualquier configuración nueva
tiene que nacer con **tabla + RLS + trigger de auditoría + repository real**, en la misma migración.
Regla dura del proyecto: nunca una tabla sin RLS en el mismo cambio.

**La restricción que domina todo el diseño: la regla de negocio no está confirmada.** Ver
`proposal.md` §Why. El corolario de diseño es concreto y no negociable: **el sistema debe comportarse
exactamente como hoy mientras nadie configure ítems por tipo de actividad**. La configuración vacía no
es un estado de error ni un estado "a completar" — es el default documentado.

---

## Goals / Non-Goals

**Goals**

- Que cada bloque de actividad muestre `ítems de la obra social` **∪** `ítems del tipo de esa
  actividad`, en una sola lista, aditiva.
- Que el bloque "General" siga mostrando **solo** los ítems de la obra social.
- Que la lista por tipo de actividad sea **configuración real** (tabla + RLS + pantalla), nunca una
  constante en el código.
- Que el default (configuración vacía) reproduzca **bit a bit** el comportamiento actual.
- Que la combinación de listas viva en una **función pura y única**, testeable sin React y sin
  repository — mismo criterio ya escrito en `actividadDocumental.ts`.
- Que la discrepancia "regla no confirmada" quede visible en KB, `CHANGES.md` y pantalla.

**Non-Goals (de diseño, además de los de `proposal.md`)**

- No se toca `DocumentChecklist.tsx`. Recibe `items` y los pinta; de dónde salieron no es asunto suyo.
- No se toca el contrato documental compartido (`ChecklistItem`, `DocumentoAdjunto`,
  `DocumentoRepository`). Este change es sobre **qué se pide**, no sobre **cómo se guarda lo cargado**.
- No se introduce un concepto de "ítem obligatorio por actividad pero opcional en general" ni ninguna
  otra semántica nueva sobre `ChecklistItem.requerido`.
- No se resuelve el orden global de la lista combinada más allá de lo que decida el Checkpoint (c) —
  RN-FA-08 exige respetar el orden de la obra social, y eso se preserva.

---

## Checkpoint (0) — ⚠️ BLOQUEANTE: la regla de negocio no está confirmada

**El problema.** Todo este change existe por una hipótesis de la usuaria (Delfina), no por feedback de
la clienta. Textual de la conversación: *"yo creería que cada actividad define los suyos… conviven, es
un complemento"*. Los tres refinamientos anteriores de este mismo dominio fueron feedback transcripto
de Andrea Pastor; **este no**.

El change anterior (`documentos-checklist-por-actividad`) ya dejó esto anotado en su Checkpoint (d):
el veredicto fue *"asumimos que son los mismos ítems… ⚠️ sin confirmar con la clienta todavía (la
usuaria sospecha que en realidad varían)"*. Este propose es literalmente el "si varían" de esa nota,
llegando **antes** de la confirmación.

| Opción | Qué implica |
|---|---|
| **A. Preguntarle a Andrea antes de aplicar** ✅ recomendada | Se lleva la pregunta concreta: *"¿la escuela pide documentación que la terapia no pide? ¿O los ~10 ítems son los mismos y solo se repiten?"*. Si dice que sí, apply arranca con la regla confirmada y las RN se reescriben con respaldo. Si dice que no, este change se archiva como `-dropped` (hay precedente: `factura-por-prestador-dropped`, `prestadores-crud-dropped`) y no se construyó nada de más |
| B. Aplicar igual con default vacío | Construye configuración inactiva. Defendible por la regla dura ("default documentado + configurable"), pero crea una tabla, una pantalla y una RLS que nadie pidió, en un dominio CRÍTICO |
| C. No hacer nada hasta el próximo feedback | Cero riesgo, cero avance. La usuaria ya expresó la necesidad |

**Recomendación: A.** La pregunta es corta y barata; construir la tabla, la RLS y la pantalla no.
**Sin veredicto — ninguna tarea de `tasks.md` §2 en adelante arranca sin esto.**

---

## Checkpoint (a) — ¿Dónde vive la configuración "ítems por tipo de actividad"?

**El problema.** Regla dura del proyecto: *"nunca hardcodear"*. Hay que elegir dónde persiste esa
lista, y la elección arrastra migración, RLS, repository y pantalla.

| Opción | Forma | A favor | En contra |
|---|---|---|---|
| **A. Tabla nueva que reusa `obra_social.tipos_documento`** ✅ recomendada | `requisitos_actividad (id, tipo_lugar pacientes.tipo_direccion, tipo_documento_id FK → obra_social.tipos_documento, requerido BOOL, orden INT, UNIQUE(tipo_lugar, tipo_documento_id))` | Espejo estructural exacto de `requisitos_os`, que ya funciona en producción del proyecto. Un solo universo de nombres de documento: "Autorización" es el mismo `tipos_documento.id` venga de la obra social o de la escuela — condición necesaria para que el Checkpoint (c) pueda deduplicar por identidad real y no por string. Aditiva: ninguna tabla existente se altera | Decide de fábrica que la lista es **global por tipo**, no por obra social — eso es el Checkpoint (e), hay que resolverlos juntos. Y obliga a decidir en qué schema vive (ver sub-pregunta) |
| B. Catálogo independiente, sin reusar `tipos_documento` | Tabla propia con `nombre TEXT` | Desacopla de un catálogo compartido por 3 dominios con `ON DELETE RESTRICT` | Crea un segundo universo de nombres. "Autorización" escrita dos veces = dos ítems distintos en el mismo bloque, sin forma de deduplicar. Rompe la premisa del cartel que ya está en `ChecklistEditor.tsx` ("el nombre se guarda en un catálogo compartido") |
| C. Columna JSON en alguna tabla existente | `obra_social.obra_social.requisitos_por_actividad JSONB` | Cero tabla nueva | El proyecto modela checklists de forma relacional en todos lados. JSON acá sería la única excepción, sin índice, sin FK, sin `ON DELETE RESTRICT`, y sin poder reusar el catálogo |
| D. Constante en el frontend | `const ITEMS_POR_TIPO: Record<TipoDireccion, string[]>` | Trivial | **Prohibido por regla dura** ("nunca hardcodear valores de negocio; dejar configurable"). Descartada, se lista solo para dejar constancia |

**Sub-pregunta obligatoria si se elige A: ¿en qué schema?**
`obra_social` (donde vive `requisitos_os`, gateado por `modulos.tiene_permiso('obra_social', …)`) o
`pacientes` (donde vive el enum `tipo_direccion`). La respuesta define **quién puede editar esta
configuración**, y por lo tanto la RLS. Intuición de este propose: `obra_social`, por coherencia con
`requisitos_os` y porque quien administra checklists documentales hoy es ese módulo — pero implica que
un usuario con permiso `pacientes` y sin permiso `obra_social` **no** puede tocarla. Decidirlo por
descarte sería un agujero de permisos en un dominio CRÍTICO. **Sin veredicto.**

**Recomendación: A**, con la sub-pregunta del schema resuelta explícitamente antes de escribir la
migración.

---

## Checkpoint (b) — ¿El scope es solo `tipo`, o también la `descripcion`?

**El problema.** Una actividad se identifica en pantalla como `Tipo — Descripción`
(`etiquetaActividad`, ej. "Terapia — Kinesióloga" vs "Terapia — Fonoaudióloga"). Si la configuración
se scopea solo por `tipo`, **las dos terapias reciben exactamente los mismos ítems extra**. ¿Alcanza?

| Opción | A favor | En contra |
|---|---|---|
| **A. Solo por `TipoDireccion`** ✅ recomendada | Unión cerrada de 5 valores útiles (sin `domicilio`) ⇒ configuración finita, enumerable, administrable en una pantalla chica. `descripcion` es texto libre por paciente: no hay forma de configurar "Kinesióloga" globalmente sin inventar un catálogo de descripciones que hoy no existe. La documentación que pide una obra social para una terapia normalmente depende de que sea *terapia*, no de *cuál* terapia | Con 5 tipos, "club", "natación" y cualquier actividad no prevista caen todas en `otro` y comparten lista. Si la clienta necesita distinguirlas, el enum se queda corto (y ampliarlo es una migración de enum, no de este change) |
| B. Por `tipo` + `descripcion` normalizada | Máxima granularidad | `descripcion` es texto libre cargado por paciente, con typos y mayúsculas inconsistentes. Configurar por string libre = configuración que deja de aplicar cuando alguien escribe "kinesiologa" sin tilde. Requeriría catálogo de descripciones ⇒ change mucho más grande |
| C. Por actividad puntual (`Direccion.id`) | Control total, caso por caso | Deja de ser configuración y pasa a ser carga manual por paciente y por actividad. Con N pacientes × M actividades es inviable operativamente, y nadie lo pidió |

**Recomendación: A.** Con una pregunta concreta para Andrea si el Checkpoint (0) se responde que sí:
*"¿el club y la escuela piden documentación distinta entre sí, o alcanza con distinguir escuela /
terapia / CET?"* — porque si "club" necesita lista propia, primero hay que ampliar el enum
`tipo_direccion`, y eso es un change aparte. **Sin veredicto.**

---

## Checkpoint (c) — Merge y dedup: ¿qué pasa si un ítem coincide entre las dos listas?

**El problema.** La obra social pide "Autorización". La escuela también. El bloque "Escuela" tiene que
mostrar… ¿uno o dos ítems "Autorización"? Y si es uno, ¿contra qué se compara la identidad? El
comportamiento elegido define además cómo cuenta el progreso (`X de Y`) y contra qué `itemId` se
guarda cada documento — o sea, **toca datos, no solo UI**.

| Opción | Comportamiento | A favor | En contra |
|---|---|---|---|
| **A. Dedup por identidad real (`ChecklistItem.id` / `tipo_documento_id`)** ✅ recomendada | Si el mismo `tipos_documento.id` aparece en las dos listas, se muestra **una vez**. Gana el de la obra social para orden y para `requerido` (RN-FA-08: el orden lo manda la obra social) | Es la única opción coherente con la opción A del Checkpoint (a): al reusar el catálogo compartido, dos ítems con el mismo nombre **son** el mismo `id`. El usuario nunca ve "Autorización" dos veces. Un documento cargado tiene un `itemId` sin ambigüedad | Un ítem que la obra social marca `requerido: false` y la escuela marca `requerido: true` (o al revés) exige una regla de precedencia explícita — ver sub-pregunta |
| B. Dedup por `nombre` normalizado (trim + lower) | Compara strings | Cubre el caso de que las dos listas vengan de catálogos distintos | Solo hace falta si el Checkpoint (a) se resuelve por B/C. Frágil: "Autorización" vs "Autorizacion" |
| C. Sin dedup, se suman con duplicados | Concatenación literal | Refleja literalmente "conviven, es un complemento". Cero lógica | El usuario ve dos filas idénticas en el mismo bloque y no sabe en cuál cargar. El progreso cuenta el mismo documento dos veces. En un dominio CRÍTICO, es inducir a error |

**Sub-pregunta obligatoria si se elige A: precedencia de `requerido` ante conflicto.** La opción
segura es **el más estricto gana** (`requerido: true` si cualquiera de las dos lo pide) — nunca relajar
una exigencia documental por efecto colateral de un merge. Intuición de este propose, **sin veredicto**.

**Sub-pregunta menor: ¿el usuario ve de dónde viene cada ítem?** Un `Chip` "Escuela" junto a los ítems
que no vienen de la obra social ayudaría a entender por qué este bloque tiene 13 ítems y el General 10.
Implicaría pasar procedencia hasta `DocumentChecklist.tsx` — que este diseño quiere **no** tocar. La
alternativa sin costo es un texto explicativo a nivel de bloque, en `PacienteDocumentos.tsx`.
**Sin veredicto.**

**Recomendación: A** (dedup por id, orden de la obra social primero, extras del tipo después, el más
estricto gana en `requerido`), con la procedencia comunicada a nivel de bloque y no de ítem.

---

## Checkpoint (d) — ¿Dónde se administra esta configuración?

**El problema.** Configuración sin pantalla no es configuración: sería una tabla que solo se puede
editar por SQL, y eso equivale a hardcodear con pasos extra.

| Opción | A favor | En contra |
|---|---|---|
| **A. Pantalla propia de "Documentación por tipo de actividad"** ✅ recomendada | La configuración es **global por tipo** (Checkpoint (e) opción A), no pertenece a ninguna obra social puntual — meterla dentro de la ficha de una obra social sugeriría lo contrario y confundiría. Reusa `ChecklistEditor`/`ChecklistItemRow` como componentes, sin duplicar el editor | Pantalla y ruta nuevas ⇒ entrada de navegación, permisos de módulo, `route-guard`. Es el pedazo más grande del change |
| B. Extender `ChecklistEditor.tsx` dentro de la ficha de obra social | Cero ruta nueva, cero navegación. El usuario ya va ahí a configurar checklists | Solo tiene sentido si la configuración **es** por obra social (Checkpoint (e) opción B). Si es global y se edita desde la ficha de OSDE, el usuario cree que está editando OSDE y en realidad edita todas |
| C. Sección dentro de una pantalla de configuración general | Coherente si existiera un módulo "Configuración" | No existe hoy; habría que crearlo. Fuera de alcance |

**Este checkpoint depende del (e) y no puede resolverse antes.** Si (e) = global ⇒ A. Si (e) = por obra
social ⇒ B. **Sin veredicto.**

---

## Checkpoint (e) — ¿La configuración es global por tipo, o por obra social × tipo?

**El problema.** ¿"La escuela pide constancia de alumno regular" es una verdad del mundo, o es algo que
OSDE pide y IOMA no? Es la decisión que más multiplica el alcance de todo el change.

| Opción | Forma | A favor | En contra |
|---|---|---|---|
| **A. Global por tipo de actividad** ✅ recomendada | `UNIQUE(tipo_lugar, tipo_documento_id)` — 5 listas en total | La hipótesis de la usuaria habla de la actividad, no de la obra social: *"cada actividad define los suyos"*. Configuración finita y mantenible (5 listas). RN-FA-08 sigue intacta: los ítems **de la obra social** siguen siendo configurables por obra social; esto es una capa aditiva de otro eje | Si resulta que sí depende de la obra social, migrar de global a matriz es agregar una columna nullable + backfill — no trivial, pero tampoco catastrófico |
| B. Por obra social × tipo | `UNIQUE(obra_social_id, tipo_lugar, tipo_documento_id)` | Máxima fidelidad si cada obra social tiene sus reglas | N obras sociales × 5 tipos de configuración a mantener a mano. La pantalla deja de ser una lista y pasa a ser una matriz. Y hoy **no hay ningún indicio** de que la clienta lo necesite |
| C. Global con override opcional por obra social | Lo mejor de ambos | Dos niveles de resolución + reglas de precedencia + UI que muestre qué se hereda y qué se pisa. Complejidad grande para una regla que ni siquiera está confirmada |

**Recomendación: A**, con `obra_social_id` **no** presente en la tabla (agregarla después como columna
nullable es más simple que sacarla). **Sin veredicto** — es la pregunta que hay que hacerle a Andrea
junto con el Checkpoint (0), en la misma conversación.

---

## Checkpoint (f) — ¿Cuándo se reescriben RN-FA-08 y RN-FA-10?

**El problema.** Las dos reglas documentadas hoy contradicen parcialmente lo que este change
construye:

- **RN-FA-08**: *"El checklist de documentación requerido para facturar es **configurable por obra
  social** (no es una lista única fija)"* — no contempla un segundo eje de configuración.
- **RN-FA-10**: documenta la instanciación por actividad, pero dice que cada instancia usa el mismo
  checklist; no menciona ítems propios por tipo.

Y las tres RN de este dominio confirmadas hasta hoy llevan la marca **"(feedback real de la clienta)"**.
Escribir una cuarta con la misma marca, sin que lo sea, contamina la KB.

| Opción | A favor | En contra |
|---|---|---|
| **A. Documentar la discrepancia ahora, reescribir las RN recién con veredicto de Andrea** ✅ recomendada | Preserva la distinción entre "confirmado por la clienta" y "asumido por el equipo", que es exactamente lo que la KB usa hoy para marcar procedencia. La discrepancia queda visible en `04_modelo_de_datos.md` §Discrepancias + `CHANGES.md` + `AvisoModeloDatos`, que es el patrón ya usado por `documentos-checklist-por-actividad` | La KB queda temporalmente describiendo un comportamiento que el código ya no tiene del todo — mitigable con una nota `⚠️` explícita en RN-FA-08/RN-FA-10 apuntando a la discrepancia |
| B. Reescribir RN-FA-08/RN-FA-10 ahora, marcadas como no confirmadas | La KB refleja el código | Una RN es una regla **del negocio**; escribirla desde una suposición del equipo invierte la dirección de la verdad. Riesgo alto de que dentro de un mes nadie recuerde que era una hipótesis |
| C. No documentar nada hasta la confirmación | Cero ruido | Viola la regla dura: toda discrepancia se documenta **en los dos lugares a la vez**, sin excepción |

**Recomendación: A.** Concretamente, mientras no haya veredicto: nota `⚠️` en RN-FA-08 y RN-FA-10
apuntando a la discrepancia; bullet nuevo en `04_modelo_de_datos.md` §Discrepancias; bullet de
refinamiento en `CHANGES.md` `C-03` y `C-05`; `AvisoModeloDatos` en la sección de documentación de
`PacienteDetail.tsx`. Con veredicto afirmativo de Andrea: **RN-FA-11 nueva** (no reescritura de la 08,
que sigue siendo verdad) marcada como feedback real, y las notas `⚠️` se cierran. **Sin veredicto.**

---

## Checkpoint (g) — Nivel de gobernanza

| Opción | Justificación |
|---|---|
| ALTO | Configuración, no datos de paciente |
| **CRÍTICO** ✅ recomendada | Precedente directo: los **tres** refinamientos anteriores sobre esta misma pantalla (`pacientes-documentos-multiples`, `documentos-previsualizacion`, `documentos-checklist-por-actividad`) se trataron como CRÍTICO, y `C-05` (dueño de la pantalla) es CRÍTICO. Además este change va **más lejos** que los tres: crea tabla nueva con RLS propia sobre documentación de salud, y se apoya en una regla de negocio no confirmada |

**Recomendación: CRÍTICO** — aprobación humana explícita registrada en `tasks.md` §1 antes de que
apply escriba una línea, y verificación manual de cierre con cuentas reales. **Sin veredicto.**

---

## Decisions (condicionadas a los checkpoints)

### D1 — La combinación de listas es una función pura en `actividadDocumental.ts`

Cualquiera sea el veredicto de (a)/(b)/(c), la lógica de "qué ítems ve este bloque" no vive dentro de
un componente ni de un `useEffect`: es una función pura que recibe las dos listas y la actividad, y
devuelve la lista combinada. Forma propuesta (ilustrativa, **no aplicada**):

```ts
// features/pacientes/actividadDocumental.ts — junto a obtenerActividadesConChecklist/etiquetaActividad
export function combinarItemsDeActividad(
  itemsObraSocial: ChecklistItem[],
  itemsPorTipo: ChecklistItem[],   // los del `tipo` de esta actividad; [] = default documentado
): ChecklistItem[]
```

Razones: (1) mismo criterio ya escrito en ese archivo — *"criterio único, nunca un `filter` inline
repetido"*; (2) Strict TDD está activo y una función pura es RED→GREEN→TRIANGULATE sin montar React;
(3) el bloque "General" simplemente no la llama, así que su comportamiento queda protegido por
construcción, no por cuidado.

### D2 — El default es la lista vacía, y es el comportamiento actual

`itemsPorTipo = []` ⇒ `combinarItemsDeActividad(base, []) === base` (misma identidad de ítems, mismo
orden). No hay estado "sin configurar" que muestre error, cartel de faltante ni bloqueo: **hoy el
sistema está en ese estado y funciona**. Esto es lo que permite aplicar el change sin regresión aunque
la regla nunca se confirme.

### D3 — `DocumentChecklist.tsx` y el contrato documental no cambian

El componente compartido recibe `items: ChecklistItem[]`. Quien decide qué ítems son, es Pacientes.
Vehículos, Conductores y Facturas no se enteran de este change — a diferencia de
`documentos-checklist-por-actividad`, que sí tuvo que tocar el contrato compartido. Única excepción
posible: la sub-pregunta de procedencia visible del Checkpoint (c), y para eso la salida preferida es
texto a nivel de bloque, no una prop nueva en el componente compartido.

### D4 — La migración se escribe en apply, con RLS y auditoría en el mismo archivo

Regla dura: ninguna tabla sin RLS en el mismo cambio. La tabla nueva llevará, en la misma migración:
`ENABLE ROW LEVEL SECURITY`, policies `Read`/`Write` gateadas por `modulos.tiene_permiso(<módulo>, …)`
con el módulo que salga del Checkpoint (a) sub-pregunta, `GRANT` a `authenticated`, trigger
`auditoria.log_action()`, y bloque de rollback comentado — mismo formato que
`20260807010000_documentos_direccion_id.sql`. **Nada de esto se escribe en propose.**

### D5 — Reusar `tipos_documento` implica reusar su get-or-create, no escribir INSERTs sueltos

Si (a) = A, dar de alta un ítem por tipo de actividad puede necesitar crear una fila en
`tipos_documento`. Eso ya tiene un camino establecido y confirmado por la usuaria: get-or-create
normalizado (trim + lower) dentro de un RPC (`20260731120001_obra_social_rpc.sql`, D3 de
`integracion-obra-social`). No se escribe un `INSERT` paralelo desde el frontend — sería una segunda
fuente de verdad sobre un catálogo compartido por tres dominios con `ON DELETE RESTRICT`.

### D6 — Los documentos ya cargados no se tocan

Ningún documento existente cambia de `itemId` ni de `direccion_id`. La lista de ítems que se muestra
crece; lo cargado permanece donde está. El único efecto observable sobre datos previos es que el
denominador del progreso de cada actividad puede aumentar (más ítems ⇒ mismo cargado sobre más total).
Esto **debe** anticiparse a la usuaria: el porcentaje de pacientes ya completos va a bajar el día que
alguien configure ítems por tipo. No es un bug.

---

## Risks / Trade-offs

- **Se construye para una regla no confirmada** → Checkpoint (0) bloqueante; default vacío ⇒ cero
  regresión; si Andrea la rechaza, el change se archiva como `-dropped` sin deuda (precedente:
  `factura-por-prestador-dropped`, `prestadores-crud-dropped`).
- **La RLS puede quedar gateada por el módulo equivocado** (Checkpoint (a) sub-pregunta) → precedente
  real y caro en este proyecto: `integracion-documentos` encontró el bucket `documentos-vehiculos`
  gateado por `conductores` en vez de `vehiculos`. Se resuelve con veredicto explícito, nunca por
  descarte, y se verifica manualmente con dos cuentas de permisos distintos antes de cerrar.
- **El progreso de pacientes ya completos baja al configurar ítems nuevos** (D6) → avisar a la usuaria
  antes de configurar; no es reversible por código, es aritmética.
- **`otro` como cajón de sastre** (Checkpoint (b)) → "club" y cualquier actividad no prevista comparten
  lista. Si molesta, ampliar el enum `pacientes.tipo_direccion` es un change aparte, no este.
- **Un ítem por tipo que se quita de la configuración deja documentos sin fila visible** → `ON DELETE
  RESTRICT` sobre `tipos_documento` protege el catálogo, pero **no** protege la fila de
  `requisitos_actividad`. Hay que decidir en apply si quitar un ítem de la configuración se bloquea
  cuando ya hay documentos cargados contra él, o se permite y esos documentos quedan en el bloque sin
  ítem. Mismo espíritu que la advertencia al quitar una actividad con documentos.
- **Scope creep si (e) = B** → la pantalla pasa de lista a matriz N×5. Mitigación: resolver (e) antes
  que (d), y no empezar la pantalla hasta tener los dos veredictos.

---

## Migration Plan

1. Checkpoint (0) resuelto con Andrea + veredictos de (a)-(g) registrados en `tasks.md` §1.
2. Migración aditiva con RLS + auditoría + rollback comentado, en un solo archivo. Ninguna tabla
   existente se altera ⇒ no hay ventana de incompatibilidad ni datos que migrar.
3. Repository + tipos + función pura de combinación (TDD).
4. Pantalla de administración (según (d)).
5. Cableado en `PacienteDocumentos.tsx`; el bloque "General" se verifica **sin cambios**.
6. Documentación de la discrepancia (KB + `CHANGES.md` + `AvisoModeloDatos`).
7. Verificación manual con cuentas reales de permisos distintos.

**Rollback**: revertir los archivos de frontend (el sistema vuelve a mostrar solo los ítems de la obra
social) y, si hiciera falta, `DROP TABLE` de la tabla nueva — aditiva, ninguna otra tabla la
referencia. Ningún documento cargado se pierde en ningún escenario de rollback.

---

## Open Questions

- **Checkpoint (0)** — ⚠️ **BLOQUEANTE**: ¿Andrea confirma que cada tipo de actividad pide
  documentación propia? Sin confirmar.
- **Checkpoint (a)** — ¿tabla nueva reusando `obra_social.tipos_documento` (recomendado), catálogo
  independiente, JSON, o constante (prohibida)? **Sub-pregunta**: ¿en qué schema vive, y por lo tanto
  qué módulo la gatea en la RLS? Sin confirmar.
- **Checkpoint (b)** — ¿scope por `TipoDireccion` (recomendado), por `tipo` + `descripcion`, o por
  actividad puntual? Sin confirmar.
- **Checkpoint (c)** — ¿dedup por `id` (recomendado), por `nombre` normalizado, o sin dedup?
  **Sub-preguntas**: precedencia de `requerido` ante conflicto; ¿el usuario ve la procedencia de cada
  ítem? Sin confirmar.
- **Checkpoint (d)** — ¿pantalla propia (recomendado si (e)=A) o extensión de `ChecklistEditor.tsx`
  (si (e)=B)? **Depende de (e).** Sin confirmar.
- **Checkpoint (e)** — ¿configuración global por tipo (recomendado) o por obra social × tipo? Sin
  confirmar.
- **Checkpoint (f)** — ¿documentar la discrepancia ahora y reescribir las RN con veredicto
  (recomendado), reescribirlas ya, o no documentar? Sin confirmar.
- **Checkpoint (g)** — ¿gobernanza CRÍTICO (recomendado, por precedente de los tres hermanos) o ALTO?
  Sin confirmar.
- **Deferible sin bloquear**: si quitar un ítem de la configuración por tipo debe bloquearse cuando ya
  hay documentos cargados contra él (ver Risks). Se puede decidir al escribir la migración, con el
  veredicto de (a) ya en mano.
- **Anotado para el futuro, fuera de alcance**: el **punto 3** del feedback original (vincular la
  actividad con su documentación al operar/facturar, exportar/transferir documentación a otro
  domicilio) sigue esperando el video del cliente. Si los ítems pasan a depender del tipo de actividad,
  "transferir documentación a otro domicilio" deja de ser solo cambiar el `agrupacionId`: el destino
  puede no tener ese ítem en su lista. Quien proponga ese change debe leer este `design.md` primero.
