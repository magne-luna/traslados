## Context

Motivación y verificación del estado actual: ver `proposal.md` §Why. Acá solo lo que hace falta para
justificar el enfoque.

**Estructura de montaje actual, leída, no asumida.**

```
PacienteDetail.tsx
├── <Section label="Traslados" title="Direcciones">            ← líneas 233-247
│     └── <DireccionesEditor direcciones onChange documentosPorDireccion />
│           └── <li data-direccion-id={d.id}>  … [Editar] [Quitar]      ← sin acción hacia docs
│
└── <Section label="Documentación" title="Checklist documental">  ← líneas 249-269
      └── <PacienteDocumentos pacienteId obraSocialId … direcciones />
            ├── RingProgress  (total agregado)
            ├── <PacienteDocumentosChecklist … />                 ← bloque "General"
            └── direcciones.filter(no-domicilio).map(d =>
                  <PacienteDocumentosChecklist agrupacionId={d.id} label={etiqueta(d)} />)
                    ├── useDocumentChecklist('paciente', pacienteId, items, repo, agrupacionId)
                    │     └── repo.listByEntity('paciente', pacienteId, agrupacionId)
                    ├── const [abierta, setAbierta] = useState(true)   ← ★ estado local, línea 67
                    ├── <SeccionPlegable abierta onToggle>             ← 100% controlado
                    └── <DocumentChecklist … />                       ← compartido x4 dominios
```

Las dos `<Section>` son **hermanas y hoy no se comunican** salvo por `documentosPorDireccion` (conteo
de solo lectura, para el diálogo de borrado). El `★` marca el único obstáculo estructural de la
sub-parte 3.a: quien sabe si un bloque está abierto es el bloque mismo, no su padre.

**El contrato compartido, hoy (cuatro métodos):**

```ts
interface DocumentoRepository {
  listByEntity(entidad, entidadId, agrupacionId?): Promise<DocumentoAdjunto[]>;
  upload(entidad, entidadId, itemId, file, vigenciaDesde?, agrupacionId?): Promise<DocumentoAdjunto>;
  remove(entidad, entidadId, documentoId): Promise<void>;
  resolverPrevisualizacion(entidad, entidadId, documentoId): Promise<string | null>;
}
```

Cuatro dominios lo consumen (`EntidadDocumental = 'paciente' | 'vehiculo' | 'conductor' | 'factura'`)
y **solo Pacientes tiene actividades**. `agrupacionId` ya es opcional y los otros tres pasan
`undefined` — precedente directo, y la razón por la que el change anterior eligió la opción "campo
opcional" sobre "entidadId compuesto". Este change agrega el **quinto** método sobre esa misma
cabecera que declara *"nunca cambia la forma del dato"*. Es la cuarta modificación del mes.

**Storage vs. Postgres — la asimetría que abarata todo 3.c.**

```
clave de Storage:  {entidadId}/{itemId}/{uuid}-{nombreArchivoSeguro}   ← documentoMapping.ts:123-130
                    └── paciente_id      └── id_tipo_documento
                    ✗ direccion_id NO aparece en ningún punto del path

fila en Postgres:  pacientes.documentos
                   (id, paciente_id, id_tipo_documento, archivo_url, created_at,
                    nombre_archivo, direccion_id ← 20260807010000, nullable, ON DELETE RESTRICT)
```

Transferir = `UPDATE pacientes.documentos SET direccion_id = $destino WHERE id = $doc`. **El objeto
del bucket no se toca.** No hay copia, no hay borrado, no hay ventana en que el archivo no exista.
Esto es lo que hace que la operación sea segura y barata — y es una propiedad **accidental** del
diseño de la clave, no una decisión deliberada de nadie. Vale dejarla escrita para que no se rompa
sin querer (ver D3 y §Riesgos).

