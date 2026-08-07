## Context

**Estado actual del frontend.** `mockDocumentoRepository` (`frontend/src/shared/lib/documentos/`) es
un `Map<string, DocumentoAdjunto[]>` en memoria con 350 ms de latencia fingida. No es "el mock de un
módulo": es el mock **transversal** que consumen cinco composition roots.

| Composition root | Entidad documental | Repository de la entidad inyectado hoy | ¿`entidadId` real? | ¿Swapea en este change? |
|---|---|---|---|---|
| `features/pacientes/PacientesRoute.tsx` | `paciente` | `supabasePacienteRepository` | ✅ UUID de Postgres | ✅ **sí** |
| `features/vehiculos/VehiculosRoute.tsx` | `vehiculo` | `mockVehiculoRepository` | ❌ `generateId('vehiculo')` | ❌ no |
| `features/conductores/ConductoresRoute.tsx` | `conductor` | `mockConductorRepository` | ❌ fixture | ❌ no |
| `features/facturacion/FacturacionRoute.tsx` | `factura` | `mockFacturaRepository` | ❌ fixture (swap parcial deliberado, comentario del propio archivo) | ❌ no |
| `design-system/DesignSystem.tsx` | `paciente` (`'p1'`) | — catálogo vivo, checklist demo hardcodeado | ❌ literal inventado | ❌ **nunca** |

La cadena de tipos es corta y no se toca: `DocumentoRepository` (3 firmas) →
`useDocumentChecklist(entidad, entidadId, items, repository)` → `DocumentChecklist` (presentacional).
`DocumentoAdjunto` es `{ itemId, nombreArchivo, subidoEn }` y `EntidadDocumental` es la unión cerrada
`'paciente' | 'vehiculo' | 'conductor' | 'factura'`.

**De dónde sale `ChecklistItem.id`** — es el dato que decide todo el mapeo, y **no es homogéneo**:

| Entidad | Origen de `items` | Forma del `id` |
|---|---|---|
| paciente | checklist de la obra social del paciente (`PacienteDocumentosChecklist`) | **UUID** de `obra_social.tipos_documento` (ver `obraSocialMapping.parseRequisitoRow`, D2 de `integracion-obra-social`: *"`ChecklistItem.id` es el de `tipos_documento`, NUNCA el de `requisitos_os`"*) |
| factura | checklist de la obra social del paciente de la factura (RN-FA-08) | **UUID** de `tipos_documento`, ídem |
| vehículo | `vehiculoDocumentosItems.ts`, lista fija en el código | **slug** `'vehiculo-doc-cedula'`, `…-vtv`, `…-rto`, `…-seguro`, `…-fotos` |
| conductor | `conductorDocumentosItems.ts`, lista fija en el código | **slug** `'conductor-doc-licencia'`, `…-dni`, `…-apto-medico` |

**Estado real del backend — verificado en vivo (`supabase db query --linked`, 2026-08-05), no contra
las migraciones a ojo.**

```
storage.buckets                                     4 filas, todas public = false
  documentos-pacientes, documentos-vehiculos, documentos-conductores, documentos-facturas
storage.objects                                     1 objeto (residuo de la prueba manual de C-03)
pg_policies WHERE schemaname='storage'              16 policies, 4 por bucket, todas con tiene_permiso()

pacientes.documentos                (id, paciente_id, id_tipo_documento UUID FK, archivo_url, created_at)   0 filas
conductores.documentacion_vehiculo  (id, vehiculo_id, tipo_documento TEXT,       archivo_url, created_at)   0 filas
conductores.documentacion_conductores (id, conductor_id, tipo_documento TEXT,    archivo_url)               0 filas  ← sin created_at
facturacion.documento_factura       (id, factura_id, id_tipo_documento UUID FK,  archivo_url, created_at)   0 filas

obra_social.tipos_documento         3 filas: 'comprobante ARCA', 'asistencia', 'CODEM'
obra_social.requisitos_os           0 filas   ← ninguna obra social tiene checklist configurado
```

Y el desfasaje de módulo, leído literal de `pg_policies.qual`:

```
storage "…documentos-vehiculos"                 → modulos.tiene_permiso('conductores', …)
conductores.documentacion_vehiculo "Read/Write" → modulos.tiene_permiso('vehiculos',   …)
```

Cronología que lo explica (y que descarta que sea un error de C-03): `20260729100001_storage_objects_rls.sql`
gateó los 4 buckets el 29/07 con el mapa correcto **de ese día**; `20260730140000_split_modulos_permisos.sql`
movió `conductores.documentacion_vehiculo` (entre otras 5 tablas) al módulo nuevo `vehiculos` el 30/07 y
**no tocó `storage.objects`**; `20260730150000_fix_habilitaciones_vehiculo_modulo.sql` alcanzó a
arreglar una tabla que había quedado afuera del split, pero tampoco miró el storage.

**Referencia de patrón.** Este es el **sexto** repository real de la serie (`integracion-pacientes`,
`integracion-obra-social`, `integracion-presupuestos` ×2, `integracion-hojas-de-ruta`, y los dos en
curso de `integracion-conductores-vehiculos`). Mismo molde: mapeo puro separado del I/O, type guards
explícitos sobre `unknown`, traducción de errores a castellano, discrepancias documentadas por
triplicado. **Una diferencia estructural respecto de los cinco anteriores**: acá no hay escritura
multi-tabla, así que **no hace falta ninguna RPC `SECURITY INVOKER`** — pero sí aparece un problema
que ninguno de los anteriores tuvo, porque ninguno tocaba Storage: **dos sistemas de persistencia sin
transacción compartida** (D4).

