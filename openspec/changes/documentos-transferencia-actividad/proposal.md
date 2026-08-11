## Why

Feedback real de la clienta (Andrea Pastor), "Ronda 2" — **punto 3 de 7** de la síntesis transcripta
de notas de voz de WhatsApp (`docs/cambios/cambios2-requerimientos.pdf`, 2026-08-06). Resumen
verbatim del punto:

> **Propuesta atribuida a "Ari" en el audio.**
>
> **Cambio**: al **marcar una actividad** (identificada por su domicilio), el sistema debe **llevar a
> la documentación de ese domicilio**. Ejemplo: marco la terapia del domicilio A → me muestra la
> documentación de A; marco la del domicilio B → la de B.
>
> **Requisito adicional**: poder **exportar** esa documentación y **transferir un documento de un
> lugar a otro**.
>
> **Justificación operativa**: puede ocurrir un **error de carga** (subir un documento en el
> domicilio equivocado). La transferencia permite corregirlo sin recargar desde cero.
>
> **Pendiente**: el cliente indica que enviará **un video** mostrando este flujo. Este punto puede
> refinarse cuando llegue.
>
> ⚠️ En el audio los domicilios figuran como "calle 818" y "calle 254". Son ejemplos de direcciones;
> los números pueden estar mal transcritos. **No son valores a hardcodear.**

Es el **último punto pendiente** de la Ronda 2 que toca el dominio documental. Los otros tres ya
están archivados: punto 1 (`2026-08-06-pacientes-documentos-multiples`, N documentos por ítem),
punto 2 (`2026-08-07-documentos-checklist-por-actividad`, N bloques de checklist, uno por actividad)
y punto 4 (`2026-08-06-documentos-previsualizacion`, overlay "Ver"). El punto 3 fue **explícitamente
excluido** por el punto 2 con esta justificación textual (`archive/2026-08-07-documentos-checklist-por-actividad/proposal.md`):

> El **punto 3** del mismo PDF (vincular la actividad seleccionada con su documentación + exportar/
> transferir a otro domicilio) queda **explícitamente fuera**: el cliente prometió un video mostrando
> ese flujo y todavía no llegó — no se diseña una funcionalidad sobre una descripción incompleta.

**El video sigue sin llegar** (revisado `TODO-video-revision.txt`, que documenta una reunión posterior
del 2026-08-04 por Google Meet: no menciona este flujo). Este propose **no cierra ese pendiente**: lo
formaliza como checkpoint abierto, elige el **default que menos compromete** (la lectura más literal
del texto transcripto) y deja el diseño explícitamente marcado como sujeto a revisión cuando el video
llegue. Ver `design.md` Checkpoint (a).

### Verificado contra el código, no asumido

**1. La navegación actividad → documentación NO existe hoy. En ninguna forma.**
Barrido exhaustivo sobre `frontend/src`: **cero** ocurrencias de `scrollIntoView`, cero de
`location.hash`, cero de anchors `#doc-`, y `useSearchParams` aparece solo en
`features/auth/LoginPage.tsx` (nada de pacientes). `DireccionesEditor.tsx` sí pone un
`data-direccion-id={direccion.id}` en cada `<li>` (línea 130), pero es un ancla de test/CSS: no lo
consume ningún handler de navegación. Los botones "Editar"/"Quitar" de cada fila (líneas 148-163)
solo abren el formulario inline de esa misma sección.

`DireccionesEditor` y `PacienteDocumentos` son **hermanos** dentro de `PacienteDetail.tsx` (dos
`<Section>` separadas, líneas 233-247 y 249-269), y hoy no se comunican salvo por
`documentosPorDireccion` — un conteo de solo lectura que existe únicamente para el diálogo de
confirmación al borrar una dirección (delta de `paciente-direcciones`, change anterior). **La primera
mitad del punto 3 se construye desde cero.**