**Patrón de exportación del proyecto.** No hay librería de export instalada (verificado en
`frontend/package.json`: `pdfjs-dist` es de **lectura**). Las dos exportaciones existentes son vistas
imprimibles con clases `print:` de Tailwind (`HojaDeRutaImprimible.tsx`, `factura-exportacion`), y
ninguna llama `window.print()` — el usuario dispara Ctrl+P.

**El video que no llegó.** El requerimiento se cierra con *"el cliente enviará un video mostrando este
flujo. Este punto puede refinarse cuando llegue"*. El video sigue pendiente (`TODO-video-revision.txt`
documenta una reunión posterior del 2026-08-04 que **no** lo menciona). Todo este diseño se construye
sobre la **lectura literal del texto transcripto**, y el Checkpoint (a) es el punto exacto donde el
video puede contradecirlo.

---

## Goals / Non-Goals

**Goals:**

- Que las tres sub-partes (navegar / exportar / transferir) sean **implementables y revertibles por
  separado**, en orden de riesgo creciente — el pedido es uno, pero el riesgo no es uniforme.
- Que el default de cada checkpoint sea el que **menos compromete**: la lectura más literal del texto,
  la que menos superficie nueva abre y la más fácil de revertir cuando llegue el video.
- Que transferir **no pueda perder un documento**: sin copiar-y-borrar, sin ventana de inconsistencia,
  sin tocar el bucket.
- Que Vehículos, Conductores y Facturas **no cambien de comportamiento ni de UI**, por cuarta vez
  consecutiva sobre este contrato compartido.
- Que el checkpoint abierto quede visible para la clienta **en la pantalla**, no solo en un `.md`.

**Non-Goals:**

- **No** se decide el flujo definitivo del punto 3. Este diseño es un default explícito y provisorio.
- **No** se diseña transferencia entre pacientes distintos. Riesgo clínico, y el texto no lo pide.
- **No** se diseña un modo "una actividad por vez" que filtre la sección (alternativa registrada en
  Checkpoint (a), no elegida).
- **No** se agrega ninguna dependencia npm.
- **No** se propone migración de base.
- **No** se coordina con `documentos-checklist-items-por-actividad` (change en curso de otra línea de
  trabajo). Se anota el riesgo de merge y la pregunta de diseño que abre; nada más.

---

## Checkpoints de diseño (abiertos — sin veredicto)

> Mismo formato que `archive/2026-08-07-documentos-checklist-por-actividad/design.md`, que dejó siete
> checkpoints resueltos en `tasks.md` §0 antes de escribir una línea de código. **Ninguno de estos
> tiene veredicto todavía.** El alcance real de las secciones de `tasks.md` depende de ellos.
>
> **(a) es el checkpoint del video.** Los demás son decisiones que Enzo/la usuaria pueden cerrar sin
> esperar nada.

### Checkpoint (a) — ⚠️ PENDIENTE DEL VIDEO DE LA CLIENTA — ¿qué significa "marcar una actividad"?

El texto dice: *"al marcar una actividad (identificada por su domicilio), el sistema debe llevar a la
documentación de ese domicilio"*. **"Marcar" y "llevar a" son ambos ambiguos**, y de la combinación
salen tres lecturas incompatibles:

| Opción | Lectura | Costo | Qué rompe |
|---|---|---|---|
| **A — acción explícita por fila** *(DEFAULT ELEGIDO)* | En cada actividad de la lista de Direcciones hay un botón "Ver documentación" que expande + enfoca + desplaza al bloque de esa actividad. Los N bloques siguen existiendo simultáneamente. | Bajo. Lift-state de `abierta` + `ref` por bloque. | Nada. Aditivo puro sobre lo que la clienta ya aprobó. |
| **B — selección persistente que filtra** | "Marcar" = seleccionar una actividad; la sección de documentación pasa a mostrar **solo** esa. Modelo "una por vez". | Medio-alto. Cambia el modelo mental de la pantalla completa y el total agregado del encabezado. | Contradice el requisito ya especificado *"un paciente con varias actividades ve varios checklists"* (`paciente-documentos`). Requeriría **modificar** ese requisito, no extenderlo. |
| **C — deep-link desde Hojas de Ruta** | "Marcar la actividad" ocurre al marcar un recorrido/parada en Hojas de Ruta, y desde ahí se salta a la documentación del paciente. | Alto. Hoy **no existe ninguna navegación** entre Hojas de Ruta y Pacientes (verificado), ni estado de paciente en la URL (`PacientesPage` usa `useState`, no rutas). Habría que introducir routing por paciente primero. | Nada, pero es un change propio, no una sub-parte de éste. |

