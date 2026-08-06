## Context

**Lo que hay hoy, verificado leyendo los archivos.**

`DocumentChecklist.tsx` (173 líneas) es el único componente documental del proyecto y está montado en
**seis** lugares: los cuatro wrappers de dominio (`PacienteDocumentosChecklist.tsx`,
`VehiculoDocumentos.tsx`, `ConductorDocumentos.tsx`, `FacturaDocumentos.tsx`), el preview de solo
lectura del editor de checklists de obras sociales (`ChecklistEditor.tsx`, que lo monta con
`readOnly`) y la demo del catálogo (`DesignSystem.tsx:200`). Sus acciones por fila son exactamente
tres:

```tsx
{cargado ? 'Agregar otro' : 'Subir'}          // botón por ítem
<button aria-label={`Quitar ${item.nombre} - ${doc.nombreArchivo}`} …>  // por documento
```

Y el nombre del archivo se renderiza como **texto plano, no como link**:

```tsx
<span className="font-body text-[11px] text-muted">
  {doc.nombreArchivo} · {new Date(doc.subidoEn).toLocaleDateString('es-AR')}
  {vigente?.id === doc.id && <Chip kind="info">Vigente</Chip>}
</span>
```

El tipo compartido, tras `pacientes-documentos-multiples`:

```ts
export interface DocumentoAdjunto {
  id: string;              // ← agregado por pacientes-documentos-multiples
  itemId: string;
  nombreArchivo: string;
  subidoEn: string;        // ISO date
  vigenciaDesde?: string;  // ISO date opcional
}
```

**Ningún campo apunta al contenido del archivo.** Y el mock tira el `File` de entrada:
`upload()` recibe `file: File` y solo conserva `file.name`. El `store` es un `Map` en memoria de
sesión (sin `localStorage`, sin `SCHEMA_VERSION` — distinto del resto de los mocks del proyecto, que
sí persisten versionados; ver D3 de `pacientes-documentos-multiples/design.md`).

**El input de archivo ya acepta lo que se querría previsualizar**:
`<input type="file" accept="image/*,.pdf" />` — imágenes y PDF. Eso define exactamente los dos
formatos que el visor tiene que resolver, y `integracion-documentos` §Open Questions ya advierte que
`accept` es *"una sugerencia del navegador, no una validación: nada impide arrastrar un `.exe`
renombrado"*.

**El backend existe pero está desconectado.** Los 4 buckets privados y sus policies RLS están
aplicados desde `C-03`. Las 4 tablas `*.documentos` tienen `archivo_url TEXT NOT NULL`. La Edge
Function `pacientes-documentos` tiene CRUD completo. **Cero referencias desde `frontend/src`.**
`integracion-documentos` (el change que cerraría ese hueco) está en **1 de 55 tasks**.

**Precedente de portal en el design system.** `Tooltip` (`components.tsx:359-388`) ya usa
`createPortal` de `react-dom`, con la justificación escrita en el propio archivo (escapar del stacking
context del `<aside>`). El overlay de este change reusa esa técnica, no la inaugura.

## Goals / Non-Goals

**Goals**

1. Que un usuario pueda **ver el contenido** de un documento cargado sin salir de la pantalla del
   checklist ni descargarlo — el pedido literal de la clienta.
2. Que el mecanismo sirva a los **cuatro dominios** documentales sin duplicar código, respetando el
   principio *"nunca cambia la forma del dato"*.
3. Que la "ventana pequeña" sea un **componente del design system**, no markup ad-hoc dentro de
   `DocumentChecklist.tsx` (regla dura del proyecto).
4. Que el contrato quede escrito de forma que `integracion-documentos` lo implemente contra Storage
   real **sin volver a abrir el componente compartido**.

**Non-Goals**

1. No conectar Storage real (eso es `integracion-documentos`).
2. No escribir ni aplicar migraciones.
3. No relajar la privacidad de los buckets ni sus policies.
4. No incorporar dependencias nuevas de visor (ver Checkpoint (e)).
5. No resolver el punto 2 del feedback (checklist a nivel actividad).

