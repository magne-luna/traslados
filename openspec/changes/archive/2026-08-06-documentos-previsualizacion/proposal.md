## Why

Feedback real de la clienta (Andrea Pastor), "Ronda 2" — **punto 4 de 7** de la síntesis
transcripta de notas de voz de WhatsApp (`docs/cambios/cambios2-requerimientos.pdf`, 2026-08-06).
Resumen verbatim del punto:

> Ventana de previsualización de documentos. Al cargar/consultar un documento (mencionan el RHC),
> poder abrir una ventana pequeña que muestre qué se cargó — una previsualización del documento
> subido. Propósito: verificar de un vistazo el contenido cargado sin tener que descargar o salir de
> la pantalla. Refuerza el control de errores de carga (evitar subir un documento en el checklist/
> actividad equivocada).

**Alcance explícito: solo el punto 4.** Los otros seis puntos del mismo documento de feedback son
changes aparte (uno de ellos, el punto 1, ya está aplicado como `pacientes-documentos-multiples`).

### Verificado contra el código, no asumido

**1. Hoy no existe ninguna previsualización, y tampoco descarga.** `grep -rn "preview\|previsualiz"`
sobre `frontend/src/shared/components/DocumentChecklist.tsx` y `frontend/src/shared/lib/documentos/`
no devuelve nada. Las acciones del checklist son exactamente tres: **Subir / Agregar otro / Quitar**
(verificado leyendo el componente, líneas 117-148). No hay botón de descarga ni de vista. El nombre
del archivo se renderiza como texto plano (`{doc.nombreArchivo}`), no como link.

**2. El nombre del archivo es lo único que se guarda.** `mockDocumentoRepository.upload()` recibe el
`File` que el usuario eligió y **descarta el binario**, quedándose solo con `file.name`:

```ts
// mockDocumentoRepository.ts, upload()
const nuevo: DocumentoAdjunto = {
  id: generateId('documento'),
  itemId,
  nombreArchivo: file.name,          // ← lo único que sobrevive del File
  subidoEn: new Date().toISOString(),
  vigenciaDesde,
};
```

`DocumentoAdjunto` (`shared/types/documento.ts`) **no tiene hoy ningún campo de URL, blob ni clave de
Storage**. No hay nada que previsualizar: ni en el mock (que tira el archivo) ni contra el backend
(que el frontend todavía no consume). **Esta es la decisión central de este change** — ver Checkpoint
(a) de `design.md`.