**DEFAULT ELEGIDO: opción A**, por tres razones que quedan escritas para poder revisarlas contra el
video:
1. Es la lectura **más literal**: el texto habla del domicilio como identificador de la actividad y de
   "llevar a" su documentación — una acción de navegación, no un modo de la pantalla.
2. Es la **única que no contradice** un requisito ya aprobado y archivado por la clienta hace tres
   días (N bloques simultáneos).
3. Es la **más barata de revertir**: si el video muestra la opción B, se descarta un botón y un
   lift-state; si muestra la C, este change queda igual y la C se propone aparte.

**⚠️ Si el video muestra B o C, este checkpoint se reabre y las secciones de navegación de `tasks.md`
se rehacen.** Registrar en `AvisoPendienteCliente` (D5), en `CHANGES.md` y en
`knowledge-base/04_modelo_de_datos.md`.

### Checkpoint (b) — ¿qué produce "exportar"?

El texto dice *"poder exportar esa documentación"* y nada más. Tres formas posibles, muy distintas:

| Opción | Qué produce | Costo | Contra |
|---|---|---|---|
| **A — vista imprimible** *(DEFAULT ELEGIDO)* | Una vista de la documentación de **una** actividad con encabezado (paciente, actividad, dirección) y la lista de ítems cargados/faltantes. PDF vía Ctrl+P → "Guardar como PDF". | Bajo. Patrón ya usado dos veces en el repo, cero dependencias. | No incluye los **archivos** binarios, solo el detalle de qué hay y qué falta. |
| **B — ZIP de los archivos** | Un `.zip` con los N documentos de esa actividad. | Medio. Dependencia nueva (`jszip`), N `createSignedUrl` + N `fetch` en paralelo, manejo de fallos parciales, y expiración de las URLs firmadas a mitad de la descarga. | Es lo que probablemente quiere quien va a **mandarle la carpeta a la obra social**. |
| **C — PDF consolidado** | Un solo PDF con todos los documentos concatenados. | Alto. Dependencia de generación + merge de PDFs; los adjuntos pueden ser imágenes, no solo PDF. | Descartada por costo/beneficio en este change. |

**DEFAULT ELEGIDO: opción A**, porque (1) es consistente con las dos exportaciones que el proyecto ya
tiene, (2) no agrega dependencias, y (3) el texto de la clienta **no distingue** entre "exportar el
listado" y "exportar los archivos" — elegir B sobre una ambigüedad cuesta una dependencia nueva que
después hay que sostener.

**Nota honesta**: la lectura operativa del punto 3 (*"error de carga", "sin recargar desde cero"*)
sugiere que el uso real es **armar el legajo de una actividad para mandarlo**, y eso apunta a B. Este
default está elegido para **no bloquear el propose**, no porque B esté descartada. Es el segundo punto
que el video puede aclarar. Si el veredicto es B, `tasks.md` §Exportación se reescribe y entra `jszip`.

### Checkpoint (c) — ¿dónde vive la acción "transferir" en la UI compartida?

`DocumentChecklist.tsx` es **compartido por los cuatro dominios**. Transferir solo tiene sentido en
Pacientes (los otros tres no tienen agrupaciones).

- **Opción A** — prop opcional `onTransferir?: (documentoId: string) => void` en `DocumentChecklist`;
  si no se pasa, la acción no se renderiza. Precedente directo y reciente: `mostrarProgreso?: boolean`
  (default `true`, agregado por el change anterior a pedido de la usuaria, sin efecto en los otros 3
  dominios). **Recomendado.**