**2. La ficha del paciente es una sola página larga, sin tabs y sin estado en la URL.**
`PacienteDetail.tsx` apila `<Section>` verticalmente en un `flex flex-col gap-xl`. `PacientesPage.tsx`
decide listado vs. detalle con `useState<View>` local (línea 12), **no** con rutas: `router.tsx` monta
`/pacientes` como ruta única. No hay ningún deep-link a un paciente, y mucho menos a una sección suya.
Esto acota fuerte el diseño posible de "llevar a la documentación de ese domicilio": hoy no hay a
dónde linkear.

**3. Hojas de ruta NO linkea a Pacientes.** En `features/hojas-de-ruta/` (`RecorridoCard.tsx`,
`ParadasList.tsx`, `VistaGlobalHojaDeRuta.tsx`, `AsignacionPanel.tsx`) las direcciones del paciente se
resuelven como **texto puro** (`nombrePaciente(pacienteId)`, `direccionTexto(direccionId, pacienteId)`
buscan en un array recibido por props y devuelven un `string`). No hay un solo `<Link>`, `navigate()`
ni `onClick` que lleve al módulo Pacientes. La lectura "marcar un recorrido lleva a la documentación"
**no tiene infraestructura que la sostenga hoy**, y es una de las dos lecturas posibles del pedido
(ver Checkpoint (a)).

**4. `SeccionPlegable` ya es 100 % controlado — abrir un bloque desde afuera es viable sin refactor.**
`features/facturacion/SeccionPlegable.tsx` recibe `abierta: boolean` + `onToggle: () => void` y no
tiene estado interno. Hoy el estado vive **abajo**, en `PacienteDocumentosChecklist.tsx` (línea 67:
`useState(true)`, con auto-colapso si el bloque está completo, líneas 70-76). Para que algo externo
diga "abrite", ese estado tiene que **subir** a `PacienteDocumentos.tsx`. Es un lift-state acotado, no
un rediseño — pero toca la lógica de auto-colapso que la usuaria pidió explícitamente en el change
anterior, y hay que preservarla.

**5. Transferir un documento entre actividades es un `UPDATE` de una columna. El archivo NO se mueve.**
La clave de Storage se construye en `documentoMapping.ts` (`construirClaveStorage`, líneas 123-130)
como `{entidadId}/{itemId}/{uuid}-{nombreArchivoSeguro}` — **no incluye `direccion_id` en ningún
punto del path**. La agrupación por actividad vive exclusivamente como columna de Postgres
(`pacientes.documentos.direccion_id`, migración `20260807010000_documentos_direccion_id.sql`,
`ON DELETE RESTRICT`). O sea: mover un documento de una actividad a otra es un `UPDATE ... SET
direccion_id = $nuevo`, sin tocar el bucket. **Ese es el hallazgo que hace barata la segunda mitad
del punto 3** — y es exactamente lo que la clienta pide ("sin recargar desde cero").

**6. El contrato `DocumentoRepository` NO tiene ningún método de mover/transferir.**
Hoy son cuatro: `listByEntity`, `upload`, `remove`, `resolverPrevisualizacion`
(`shared/lib/documentos/DocumentoRepository.ts`). Ninguno reasigna `agrupacionId`. Sería el **quinto**
método, y la **cuarta** vez este mes que este contrato compartido por cuatro dominios (Pacientes,
Vehículos, Conductores, Facturas) se mueve. Los otros tres dominios **no tienen actividades**: un
vehículo no tiene escuela. Ver Checkpoint (c).

**7. La descarga real ya existe en la implementación Supabase, contra lo que sugieren las notas
viejas.** `SupabaseDocumentoRepository.ts` línea 201-206 llama `createSignedUrl(clave,
EXPIRACION_URL_FIRMADA_SEGUNDOS)`, y `DocumentChecklist.tsx` línea 212 ya renderiza
`<a href={estado.url} download={documento.nombreArchivo}>`. O sea, **descargar un documento suelto ya
funciona**. Lo que no existe es exportar **el conjunto** de una actividad. El change anotado
`documentos-descarga-firmada` (CHANGES.md línea 193) quedó parcialmente absorbido por
`integracion-documentos` sin que nadie lo actualizara — anotarlo.