**Restricciones duras del proyecto** (`CLAUDE.md`): nada de `any` (usar `unknown` + narrowing); solo
utilidades Tailwind v4; reusar `design-system/components.tsx`; `anon key` únicamente, **nunca**
`service_role`; toda tabla nueva define su RLS en el mismo change; `npx tsc -b --noEmit` como único
type-check válido; Conventional Commits; el docx manda en estructura y la KB en reglas de negocio,
discrepancias documentadas en los dos lugares y con `AvisoModeloDatos`, nunca resueltas adivinando.

**Governance: ALTO** (`CHANGES.md` §C-03, tabla de la línea 827), con **un punto de nivel CRÍTICO
adentro**: el Checkpoint 3 modifica policies de RLS ya aplicadas en producción sobre datos de salud.
Consecuencia práctica, y es más estricta que la de `integracion-hojas-de-ruta`: **este propose no
escribe código ni SQL**; los Checkpoints 0, 1, 2 y 4 se resuelven en la tarea `0.1` de `tasks.md`, y
el **Checkpoint 3 exige aprobación humana explícita y por escrito** de la usuaria/Enzo antes de que
se redacte una sola línea de esa migración — mismo mecanismo que la ceremonia CRÍTICO de
`integracion-facturacion`.

---

## Goals / Non-Goals

**Goals**

- Que `DocumentoRepository` tenga una implementación real contra Supabase Storage + Postgres,
  cumpliendo la interfaz **al pie de la letra** (mismas 3 firmas, misma semántica de reemplazo de
  `upload`, misma forma de error) — `DocumentChecklist`, `useDocumentChecklist` y los 4 wrappers de
  feature no cambian de forma.
- Que un archivo elegido por la usuaria en la ficha de un paciente **realmente exista** después de
  recargar la pantalla.
- Absorber la heterogeneidad de las 4 tablas de destino en **un solo lugar declarativo**, sin
  `if (entidad === …)` desparramados por el repository.
- Dejar explícito y visible (nunca implícito) que Vehículos, Conductores y Facturación siguen
  simulando el upload, y por qué.
- Dejar el desfasaje de módulo del bucket `documentos-vehiculos` **decidido**, no descubierto por la
  primera persona que intente subir la VTV de un vehículo.
- Aislar todo el mapeo y la construcción de claves de Storage en funciones puras testeables sin red.

**Non-Goals**

- **No se construye ni se modifica ninguna pantalla de producto.** El único cambio visual son los
  `AvisoModeloDatos` de las tres entidades que siguen en mock.
- **No se implementa descarga** (`createSignedUrl` + botón). Ver D6 y Open Questions.
- **No se vuelven reales Vehículo, Conductor ni Factura** — sus propios changes.
- **No se unifica el catálogo de tipos de documento** (Checkpoint 1 opción B, descartada).
- **No se crea la pantalla de administración de `tipos_documento`** — pregunta abierta ya registrada.
- **No se siembran checklists de obras sociales** — es dato, lo carga la usuaria con `ChecklistEditor`.
- **No se introduce TanStack Query.**
- **No se toca `PresupuestoForm`/`AutorizacionForm`** (archivo único, no `DocumentChecklist`).
- **No se borra el mock.**

---

## Checkpoint 0 — Alcance del swap: ¿solo Pacientes, o los cuatro roots?