- **Opción B** — la acción vive fuera de `DocumentChecklist`, en `PacienteDocumentosChecklist`, como
  una lista de documentos paralela. Evita tocar el componente compartido, pero duplica el render de
  la lista de documentos y desincroniza dos vistas del mismo dato.
- **Opción C** — `DocumentChecklist` recibe un array genérico de acciones por documento. Más flexible,
  más abstracto, y nadie pidió la flexibilidad.

**Recomendación: A** — mismo mecanismo opt-in que ya se usó con éxito hace tres días, mismo argumento
("los otros tres dominios no se enteran"), y verificable con los tests de no-regresión cruzada que ese
change dejó (`archive/…-checklist-por-actividad/tasks.md` §7).

### Checkpoint (d) — ¿qué exactamente se puede transferir, y hacia dónde?

El texto dice *"transferir un documento de un lugar a otro"*. Alcance a fijar:

1. **¿Destinos válidos?** → Recomendado: las otras actividades del **mismo paciente**, más el bloque
   "General". **Nunca** otro paciente (riesgo clínico: mezclar documentación de dos personas con
   discapacidad; y el texto no lo pide — habla de "domicilio equivocado", siempre dentro del mismo
   paciente).
2. **¿Cambia el ítem del checklist?** → Recomendado: **no**. La transferencia conserva `itemId` y solo
   cambia `agrupacionId`. Si además se pudiera cambiar de ítem, la operación pasa a ser "editar el
   documento" y el error de carga que la clienta describe (*"lo subí en el domicilio equivocado"*) no
   lo requiere.
3. **¿Se puede transferir desde/hacia "General"?** → Recomendado: **sí, en ambos sentidos**. Es el
   caso más probable de error de carga, porque "General" es el bloque que aparece primero en la
   pantalla y el destino por defecto de todo lo cargado antes del change anterior.
4. **¿Se transfiere de a uno o en lote?** → Recomendado: **de a uno**. El texto dice "un documento".

### Checkpoint (e) — ⚠️ ¿qué pasa si el ítem no existe en la actividad destino?

**Depende de un change en curso de otra línea de trabajo.** Hoy los N bloques reciben **los mismos
ítems** (los de la obra social), así que la pregunta no se puede dar: cualquier `itemId` válido en el
origen lo es en el destino. Pero `openspec/changes/documentos-checklist-items-por-actividad/`
(propuesto, 0/52) hace que **el contenido del checklist dependa del tipo de actividad** — y entonces
transferir un documento de una terapia a una escuela puede aterrizar en un ítem que la escuela no
tiene.

Opciones, para cuando eso ocurra:
- **A** — restringir los destinos ofrecidos a las actividades cuyo checklist contiene ese `itemId`.
  Seguro, pero el usuario no entiende por qué falta un destino.
- **B** — permitir el destino y mostrar el documento en el bloque destino como "ítem no aplicable a
  esta actividad", visible y corregible. Nada se pierde.
- **C** — no hacer nada ahora; el problema no existe hasta que ese change se aplique.

**Recomendado: C para este change + B como forma futura**, y dejarlo anotado en el `design.md` del
otro change **sin editarlo** (es de otra línea de trabajo). El punto de decisión es de quien aplique
segundo. **Este propose no lo resuelve ni lo coordina.**

### Checkpoint (f) — GOVERNANCE: ¿CRÍTICO, como sus tres predecesores?

**Recomendación: CRÍTICO**, y con un argumento más fuerte que los anteriores:
- Mismo dominio y misma pantalla que `pacientes-documentos-multiples`,
  `documentos-previsualizacion` y `documentos-checklist-por-actividad`, los tres CRÍTICO
  (datos de salud de personas con discapacidad, incluidos menores).