**8. No hay ninguna librería de exportación instalada, ni un helper de descarga.**
`frontend/package.json` verificado: las dependencias son `@supabase/supabase-js`, `@tailwindcss/vite`,
`@vis.gl/react-google-maps`, `pdfjs-dist` (solo **lectura**/render de PDF, para la previsualización),
`react`, `react-dom`, `react-router`, `tailwindcss`. **No hay `jspdf`, `xlsx`, `jszip`, `exceljs` ni
`file-saver`.** El único patrón de "exportar" del proyecto es la **vista imprimible con clases
`print:` de Tailwind** (`HojaDeRutaImprimible.tsx`, `factura-exportacion`), y ni siquiera llama a
`window.print()` (cero ocurrencias en todo el árbol): el usuario dispara Ctrl+P. Ver Checkpoint (b):
la forma más barata y consistente de "exportar" acá probablemente **no** sea un ZIP.

**9. Colisión potencial con un change en curso, distinto pero adyacente.**
`openspec/changes/documentos-checklist-items-por-actividad/` (0/52 tasks, modificado 2026-08-10) está
**propuesto y sin aplicar**, y diferencia **el contenido** del checklist según el *tipo* de actividad
(la escuela pide otros ítems que la terapia). Es otra línea de trabajo, **no se toca acá**. Pero abre
una pregunta real para la transferencia: si los ítems de la actividad origen y la destino no son los
mismos, ¿a dónde aterriza el documento transferido? Ver Checkpoint (e). Además ambos changes tocan
`PacienteDocumentos.tsx` y `PacienteDocumentosChecklist.tsx` → riesgo real de conflicto de merge,
anotado en `design.md` §Riesgos, sin acción en este propose.

## What Changes

El punto 3 son **tres sub-partes independientes** con costo y riesgo muy distintos. Se proponen las
tres, pero explícitamente ordenadas y separables.

### 3.a — Navegación: de la actividad a su documentación

- Cada actividad listada en **Pacientes → Traslados → Direcciones** gana una acción explícita que
  **lleva a su bloque de documentación**: enfoca, expande y desplaza la vista hasta el
  `PacienteDocumentosChecklist` cuyo `agrupacionId` es esa dirección.
- El estado "qué bloque está abierto" **sube** de `PacienteDocumentosChecklist` a
  `PacienteDocumentos`, preservando el auto-colapso de bloques completos ya pedido por la usuaria.
- **Default elegido (Checkpoint (a))**: acción explícita por fila, la lectura más literal del pedido y
  la que **no** cambia el modelo mental de N bloques simultáneos que la clienta ya aprobó en el change
  anterior. **No** se implementa un modo "una actividad por vez" que filtre la sección, ni deep-links
  desde Hojas de Ruta — ambas quedan como alternativas registradas, a decidir con el video.

### 3.b — Exportar la documentación de una actividad puntual

- La documentación de **una** actividad se puede exportar como unidad, con su encabezado
  identificatorio (paciente, actividad, dirección) y el detalle de qué ítems están cargados y cuáles
  faltan.
- **Default elegido (Checkpoint (b))**: **vista imprimible** con clases `print:` de Tailwind, el
  patrón que el proyecto ya usa dos veces (`HojaDeRutaImprimible.tsx`, `factura-exportacion`) —
  **cero dependencias nuevas**, y produce PDF vía "Imprimir → Guardar como PDF" del navegador. Un ZIP
  con los archivos binarios queda como alternativa registrada; requiere una dependencia nueva
  (`jszip`) y N descargas firmadas en paralelo, y el texto de la clienta no dice cuál de las dos
  quiere.
- La descarga de un documento **individual** ya existe (`DocumentChecklist.tsx` línea 212) y no se
  toca.