**El problema.** El enunciado de la fila 8 de `CHANGES.md` ("falta reemplazar
`mockDocumentoRepository`") sugiere un swap de los cinco puntos de inyección. Pero tres de las cuatro
entidades todavía viven en mock, y sus ids son fixture: `documentacion_vehiculo.vehiculo_id`,
`documentacion_conductores.conductor_id` y `documento_factura.factura_id` son **`NOT NULL REFERENCES …`**,
así que el primer `upload` con un id de fixture responde `23503` (foreign key violation) y el archivo
ya subido queda huérfano en el bucket.

| Opción | Qué implica | Riesgo |
|---|---|---|
| **A. Swap solo de `PacientesRoute.tsx`** ✅ recomendada | El repository se escribe **completo para las 4 entidades** y se testea entero; se inyecta solo donde el `entidadId` es real. Los otros 3 roots quedan a una línea de distancia | Este change entrega valor real en 1 de 4 pantallas. Requiere `AvisoModeloDatos` en las otras 3 para no mentir sobre lo que hacen |
| B. Swap de los 4 roots ya | "Documentos" se marca ✅ de una vez | **Rompe tres pantallas en producción**: subir la VTV de un vehículo, el DNI de un conductor o el comprobante ARCA de una factura falla con `23503` y deja objetos huérfanos en los buckets. Inaceptable |
| C. Bloquear el change hasta que las 3 entidades sean reales | Nada se rompe, todo llega junto | Encadena el último ítem del plan de integración a `integracion-facturacion` (CRÍTICO, 5 aprobaciones pendientes) y a `integracion-conductores-vehiculos` (bloqueado en 1 gap, sin fecha). El upload de Pacientes —el caso con datos clínicos reales y el más urgente— se posterga indefinidamente |

**Recomendación de este propose: A.** Es exactamente el precedente que ya sentaron
`integracion-hojas-de-ruta` (Checkpoint 0 A, swap parcial: Hoja de Ruta y Paciente reales, Vehículo y
Conductor mock) y `FacturacionRoute.tsx` (swap parcial por pedido explícito de Enzo el 2026-08-05:
Paciente/ObraSocial/Prestador reales, Factura/Cobro mock). Confirmar en `tasks.md` 0.1.

---

## Checkpoint 1 — `itemId` heterogéneo: UUID contra catálogo compartido vs. TEXT libre

**El problema.** El mismo campo del dominio (`DocumentoAdjunto.itemId`) tiene que persistirse en dos
formas distintas según la entidad, porque el schema real es así:

```
pacientes.documentos.id_tipo_documento          UUID NOT NULL REFERENCES obra_social.tipos_documento(id) ON DELETE RESTRICT
facturacion.documento_factura.id_tipo_documento UUID NOT NULL REFERENCES obra_social.tipos_documento(id) ON DELETE RESTRICT
conductores.documentacion_vehiculo.tipo_documento     TEXT NOT NULL     ← sin catálogo
conductores.documentacion_conductores.tipo_documento  TEXT NOT NULL     ← sin catálogo
```

Y del lado del frontend calza igual de bien en las dos: para paciente/factura el `ChecklistItem.id`
**ya es** el UUID de `tipos_documento`; para vehículo/conductor **ya es** un slug estable definido en
el código. O sea: el mapeo natural es `itemId → columna`, sin traducción, en los cuatro casos.

| Opción | Forma | A favor | En contra |
|---|---|---|---|
| **A. Aceptar la heterogeneidad, declararla en una tabla de configuración** ✅ recomendada | `documentoMapping.ts` expone `CONFIG_ENTIDAD: Record<EntidadDocumental, ConfiguracionEntidad>` con `{ schema, tabla, columnaEntidad, columnaItem, bucket, modulo }`. El repository nunca ramifica por entidad: lee la config | Cero migraciones de modelo. El adaptador refleja el schema real en vez de pelearse con él. Un `if` menos por operación. La forma queda en **un** objeto de 4 entradas, revisable de un vistazo | El `TEXT` libre de vehículo/conductor no tiene integridad referencial: un typo en `vehiculoDocumentosItems.ts` no lo detecta la base. Mitigado porque esos ids son constantes del código, no input de usuario |
| B. Normalizar: los 8 slugs de vehículo/conductor pasan a filas de `obra_social.tipos_documento` y las dos columnas `TEXT` a `UUID FK` | Un solo modelo documental para las 4 entidades | Cambia el tipo de una columna existente (**no es aditivo**, viola la regla del proyecto para changes de integración), mezcla en un catálogo llamado `obra_social.tipos_documento` conceptos que no tienen nada que ver con obras sociales (VTV, RTO, apto médico), y agranda el problema ya abierto de *"¿quién administra `tipos_documento`?"* con `ON DELETE RESTRICT` desde 5 consumidores en vez de 3 |
| C. Tabla polimórfica única `documentos(entidad, entidad_id, …)` | Un solo lugar | Descarta el modelo que el docx y C-03 ya fijaron (`documento_{entidad}`), rompe las FK y la RLS por módulo, y reescribe backend ya aplicado. Fuera de alcance de un change de integración |

**Recomendación de este propose: A.** Confirmar en `tasks.md` 0.1.

**Nota de rastreo, no bloqueante:** con la opción A, borrar un `tipos_documento` que algún
`pacientes.documentos` referencie sigue fallando con `23503` gracias al `ON DELETE RESTRICT` — y ese
error **ya está traducido** en `SupabaseObraSocialRepository` (`MSG_ITEM_CON_DOCUMENTOS`: *"No se puede
quitar ese ítem: hay documentos de pacientes que lo usan"*), un mensaje que hasta hoy era teórico
porque no había forma de crear un documento. Este change lo vuelve alcanzable de verdad: primera vez
que ese camino de error se puede ejercitar.

---

## Checkpoint 2 — Dos columnas que el contrato del frontend necesita y el schema no tiene

**El problema, en dos partes.**

*Parte A — `nombreArchivo`.* `DocumentoAdjunto.nombreArchivo` se **muestra en pantalla**
(`DocumentChecklist.tsx:70`: `{doc.nombreArchivo} · {fecha}`). Ninguna de las 4 tablas tiene una
columna para el nombre original: solo `archivo_url TEXT`.

| Opción | Qué hace | Costo |
|---|---|---|
| **A. Columna nueva `nombre_archivo TEXT` en las 4 tablas** (aditiva) ✅ recomendada | El nombre original se guarda tal cual lo eligió la usuaria: acentos, espacios, mayúsculas — `"Certificado médico 2026.pdf"` | Una migración aditiva de 4 `ADD COLUMN`. Nada existente se altera (las 4 tablas están en 0 filas) |
| B. Derivar el nombre del último segmento de `archivo_url`, con `encodeURIComponent`/`decodeURIComponent` para round-trip | Cero migración | La clave de Storage se vuelve ilegible (`Certificado%20m%C3%A9dico%202026.pdf`), y el nombre queda acoplado a la clave: renombrar o mover un objeto rompe el dato mostrado. Además el round-trip depende de que **toda** escritura futura respete la convención — una fila insertada a mano desde el dashboard rompe la UI |

*Parte B — `subidoEn` de conductores.* `conductores.documentacion_conductores` es la única de las 4
tablas **sin `created_at`** (verificado en vivo). Sin él, `DocumentoAdjunto.subidoEn` de un documento
de conductor no tiene origen. Alternativa evaluada y descartada: leer `storage.objects.created_at` con
una segunda consulta — agrega una request por listado, ata el dato del dominio a un detalle del
storage, y sería la única de las 4 entidades que lo hace así. **Se propone
`ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW()`**, exactamente la misma definición que ya tienen sus
tres hermanas. Es, además, un gap de RN-GL-02 (trazabilidad) que existía desde
`20260724100006_schema_conductores.sql` y que nadie había notado porque la tabla nunca se usó.

**Recomendación de este propose: A + Parte B (una sola migración aditiva, 5 `ADD COLUMN`).**
Confirmar en `tasks.md` 0.1.

**`nombre_archivo` se declara `TEXT` nullable**, no `NOT NULL`: las 4 tablas podrían recibir filas de
otra vía en el futuro, y una fila sin nombre debe degradar (mostrar el último segmento de la clave)
en vez de romper el listado entero. El mapeo puro lo contempla explícitamente.

---

## Checkpoint 3 — 🔴 CRÍTICO: el bucket `documentos-vehiculos` está gateado por el módulo equivocado

**El problema (verificado en vivo, no inferido).** La tabla y el bucket de la misma entidad piden
permisos de módulos distintos:

```sql
-- storage.objects, 4 policies (20260729100001, 29/07)
bucket_id = 'documentos-vehiculos' AND modulos.tiene_permiso('conductores', …)
-- conductores.documentacion_vehiculo, 2 policies (reescritas por 20260730140000, 30/07)
modulos.tiene_permiso('vehiculos', …)
```

Una cuenta con `vehiculos: write` y sin `conductores: write` puede escribir la fila y **no** puede
subir el archivo. Con el orden de operaciones de D4 (archivo primero) el efecto real es que el upload
**falla limpio en el primer paso**, sin dejar residuo — pero falla, y el mensaje que la usuaria vería
("no tenés permiso") sería literalmente incorrecto: sí tiene permiso sobre Vehículos.

| Opción | Qué hace | Riesgo |
|---|---|---|
| **A. Repuntar las 4 policies del bucket a `vehiculos`** ✅ recomendada | Alinea storage con la tabla, con el sidebar (`routes.ts`) y con las otras 5 tablas que el split movió. Es el mismo arreglo, sobre la misma omisión, que ya hizo `20260730150000_fix_habilitaciones_vehiculo_modulo.sql` para `habilitaciones_vehiculo` | Una cuenta con `conductores` y **sin** `vehiculos` pierde acceso al bucket. El `INSERT … SELECT` aditivo del split (§2 de `20260730140000`) le dio `vehiculos` a toda cuenta que tenía `conductores` **al 30/07** — pero no a las creadas después a mano. **Hay que auditar `modulos.permisos` antes de aplicar** (tarea 2.4) |
| B. Dejarlo como está y documentarlo | Cero riesgo de quitarle acceso a nadie hoy | Deja una incoherencia de seguridad viva sobre datos reales, y hace que el upload de Vehículos sea el único que exige un permiso que la pantalla no pide. Cuando `integracion-conductores-vehiculos` aterrice, alguien lo va a redescubrir desde el lado del bug |
| C. Ampliar la policy a `('vehiculos' OR 'conductores')` | Nadie pierde acceso | **Amplía** la superficie de permiso en vez de corregirla: una cuenta con solo `conductores` seguiría pudiendo leer documentos de vehículos que la tabla no le deja ver. Empeora la incoherencia en vez de cerrarla |

**Recomendación de este propose: A**, condicionada a la auditoría de `modulos.permisos`. **Este es el
único punto del change con ceremonia CRÍTICO**: requiere aprobación humana explícita y por escrito de
la usuaria/Enzo, registrada en `tasks.md` 0.1, **antes** de que se escriba el `.sql`. Si la auditoría
encuentra aunque sea una cuenta que perdería acceso, la decisión vuelve a la usuaria con esa lista
concreta antes de aplicar nada.

**Fuera de alcance, deliberadamente:** los otros tres buckets están correctamente alineados con sus
tablas (`pacientes`↔`pacientes`, `conductores`↔`conductores`, `facturacion`↔`facturacion`,
verificado en vivo). No se toca ninguno.

---

## Checkpoint 4 — Sin checklists configurados no hay nada que verificar

**El problema.** `obra_social.requisitos_os` tiene 0 filas y `tipos_documento` tiene 3, ninguna
vinculada a ninguna obra social. Como el checklist de Paciente sale de ahí, **hoy
`PacienteDocumentosChecklist` renderiza una lista vacía para los 2 pacientes que existen** — con mock
o con Supabase, indistinto. El swap no se puede verificar contra nada.

No es un problema de código: `ChecklistEditor` ya escribe `requisitos_os` real desde
`integracion-obra-social`. Es una **precondición de datos** de la verificación manual.

**Recomendación de este propose:** antes de la verificación manual (§8), la usuaria configura en una
obra social real —vía la pantalla que ya existe— un checklist de al menos 2 ítems (uno requerido, uno
opcional) y asigna esa obra social a un paciente de prueba. Queda como tarea bloqueante `8.2`, no como
sorpresa. Confirmar en `tasks.md` 0.1 quién lo hace.

**Efecto lateral que conviene anticipar:** crear ítems de checklist inserta filas nuevas en
`obra_social.tipos_documento` (get-or-create de `crear_obra_social_completa`), que hoy tiene solo las
3 de facturas. Es el comportamiento esperado, no un bug — pero es la primera vez que ese catálogo
crece por uso real, y refuerza la pregunta ya abierta de quién lo administra.

---

## Decisions

### D1 — Dos archivos nuevos: mapeo puro + repository

```
shared/lib/documentos/
  documentoMapping.ts            CONFIG_ENTIDAD, construirClaveStorage, nombreArchivoSeguro,
                                 parseDocumentoRow, ensamblarDocumentos, toInsertPayload
  SupabaseDocumentoRepository.ts listByEntity, upload, remove (+ traducción de errores)
```

Mismo criterio que las cinco implementaciones anteriores de la serie: el repository solo hace `await`,
chequea `error` y delega toda decisión de forma al módulo puro. Acá el mapeo carga con algo que los
anteriores no tenían: **la construcción de la clave de Storage**, que es pura, determinista salvo por
un UUID inyectado, y la pieza más fácil de romper en silencio — por eso vive en una función con
nombre propio y test propio, no inline en el repository.

### D2 — Tabla de configuración por entidad: una sola fuente para toda la heterogeneidad

```ts
interface ConfiguracionEntidad {
  readonly schema: 'pacientes' | 'conductores' | 'facturacion';
  readonly tabla: string;
  readonly columnaEntidad: string;   // FK a la entidad dueña
  readonly columnaItem: string;      // dónde vive el itemId
  readonly bucket: string;
  readonly modulo: string;           // solo para el mensaje de error, nunca para autorizar
}

const CONFIG_ENTIDAD: Record<EntidadDocumental, ConfiguracionEntidad> = {
  paciente:  { schema: 'pacientes',   tabla: 'documentos',              columnaEntidad: 'paciente_id',  columnaItem: 'id_tipo_documento', bucket: 'documentos-pacientes',   modulo: 'pacientes'   },
  vehiculo:  { schema: 'conductores', tabla: 'documentacion_vehiculo',  columnaEntidad: 'vehiculo_id',  columnaItem: 'tipo_documento',    bucket: 'documentos-vehiculos',   modulo: 'vehiculos'   },
  conductor: { schema: 'conductores', tabla: 'documentacion_conductores', columnaEntidad: 'conductor_id', columnaItem: 'tipo_documento',  bucket: 'documentos-conductores', modulo: 'conductores' },
  factura:   { schema: 'facturacion', tabla: 'documento_factura',       columnaEntidad: 'factura_id',   columnaItem: 'id_tipo_documento', bucket: 'documentos-facturas',    modulo: 'facturacion' },
};
```

`Record<EntidadDocumental, …>` es intencional: si algún día se agrega un quinto valor a
`EntidadDocumental`, **`tsc` falla acá** hasta que se agregue su fila. Es el único mecanismo de este
change que garantiza que no quede una entidad a medio cablear.

`modulo` **no autoriza nada** — la autorización vive 100% en la RLS del servidor. Sirve solo para
redactar el mensaje de error en castellano ("No tenés permiso para subir documentos de vehículos") y
para el test que verifica que la config coincide con las policies reales.

**Nota de coherencia (Checkpoint 3):** `vehiculo.modulo` dice `'vehiculos'` porque es lo que dice la
**tabla**. Si el Checkpoint 3 se resolviera por la opción B (no tocar el storage), esta entrada queda
mintiendo respecto del bucket y hay que anotarlo en el propio archivo — otra razón para preferir A.

### D3 — Clave de Storage: `{entidadId}/{itemId}/{uuid}-{nombreSeguro}`

```
documentos-pacientes/9f3c…/7b21…/3e5a1c9d-certificado-medico-2026.pdf
                     ^^^^^ ^^^^^  ^^^^^^^^ ^^^^^^^^^^^^^^^^^^^^^^^^^
                     entidadId    uuid v4   nombre saneado (ASCII, sin espacios)
                           itemId
```

Cuatro decisiones adentro, cada una con su razón:

1. **Prefijo por `entidadId`** — habilita listar/borrar por entidad sin tocar la base, y deja la
   puerta abierta a una RLS por carpeta en el futuro **sin migrar archivos**. Hoy la RLS es por módulo
   (decisión explícita de C-03, alineada con el docx: *"el acceso se controla por módulo"*), y este
   change **no la cambia**.
2. **Segmento por `itemId`** — hace obvio en el dashboard de Storage qué archivo corresponde a qué
   ítem del checklist, sin joinear.
3. **UUID por archivo** — el `upload` de reemplazo sube el archivo nuevo **antes** de borrar el viejo
   (D4). Sin el UUID los dos colisionarían en la misma clave y habría que elegir entre `upsert: true`
   (que destruye el archivo anterior antes de saber si el insert va a funcionar) y fallar. Con UUID,
   `upsert: false` siempre, y nunca hay dos escrituras sobre la misma clave.
4. **Nombre saneado y `archivo_url` guarda la clave, no una URL** — los buckets son privados: una
   "URL" pública no existiría y una firmada expira. `archivo_url` almacena la **clave dentro del
   bucket** (el bucket sale de `CONFIG_ENTIDAD`, no de la columna). El nombre que ve la usuaria sale
   de `nombre_archivo` (Checkpoint 2), no de la clave.

> ⚠️ **Discrepancia menor a documentar**: la columna se llama `archivo_url` y no guarda una URL.
> Renombrarla sería un cambio destructivo sobre 4 tablas del backend ya aplicado, desproporcionado
> para un problema de nombre. Se documenta con `COMMENT ON COLUMN` en la migración aditiva del
> Checkpoint 2 y en `04_modelo_de_datos.md` §Discrepancias. No se resuelve unilateralmente.

`nombreArchivoSeguro` es pura: minúsculas, `NFD` + quita diacríticos, todo lo que no sea
`[a-z0-9.-]` a `-`, colapsa guiones repetidos, recorta a 100 caracteres **preservando la extensión**.
Es puro higiene de la clave — el nombre real lo guarda la columna nueva.

### D4 — El corazón del change: Storage y Postgres no comparten transacción

**El problema.** Los cinco repositories anteriores de la serie resolvían la atomicidad con una RPC
`SECURITY INVOKER`, porque escribían varias tablas. Acá cada operación escribe **una** tabla, así que
no hace falta ninguna RPC — pero aparece algo que una transacción de Postgres **no puede** cubrir: el
archivo vive en Storage y la fila en Postgres. Toda secuencia tiene una ventana de fallo.

**Criterio que ordena todo lo demás:** de los dos residuos posibles, **un objeto huérfano (archivo sin
fila) es tolerable y un puntero roto (fila sin archivo) no lo es**. Un huérfano es invisible para la
UI (nadie lo lista: `listByEntity` lee la tabla, no el bucket), no rompe nada y se limpia después. Un
puntero roto sí llega a la pantalla: el ítem aparece "Cargado" y al descargarlo —cuando exista la
descarga— falla. Por eso **el archivo se sube primero y la fila se escribe última, siempre.**

```
upload(entidad, entidadId, itemId, file):
  1. SELECT  fila previa de (entidadId, itemId)         → puede no existir
  2. UPLOAD  archivo nuevo a clave nueva (upsert: false)
  3. DELETE  fila previa, si existía                    ─┐ semántica de reemplazo,
  4. INSERT  fila nueva apuntando a la clave nueva      ─┘ igual que el mock
  5. REMOVE  objeto previo, si existía                   ← best-effort, no lanza

  compensación: si 4 falla → REMOVE del objeto de 2 y se propaga el error
                si 3 falla → REMOVE del objeto de 2 y se propaga el error
                si 5 falla → NO se propaga: el estado del dominio ya es correcto
```

*Por qué el `DELETE` (3) va antes del `INSERT` (4) y no al revés:* ninguna de las 4 tablas tiene un
`UNIQUE (entidad_id, tipo_documento)`, así que insertar primero dejaría transitoriamente **dos** filas
para el mismo ítem; si el delete fallara, quedan las dos para siempre y `listByEntity` tendría que
desempatar. Con delete-primero, el peor caso es "el ítem queda sin fila" — que es exactamente el
estado previo a subir nada, y el que la UI ya sabe representar ("Falta").

> **Consecuencia honesta que hay que decir:** entre el paso 3 y el 4 hay una ventana de milisegundos
> en la que el documento anterior ya no está en la tabla y el nuevo todavía no. Si el proceso muere
> justo ahí, la usuaria ve el ítem como "Falta" y vuelve a subir. Se acepta: la alternativa
> (`UNIQUE` + `upsert` de PostgREST) exige agregar una constraint a 4 tablas del backend ya aplicado,
> lo que sale del alcance aditivo de este change. Queda anotado como mejora posible
> (`Open Questions`), no como deuda oculta.

> **⚠️ CORRECCIÓN (2026-08-06, hallada al retomar el apply de este change — mismo tipo de supuesto
> roto que la corrección de D6, esta vez sin anotar hasta ahora).** El algoritmo de arriba dice
> "semántica de reemplazo, igual que el mock" (pasos 1 y 3) — eso **dejó de ser cierto**.
> `pacientes-documentos-multiples` (archivado, Checkpoint (a), veredicto de la usuaria: **sin
> límite, colección real**) cambió `mockDocumentoRepository.upload()` de "reemplaza el documento
> del ítem" a "**siempre agrega**" (`store.set(k, [...existing, nuevo])`, sin `SELECT` previa, sin
> `DELETE` de nada). El algoritmo real que `SupabaseDocumentoRepository.upload()` tiene que replicar
> es más simple que el de arriba, no el mismo:
> ```
> upload(entidad, entidadId, itemId, file, vigenciaDesde?):
>   1. UPLOAD  archivo nuevo a clave nueva (upsert: false)
>   2. INSERT  fila nueva apuntando a la clave nueva (incluye itemId, sin tocar filas existentes)
>   compensación: si 2 falla → REMOVE del objeto de 1 y se propaga el error
> ```
> No hay paso 3/4/5 de la versión original: no hay fila previa que buscar, ni reemplazar, ni objeto
> viejo que limpiar — cada upload es un documento nuevo e independiente en la colección. `itemId` se
> sigue guardando en la fila (agrupa los documentos por ítem del checklist) pero ya no se usa para
> buscar-y-reemplazar. `vigenciaDesde` (agregado por el mismo change, `design.md`
> `documentos-previsualizacion`/`pacientes-documentos-multiples`) es un parámetro opcional sin
> columna persistida en ninguna de las 4 tablas reales — se acepta por firma de interfaz pero no se
> escribe en el INSERT (mismo criterio que `documentoMapping.ts` §3.6 con `vigenciaDesde`/`tipoMime`
> en `DocumentoAdjunto`).
>
> `remove()` también quedó desactualizado: ya no es `remove(entidad, entidadId, itemId)`, es
> `remove(entidad, entidadId, **documentoId**)` — apunta al documento puntual por su propio `id`, no
> por `itemId` (con colección, "el" documento de un ítem no identifica nada, puede haber N). El
> algoritmo de 3 pasos de abajo (SELECT/DELETE/REMOVE) sigue siendo correcto tal cual está escrito,
> solo cambia qué columna filtra el `SELECT`/`DELETE`: por `id`, no por `item_id`.
>
> Quien implemente `SupabaseDocumentoRepository.upload()`/`remove()` debe seguir el algoritmo
> corregido de acá arriba, no el original de 2 párrafos más arriba. Ver también la corrección de D6
> sobre `resolverPrevisualizacion()` — es el mismo patrón: este `design.md` se escribió antes de que
> `pacientes-documentos-multiples` y `documentos-previsualizacion` se aplicaran, y ambos cambiaron el
> contrato real de `DocumentoRepository`/mock que este change tiene que replicar.

```
remove(entidad, entidadId, documentoId):
  1. SELECT  fila por su `id` (= documentoId)  → si no existe, resuelve sin error (idempotente, igual que el mock)
  2. DELETE  fila
  3. REMOVE  objeto                        ← best-effort, no lanza
```

*Por qué la fila primero en `remove`:* si el borrado del objeto fallara después, queda un huérfano
(tolerable). Al revés quedaría un puntero roto (inaceptable). Mismo criterio, aplicado en el orden
inverso — y esa simetría es exactamente lo que hace la regla fácil de sostener en el tiempo.

`listByEntity` es una sola consulta a la tabla, sin tocar Storage: la UI necesita `itemId`,
`nombreArchivo` y `subidoEn`, y los tres viven en la fila.

### D5 — Traducción de errores: PostgREST **y** Storage, siempre en castellano

Novedad respecto de los cinco repositories anteriores: acá hay **dos** fuentes de error con formas
distintas. `supabase-js` devuelve `PostgrestError` (`{ code, message }`) para la tabla y `StorageError`
(`{ name, message }`, sin `code` numérico) para el bucket — hay que angostar las dos con type guards,
nunca con `as`.

| Origen | Código / señal | Cuándo | Mensaje de UI |
|---|---|---|---|
| Postgres | `42501` / `PGRST301` | RLS de la tabla rechaza la escritura | `No tenés permiso para subir documentos de {entidad}.` |
| Postgres | `23503` | la entidad no existe (**el caso del id de fixture**, Checkpoint 0) | `No se encontró {la entidad} de este documento. Puede que se haya eliminado.` |
| Postgres | `PGRST204` | falta `nombre_archivo` → **migración del Checkpoint 2 no aplicada** | `La carga de documentos no está habilitada en el servidor todavía.` |
| Postgres | `PGRST106` / `PGRST205` | el schema no está expuesto en el Data API | `El módulo de {entidad} no está habilitado en el servidor.` |
| Storage | `403` / `Unauthorized` | RLS del bucket rechaza (**el caso del Checkpoint 3** en Vehículos) | `No tenés permiso para subir archivos de {entidad}.` |
| Storage | `404` / `Bucket not found` | el bucket no existe | `El almacenamiento de documentos no está configurado.` |
| Storage | `413` / `Payload too large` | archivo supera el límite del proyecto | `El archivo es demasiado grande.` |
| Storage | `409` / `Duplicate` | colisión de clave (imposible por el UUID de D3 — si aparece, es un bug) | `No se pudo guardar el documento.` |
| cualquiera | resto | — | `No se pudo cargar el documento.` / `No se pudo guardar el documento.` según la operación |

**Nunca se propaga `error.message` crudo a la UI** — mismo requisito duro que toda la serie. Los dos
mensajes de 403 (tabla y bucket) son deliberadamente **distintos en el texto** para que, cuando la
usuaria reporte el problema, se sepa cuál de las dos capas rechazó — que es justo el diagnóstico que
hoy nadie podría hacer con el desfasaje del Checkpoint 3.

### D6 — La descarga queda explícitamente fuera, y por qué eso no es una regresión

`US-900` pide *"consultar y **descargar** los documentos adjuntos cuando haga falta presentarlos"*.
`DocumentChecklist` **nunca tuvo** botón de descarga: sus tres acciones son Subir / Reemplazar /
Quitar (verificado leyendo el componente). El mock tampoco podía descargar nada. Es decir: **este
change no quita una funcionalidad que exista** — deja intacta una que nunca se construyó.

Implementarla ahora exigiría: (a) `createSignedUrl(clave, expiración)` en el repository, (b) una
cuarta firma en la interfaz `DocumentoRepository` —que este change se comprometió a no tocar—, y
(c) un botón nuevo en un componente compartido por 5 pantallas. Es un change de producto, no de
adaptador. **Se propone como change propio: `documentos-descarga-firmada`**, y se anota en
`10_preguntas_abiertas.md` para que el criterio de aceptación de US-900 no quede tácitamente dado por
cumplido.

> **⚠️ CORRECCIÓN (2026-08-06, `documentos-previsualizacion` §7.4 — supuesto roto, documentado antes
> de que este change se aplique, no descubierto durante su apply).** El párrafo de arriba dice que
> este change "se comprometió a no tocar" la interfaz `DocumentoRepository` y que agregarle una firma
> sería el costo de implementar la descarga (fuera de alcance, ver más abajo). Eso **ya no es
> cierto en el punto de partida**: `documentos-previsualizacion` se aplicó primero (§0-§6 completas,
> commiteado) y le agregó a `DocumentoRepository` un **cuarto método**,
> `resolverPrevisualizacion(entidad, entidadId, documentoId): Promise<string | null>`
> (`frontend/src/shared/lib/documentos/DocumentoRepository.ts`). O sea: cuando quien implemente
> `integracion-documentos` escriba `SupabaseDocumentoRepository`, la interfaz que tiene que satisfacer
> **ya no tiene tres métodos** (`listByEntity`/`upload`/`remove`, los únicos que este `design.md`
> conocía al escribirse) sino **cuatro** — falta implementar `resolverPrevisualizacion()` también, o el
> `tsc -b --noEmit` de este change no va a compilar. No es la firma "cuarta" que D6 imaginaba para la
> descarga (esa, si se construye, sería la **quinta**, vía `documentos-descarga-firmada`) — es una
> preexistente que apareció por otro change. Ver `CHANGES.md` bajo `C-03`/`C-05` (nota "Refinamiento
> posterior (`documentos-previsualizacion`)") y `knowledge-base/10_preguntas_abiertas.md` (entrada
> `documentos-previsualizacion`) para el detalle completo. **Quien retome este change debe releer
> `DocumentoRepository.ts` contra el estado real del repo antes de escribir
> `SupabaseDocumentoRepository`, no asumir los tres métodos originales de este `design.md`.**
>
> **⚠️ SEGUNDO REFINAMIENTO (2026-08-07, `documentos-checklist-por-actividad`, ya en `main` —
> commit `e6f9bc2`).** Mismo patrón que arriba, un tercer change se aplicó encima mientras
> `integracion-documentos` seguía en curso. Este agregó `agrupacionId?: string` a
> `DocumentoAdjunto` (`shared/types/documento.ts`) y como parámetro opcional final a
> `DocumentoRepository.listByEntity` (3er parámetro) y `.upload` (6to parámetro, después de
> `vigenciaDesde`, `shared/lib/documentos/DocumentoRepository.ts`) — agrupa documentos de Pacientes
> por actividad/dirección (Checkpoint (b) de ese change, opción B). `remove`/`resolverPrevisualizacion`
> **no** lo ganan: el `documentoId` ya identifica un documento único sin importar la agrupación.
>
> A diferencia de `resolverPrevisualizacion` (que si no se implementaba, `tsc` fallaba),
> `agrupacionId?` es un parámetro **opcional al final** — el tipado estructural de TypeScript deja
> que `SupabaseDocumentoRepository.listByEntity(entidad, entidadId)`/`.upload(..., vigenciaDesde?)`
> (sin ese parámetro) sigan cumpliendo la interfaz sin cast y sin romper `tsc -b --noEmit`. La
> implementación real de este change (`SupabaseDocumentoRepository.ts`) lo trata exactamente igual
> que ya trata `vigenciaDesde`/`tipoMime`: **aceptado por firma, no persistido** — ninguna de las 4
> tablas reales tiene columna para agrupación todavía, así que `listByEntity` no filtra por
> `agrupacionId` (siempre devuelve la colección completa, sea cual sea el `agrupacionId` pedido) y
> `upload` no lo guarda. **No es un bug de este change** — es el estado esperado hasta que exista una
> migración futura (fuera de alcance acá: columna aditiva y nullable, `direccion_id UUID REFERENCES
> pacientes.direcciones(id)`, `ON DELETE` todavía sin decidir — ver Checkpoint (h) de
> `openspec/changes/documentos-checklist-por-actividad/design.md`). Documentado acá para que quede
> escrito en los dos lugares (regla dura del proyecto sobre discrepancias): `Pacientes` es hoy la
> única entidad de las 4 que algún día usará agrupación real; Vehículos/Conductores/Facturas nunca
> la pasan y no se ven afectados.

### D7 — Seguridad: nada se relaja, y el gateo de cliente no se mueve

- **`anon key` únicamente.** El repository usa el singleton `shared/lib/supabaseClient.ts`, igual que
  las cinco implementaciones anteriores. **Ningún camino de este change toca
  `SUPABASE_SERVICE_ROLE_KEY`** — el test lo verifica leyendo el texto del archivo, mismo mecanismo
  que la serie usa para verificar que ninguna función se declaró `SECURITY DEFINER`.
- **Los buckets siguen privados** (`public: false`). Este change no genera URLs públicas ni firmadas
  (D6): no crea **ninguna** superficie de lectura nueva sobre datos clínicos.
- **El gateo de cliente no cambia.** `readOnly={!puedeEscribir}` ya está cableado en los 4 wrappers y
  se queda como está. Se mantiene el principio ya escrito en esos archivos: *"el gateo del cliente
  nunca debe ser más restrictivo que la RLS del servidor"* — la lectura del checklist sigue
  disponible con solo `read`.
- **La RLS es la única autoridad.** `CONFIG_ENTIDAD.modulo` se usa para redactar mensajes, jamás para
  decidir si una operación procede.

### D8 — Orden del trabajo

```
§2  migración escrita, NO aplicada (5 ADD COLUMN + 4 policies del bucket)  ← gated por CP2 y CP3
§3  documentoMapping.ts        (nadie lo importa todavía)
§4  SupabaseDocumentoRepository.ts + traducción de errores
§5  el swap: PacientesRoute.tsx           ← corte real, 1 de 4 roots
§6  AvisoModeloDatos en los 3 wrappers que siguen en mock
§7  documentación
§8  verificación manual (usuaria/Enzo) — incluye la precondición de datos del CP4
```

Las §3 y §4 no dependen de que la migración esté aplicada: se testean con un fake tipado del cliente.
La §5 **sí** — sin `nombre_archivo` en la base, el primer upload real responde `PGRST204`. Por eso la
verificación manual (§8) es bloqueante y va después de que la usuaria/Enzo apliquen el `.sql`.

---

## Open Questions

- **¿Quién administra `obra_social.tipos_documento`?** Ya abierta en `10_preguntas_abiertas.md` con
  tres consumidores `ON DELETE RESTRICT`. Este change la vuelve más urgente: hasta hoy el catálogo no
  podía crecer por uso (no había forma de crear un documento) — a partir de acá sí, y su ruta de error
  (`23503` al intentar borrar un tipo en uso) deja de ser teórica. No bloquea, pero conviene resolverla
  antes de que el catálogo se llene.
- **Descarga de documentos (US-900).** Fuera de alcance por D6. Propuesto como
  `documentos-descarga-firmada`. Hasta que exista, el criterio de aceptación *"se pueden consultar y
  descargar"* de US-900 está cumplido **a medias** (se consultan, no se descargan) — y conviene que
  eso esté escrito y no asumido.
- **Límite de tamaño y tipos MIME.** El `<input accept="image/*,.pdf">` de `DocumentChecklist` es una
  sugerencia del navegador, no una validación: nada impide arrastrar un `.exe` renombrado. El límite
  real lo pone la configuración del bucket en Supabase, que este change **no toca** y cuyo valor
  actual no se verificó (no hay comando de CLI para leerlo sin pasar por el dashboard). Queda como
  verificación pendiente en `tasks.md` 1.4 — con `413` ya traducido por si el límite es más bajo de lo
  que alguien espera.
- **`UNIQUE (entidad_id, tipo_documento)` en las 4 tablas.** Cerraría la ventana entre el `DELETE` y
  el `INSERT` de D4 y habilitaría un `upsert` real. Es una constraint nueva sobre tablas del backend
  ya aplicado — fuera del alcance aditivo de este change, anotado para quien retome el modelo.
- **Limpieza de huérfanos.** D4 acepta que un fallo parcial deje un objeto sin fila. Con 4 tablas en 0
  filas y 1 objeto en total hoy es irrelevante, pero no hay proceso de limpieza. Anotado, sin
  proponerse acá.
- **Si el Checkpoint 3 se resuelve por la opción B** (no tocar el storage), D2 y D5 necesitan una nota
  extra: `CONFIG_ENTIDAD.vehiculo.modulo` quedaría desalineado respecto del bucket, y el mensaje de
  403 tendría que nombrar los dos módulos. Los dos caminos quedan escritos acá para no rehacer el
  análisis.