- **Novedad**: 3.c es la **primera operación del proyecto que muta la ubicación de un documento
  clínico ya cargado**. Hasta hoy la superficie de escritura documental era crear y borrar. Una
  transferencia mal hecha no borra el documento, pero lo **esconde** en el bloque equivocado — que es
  exactamente el problema que la clienta quiere resolver, al revés.
- 3.b abre una superficie de **lectura agregada** (una vista que junta toda la documentación de una
  actividad en una sola página imprimible), que hasta ahora no existía.

`/opsx:apply` de este change **requiere aprobación humana explícita antes de escribir código**, igual
que sus tres predecesores. Ver `tasks.md` §0.

### Checkpoint (g) — ¿transferir requiere permiso de escritura? ¿Y exportar?

- **Transferir** → Recomendado: **sí**, `usePuedeEscribir()`, exactamente el mismo gate que `upload` y
  `remove` ya usan en `PacienteDocumentosChecklist.tsx` (línea 45, `readOnly={!puedeEscribir}`). En
  Supabase queda cubierto por la policy `Write documentos` (`ALL` con
  `modulos.tiene_permiso('pacientes','write')`) — `ALL` incluye `UPDATE`, pero **verificarlo, no
  asumirlo**.
- **Exportar** → Recomendado: **permiso de lectura alcanza**. Es una vista de datos que el usuario ya
  puede ver en pantalla; exigir escritura para imprimir lo que ya se ve sería incoherente.

### Checkpoint (h) — ¿queda traza de la transferencia?

El proyecto tiene auditoría (`C-02 usuarios-permisos-auditoria`, archivado). Una transferencia
**sobrescribe** `direccion_id` sin dejar constancia de cuál era el valor anterior — y eso es
precisamente lo que haría falta para deshacer una transferencia equivocada.

- **A** — sin traza (lo más barato, y lo que sale solo si no se decide nada).
- **B** — registrar la transferencia en el mecanismo de auditoría existente (origen, destino, quién,
  cuándo). **Recomendado**: es lo que convierte 3.c de "operación irreversible" en "operación
  reversible a mano", y es el mitigante que el rollback plan del `proposal.md` señala como abierto.
- **C** — deshacer en la propia UI ("Deshacer" tras transferir). Más caro, y nadie lo pidió.

**Sin veredicto de (h), el rollback de 3.c queda incompleto.** Es decisión de Enzo, no del propose.

---

## Decisions

Las decisiones de abajo son **condicionales a los checkpoints**: describen la forma del diseño
suponiendo los defaults recomendados. Si un checkpoint se resuelve distinto, la decisión asociada se
rehace.

### D1 — El estado "qué bloque está abierto" sube a `PacienteDocumentos` (depende de (a)=A)

`SeccionPlegable` ya es 100 % controlado (`abierta` + `onToggle`, sin estado propio), así que la
única pieza que se mueve es el `useState(true)` de `PacienteDocumentosChecklist.tsx` línea 67.

**Forma propuesta:** `PacienteDocumentos` mantiene `Record<string, boolean>` de bloques abiertos
(clave: `'general'` o `Direccion.id`, **la misma clave que ya usa `progresos`** en ese componente —
línea 44) y baja `abierta`/`onToggle` como props. La navegación pasa a ser: *abrir esa clave + hacer
foco*.

**Lo que NO puede romperse:** el auto-colapso de bloques completos que la usuaria pidió
explícitamente (bloques de actividad ya completos arrancan cerrados, y la decisión se toma **una sola
vez** vía `decidioColapsoInicial` — si el usuario reabre a mano, no se vuelve a cerrar). Esa lógica
depende de `loading`/`cargados`/`total`, que viven **dentro** del bloque, no arriba. Por eso el estado
sube pero la **decisión inicial** no: el hijo sigue reportando "sugiero arrancar colapsado" hacia
arriba (mismo patrón `onProgreso` que ya existe, línea 54), y el padre decide. Alternativa descartada:
subir también el cálculo de progreso al padre — duplicaría la fórmula de `cargados/total` que ya está
deliberadamente derivada en el hijo.