---

## Checkpoint (a) — La decisión central: ¿qué se previsualiza, si hoy no se guarda nada?

**Bloqueante. Sin veredicto acá, ninguna task de código puede empezar.**

El problema en una línea: `mockDocumentoRepository` **descarta el `File`**, así que hoy no existe
ningún byte que mostrar; y el backend que sí los tendría no está conectado (1/55 tasks).

### Opción A — Mock previsualizable (`ObjectURL` en memoria)

`mockDocumentoRepository` deja de tirar el `File`: lo guarda junto al `DocumentoAdjunto` y expone su
contenido vía `URL.createObjectURL(file)`. La previsualización funciona **hoy**, en desarrollo y en la
demo del catálogo, sin backend.

- ✅ El change es **autocontenido**: se puede aplicar, testear y mostrarle a la clienta esta semana.
- ✅ Coherente con cómo ya opera todo el frontend del proyecto (190 tests, 10 changes archivados,
  todo sobre mocks).
- ✅ Deja el contrato y el componente escritos; `integracion-documentos` solo cambia **la
  implementación** del método (de `ObjectURL` a `createSignedUrl`), no la UI.
- ⚠️ **Lo que se demuestra no es lo que va a correr.** En mock la URL es local e instantánea; en
  producción es una URL firmada con expiración, latencia y modos de falla (403 de RLS, 404 de bucket,
  URL vencida). El componente tiene que contemplar carga y error **desde el día uno**, o la demo
  miente.
- ⚠️ `ObjectURL` **hay que revocarlo** (`URL.revokeObjectURL`) o se filtra memoria mientras dure la
  sesión. Y muere al recargar la página: tras un F5 los documentos "cargados" del mock ya no se pueden
  previsualizar (el `Map` en memoria se vacía igual, así que el estado es consistente, pero conviene
  saberlo).
- ⚠️ Guardar el `File` en el mock **cambia la forma de lo que el repository almacena** — no la del
  tipo `DocumentoAdjunto` expuesto, pero sí la del store interno.

### Opción B — Bloquear este change hasta que `integracion-documentos` aterrice

No se escribe nada de previsualización hasta que exista `SupabaseDocumentoRepository` y haya archivos
reales en Storage.

- ✅ Lo que se construye es **lo que va a correr**, sin doble implementación ni demo engañosa.
- ✅ Evita agregarle un método al contrato `DocumentoRepository` que `integracion-documentos`
  (que se comprometió a **no tocar la interfaz**) tendría que absorber a mitad de camino.
- ❌ **Bloqueado detrás de 54 tasks pendientes**, un change que además tiene 4 checkpoints propios sin
  resolver. La clienta no ve nada durante ese tiempo.
- ❌ Rompe el modo de trabajo del proyecto: acá **siempre** se construyó UI contra mock primero y se
  swapeó el repository después. Sería la primera excepción.

### Opción C — Híbrido: contrato + componente ahora, resolución real después