### 3.c — Transferir un documento cargado de una actividad a otra

- Un documento ya cargado se puede **reasignar** a otra actividad del **mismo paciente** (o al bloque
  "General"), conservando su identidad: mismo `id`, mismo archivo en Storage, misma fecha de subida,
  mismo nombre. Sin volver a subirlo.
- `DocumentoRepository` gana un **quinto método** de reasignación de agrupación. Vehículos,
  Conductores y Facturas **no cambian de comportamiento** — igual que en el change anterior, pasan
  `undefined` y el método les es inaplicable (ver Checkpoint (c) para la forma exacta).
- **Default elegido (Checkpoint (d))**: la transferencia **conserva el ítem del checklist**
  (`itemId`) y solo cambia la agrupación. Cambiar de ítem *y* de actividad a la vez, o transferir
  entre pacientes distintos, quedan **fuera** — el segundo por riesgo clínico explícito (mezclar
  documentación de dos personas con discapacidad).
- La operación **confirma antes de ejecutar** y es visible: mismo criterio que "Quitar una dirección
  con documentación cargada" (`paciente-direcciones`, requisito ya vigente).

### Transversal

- **Governance CRÍTICO**, mismo criterio que los tres refinamientos hermanos ya archivados. 3.c es
  además la **primera operación del proyecto que muta la ubicación de un documento clínico ya
  cargado** — hasta hoy los documentos solo se crean y se borran.
- El checkpoint abierto por el video pendiente se documenta por **triplicado**, siguiendo la regla
  dura del proyecto: `knowledge-base/04_modelo_de_datos.md` §Discrepancias, el bullet del change en
  `CHANGES.md`, y un `AvisoPendienteCliente` visible en la pantalla de documentación del paciente
  (componente ya existente en `design-system/components.tsx` línea 341, hecho exactamente para esto).

### Fuera de alcance (explícito)

- **NO** se hardcodea ninguna dirección: "calle 818"/"calle 254" son ejemplos del audio, no datos.
- **NO** se implementa transferencia entre pacientes distintos.
- **NO** se toca `documentos-checklist-items-por-actividad` (change en curso de otra línea de trabajo).
- **NO** se agrega ninguna dependencia npm (consecuencia del default de Checkpoint (b)).
- **NO** se propone migración de base: `direccion_id` ya existe y es nullable; transferir es un
  `UPDATE` sobre una columna que ya está.

## Capabilities

### New Capabilities

- `paciente-documentos-transferencia`: reasignar un documento ya cargado de una actividad del paciente
  a otra (o al bloque general) sin volver a subirlo, con confirmación explícita y sin pérdida de
  identidad del documento ni movimiento del archivo en Storage.
- `paciente-documentos-exportacion`: exportar como unidad la documentación de **una actividad puntual**
  del paciente, identificando paciente/actividad y distinguiendo ítems cargados de ítems faltantes.

### Modified Capabilities

- `paciente-documentos`: se agrega el requisito de **navegación dirigida** desde una actividad
  seleccionada hacia su bloque de documentación (foco + expansión + desplazamiento), y la garantía de
  que esa navegación **no altera** el modelo de N bloques simultáneos ni el auto-colapso ya
  especificado.
- `paciente-direcciones`: cada actividad listada gana una acción explícita "ver su documentación",
  hermana de las ya especificadas para editar y quitar.
- `documento-contract`: el contrato `DocumentoRepository` pasa de cuatro a **cinco** métodos; se
  especifica que la reasignación de agrupación no altera la clave de Storage y que los tres dominios
  documentales sin actividades no cambian de comportamiento.
- `documento-avisos-modelo-datos`: se suma el aviso en pantalla del checkpoint abierto por el video
  pendiente de la clienta (`AvisoPendienteCliente`), bajo el requisito ya vigente de documentar las
  decisiones no confirmadas por triplicado.

## Impact