**Alternativa considerada y descartada:** `useImperativeHandle` + `ref` por bloque para abrirlo desde
afuera. Menos código, pero mete una API imperativa en un árbol que hoy es 100 % declarativo, y la
apertura dejaría de ser observable desde el padre (que la necesita para saber a dónde desplazar).

### D2 — El desplazamiento usa un ancla por bloque, no la URL (depende de (a)=A)

Hoy no hay estado en la URL para pacientes (`PacientesPage.tsx` usa `useState<View>`, no rutas), así
que un `#anchor` no tiene dónde vivir sin introducir routing por paciente — un change propio.

**Forma propuesta:** un `ref` por bloque en `PacienteDocumentos`, `scrollIntoView({ behavior:
'smooth', block: 'start' })` **más** foco programático en el encabezado del bloque para que sea
navegable por teclado y anunciable por lector de pantalla (hay N bloques idénticos en la misma
página; un scroll sin foco no le dice nada a quien no ve la pantalla). Respetar
`prefers-reduced-motion` para el `behavior: 'smooth'`.

Nota: `scrollIntoView` no aparece hoy en ninguna parte del código — sería la primera vez. Vale
encapsularlo en un helper de `shared/` en vez de dejarlo suelto en el componente.

### D3 — Transferir es un `UPDATE` de `direccion_id`. El archivo no se toca. Nunca.

La clave de Storage no contiene `direccion_id` (`documentoMapping.ts:123-130`), así que reasignar la
agrupación **no requiere ni justifica** mover el objeto del bucket.

**Consecuencia deliberada:** la operación es atómica a nivel de fila, no tiene ventana en que el
archivo no exista, y no puede fallar a medias. Es la razón por la que 3.c es implementable con
seguridad aceptable en un dominio CRÍTICO.

**Alternativa descartada explícitamente: copiar a la clave nueva + borrar la vieja.** Sería lo
"natural" si alguien asumiera que el path refleja la agrupación. No lo refleja. Copiar-y-borrar
introduce una ventana de pérdida real de un documento clínico a cambio de cero beneficio.

**Invariante a proteger:** si alguna vez se cambia `construirClaveStorage` para incluir `direccion_id`
en el path, esta decisión se invalida y transferir pasa a requerir mover el objeto. Dejarlo escrito
como comentario en `documentoMapping.ts` junto a la función.

### D4 — El 5.º método del contrato (depende de (c))

**Forma propuesta**, alineada con cómo el change anterior agregó `agrupacionId` (parámetros nuevos al
final, nunca reordenar, opcionalidad para que los otros tres dominios no se enteren):

```ts
/** Reasigna la agrupación de un documento ya cargado sin volver a subirlo ni mover el archivo en
 *  Storage (design.md D3). `agrupacionDestino` undefined = mover al bloque sin agrupación
 *  ("General", Checkpoint (d).3). Conserva id, itemId, nombre, fecha de subida y clave de Storage.
 *  Solo Pacientes lo usa; los otros tres dominios documentales no tienen agrupaciones. */
transferirAgrupacion(
  entidad: EntidadDocumental,
  entidadId: string,
  documentoId: string,
  agrupacionDestino: string | undefined,
): Promise<DocumentoAdjunto>;
```

Decisiones puntuales y su porqué:
- **Devuelve el `DocumentoAdjunto` actualizado**, no `void` (a diferencia de `remove`): la UI necesita
  reflejar el documento en su bloque nuevo, y devolverlo evita un `listByEntity` extra por bloque.
- **`agrupacionDestino: string | undefined` explícito, no opcional** (`?`): acá `undefined` significa
  "movelo a General", una intención real del usuario — no "no me importa". Un parámetro opcional
  haría que olvidarse de pasarlo se lea igual que pedir el traslado a General. **Nunca `any`.**