**3. El dominio documental sigue 100 % en mock, incluido Pacientes.**
`openspec/changes/integracion-documentos/` está **propuesto pero no aplicado**: 1 de 55 tasks
marcadas. No existe ningún `SupabaseDocumentoRepository.ts` en el árbol del repo (confirmado con
`find`). Los cuatro buckets de Storage existen y son **privados** (`openspec/specs/storage-buckets/
spec.md`: *"Todos los buckets MUST ser privados (sin acceso público)... subida/descarga solo mediante
operaciones autenticadas con RLS"*), con sus policies aplicadas desde `C-03` — pero **no hay ni un
archivo real adentro puesto por esta app**, porque ninguna pantalla escribe en Storage todavía.

**4. Relación con `documentos-descarga-firmada` — y un hallazgo: ese change no existe en ningún
lado salvo como mención.** `integracion-documentos/design.md` §D6 dice textualmente:

> `US-900` pide *"consultar y **descargar** los documentos adjuntos"*. `DocumentChecklist` **nunca
> tuvo** botón de descarga... Se propone como change propio: `documentos-descarga-firmada`, y se
> anota en `10_preguntas_abiertas.md` para que el criterio de aceptación de US-900 no quede
> tácitamente dado por cumplido.

Verificado: **no existe** `openspec/changes/documentos-descarga-firmada/`, **no aparece** en
`CHANGES.md` (grep sin resultados), y **la anotación prometida en `knowledge-base/10_preguntas_
abiertas.md` nunca se escribió** (grep de `descarga`/`US-900`/`previsualiz` sobre ese archivo: sin
resultados; el único hit de "descargar" es sobre ARCA, otro tema). O sea: `documentos-descarga-
firmada` es hoy **una promesa huérfana en un design.md de un change no aplicado**. Este propose no
puede ignorarlo — ver Checkpoint (b), que pide veredicto sobre si los dos objetivos se fusionan, se
absorben o quedan complementarios, y deja escrito qué entrada corresponde en `CHANGES.md` en cada
caso para que las dos no se contradigan.

El problema de fondo es **el mismo** en los dos casos: bucket privado ⇒ no hay URL pública ⇒ tanto
"ver" como "bajar" un documento necesitan `createSignedUrl(clave, expiración)` contra Storage, más un
campo en `DocumentoAdjunto` que apunte al objeto. La diferencia es solo qué se hace con la URL
firmada: renderizarla en un `<iframe>`/`<img>` (previsualizar) o entregarla al navegador como descarga
(`download`). **Técnicamente, previsualizar es descargar y no mostrar el diálogo de guardado.**

**5. No existe ningún componente de ventana/overlay en el design system.** `grep` sobre
`frontend/src/design-system/components.tsx` por `Modal|Dialog|Drawer|Sheet|Popover` no devuelve
ningún export. Los 20 exports actuales son `Section`, `Swatch`, `Button`, `CamposSoloLectura`,
`AvisoSoloLectura`, `VolverAlListadoLink`, `VolverAlListadoButton`, `SearchInput`, `Chip`,
`AvisoModeloDatos`, `AvisoPendienteCliente`, `Tooltip`, `NavIcon`, `InlineIcon`, `ChecklistOption`,
`FieldGroupHeading`, `SectionBadge`, `redondearProgreso`, `ProgressBar`. La clienta pidió
literalmente *"una ventana pequeña"*. La regla dura del proyecto obliga a *"revisar
`design-system/components.tsx` antes de escribir markup nuevo... reusar los componentes existentes en
vez de reimplementar"* — acá el componente reutilizable **no existe todavía**, así que este change lo
crea en el design system (con su entrada en el catálogo `DesignSystem.tsx`), **nunca** como markup
ad-hoc dentro de `DocumentChecklist.tsx`.

**Hallazgo relevante y a favor**: `Tooltip` (`components.tsx:359`) **ya usa `createPortal`** de
`react-dom` para escapar del stacking context del `<aside>`. O sea, el patrón de portal ya tiene
precedente y justificación escrita en este design system — el overlay nuevo no inaugura una técnica,
la reusa.

**Tensión a resolver con la convención de UI (Checkpoint (d)).**
`knowledge-base/08_arquitectura_propuesta.md:28` dice: el detalle de una entidad revela el formulario
*"inline, en la misma pantalla — **nunca como modal** ni como pantalla separada"*. Leído al pie de la
letra, esa regla habla de **formularios de edición**, no de superficies de solo lectura — y este
change es estrictamente de lectura. Pero la clienta pidió una "ventana", así que la tensión tiene que
quedar resuelta por escrito y no por interpretación de quien implemente.

## What Changes

- **`DocumentoAdjunto` gana una referencia al contenido del archivo**, respetando el principio ya
  escrito en `shared/types/documento.ts` (*"solo cambia la entidad y la lista de items, nunca la forma
  del dato"*): el campo se agrega **al tipo compartido**, no a un tipo paralelo solo para Pacientes.
  La forma exacta del campo depende del Checkpoint (a).
- **`DocumentChecklist.tsx` gana una acción nueva de "Ver"** por documento puntual (junto a "Quitar",
  que ya apunta al documento por su `id` desde `pacientes-documentos-multiples`). No se quita ni se
  renombra ninguna acción existente.
- **Componente nuevo de overlay/ventana en el design system**
  (`frontend/src/design-system/components.tsx`) con su entrada de catálogo en `DesignSystem.tsx` —
  reusable, no específico de documentos. Nombre y API exactos: Checkpoint (d).
- **`DocumentoRepository` gana un método para resolver el contenido previsualizable** de un documento.
  Es el punto de extensión que hoy resuelve el mock y mañana resuelve `createSignedUrl` contra Storage
  sin volver a tocar el componente — mismo criterio que ya usa el contrato ("cuando `C-03` se archive
  se escribe un `SupabaseDocumentoRepository` que cumpla este mismo contrato... los componentes no
  cambian"). Sujeto a Checkpoint (a) y (b).
- **`mockDocumentoRepository` deja de descartar el `File`** (si el Checkpoint (a) se resuelve por la
  opción de mock previsualizable).

### Lo que este change explícitamente NO hace

- **No conecta Supabase Storage real ni escribe `SupabaseDocumentoRepository.ts`.** Eso es
  `integracion-documentos` (1/55 tasks, no aplicado). Este change deja el **contrato** listo para que
  esa integración lo implemente sin re-abrir el componente compartido.
- **No escribe ninguna migración de base de datos.** Ver `Impact` § Base de datos.
- **No implementa descarga** (botón que baje el archivo al disco) salvo que el Checkpoint (b) se
  resuelva por la opción de fusión.
- **No toca las políticas RLS de `storage.objects` ni la privacidad de los buckets.** Siguen privados,
  sin excepción (ver Checkpoint (c)).
- **No pide comportamiento nuevo a Vehículos, Conductores ni Facturas.** Como el componente es
  compartido, los tres lo reciben estructuralmente — pero ninguno de sus specs pide previsualización
  y ninguna pantalla de esos dominios cambia por pedido de negocio en este change.
- **No implementa el punto 2 del feedback** (checklist a nivel actividad/domicilio en vez de
  paciente), aunque la clienta lo menciona en el mismo párrafo del punto 4 ("evitar subir un documento
  en el checklist/**actividad** equivocada"). Ese es un change aparte, de alcance mucho mayor.
- **No define un visor propio de PDF** (nada de `pdf.js` ni dependencias nuevas) — ver Checkpoint (e).

## Capabilities

### Modified Capabilities

- **`paciente-documentos`** (`openspec/specs/paciente-documentos/spec.md`) — capability existente,
  dominio donde la clienta pidió la funcionalidad (menciona el RHC, documento de paciente). Recibe el
  requisito nuevo de previsualización. Los dos requisitos actuales (reutilizar `DocumentChecklist`,
  ítems filtrados por obra social) siguen vigentes sin cambios.

### Capabilities compartidas afectadas a nivel de componente (sin requisito nuevo)

- **`vehiculo-documentos`**, **`conductor-documentos`**, **`factura-documentacion`** — consumen el
  mismo `DocumentChecklist`/`DocumentoAdjunto`/`DocumentoRepository`, así que heredan la capacidad de
  previsualizar apenas este change se mergee. Ninguno de los tres specs declara ni prohíbe
  previsualización, así que no hay contradicción que resolver y **no reciben delta spec** — mismo
  criterio que aplicó `pacientes-documentos-multiples`.

### Capability no cubierta a propósito

- **El componente de overlay del design system no recibe capability spec propia.** Verificado: el
  design system **no tiene** capability en `openspec/specs/` (el change archivado
  `2026-07-27-design-system-componentes-base` no dejó ningún `specs/`). Crear una sola para este
  componente sería inconsistente con los 20 componentes que ya existen sin spec. Se documenta acá en
  vez de inventar una capability nueva de un solo miembro.

## Impact

**Código a modificar** (todo frontend — no hay backend conectado que tocar):

| Archivo | Qué cambia |
|---|---|
| `frontend/src/shared/types/documento.ts` | `DocumentoAdjunto` gana la referencia al contenido (Checkpoint (a)) |
| `frontend/src/shared/lib/documentos/DocumentoRepository.ts` | Método nuevo para resolver el previsualizable |
| `frontend/src/shared/lib/documentos/mockDocumentoRepository.ts` | Deja de descartar el `File`; implementa el método nuevo |
| `frontend/src/shared/lib/documentos/useDocumentChecklist.ts` | Expone la resolución del previsualizable a la UI |
| `frontend/src/shared/components/DocumentChecklist.tsx` | Acción "Ver" por documento + montaje del overlay |
| `frontend/src/design-system/components.tsx` | Componente de overlay nuevo (reusable) |
| `frontend/src/design-system/DesignSystem.tsx` | Entrada de catálogo del componente nuevo |

**Tests existentes que montan `DocumentChecklist`** (verificado con `grep -rl`, **seis** puntos de
montaje, no cuatro): `PacienteDocumentos.test.tsx`, `FacturaDocumentos.test.tsx`,
`ConductorDocumentos.test.tsx`, `DocumentChecklist.test.tsx`, `useDocumentChecklist.test.tsx`, más los
wrappers `PacienteDocumentosChecklist.tsx`, `VehiculoDocumentos.tsx`, `ConductorDocumentos.tsx`,
`FacturaDocumentos.tsx`, el preview de solo lectura `obras-sociales/ChecklistEditor.tsx` y la demo del
catálogo `DesignSystem.tsx`. Ajuste mecánico al contrato nuevo donde haga falta.

> **Nota sobre `PresupuestoForm.tsx`**: aparece en el `grep` de `DocumentChecklist` pero **solo en un
> comentario** que aclara lo contrario (*"archivo único (Decisión 3, Discrepancia 1 — NO
> DocumentChecklist)"*). Presupuestos **no** usa el checklist y **no** entra en el alcance de este
> change. Se deja escrito para que nadie lo cuente de más al estimar el blast radius.

**Sin impacto**

- `PacienteDocumentos.tsx` / los wrappers de los 4 dominios — siguen pasando `items`/`documentos`/
  `upload`/`remove` al componente compartido; el overlay vive dentro de `DocumentChecklist`.
- `ObraSocialRepository`, `obra_social.tipos_documento` — sin cambios.
- `supabase/functions/pacientes-documentos/index.ts` — sin cambios, sigue sin consumidor en frontend.
- Las 4 tablas `*.documentos` y los 4 buckets — sin cambios (ver abajo).

**Base de datos**

- **Ninguna migración se escribe ni se aplica en este propose** (regla dura del proyecto para tareas
  propose-only).
- **La regla dura de RLS no se activa**: este change **no crea ninguna tabla nueva en Supabase**, así
  que la obligación *"toda tabla nueva debe definir sus policies de RLS en el mismo cambio que la
  crea"* no aplica acá — se confirma explícitamente en vez de asumirlo. Las policies de
  `storage.objects` para los 4 buckets ya existen desde `C-03` y **este change no las toca**.
- Si el Checkpoint (a) se resuelve por la opción que persiste una clave de Storage, la columna
  correspondiente la escribe `integracion-documentos` (que ya tiene esa migración planificada en su
  §2, "5 `ADD COLUMN` + 4 policies del bucket", **escrita y no aplicada**), no este change. Acá solo
  queda documentada la forma esperada, como guía no vinculante.

**Fuente de verdad dual (regla dura del proyecto)**

- **Este change no tiene contraparte en `docs/core/Traslados-Modelo-Datos.docx`** y se dice
  explícitamente en vez de omitirlo: es una funcionalidad **de UI/visualización**, no una entidad ni
  un campo del modelo de datos. El docx manda en estructura y acá no se propone estructura nueva de
  negocio. La única cosa parecida a un campo (la referencia al archivo) es un detalle de
  implementación del adaptador de Storage, ya modelado en el backend real como `archivo_url TEXT NOT
  NULL` en las 4 tablas `*.documentos`.
- La regla de negocio de origen sí existe en la KB: `knowledge-base/06_funcionalidades.md` §US-900,
  criterio *"Se pueden **consultar** y descargar los documentos adjuntos cuando haga falta
  presentarlos"* — hoy sin tildar (`[ ]`), y correctamente sin tildar, porque no se puede ni consultar
  ni descargar.
- **No se detectó ninguna discrepancia docx↔KB en este change**, por lo tanto **no corresponde**
  ningún `AvisoModeloDatos` nuevo ni nota en `04_modelo_de_datos.md` §Discrepancias.

**Dependencias**

- **Requiere (ya cumplido)**: `C-03-gestion-documental-core` (tipo/componente/mock compartidos) y
  `pacientes-documentos-multiples` (aplicado 2026-08-06 — de él viene el `id` propio por documento,
  sin el cual "previsualizar *este* documento" no tendría a qué apuntar).
- **Relación no resuelta con `integracion-documentos`**: no lo bloquea ni lo necesita si el Checkpoint
  (a) va por la opción mock. Si va por la opción "esperar backend real", este change queda **bloqueado
  detrás de un change de 55 tasks con 1 hecha**.
- **Relación no resuelta con `documentos-descarga-firmada`**: Checkpoint (b). Es el único checkpoint
  que puede cambiar el **nombre y el alcance** de este propose.

**Riesgo y rollback**

- **Riesgo de seguridad (el más serio de este change)**: cualquier mecanismo que muestre el contenido
  de un documento clínico crea una **superficie de lectura nueva sobre datos de salud** —
  exactamente lo que `integracion-documentos` §D7 evitó a propósito (*"no genera URLs públicas ni
  firmadas: no crea **ninguna** superficie de lectura nueva sobre datos clínicos"*). Este change
  revierte deliberadamente esa postura. Los buckets siguen privados y el gateo de cliente
  (`readOnly`) no se relaja, pero la decisión tiene que ser consciente → Checkpoint (c).
- **Riesgo de alcance**: si el Checkpoint (a) va por "mock previsualizable", lo que se demuestra en
  desarrollo **no es lo que va a correr en producción** (memoria del navegador vs. URL firmada). Hay
  que evitar que la clienta apruebe una demo que después se comporta distinto.
- **Riesgo de contrato**: agregar un método a `DocumentoRepository` obliga a `integracion-documentos`
  a implementarlo — ese change se comprometió explícitamente a *"no tocar la interfaz
  `DocumentoRepository`"* (§D6). Este propose **rompe ese supuesto** y hay que avisarlo ahí.
- **Rollback**: revertir los 7 archivos. No hay pérdida de datos posible — el mock es memoria de
  sesión y no hay backend conectado.