**Código afectado (frontend, mock + Supabase):**

| Archivo | Qué cambia |
|---|---|
| `frontend/src/shared/lib/documentos/DocumentoRepository.ts` | 5.º método (reasignación de agrupación) |
| `frontend/src/shared/lib/documentos/mockDocumentoRepository.ts` | implementación en memoria del 5.º método |
| `frontend/src/shared/lib/documentos/SupabaseDocumentoRepository.ts` | `UPDATE direccion_id`, sin tocar Storage |
| `frontend/src/shared/lib/documentos/documentoMapping.ts` | mapeo del `UPDATE` (columna ya existente) |
| `frontend/src/shared/lib/documentos/useDocumentChecklist.ts` | expone la acción de transferir + refresco cruzado entre bloques |
| `frontend/src/features/pacientes/PacienteDocumentos.tsx` | lift-state de "bloque abierto"; ancla por actividad; refresco tras transferir |
| `frontend/src/features/pacientes/PacienteDocumentosChecklist.tsx` | `abierta`/`onToggle` pasan a ser props controladas desde arriba |
| `frontend/src/features/pacientes/DireccionesEditor.tsx` | acción nueva por fila ("Ver documentación") |
| `frontend/src/features/pacientes/PacienteDetail.tsx` | cablea Direcciones ↔ Documentación (hoy no se conocen) |
| `frontend/src/shared/components/DocumentChecklist.tsx` | acción "Transferir" por documento (compartido x4 → **opt-in**, ver Checkpoint (c)) |
| **nuevo** — vista imprimible de la documentación de una actividad | patrón `HojaDeRutaImprimible.tsx` |

**Base de datos:** ninguna migración. `pacientes.documentos.direccion_id` ya existe
(`20260807010000_documentos_direccion_id.sql`). Sí hay que verificar que la policy `Write documentos`
(`ALL` con `modulos.tiene_permiso('pacientes','write')`, `20260724100004_schema_pacientes.sql:150-151`)
cubra el `UPDATE` — lo hace, `ALL` incluye `UPDATE`, pero debe quedar verificado, no asumido.

**Dependencias npm:** ninguna, con el default de Checkpoint (b). Si el veredicto cambia a ZIP, entra
`jszip` (~100 kB) y el análisis de bundle correspondiente.

**Dependencias entre changes:**
- **Requiere** (ya archivado): `documentos-checklist-por-actividad` — sin `agrupacionId` no hay nada
  que transferir. `pacientes-documentos-multiples` y `documentos-previsualizacion` también archivados.
- **Adyacente, sin dependencia formal**: `documentos-checklist-items-por-actividad` (en curso, otra
  línea de trabajo). Toca los mismos dos componentes → riesgo de conflicto de merge, y una pregunta
  genuina de diseño en Checkpoint (e). **No se coordina en este propose**: se anota.
- **Bloquea**: nada.

**Rollback plan.** Las tres sub-partes son **independientes y revertibles por separado**, en este
orden de riesgo creciente:
1. **3.b (exportar)** — es una vista nueva, aditiva. Revertir = borrar el componente y su botón. Cero
   efecto sobre datos.
2. **3.a (navegación)** — el único cambio estructural es el lift-state de `abierta`. Revertir =
   devolver el `useState` a `PacienteDocumentosChecklist` y quitar la acción de la fila. Cero efecto
   sobre datos.
3. **3.c (transferir)** — **el único con efecto sobre datos**. Revertir el *código* es quitar el 5.º
   método y su UI, pero **las transferencias ya ejecutadas no se deshacen solas**: quedan documentos
   con un `direccion_id` distinto del original y sin traza de cuál era (salvo que el Checkpoint (h)
   se resuelva a favor de auditar). Mitigación propuesta: **no** liberar 3.c a la clienta hasta que el
   video llegue y confirme el flujo, o resolver (h) a favor de dejar traza. Esto es una decisión de
   Enzo, no del propose.