- **Nombre `transferirAgrupacion`, no `mover`/`transferir` a secas**: "mover" en un contexto de
  Storage sugiere mover el archivo, que es exactamente lo que D3 prohíbe.

### D5 — El checkpoint del video se declara en pantalla, no solo en los `.md`

Regla dura del proyecto: toda decisión no confirmada por el cliente se documenta en
`knowledge-base/04_modelo_de_datos.md` §Discrepancias **y** en el bullet del change en `CHANGES.md`
**y** con un cartel visible en la pantalla donde aplica.

**Forma propuesta:** `AvisoPendienteCliente` (ya existe, `design-system/components.tsx` línea 341 —
hecho exactamente para esto, no inventar componente) en la `<Section>` de documentación de
`PacienteDetail.tsx`, con el texto del pendiente: *el flujo de vinculación/exportación está
implementado según la lectura literal del requerimiento; la clienta enviará un video que puede
refinarlo*. `AvisoModeloDatos` **no** corresponde acá: no hay discrepancia con el docx, hay un
requerimiento incompleto — son dos carteles distintos y el proyecto ya los distingue.

### D6 — Refresco cruzado entre bloques tras una transferencia

Cada `PacienteDocumentosChecklist` tiene su propio `useDocumentChecklist`, con su propia lista. Una
transferencia afecta a **dos** bloques a la vez (el origen pierde un documento, el destino lo gana), y
al total agregado del encabezado.

**Forma propuesta:** la transferencia se dispara hacia arriba (a `PacienteDocumentos`), que invalida
las listas de **ambos** bloques involucrados. Alternativa descartada: refrescar los N bloques —
correcto pero desperdicia N-2 llamadas y hace parpadear bloques que no cambiaron.

**Trampa conocida:** el `agrupacionId` es parte de las dependencias del hook. Si el refresco se
implementa cambiando la identidad del array de `items` en vez de invalidar explícitamente, se
re-monta todo y el auto-colapso de D1 se vuelve a evaluar. Verificarlo con un test, no a ojo.

---

## Risks / Trade-offs

**[El video llega y contradice el Checkpoint (a)]** → El default (opción A) es aditivo y no modifica
ningún requisito ya aprobado: revertirlo es borrar un botón y bajar un `useState`. Las sub-partes 3.b
y 3.c **no dependen** de cómo se resuelva (a) — se pueden aplicar aunque (a) se reabra. Esa
independencia es deliberada.

**[El video llega y pide un ZIP (Checkpoint (b) = opción B)]** → La vista imprimible no se tira: sigue
siendo el "índice" del legajo. Pero entra `jszip` y toda la sección de exportación de `tasks.md` se
rehace. Riesgo asumido a cambio de no agregar hoy una dependencia sobre una ambigüedad.

**[Una transferencia mal hecha esconde un documento clínico]** → Es el riesgo central de 3.c, y es
exactamente el problema que la clienta quiere resolver, al revés. Mitigación: confirmación explícita
antes de ejecutar (mismo criterio que "quitar una dirección con documentación cargada", requisito ya
vigente en `paciente-direcciones`), destino elegido de una lista cerrada de actividades del mismo
paciente (nunca texto libre, nunca otro paciente), y **Checkpoint (h)** — sin traza, la operación no
es reversible.

**[Colisión de merge con `documentos-checklist-items-por-actividad`]** → Ambos changes tocan
`PacienteDocumentos.tsx` y `PacienteDocumentosChecklist.tsx`; el otro está propuesto y sin aplicar
(0/52), es de otra línea de trabajo y **no se toca en este propose**. Mitigación: quien aplique
segundo rebasa; el conflicto es en los mismos dos archivos pero en ejes distintos (aquél cambia
`items`, éste cambia `abierta`/`ref`). Además abre la pregunta de diseño del Checkpoint (e), que
**pertenece a quien aplique segundo**, no a este propose.