Se escriben el tipo, el método del contrato, el componente de design system y la acción "Ver" con
tests completos; el mock resuelve el contenido de forma **degradada explícita** (muestra el nombre,
el tipo de archivo y un estado *"la previsualización estará disponible cuando se conecte el
almacenamiento real"*), sin `ObjectURL`.

- ✅ Todo el andamiaje queda hecho y testeado; `integracion-documentos` solo rellena una función.
- ✅ Ningún riesgo de demo engañosa: el estado degradado **se ve** como degradado.
- ❌ La clienta pidió *ver el documento* y esta opción, hasta la integración, **no se lo muestra**.
  Cumple la forma, no el pedido.

**Recomendación de este propose: Opción A**, precisamente porque el propósito que la clienta declaró
es *"reforzar el control de errores de carga"* — y ese control se ejerce **en el momento de subir**,
donde el `File` está en la mano y el `ObjectURL` es incluso más fiel que una ida y vuelta a Storage.
Con dos condiciones no negociables: (1) el componente contempla `cargando`/`error` desde el día uno,
para que la migración a URL firmada no lo rediseñe; (2) se revoca el `ObjectURL` al desmontar.

**Se necesita veredicto explícito de Enzo. No se decide unilateralmente.**

---

## Checkpoint (b) — ¿Qué pasa con `documentos-descarga-firmada`?

**Bloqueante para el nombre y el alcance del change.**

Hallazgo (ver `proposal.md` §Why punto 4): `documentos-descarga-firmada` **no existe** como carpeta,
**no está** en `CHANGES.md`, y la anotación que `integracion-documentos` §D6 prometió dejar en
`knowledge-base/10_preguntas_abiertas.md` **nunca se escribió**. Existe únicamente como dos menciones
dentro del `design.md` de un change no aplicado.

Técnicamente los dos objetivos son **el mismo mecanismo** con distinto destino final del byte:
`createSignedUrl` contra un bucket privado → renderizar (previsualizar) o entregar al navegador
(descargar).

### Opción B1 — Fusionar: este change absorbe la descarga

`documentos-previsualizacion` cubre **ver y bajar**. Se cierra el criterio de US-900 completo
(*"consultar y descargar"*) de una sola vez. `documentos-descarga-firmada` se declara absorbido y
nunca se crea.

- ✅ Un solo change, un solo contrato, un solo componente. Cero contradicción en `CHANGES.md` porque
  hay una sola entrada.
- ✅ US-900 queda **cumplido de verdad**, con sus tres criterios tildables.
- ⚠️ Amplía el alcance más allá de lo que la clienta pidió en el punto 4 (ella pidió ver, no bajar).
- ⚠️ Con la Opción A del Checkpoint (a), "descargar" desde un `ObjectURL` de mock es trivial pero aún
  más engañoso que previsualizar: baja el archivo que el propio navegador tiene en memoria.

### Opción B2 — Complementarios por capa: este change es la UI, el otro es el backend

`documentos-previsualizacion` construye el **contrato + componente + acción "Ver"** contra mock;
`documentos-descarga-firmada` se reformula como el change que **implementa `createSignedUrl` y agrega
la descarga** cuando exista Storage real, heredando todo lo que este deja escrito.

- ✅ Cada change hace una cosa y las dos entradas de `CHANGES.md` son coherentes entre sí (una dice
  "UI contra mock", la otra "resolución real + descarga").
- ✅ Respeta el pedido literal de la clienta sin inflarlo.
- ⚠️ Obliga a **crear efectivamente** `documentos-descarga-firmada` (hoy huérfano) y a escribir la
  anotación en `10_preguntas_abiertas.md` que §D6 prometió — trabajo de tracking, no de código.

### Opción B3 — Ignorarlos como temas separados

Dejar `documentos-descarga-firmada` como está (una mención huérfana) y no relacionarlos.

- ❌ **Es el estado actual y es el problema.** Dos entradas que se van a contradecir en cuanto
  alguien retome cualquiera de las dos. Se lista solo para descartarla explícitamente.

**Recomendación de este propose: Opción B2.** Mantiene el alcance fiel al pedido y **usa** este
propose para reparar el tracking huérfano en vez de agravarlo. Sea cual sea el veredicto, este change
**debe** dejar escrito en `CHANGES.md` y en `10_preguntas_abiertas.md` cuál es la relación — la
alternativa (no escribir nada) ya se probó y produjo el hallazgo.

**Se necesita veredicto explícito de Enzo.**

---

## Checkpoint (c) — Gobernanza: ¿CRÍTICO, ALTO o MEDIO?

`pacientes-documentos-multiples` (el precedente más cercano, aplicado hoy mismo) resolvió su
Checkpoint (d) declarándose **CRÍTICO**, con el criterio *"mismo que los `gateo-*`: pantalla del
dominio Pacientes"* (`CHANGES.md:188`). `C-05` (Pacientes) es CRÍTICO en la tabla de gobernanza.

El prompt de esta tarea plantea la duda razonable de si un change **de solo lectura** merece el mismo
nivel. Los dos argumentos, sin resolver unilateralmente:

**A favor de bajarlo (MEDIO/ALTO)**: no escribe datos, no borra nada, no toca RLS, no toca schema. Un
bug de render no corrompe información clínica.

**A favor de mantenerlo CRÍTICO**: este change hace **exactamente lo que los demás changes del
dominio evitaron a propósito** — abrir una superficie de lectura sobre documentos clínicos.
`integracion-documentos` §D7 lo dice con todas las letras: *"Los buckets siguen privados. Este change
no genera URLs públicas ni firmadas (D6): no crea **ninguna** superficie de lectura nueva sobre datos
clínicos."* Este propose revierte esa postura de forma deliberada. Además, "solo lectura" es
justamente la categoría donde una filtración duele: un documento de salud mostrado a quien no
corresponde es un incidente de privacidad aunque nadie haya escrito un byte.

**Recomendación de este propose: CRÍTICO**, alineado con el precedente inmediato y con el hecho de que
la lectura —no la escritura— es el riesgo dominante acá. Bajo gobernanza CRÍTICA, la implementación
**no arranca sin aprobación humana explícita**, que es exactamente lo que estos checkpoints piden.

**Invariantes que este change NO negocia, decida lo que decida el checkpoint:**
- Los 4 buckets siguen `public: false`. Sin excepciones, sin "solo para desarrollo".
- Nunca se usa `SUPABASE_SERVICE_ROLE_KEY` desde frontend (regla dura del proyecto).
- El gateo de cliente (`readOnly={!puedeEscribir}`) no se relaja. Nota: `readOnly` gatea **escritura**;
  la previsualización es lectura, y el principio ya escrito en los wrappers (*"el gateo del cliente
  nunca debe ser más restrictivo que la RLS del servidor"*) implica que **"Ver" debe seguir disponible
  en modo `readOnly`** — quien tiene permiso de lectura del módulo puede consultar. Salvo veredicto en
  contra.
- La RLS del servidor es la única autoridad real. Ningún chequeo de cliente decide si una operación
  procede.

**Se necesita veredicto explícito de Enzo.**

---

## Checkpoint (d) — El componente nuevo del design system: nombre, forma y la convención "nunca modal"

**Tensión a resolver por escrito.** `knowledge-base/08_arquitectura_propuesta.md:28` establece que el
detalle de una entidad revela el formulario *"inline, en la misma pantalla — **nunca como modal** ni
como pantalla separada"*, y la línea 35 extiende el criterio a sub-secciones embebidas (incluyendo
explícitamente *"checklist documental"*). La clienta, en cambio, pidió textualmente *"una ventana
pequeña"*.

**Lectura de este propose**: la convención regula **formularios de edición** (su motivo declarado es
que los datos ya cargados "parecían campos editables" cuando no correspondía tocarlos). Una superficie
**de solo lectura, efímera y sin inputs** no es lo que esa regla prohíbe. Pero como el componente vive
en el design system y va a ser reusable, hace falta que quede escrito que **no es un vehículo para
formularios** — o alguien lo va a usar para eso en seis meses.

### Opciones de forma

- **D-i — Overlay centrado con backdrop** (lo que la clienta llamó "ventana pequeña"). Es lo más
  parecido a lo pedido. Requiere `createPortal` (precedente: `Tooltip`), foco atrapado, cierre con
  `Escape` y click en el backdrop, `role="dialog"` + `aria-modal` + `aria-labelledby`.
- **D-ii — Panel expandible inline** dentro de la fila del documento, sin overlay. Máxima fidelidad a
  la convención "nunca modal", pero **no es lo que la clienta pidió** y en un checklist de 2 columnas
  con N documentos por ítem el layout se vuelve caótico.
- **D-iii — Drawer lateral**. Ni una cosa ni la otra; sin precedente en el proyecto.

**Recomendación: D-i**, con la restricción escrita en el propio componente de que es para contenido de
solo lectura.

### Definiciones que necesitan veredicto

1. **Nombre del componente.** Candidatos: `VentanaPrevisualizacion` (específico, en español como
   `CamposSoloLectura`/`AvisoSoloLectura`/`VolverAlListadoLink`, pero acota su reuso),
   `Overlay`/`VentanaFlotante` (genérico y reusable), o `ModalSoloLectura` (nombra la restricción,
   pero usa la palabra que la convención prohíbe). **El design system del proyecto nombra en
   castellano** cuando el componente es específico del dominio y en inglés cuando es genérico
   (`Button`, `Chip`, `Section`, `Table` vs. `CamposSoloLectura`, `AvisoModeloDatos`,
   `VolverAlListadoButton`) — el nombre elegido debería respetar ese patrón.
2. **¿Genérico o específico de documentos?** Un `Overlay` genérico + un contenido de previsualización
   compuesto adentro es más reusable; un `VentanaPrevisualizacion` cerrado es más simple y menos
   susceptible de mal uso. Trade-off directo entre reuso y guardarraíl.
3. **Entrada de catálogo obligatoria** en `DesignSystem.tsx` — no negociable, es donde el resto del
   equipo descubre que el componente existe (y la razón por la que la regla dura de "revisar el design
   system antes de escribir markup" funciona).

**Se necesita veredicto explícito de Enzo.**

---

## Checkpoint (e) — Qué formatos se previsualizan y con qué

`<input accept="image/*,.pdf">` define el universo: **imágenes y PDF**.

- **Imágenes**: `<img src={url}>`. Sin dependencias, funciona en todos lados.
- **PDF**: las opciones son `<iframe src={url}>` / `<embed>` (visor nativo del navegador, cero
  dependencias, pero el resultado varía por navegador y algunos móviles lo bajan en vez de mostrarlo)
  o una librería tipo `pdf.js` (control total, **dependencia nueva** — el proyecto hoy no la tiene).
- **Cualquier otro tipo** (el `.exe` renombrado que `integracion-documentos` ya advirtió, o un `.docx`
  que alguien fuerce): **no se intenta renderizar**. Se muestra un estado explícito de "no
  previsualizable" con el nombre y el tipo. Nunca se inyecta contenido desconocido en un `<iframe>`
  sin declarar su tipo.

**Recomendación: `<iframe>` nativo, sin dependencias nuevas**, coherente con el principio del proyecto
de *"priorizar funcionalidad sobre estética (RNF-05)"* y con no haber sumado ni una librería de UI en
10 changes archivados. Si la clienta necesita después zoom/paginación/anotaciones, se propone `pdf.js`
como change aparte con su justificación.

**Nota de seguridad para la implementación**: un `<iframe>` que apunta a contenido subido por usuarios
debe ir **sandboxeado** (`sandbox` sin `allow-scripts` ni `allow-same-origin`), o un PDF/SVG malicioso
puede ejecutar script en el origen de la app. Esto aplica igual en mock (`ObjectURL` es same-origin)
que contra URL firmada. **No es opcional** — se escribe acá para que no se descubra en code review.

Esto no es bloqueante para el propose (es una decisión de implementación acotada), pero conviene que
Enzo lo mire junto con el resto.

> **⚠️ Corrección (2026-08-06, hallada en verificación manual, `tasks.md` 8.2)**: `sandbox=""` (sin
> `allow-same-origin`) impedía cargar `blob:` — el iframe queda con origen opaco y los navegadores
> bloquean esa carga, independiente de que el contenido sea confiable o no. Implementado con
> `sandbox="allow-same-origin"` en su lugar. Sigue siendo seguro: el escape de sandbox conocido
> requiere `allow-scripts` **y** `allow-same-origin` juntos — con solo `allow-same-origin`, sin
> `allow-scripts`, nada dentro del iframe puede ejecutar código, tenga o no identidad de origen.

> **⚠️ Corrección (2026-08-06, hallada en verificación manual, `tasks.md` 8.2, segunda vuelta —
> revierte la recomendación de este mismo Checkpoint)**: con `sandbox="allow-same-origin"` la
> `blob:` sí cargaba (fix anterior), pero el **visor nativo de PDF del navegador se niega a correr
> dentro de CUALQUIER iframe sandboxeado**, sin importar la combinación de tokens — confirmado
> empíricamente en dos navegadores (Arc y otro Chromium) sacando el `sandbox` por completo como
> diagnóstico temporal (ya revertido): sin `sandbox` el PDF cargaba perfecto, con cualquier
> combinación de `sandbox` no. Conclusión: no existe una combinación de `sandbox` que sea segura y
> funcional a la vez — el escape de sandbox conocido necesita `allow-scripts` + `allow-same-origin`
> juntos, que es exactamente lo que el visor nativo necesitaría para correr, y exactamente lo que
> no se le puede conceder a contenido subido por un usuario en un dominio con datos clínicos.
>
> **Decisión (consultada y aprobada explícitamente por el usuario, gobernanza CRÍTICO — dominio de
> documentos clínicos)**: se agrega `pdfjs-dist` como dependencia nueva y se renderiza el PDF a un
> `<canvas>` con un componente propio (`shared/components/PdfPreview.tsx`), reemplazando por
> completo el `<iframe>` para el caso PDF. pdf.js parsea el archivo y dibuja gráficos/texto vía la
> API de canvas — no ejecuta nada del contenido del PDF como si fuera HTML/script de la página, así
> que no hay iframe, no hay plugin del navegador, no hay browsing context separado, y por lo tanto
> no hace falta `sandbox` en absoluto para este caso. Esto revierte la recomendación explícita de
> este mismo Checkpoint ("`<iframe>` nativo, sin dependencias nuevas") — el veredicto original
> asumía que el visor nativo funcionaría dentro de un iframe sandboxeado, lo cual resultó falso en
> la práctica. Worker de pdf.js configurado con el patrón estándar de Vite (`?url` sobre
> `pdf.worker.min.mjs`, asignado a `GlobalWorkerOptions.workerSrc`), confirmado tanto en dev como
> en un build real (`npm run build`: el worker se emite como asset propio, referenciado por URL).
> Ver evidencia completa (tests, TDD cycle, `tsc`/`oxlint`/build) en `tasks.md` bajo 5.4/8.2.

---

## Decisions

> Todas las decisiones de esta sección son **condicionales a los checkpoints**. Se escriben ahora
> para que, una vez que Enzo dé el veredicto, la fase de apply no tenga que rediseñar nada.

### D1 — El campo nuevo va en `DocumentoAdjunto`, no en un tipo paralelo

El encabezado de `shared/types/documento.ts` fija el principio: *"el mismo checklist/documento se
reusa en Pacientes, Vehículos, Conductores y Facturas — solo cambia la entidad y la lista de items,
**nunca la forma del dato**"*. Un `DocumentoAdjuntoPaciente` con URL sería exactamente la violación
que ese comentario previene, y `pacientes-documentos-multiples` ya sentó el precedente de agregar al
tipo compartido (`id`, `vigenciaDesde`) en vez de bifurcar.

**Forma propuesta** (sujeta al Checkpoint (a)):

```ts
export interface DocumentoAdjunto {
  id: string;
  itemId: string;
  nombreArchivo: string;
  subidoEn: string;
  vigenciaDesde?: string;
  /** Tipo MIME del archivo cargado (`file.type`). Decide si el documento es previsualizable y con
   *  qué elemento (imagen / PDF / no previsualizable). Opcional: los documentos cargados antes de
   *  este change no lo tienen. */
  tipoMime?: string;
}
```

**La URL NO va en el tipo.** Un `ObjectURL` de mock no debe viajar dentro del modelo de datos, y una
URL firmada **expira** — persistirla en el tipo sería guardar un dato que se pudre. Se resuelve bajo
demanda vía el repository (D2). Esto también evita que `integracion-documentos` tenga que decidir qué
hacer con un campo de URL al mapear desde `archivo_url`.

### D2 — La resolución del contenido va en `DocumentoRepository`, bajo demanda

```ts
export interface DocumentoRepository {
  listByEntity(entidad: EntidadDocumental, entidadId: string): Promise<DocumentoAdjunto[]>;
  upload(…): Promise<DocumentoAdjunto>;
  remove(entidad: EntidadDocumental, entidadId: string, documentoId: string): Promise<void>;
  /** Resuelve una URL utilizable para MOSTRAR el documento, sin descargarlo. Bajo demanda porque
   *  el resultado es efímero: ObjectURL en el mock, URL firmada con expiración contra Storage
   *  privado en la implementación real. Nunca se persiste en DocumentoAdjunto. */
  resolverPrevisualizacion(
    entidad: EntidadDocumental,
    entidadId: string,
    documentoId: string,
  ): Promise<string | null>;
}
```

Devuelve `null` (no lanza) cuando el documento no es previsualizable o no tiene contenido resoluble —
el caso normal para los documentos que ya existían antes de este change. Los fallos reales (403 de
RLS, 404 de bucket, URL vencida) sí se propagan como error, para que la UI los distinga de "no hay
nada que ver".

**Consecuencia que hay que comunicar**: `integracion-documentos` se comprometió por escrito a **no
tocar la interfaz `DocumentoRepository`** (§D6). Agregar este cuarto método **rompe ese supuesto**. Si
`documentos-previsualizacion` se aplica primero, `integracion-documentos` tiene que implementar cuatro
métodos en vez de tres — y su §D6 hay que corregirla. Esto se anota en las tasks, no se deja al azar.

### D3 — El overlay se monta desde `DocumentChecklist`, no desde los wrappers

Los cuatro wrappers de dominio (más el `ChecklistEditor` y la demo del catálogo) no cambian de forma:
siguen pasando `items`/`documentos`/`onUpload`/`onRemove`. El estado de "qué documento estoy viendo"
vive dentro de `DocumentChecklist`, igual que hoy vive ahí el `useRef` de los file inputs. Cualquier
otra opción obliga a tocar seis archivos para agregar una acción a uno.

### D4 — "Ver" es una acción por documento, no por ítem

Desde `pacientes-documentos-multiples` un ítem puede tener N documentos y cada uno tiene su `id`
propio y su botón "Quitar". "Ver" vive en el mismo lugar y con la misma granularidad: junto al nombre
del archivo, en la fila del documento. Un botón "Ver" a nivel de ítem no sabría cuál de los N mostrar
— es el mismo razonamiento que llevó a `remove(documentoId)` en D1 de ese change.

**Accesibilidad**: el botón necesita `aria-label` distinguible por documento, siguiendo el patrón ya
establecido por "Quitar" (`aria-label={\`Quitar ${item.nombre} - ${doc.nombreArchivo}\`}`) — con N
documentos por ítem, un `aria-label` genérico produce N botones indistinguibles para lector de
pantalla y para los tests.

### D5 — Estados de carga y error desde el día uno, aunque el mock sea instantáneo

Aunque con la Opción A el `ObjectURL` se resuelve sincrónicamente, el componente contempla
`cargando` / `error` / `no previsualizable` desde el principio. Motivo: la implementación real
(`createSignedUrl` contra Storage) **tiene** latencia y **tiene** modos de falla, y si el componente
no los previó, `integracion-documentos` termina rediseñando la UI — exactamente lo que este change
existe para evitar. Es el mismo criterio que el spec de `paciente-documentos` ya exige para la carga
del checklist (*"sin pantalla en blanco ni loading infinito ante error"*).

### D6 — Sin `SCHEMA_VERSION` en `mockDocumentoRepository`

Sigue vigente D3 de `pacientes-documentos-multiples`: el mock documental es un `Map` en memoria de
sesión, **no persiste en `localStorage`**, así que no hay dato viejo con forma vieja que migrar.
Guardar el `File` (Opción A) no cambia eso — el `File` también muere con la sesión. Si algún día el
mock pasa a `localStorage`, ahí sí hace falta versión, y el `File` **no** sería serializable, lo que
merecería su propia decisión.

### D7 — Orden del trabajo

```
§0  checkpoints resueltos por Enzo                       ← BLOQUEANTE, nada arranca sin esto
§1  DocumentoAdjunto.tipoMime + contrato del repository   (nadie lo consume todavía)
§2  mockDocumentoRepository: conservar el File + resolver
§3  componente de overlay en el design system + catálogo  (independiente de §1-§2)
§4  useDocumentChecklist: exponer la resolución
§5  DocumentChecklist: acción "Ver" + montaje del overlay ← acá recién se ve algo
§6  ajuste de los tests existentes de los 4 dominios
§7  documentación (CHANGES.md, 10_preguntas_abiertas.md, corrección de §D6 de integracion-documentos)
§8  verificación manual (Enzo / la usuaria)
```

Las §1-§4 son invisibles para el usuario; el corte real es §5. La §3 se puede paralelizar con §1-§2
porque el componente de design system no depende del contrato de documentos (esa es justamente la
razón de que sea genérico).

## Open Questions

- **¿La previsualización debe estar disponible en modo `readOnly`?** Este propose asume que **sí**
  (ver Checkpoint (c)): `readOnly` gatea escritura, y el principio ya escrito en los wrappers dice que
  el gateo de cliente nunca debe ser más restrictivo que la RLS. Pero `ChecklistEditor` monta el
  checklist con `readOnly` como **preview de configuración** de obra social, con documentos de ejemplo
  — ahí "Ver" no tendría sentido. Puede necesitar una prop aparte o simplemente no importar (en ese
  preview no hay documentos reales cargados).
- **¿Se registra en auditoría quién previsualizó qué?** `C-02` implementó auditoría de módulos. Ver un
  documento clínico es un acceso a dato sensible; hoy la app no lo registra (ni podría, porque no se
  puede ver nada). No se resuelve acá, pero si la gobernanza queda CRÍTICA (Checkpoint (c)) es una
  pregunta que corresponde hacerle a Enzo antes de aplicar.
- **Tamaño máximo previsualizable.** `integracion-documentos` ya dejó abierto que el límite del bucket
  no se verificó y que `413` está traducido por las dudas. Un PDF de 80 MB dentro de un `<iframe>` en
  una "ventana pequeña" es mala experiencia aunque técnicamente funcione. Sin dato del límite real, no
  se fija un umbral acá.
- **¿La clienta espera previsualizar también en el momento de subir, antes de confirmar?** El
  propósito que declaró (*"evitar subir un documento en el checklist/actividad equivocada"*) sugiere
  que el momento de mayor valor es **antes** de que la carga se consolide, no después. Hoy el flujo no
  tiene paso de confirmación: `onChange` del `<input>` dispara `onUpload` directo. Agregar un paso de
  confirmación previa es un cambio de flujo mayor y **no está propuesto acá** — pero conviene
  preguntárselo antes de dar el punto 4 por cerrado.
- **Punto 2 del feedback (checklist por actividad).** La clienta lo nombra dentro del mismo párrafo
  del punto 4 ("checklist/**actividad** equivocada"). Si ese change se hace después, la
  previsualización lo hereda sin cambios; si se hace antes, hay que revisar dónde queda montado el
  checklist. Sin dependencia técnica dura en ninguna dirección.