**[Cuarta modificación del mes al contrato compartido por cuatro dominios]** → `DocumentoRepository`
pasó de 3 a 4 métodos y ganó dos parámetros opcionales en cuatro semanas, y `integracion-documentos`
(propuesto, sin aplicar) ya lleva **una** corrección registrada por un refinamiento que aterrizó
después. Ésta sería la segunda. Mitigación: el 5.º método es opt-in y no cambia ninguna firma
existente; los tests de no-regresión cruzada que dejó el change anterior (§7 de su `tasks.md`) cubren
los otros tres dominios. Pero el patrón —el contrato se mueve por debajo de un change no aplicado— ya
ocurrió y **volverá a ocurrir**: vale considerar aplicar `integracion-documentos` antes de seguir
refinando.

**[`scrollIntoView` es la primera aparición en el proyecto]** → Sin precedente interno del que copiar
el criterio. Mitigación: encapsularlo en un helper de `shared/`, respetar `prefers-reduced-motion`, y
acompañarlo siempre de foco programático (D2) — un scroll sin foco es inaccesible con N bloques
idénticos en la misma página. En jsdom `scrollIntoView` no existe por defecto: los tests necesitan
stub, y **testear el foco, no el scroll** (el foco sí es observable).

**[La vista imprimible agrega una superficie de lectura agregada de datos de salud]** → Una sola
página que junta toda la documentación de una actividad no existía hasta ahora. Mitigación: gateada
por el mismo permiso de lectura del módulo Pacientes (Checkpoint (g)); no expone nada que el usuario
no vea ya en pantalla. Pero cuenta para el encuadre CRÍTICO del Checkpoint (f).

**[La policy de RLS podría no cubrir el `UPDATE`]** → `Write documentos` es `ALL` con
`modulos.tiene_permiso('pacientes','write')`, y `ALL` incluye `UPDATE`. Bajo, pero **verificar contra
la base, no asumir**: es una tarea explícita, no una nota.

---

## Migration Plan

**Base de datos: ninguna migración.** `pacientes.documentos.direccion_id` ya existe, es nullable y
tiene `ON DELETE RESTRICT` (`20260807010000_documentos_direccion_id.sql`). Transferir es un `UPDATE`
sobre una columna existente. Storage: sin cambios (D3).

**Orden de aplicación recomendado** (riesgo creciente, cada paso desplegable y revertible por sí
solo):

1. **3.b — Exportar.** Vista nueva, aditiva, cero efecto sobre datos. Revertir = borrar el componente
   y su botón.
2. **3.a — Navegar.** Único cambio estructural: el lift-state de D1. Cero efecto sobre datos.
   Revertir = devolver el `useState` al hijo y quitar la acción de la fila.
3. **3.c — Transferir.** Único con efecto sobre datos, y **el único cuyo rollback de código no
   deshace lo ya ejecutado**: las transferencias hechas dejan documentos con otro `direccion_id` y
   —salvo que el Checkpoint (h) se resuelva a favor de auditar— sin traza del valor anterior.

**Recomendación de despliegue de 3.c:** no liberarlo a la clienta hasta que (a) llegue el video **o**
(h) se resuelva a favor de dejar traza. Decisión de Enzo, no del propose.

---

## Open Questions

Genuinamente diferibles — no cambian las specs, el enfoque ni el desglose de tareas:

- **Etiqueta exacta de la acción de navegación** ("Ver documentación" / "Ir a su documentación" /
  ícono). Cosmético, se ajusta con la usuaria al implementar.
- **¿La vista imprimible de una actividad debería tener también una variante "todas las actividades
  del paciente"?** Nadie lo pidió. Aditivo, se puede agregar después sin tocar nada de lo diseñado.
- **Orden de los destinos en el selector de transferencia** (alfabético, por tipo, "General" primero).
  Cosmético.

> Todo lo que **sí** cambiaría las specs o las tareas está arriba como **Checkpoint**, no acá. Los
> checkpoints se resuelven en `tasks.md` §0 **antes** de escribir código, no durante.
