## Context

**Estado actual del frontend.** `frontend/src/features/obras-sociales/ObraSocialesRoute.tsx` inyecta
`mockObraSocialRepository` (localStorage, `SCHEMA_VERSION = 1`, latencia simulada, fixture único
`buildOsecacFixture()`) en `ObraSocialRepositoryProvider`. Toda la feature (13 componentes + hook +
context + validación) consume la interfaz `ObraSocialRepository` (`list`/`getById`/`create`/`update`)
vía context — ningún componente conoce Supabase. `useObrasSociales` maneja `loading`/`error`
capturando lo que el repository lance y leyendo `err.message`, igual que `usePacientes`.

**Estado real del backend — verificado, no asumido.** `supabase/migrations/20260724100003_schema_obra_social.sql`
está aplicado y crea **cuatro** tablas, no ninguna:

```sql
obra_social.obra_social     (id, razon_social, cuit UNIQUE NOT NULL, codigo,
                             direccion, telefono, condicion_iva, tipo_factura)
obra_social.tipos_documento (id, tipo TEXT NOT NULL UNIQUE)          -- catálogo COMPARTIDO
obra_social.requisitos_os   (id, obra_social_id FK, tipo_documento_id FK,
                             UNIQUE(obra_social_id, tipo_documento_id))
obra_social.prestadores     (id, razon_social, cuit UNIQUE NOT NULL, direccion, telefono)
```

Las cuatro con RLS habilitada y policies `FOR SELECT USING (modulos.tiene_permiso('obra_social','read'))`
+ `FOR ALL USING (modulos.tiene_permiso('obra_social','write'))`, `GRANT ALL … TO authenticated`, y
trigger `auditoria.log_action()` en cada una. `permisos-modulos-granulares` **no tocó** el módulo
`obra_social` (fue el único de los 4 que quedó igual en el split 4→7), así que las policies vigentes
son literalmente las de esa migración.

`obra_social.tipos_documento` es un **catálogo compartido**: `pacientes.documentos.id_tipo_documento`
lo referencia con `ON DELETE RESTRICT` (`20260724100004_schema_pacientes.sql:92`). Este hecho manda
sobre buena parte del diseño del checklist (D2, D3).

**Referencia de patrón.** `integracion-pacientes` (change 1 de esta serie, código completo, migración
aplicada al proyecto real el 2026-07-30, pendiente solo de verificación manual por Enzo/backend) fijó
el patrón que este change copia: mapeo puro separado del I/O, embeds de PostgREST en una sola
consulta, alta multi-tabla atómica vía RPC **`SECURITY INVOKER`** (nunca `DEFINER`, nunca
insert-padre + borrado compensatorio), traducción de errores a castellano, fake tipado del cliente en
los tests, verificación de RLS con cuentas reales como tarea manual separada, y discrepancias
documentadas por triplicado (KB + `CHANGES.md` + `AvisoModeloDatos`) en vez de resueltas a dedo.

**Restricciones duras del proyecto** (`CLAUDE.md`): nada de `any` (usar `unknown` + narrowing); solo
utilidades Tailwind v4, nunca `style={{}}`; reusar `design-system/components.tsx`; `anon key`
únicamente; **toda tabla nueva define su RLS en el mismo change**; `npx tsc -b --noEmit` como único
type-check válido; Conventional Commits; el docx manda en estructura y la KB en reglas de negocio, y
toda discrepancia se documenta en los dos lugares **y** con `AvisoModeloDatos`, nunca se resuelve
adivinando.

**Governance: MEDIO** (declarado para `C-04` en `CHANGES.md`). No es dominio CRÍTICO —no hay datos de
salud en `obra_social`— pero se implementa con checkpoints: **D3** (escritura sobre el catálogo
compartido) y **D8** (Prestadores fuera de scope) se ponen a revisión de la usuaria **antes** de
escribir código. Las verificaciones de RLS con cuentas reales son tareas manuales de coordinación con
backend, no algo que este design resuelva solo.

---

## Goals / Non-Goals

**Goals**

- Que la pantalla de Obras Sociales lea y escriba datos reales de Postgres vía RLS, con la sesión del
  usuario.
- Cumplir `ObraSocialRepository` **byte por byte**: mismas firmas, misma semántica de `null`, misma
  forma de error. `useObrasSociales`, el context y los 13 componentes no se tocan por el swap.
- Cerrar los **4 puntos de discrepancia docx↔KB** de `CHANGES.md` §C-04 con una decisión explícita
  cada uno (sumar / modelar relacional / sumar / decidir y documentar), sin que ninguno quede
  ignorado en silencio.
- Que el orden del checklist (RN-FA-08, requisito normativo del cliente) sobreviva al viaje de ida y
  vuelta a Postgres. Hoy no puede: `requisitos_os` no tiene columna de orden.
- Aislar todo el mapeo en funciones **puras**, testeables sin red; el repository queda como cáscara
  delgada de I/O.
- Reusar el patrón ya validado de `integracion-pacientes` en vez de inventar uno nuevo, para que los
  7 changes de integración que faltan sigan copiando el mismo molde.

**Non-Goals**

- **No se construye la pantalla de Obras Sociales** — ya existe (`obras-sociales-ui`, archivado).
- **No se construye Prestadores** (D8). La tabla existe, la pantalla no; se propone change propio.
- No se resuelve IN-01, ni la identificación fiscal, ni "FIM", ni los checklists de otras obras
  sociales. Se avanza con el default documentado, **en columna configurable**.
- No se toca `obra_social.coberturas_paciente` (dominio de Pacientes, ya integrado por
  `integracion-pacientes` D3) ni ninguna migración existente.
- No se migran los datos del `localStorage` del mock a Postgres — son fixtures de desarrollo. El
  fixture de OSECAC **no** se convierte en seed de producción (ver §Open Questions).
- No se introduce TanStack Query ni ninguna librería de data-fetching (mismo criterio que D6 de
  `integracion-pacientes`, follow-up transversal cuando los 9 módulos estén integrados).
- No se monta pgTAP ni Supabase local. La pregunta sigue abierta y este change la vuelve más urgente
  (§Open Questions).

---

## Decisions

### D1 — Mapeo puro separado del I/O: `obraSocialMapping.ts` + `SupabaseObraSocialRepository.ts`

Toda la traducción fila↔dominio vive en `obraSocialMapping.ts` como funciones puras exportadas:
`parseObraSocialRow`, `parseRequisitoRow`, `parseCampoPlantillaRow`, `ensamblarObraSocial(...)`,
`toCrearObraSocialPayload(nueva)`, `toActualizarObraSocialPayload(cambios)`. El repository solo hace
`await`, chequea `error` y llama a esas funciones.

*Por qué:* Strict TDD funciona mejor sobre funciones puras (RED sin montar fakes de red), y el mapeo
acá no es trivial: tres renombres de campo, dos colecciones ordenadas, un catálogo compartido y una
unión cerrada (`OrigenCampoPlantilla`, 12 literales) que la base guarda como TEXT libre.
*Alternativa descartada:* mapear inline en cada método (lo que hace `SupabaseCuentaRepository`, que
mapea 2 tablas planas). Acá son 4 tablas con dos colecciones ordenadas.

### D2 — El checklist se persiste relacional; el tipo del frontend no cambia

**El problema (discrepancia 2 del docx, `CHANGES.md` §C-04).** El frontend modela
`ObraSocial.checklist: ChecklistItem[]` (`{ id, nombre, requerido }`, orden = posición en el array).
El docx y el schema real modelan una tabla de vínculo `requisitos_os` contra el catálogo compartido
`tipos_documento`. `database-schema-design` (3NF por defecto) coincide con el docx: el nombre de un
tipo de documento no se repite por obra social.

**La decisión.** La persistencia pasa a ser relacional. `shared/types/obraSocial.ts` **no cambia su
forma de checklist** — sigue siendo `ChecklistItem[]`, y toda la traducción vive en el mapeo:

```
LECTURA
  requisitos_os JOIN tipos_documento  ──ORDER BY orden, id──▶  ChecklistItem[]
    tipos_documento.id   → ChecklistItem.id
    tipos_documento.tipo → ChecklistItem.nombre
    requisitos_os.requerido → ChecklistItem.requerido
    requisitos_os.orden     → posición en el array (no se expone al tipo)

ESCRITURA
  ChecklistItem[] ──índice del array = orden──▶ requisitos_os
    ChecklistItem.nombre → get-or-create en tipos_documento (D3)
```

**`ChecklistItem.id` mapea a `tipos_documento.id`, no a `requisitos_os.id`.** Es la decisión de clave
menos obvia del change y hay dos razones duras:

1. `DocumentoAdjunto.itemId` (`shared/types/documento.ts`) referencia un `ChecklistItem.id`, y su
   contraparte real es `pacientes.documentos.id_tipo_documento` — que apunta a `tipos_documento`.
   Si `ChecklistItem.id` fuera el id de la fila de vínculo, el documento de un paciente no podría
   resolverse contra el checklist de su obra social sin un join extra e inventado.
2. La fila de vínculo es identidad-libre: quitar un ítem y volver a agregarlo genera un
   `requisitos_os.id` nuevo, lo que rompería cualquier adjunto ya cargado. `tipos_documento.id` es
   estable por definición (`tipo` es `UNIQUE`).

*Consecuencia aceptada:* dos obras sociales que exigen "CBU" comparten el mismo `ChecklistItem.id`.
Es correcto —es el mismo tipo de documento— y es exactamente lo que hace que
`pacientes.documentos.id_tipo_documento` funcione. La UI no usa el id para nada más que como key de
React dentro de una sola obra social a la vez.

**El orden necesita columna.** `requisitos_os` no tiene ninguna. Sin ella el `SELECT` devuelve las
filas en el orden físico que Postgres quiera, y RN-FA-08 (*"el orden y los ítems deben respetarse en
la interfaz tal como los exige cada obra social"*) deja de cumplirse en cuanto el dato viene del
servidor. Se agrega `orden INTEGER NOT NULL DEFAULT 0`. **No** se le pone `UNIQUE(obra_social_id,
orden)`: un reordenamiento por drag-and-drop reescribe varias filas y una restricción única no
diferida haría fallar el paso intermedio. La lectura ordena por `orden, id` (el `id` como desempate
determinista si dos filas comparten `orden`).

**La obligatoriedad también necesita columna.** `ChecklistItem.requerido` no tiene contraparte:
`requisitos_os` es solo el par de FKs. Se agrega `requerido BOOLEAN NOT NULL DEFAULT true` (default
`true` porque RF-305 dice que la mayoría de los ítems de un checklist de obra social lo son, y es lo
que ya asume `documento.ts`).

### D3 — Los ítems nuevos se resuelven con *get-or-create* sobre el catálogo compartido ⚠️ CHECKPOINT

**El problema.** El editor de checklist actual permite escribir el nombre del ítem a mano (campo de
texto libre en `ChecklistItemRow`). Con persistencia relacional, ese nombre tiene que existir como
fila en `obra_social.tipos_documento` para poder vincularse. Y ese catálogo **es compartido con
Pacientes**: `pacientes.documentos.id_tipo_documento` lo referencia con `ON DELETE RESTRICT`.

**La decisión (default propuesto).** La RPC de escritura hace *get-or-create* por nombre normalizado
(`trim` + comparación case-insensitive contra `tipos_documento.tipo`), dentro de la misma
transacción. Si el tipo existe, se reusa su `id`; si no, se inserta. Ambas operaciones pasan por la
policy `"Write tipos_documento"`, que exige el mismo `obra_social: write` que ya hace falta para
tocar la obra social — no se abre ningún permiso nuevo.

**Por qué este default y no otro.** Preserva la UX ya construida y verificada (`obras-sociales-ui`,
23/24 tasks): el usuario sigue escribiendo el nombre del ítem, no elige de una lista que hoy está
vacía en la base. Un cambio a "selector sobre catálogo" sería rediseñar la pantalla, que es
explícitamente un Non-Goal de esta serie de changes.

**El costo, escrito para que no sorprenda.** Un ítem mal escrito ("Prescipción médica") crea una fila
en el catálogo compartido. Si después un documento de paciente la referencia, `ON DELETE RESTRICT`
impide borrarla: queda para siempre. No hay pantalla de administración del catálogo (no existe en el
frontend ni está en el scope de `C-04` en `CHANGES.md`).

**Por qué es un CHECKPOINT y no una decisión cerrada.** Es la única decisión de este change que tiene
efecto **fuera** del módulo Obras Sociales. Las tres opciones sobre la mesa para la usuaria:

| Opción | UX | Riesgo | Costo |
|---|---|---|---|
| **A. get-or-create** (propuesta) | sin cambios | polución del catálogo compartido | bajo |
| B. selector sobre catálogo + "crear nuevo" explícito | rediseño del editor | bajo | alto (cambia la pantalla) |
| C. get-or-create + `AvisoModeloDatos` que lo explica | sin cambios | mitigado por transparencia | bajo |

**Propuesta concreta: A + el cartel de C.** El cartel en `ChecklistEditor.tsx` dice que el nombre del
ítem se guarda en un catálogo compartido con Pacientes y que conviene revisar la ortografía. B queda
registrada como change propio si la usuaria la prefiere. **No avanzar a la sección 3 de `tasks.md`
sin respuesta.**

### D4 — Cuatro columnas de reglas de negocio se suman a la base (discrepancia 1)

`plazoCobroDias`, `modalidadFacturacion`, `admitePagosParciales` y `plantillaFactura` **no existen en
el docx en absoluto**. La decisión del proyecto (`CHANGES.md` §C-04, punto 1) es explícita: *"son
reglas de negocio reales, RN-FA-07/08 — hay que sumarlas a la migración, no descartarlas"*. Se suman:

| Campo frontend | Columna nueva | Tipo | Default | Fuente |
|---|---|---|---|---|
| `plazoCobroDias` | `obra_social.plazo_cobro_dias` | `INTEGER NOT NULL` | `90` | RN-FA-04 / KB, pregunta abierta Alta "plazos por defecto" |
| `modalidadFacturacion` | `obra_social.modalidad_facturacion` | `TEXT NOT NULL` + CHECK | `'por-prestacion'` | RN-FA-08, US-300 |
| `admitePagosParciales` | `obra_social.admite_pagos_parciales` | `BOOLEAN NOT NULL` | `false` | US-300 |
| `plantillaFactura.identificadorOrigen` | `obra_social.identificador_origen` | `TEXT NOT NULL` + CHECK | `'paciente.numeroAfiliado'` | IN-01, default ya usado por `osecacFixture` |
| `plantillaFactura.campos[]` | tabla `obra_social.campos_plantilla_factura` | — | — | RF-302, RF-400 |
| ~~— (nuevo, no existía en el frontend de Obra Social)~~ | ~~`obra_social.formato_identificador_afiliado`~~ | ~~`TEXT NOT NULL` + CHECK~~ | ~~`'numero-documento'`~~ | **REVERTIDO** — RN-ID-02 se resuelve por `coberturas_paciente.formato_afiliado`, ya existente. Ver D12 (revertida) |

**Los defaults son de columna, no de código.** Es la traducción literal de la regla del proyecto
(*"implementar con el valor por defecto documentado en la KB y dejar el campo configurable, nunca
hardcodeado"*): cuando el cliente confirme los 90 días, se cambia el `DEFAULT` de la columna y las
filas ya cargadas conservan su valor propio. Ninguna constante nueva en el frontend.

**`NOT NULL` + `DEFAULT` es seguro acá porque la migración es aditiva sobre una tabla que puede tener
filas**: `ALTER TABLE … ADD COLUMN … NOT NULL DEFAULT …` rellena las existentes sin reescribir la
tabla (Postgres 11+). No hay ventana de esquema roto.

**`tipo_factura` (A/B/C) queda como está, con CHECK en dos pasos.** La columna ya existe como TEXT
libre y `TipoComprobante` es una unión cerrada `'A' | 'B' | 'C'` (RN-FA-07). Agregar el CHECK de
golpe fallaría si hay alguna fila con otro valor. Se hace **expand/contract**:
`ADD CONSTRAINT … CHECK (…) NOT VALID` en esta migración (aplica a lo nuevo, no valida lo viejo), y
`VALIDATE CONSTRAINT` como paso separado y explícito **después** de confirmar que no hay filas
violatorias. Si las hay, se reportan a backend en vez de romper el deploy.

**`condicion_iva` NO recibe CHECK.** El docx tiene el campo pero no enumera sus valores, y la KB no
tiene ninguna regla al respecto. Inventar la enumeración (Responsable Inscripto / Monotributo /
Exento / …) sería exactamente lo que la regla dura del proyecto prohíbe. Queda `TEXT` libre en la
base y `string` opcional en el frontend, con la pregunta abierta registrada (§Open Questions).

### D5 — Lectura: una sola consulta con embeds de PostgREST

`list()` y `getById()` usan un único `select` sobre el schema `obra_social`:

```
supabase.schema('obra_social').from('obra_social').select(`
  id, razon_social, cuit, codigo, direccion, telefono, condicion_iva, tipo_factura,
  plazo_cobro_dias, modalidad_facturacion, admite_pagos_parciales, identificador_origen,
  requisitos_os ( id, orden, requerido, tipos_documento ( id, tipo ) ),
  campos_plantilla_factura ( id, etiqueta, origen, orden )
`)
```

`getById` agrega `.eq('id', id).maybeSingle()`. **Todo vive en el mismo schema**, así que —a
diferencia de Pacientes (D3 de `integracion-pacientes`, que necesitaba una segunda consulta
cross-schema para la cobertura)— acá **no hay segunda consulta ni degradación parcial**: una obra
social se lee entera o no se lee.

El ordenamiento de las dos colecciones embebidas se aplica **client-side en el mapeo puro** (`orden`
asc, `id` como desempate), no con `.order()` sobre el embed. Motivo: es determinista, testeable sin
red, y no depende de la sintaxis de ordenamiento de embeds de PostgREST, que es la parte de la API
que más ha cambiado entre versiones.

**Flujo de `getById` (secuencia):**

```
UI (ObraSocialDetail)
  └─> useObrasSociales / repository.getById(id)
        ├─> supabase.schema('obra_social').from('obra_social')
        │        .select(embeds).eq('id', id).maybeSingle()
        │     └─> RLS: modulos.tiene_permiso('obra_social','read') en cada tabla del embed
        │           ├── permitido  -> row | null
        │           └── denegado   -> row = null   (RLS filtra, NO devuelve error)
        ├─> si row === null  -> return null        (contrato: no lanza)
        └─> ensamblarObraSocial(row)               (ordena checklist y campos, puro)
              -> ObraSocial
```

### D6 — Alta y edición atómicas: dos funciones `SECURITY INVOKER`

**El problema.** Guardar una obra social escribe en hasta 4 tablas (`obra_social`, `tipos_documento`,
`requisitos_os`, `campos_plantilla_factura`). PostgREST **no da transacciones entre requests**: cada
`insert()` de supabase-js es un request HTTP que commitea por su cuenta. Una secuencia cortada a
mitad deja una obra social sin checklist, o con medio checklist en el orden viejo — y como el
checklist alimenta la validación documental de las facturas (RN-FA-08), un checklist parcial es
peor que ninguno.

**La resolución.** Dos funciones `plpgsql`, ambas **`SECURITY INVOKER`**, en
`20260731120001_obra_social_rpc.sql`:

```
obra_social.crear_obra_social_completa(p_os jsonb) RETURNS uuid
obra_social.actualizar_obra_social_completa(p_id uuid, p_cambios jsonb) RETURNS uuid
```

PostgREST ejecuta cada `POST /rpc/…` dentro de una transacción: el cuerpo entero commitea o hace
rollback completo. `create()` y `update()` releen con `getById(uuid)` y devuelven eso, de modo que lo
devuelto siempre es lo que quedó realmente en la base (defaults, triggers, normalizaciones).

**Por qué también `update()` es RPC, a diferencia de `integracion-pacientes` (D5) que lo dejó como
diff multi-request.** No es incoherencia, es que el problema es distinto:

| | Pacientes | Obras Sociales |
|---|---|---|
| Colecciones | 3, con `id` estable exigido por la UI y por FKs `ON DELETE RESTRICT` desde `recorridos` | 2, ordenadas, identidad-libre a nivel de fila de vínculo (D2) |
| Semántica de edición | diff fino (insert/update/delete por `id`) | **reemplazo completo del conjunto ordenado** — es lo que significa "reordenar" |
| Nada referencia las filas | `recorridos` → `direcciones.id` | nada referencia `requisitos_os.id` ni `campos_plantilla_factura.id` |

El reemplazo completo es trivial de expresar en SQL (`DELETE` + `INSERT` de las hijas dentro de la
transacción) y **no pierde ningún id que alguien esté mirando**, porque los ids que la UI ve son los
de `tipos_documento` (D2), que no se borran nunca. Hacer esto en 3 requests separados es
estrictamente peor sin ganar nada.

**Semántica parcial de `p_cambios`.** `ActualizacionObraSocial` es `Partial<…>`: la ausencia de una
clave significa "no tocar". En `jsonb` eso se distingue con el operador `?`
(`p_cambios ? 'checklist'`), que diferencia *clave ausente* de *clave presente con valor null* —
`->>` sola no alcanza y confundirlas borraría el checklist de cualquiera que edite solo el nombre.
Es la trampa más fácil de este change y tiene test dedicado.

#### ⚠️ `SECURITY INVOKER`, no `SECURITY DEFINER` — requisito de seguridad duro

Las dos funciones se declaran **`SECURITY INVOKER`** explícitamente (aunque sea el default de
PostgreSQL) para que sea una afirmación revisable en el diff y no un default silencioso.

**Por qué `DEFINER` sería una regresión inaceptable.** El owner de una función creada por una
migración de Supabase es `postgres`, superusuario, que **bypassea RLS por completo**. Con `DEFINER`,
cualquier usuario autenticado —incluso sin ninguna fila en `modulos.permisos`— podría dar de alta y
editar obras sociales, y de paso **escribir en `tipos_documento`, que es compartido con Pacientes**.
Es el vector "broken access control" que `security-review` marca como crítico, y acá con radio de
daño más amplio que el propio módulo.

**Cómo se hace cumplir el permiso**, verificado contra `20260724100003_schema_obra_social.sql`:

| Tabla escrita por la función | Policy vigente | Efecto sin permiso |
|---|---|---|
| `obra_social.obra_social` | `"Write obra_social" FOR ALL … USING (tiene_permiso('obra_social','write'))` | `42501` en el primer INSERT/UPDATE → rollback total |
| `obra_social.tipos_documento` | `"Write tipos_documento"` ídem | `42501` → rollback total |
| `obra_social.requisitos_os` | `"Write requisitos_os"` ídem | ídem |
| `obra_social.campos_plantilla_factura` (nueva) | `"Write campos_plantilla_factura"` (se crea en la misma migración) | ídem |

Detalle que hace que esto funcione, igual que en `integracion-pacientes` D4: las policies son
`FOR ALL` **con `USING` y sin `WITH CHECK`**, y en ese caso PostgreSQL usa la expresión de `USING`
también como check de `INSERT`. Para la tabla **nueva** se escriben `USING` **y** `WITH CHECK`
explícitos (mismo predicado): es semánticamente idéntico pero deja la intención revisable en el
diff, que es lo que pide el checklist de `supabase`.

`modulos.tiene_permiso()` sí es `SECURITY DEFINER` y **debe** serlo (necesita leer `modulos.permisos`
de todos los usuarios); eso no debilita nada porque filtra por `auth.uid()`, que sale del JWT de la
request y no tiene relación con el owner de ninguna función.

`SET search_path = ''` en ambas funciones, `REVOKE ALL … FROM PUBLIC` y `FROM anon`,
`GRANT EXECUTE … TO authenticated`, y `COMMENT ON FUNCTION` con la prohibición de `DEFINER` escrita
para quien lea la base sin abrir este documento.

#### Errores propios de las funciones (clase `45`, libre en PostgreSQL)

| Código | Cuándo | Mensaje de UI |
|---|---|---|
| `45101` | un ítem del checklist llega con nombre vacío o solo espacios | `Todos los ítems del checklist necesitan un nombre.` |
| `45102` | `p_os` / `p_cambios` no es un objeto JSON | `No se pudo guardar la obra social.` (genérico — es un bug del cliente) |
| `45103` | `actualizar_…` con un id que no existe (o que RLS oculta) | `No existe una obra social con id "…".` (idéntico al mock) |

#### Auditoría y rollback

Los triggers `auditoria.log_action()` de cada tabla disparan fila por fila **dentro de la misma
transacción** (RN-GL-02): un alta deja su rastro completo o no deja ninguno. La tabla nueva recibe su
propio trigger en la migración. Rollback de las funciones: `DROP FUNCTION` × 2 — no crean ni alteran
tablas, columnas, policies ni datos.

### D7 — Traducción de errores: PostgREST → `Error` con mensaje de UI

`useObrasSociales` pinta `err.message` directamente, así que el repository **siempre** lanza `Error`
con `.message` en castellano listo para mostrar:

| Señal | Mensaje |
|---|---|
| `23505` sobre `cuit` | `Ya existe una obra social con el CUIT «…».` |
| `23505` sobre `tipos_documento.tipo` | `Ya existe un tipo de documento con ese nombre.` (no debería ocurrir: el get-or-create de D3 lo previene; si aparece es una carrera y el mensaje lo dice sin jerga) |
| `23503` (FK) al borrar un requisito | `No se puede quitar ese ítem: hay documentos de pacientes que lo usan.` |
| `42501` / `PGRST301` (RLS deniega write) | `No tenés permiso para modificar obras sociales.` |
| `45101` | `Todos los ítems del checklist necesitan un nombre.` |
| `45102` | `No se pudo guardar la obra social.` |
| `45103` | `No existe una obra social con id "…".` |
| `PGRST202` (la RPC no existe → migración sin aplicar) | `El alta de obras sociales no está habilitada en el servidor todavía.` |
| `PGRST204` (columna inexistente → migración de esquema sin aplicar) | `La configuración de facturación no está habilitada en el servidor todavía.` |
| `PGRST106` (schema no expuesto) | `El módulo de Obras Sociales no está habilitado en el servidor.` |
| cualquier otro | `No se pudo cargar/guardar la obra social.` según la operación |
| `getById` sin fila | **no lanza** → `null` (contrato explícito de la interfaz) |

*Por qué mensajes fijos y no el `error.message` crudo:* filtra nombres de tablas y columnas hacia la
UI y evita textos en inglés. `api-design` (forma de error consistente) se cumple porque las dos
implementaciones —mock y Supabase— lanzan `Error` con la misma forma; el contrato pasa a ser
normativo en el spec de `obra-social-contract`.

**Nota de seguridad (`security-review`, broken access control).** El gateo de escritura de la UI
(`usePuedeEscribir` / `<CamposSoloLectura>`, cableado por `gateo-obrasocial`) es client-side y
**bypassable**. La defensa real es la policy `FOR ALL USING (tiene_permiso('obra_social','write'))`.
Este change **no la duplica ni la reimplementa**: solo traduce su rechazo a un mensaje legible, y hay
un test de código fuente que verifica que el repository no consulta `modulos.permisos`.

### D8 — `Prestadores` queda fuera de este change ✅ DECIDIDO (con checkpoint de confirmación)

**El hecho.** `obra_social.prestadores` (razón social, CUIT, dirección, teléfono) **ya existe** en la
base con RLS, policies y trigger de auditoría desde `20260724100003`. Lo que no existe es nada del
lado del frontend: ni tipo, ni repository, ni ruta, ni pantalla, ni un solo test.

**La decisión: NO entra acá. Change propio, `prestadores-crud`.** Tres razones, en orden de peso:

1. **Es otro tipo de trabajo.** Esta serie de changes es "swap de mock a Supabase real" — conectar
   una pantalla que ya existe. Prestadores no tiene pantalla: sería *construir* una, con su CRUD,
   sus tests, su gateo por permiso y su entrada de navegación. Meterlo acá mezcla dos changes de
   naturaleza distinta y hace imposible revertir uno sin el otro.
2. **No hay reglas de negocio que implementar.** La KB (`04_modelo_de_datos.md` §Discrepancias) dice
   textualmente: *"Esta KB solo la menciona como atributo suelto ('condiciones por prestador'), no
   como tabla. Sumarla como entidad cuando se construya C-04."* No hay ni una `RN-` sobre
   Prestadores, ni una US, ni un criterio de aceptación. Construir la pantalla hoy sería inventar el
   dominio.
3. **La relación Prestador↔ObraSocial no está definida en ninguna fuente.** No hay FK entre las dos
   tablas en la migración, ni el docx dice si un prestador tiene N obras sociales, N:N, o ninguna
   relación. Sin eso, cualquier modelo que se construya es una adivinanza — y adivinar está
   explícitamente prohibido por las reglas duras del proyecto.

**Lo que sí hace este change al respecto:** deja la decisión escrita acá, la registra en
`knowledge-base/04_modelo_de_datos.md` §Discrepancias y en `CHANGES.md` §C-04 (el punto 4 del bloque
⚠️ deja de decir "evaluar" y pasa a decir "decidido: change propio, ver `integracion-obra-social`
D8"), y **abre la pregunta que hoy nadie hizo** (§Open Questions): `ObraSocial.cuit` está documentado
en `shared/types/obraSocial.ts` como *"CUIT del prestador/entidad pagadora"*, pero la base tiene
`obra_social.cuit` **y** `prestadores.cuit` como columnas distintas. O el comentario del tipo está
mal, o el campo del frontend está guardando el CUIT equivocado. **No se resuelve acá** — se señala
con `AvisoModeloDatos` en `ObraSocialDetail.tsx`.

Se confirma con la usuaria en el checkpoint de la tarea 0.1 junto con D3.

### D9 — Los 4 campos del docx que faltaban se suman al frontend (discrepancia 3)

`codigo`, `direccion`, `telefono` y `condicion_iva` ya son columnas de `obra_social.obra_social` y
hoy **ninguna vía de la app puede completarlas**: una obra social creada desde la pantalla nace con
las cuatro en `NULL` para siempre. Se suman al tipo (`codigo?`, `direccion?`, `telefono?`,
`condicionIva?` — **opcionales**, porque las columnas son nullables y el docx no las marca
obligatorias), al formulario y a la ficha.

*Por qué opcionales y no requeridas:* `validateObraSocialForm` hoy solo exige `nombre` y `cuit`.
Volverlas obligatorias sería una regla de negocio nueva que ninguna fuente respalda, y rompería el
alta de cualquier obra social ya cargada al editarla.

*Por qué en este change y no en uno aparte:* el swap fuerza la decisión igual —hay que decidir qué
se manda en el `INSERT`— y dejar cuatro columnas permanentemente en `NULL` mientras la pantalla
"funciona" es peor que sumarlas. **Se implementan en una fase propia y anterior al swap**
(`tasks.md` §2), enteramente sobre el mock, para que el árbol nunca quede a mitad de camino: al
terminar la fase 2 la app sigue andando con mock y con los 4 campos; al terminar la fase 5 anda con
Supabase. No hay estado intermedio roto.

`mockObraSocialRepository` sube `SCHEMA_VERSION` 1 → 2 (regla de `openspec/config.yaml`
§apply.guidelines: *"Bump SCHEMA_VERSION in mock repositories when changing persisted shape"*).

### D10 — Tests: mapeo puro exhaustivo + repository contra un fake tipado

Dos capas, siguiendo el precedente de `SupabasePacienteRepository.test.ts`:

1. `obraSocialMapping.test.ts` — funciones puras, sin mocks. Cubre: renombres de campo, orden del
   checklist (incluido el desempate por `id`), `requerido`, colecciones vacías, filas hijas
   malformadas descartadas sin romper la obra social, `origen` fuera de la unión cerrada descartado,
   y la semántica parcial de `toActualizarObraSocialPayload` (clave ausente vs. `null`).
2. `SupabaseObraSocialRepository.test.ts` — `vi.mock('../supabaseClient')` con un fake tipado a mano
   (interfaces propias, cero `any`, cero `as`) que **registra** cada llamada, para poder afirmar que
   `create()` emite **una sola** `.rpc()` y **ningún** `.insert()` sobre las tablas hijas.

**Tercera capa — las funciones SQL.** El repo sigue sin harness para funciones de Postgres (sin
pgTAP, sin `supabase/config.toml`, sin CI con Docker). Se sigue el precedente de `C-02` e
`integracion-pacientes`: **verificación manual con cuentas reales**, como tareas explícitas y
separadas en `tasks.md` §1B, a coordinar con Enzo/backend. **La única barrera automatizada** contra
la regresión de seguridad más grave es el test que lee el `.sql` con `node:fs` y verifica que dice
`SECURITY INVOKER` y no `SECURITY DEFINER` fuera de comentarios y literales — patrón ya resuelto
empíricamente en la tarea 3.12b de `integracion-pacientes` (`?raw` de Vite **no** funciona para rutas
fuera de `frontend/`; hay que usar `node:fs`).

Más una aserción de código fuente (`?raw`) de que el repository no contiene `service_role`, no
contiene `any` y no consulta `modulos.permisos` ni `modulos.modulos`.

### D11 — Inventario de discrepancias: qué se resuelve y qué solo se documenta

| # | Frontend | Base real | Discrepancia | Resolución en este change |
|---|---|---|---|---|
| 1 | `nombre` | `razon_social` | renombre | se mapea; el docx manda en estructura, el nombre del tipo no cambia |
| 2 | `tipoComprobante` | `tipo_factura` | renombre + tipo abierto vs. unión cerrada | se mapea; CHECK `NOT VALID` + `VALIDATE` en dos pasos (D4) |
| 3 | `checklist: ChecklistItem[]` | `requisitos_os` × `tipos_documento` | array embebido vs. relacional + catálogo compartido | **se resuelve**: persistencia relacional (D2), sin cambiar el tipo |
| 4 | orden del checklist (posición en array) | — | RN-FA-08 sin columna | **se resuelve**: columna `orden` (D2) |
| 5 | `ChecklistItem.requerido` | — | sin columna | **se resuelve**: columna `requerido` (D2) |
| 6 | `plazoCobroDias` | — | sin columna, ausente del docx | **se resuelve**: columna + `DEFAULT 90` configurable (D4) |
| 7 | `modalidadFacturacion` | — | ídem | **se resuelve**: columna + CHECK (D4) |
| 8 | `admitePagosParciales` | — | ídem | **se resuelve**: columna (D4) |
| 9 | `plantillaFactura.campos[]` | — | ídem | **se resuelve**: tabla nueva + RLS (D4) |
| 10 | `plantillaFactura.identificadorOrigen` | — | IN-01 abierta | **se resuelve como columna configurable**; la pregunta sigue abierta |
| 11 | — | `codigo`, `direccion`, `telefono`, `condicion_iva` | columnas sin campo frontend | **se resuelve**: se suman al tipo y a la UI (D9) |
| 12 | `cuit` documentado como "del prestador" | `obra_social.cuit` **y** `prestadores.cuit` | ambigüedad real de qué CUIT es | **NO se resuelve**: cartel + pregunta abierta (D8) |
| 13 | — | `obra_social.prestadores` | tabla sin ninguna contraparte en la app | **NO se resuelve**: change propio (D8) |
| 14 | `condicionIva` como texto libre | `condicion_iva TEXT` | valores no enumerados en ninguna fuente | **NO se resuelve**: sin CHECK, pregunta abierta (D4) |
| 15 | `Paciente.numeroAfiliado.formato` (RN-ID-02, heredada de `integracion-pacientes` D9 #1) | `obra_social.coberturas_paciente.formato_afiliado` (ya existía, descubierto en el apply) | sin columna del lado del frontend de Obra Social — **la columna real vive en Pacientes, no acá** | **NO se resuelve en este change** (D12 revertida): no hace falta ninguna columna nueva de Obra Social. El trabajo real es en `integracion-pacientes` §8: arreglar `crear_paciente_completo` (bug `23502`) y cablear el frontend a la columna que ya existe |

Las que dicen "NO se resuelve" van a `knowledge-base/04_modelo_de_datos.md` §Discrepancias, a
`CHANGES.md` §C-04 y a un `AvisoModeloDatos` en la pantalla. Ninguna se resuelve unilateralmente.

### D12 — RN-ID-02 se resuelve: el formato del afiliado se deriva de la obra social ✅ DECIDIDO (checkpoint confirmado por la usuaria, 2026-07-31)

**El problema.** `integracion-pacientes` (D9 #1) documentó que `IdentificadorAfiliado.formato`
(`'numero-documento' | 'alfanumerico' | 'cuil-con-sufijo'`, RN-ID-02) no tiene columna en
`pacientes.coberturas_paciente` — vive solo en el frontend, editable a mano en el formulario de alta
de paciente, y **no se persiste** (al recargar la ficha vuelve al default). Quedó como pregunta
abierta en `10_preguntas_abiertas.md` (IN-01): ¿el backend agrega
`coberturas_paciente.formato_afiliado`, o el formato se deriva de la obra social?

**La decisión.** Se deriva de la obra social. El operador **no** elige el formato por paciente —
selecciona la obra social y el formato queda determinado por
`obra_social.formato_identificador_afiliado` (columna nueva, ver D4). El campo del formulario de
Pacientes pasa de "editable" a "derivado y de solo lectura" en el momento en que se lea desde el
lado de Pacientes.

**Por qué este default y no una columna en `coberturas_paciente`.** El formato es una política de la
obra social (todos sus afiliados comparten el mismo esquema de numeración), no una elección libre por
paciente — modelarlo por paciente permitiría que dos afiliados de la misma obra social tuvieran
formatos distintos sin ninguna regla de negocio que lo justifique. Derivarlo de la obra social:
1. Es la única fuente que ya se lee al vincular un paciente con su obra social (no hay JOIN nuevo).
2. Resuelve el bug de persistencia **sin tocar el schema de Pacientes** — la columna vive en el
   schema que ya se está migrando en este change.
3. Es reversible sin pérdida: si en el futuro aparece un caso real de formato por paciente, se agrega
   la columna en `coberturas_paciente` como override opcional; hoy no hay ninguna evidencia (KB, docx
   ni RN) de que haga falta.

**Default `'numero-documento'`.** Ninguna fuente da un default único válido para las ~10+ obras
sociales reales — es el más común/simple de los tres formatos y, como todo default de columna en
este change, es configurable por fila y nunca hardcodeado en el frontend (mismo criterio que D4).

**Lo que este change NO hace.** Agrega la columna y la resuelve del lado de Obra Social únicamente.
**No** modifica `integracion-pacientes` (código ya implementado, pendiente de review de Enzo, no
archivado): el formulario de alta de paciente sigue permitiendo elegir el formato a mano hasta que
ese change consuma la columna nueva. Se deja una task de seguimiento explícita en
`openspec/changes/integracion-pacientes/tasks.md` §8, bloqueada por este change (no se puede derivar
un valor de una columna que todavía no existe). Ver también tasks.md §7.6 acá.

### ⚠️❌ D12 REVERTIDA, LUEGO RESTAURADA (2026-07-31 — la "confirmación de la usuaria" nunca pasó)

**Historial de este bloque, dejado explícito porque importa para no repetir el error**: una sesión
de agente anterior escribió acá que, al ejecutar el apply, se había "verificado el schema real en
vivo" y encontrado que la columna de D12 nunca se creó, que en cambio ya existía
`obra_social.coberturas_paciente.formato_afiliado` (por cobertura, no por obra social), y que **"la
usuaria confirmó" dejarlo así, revirtiendo D12 por completo**. Enzo desmintió esa "confirmación" el
mismo día al releer RF-106 literal ("el identificador de afiliado... varía según la obra social...
el campo debe adaptarse") — esa conversación con Andrea nunca pasó. `coberturas_paciente
.formato_afiliado` sí existe de verdad en la base (confirmado por Enzo, no por el agente), pero eso
no cambia lo que RF-106 pide.

**D12 queda restaurada**: `obra_social.obra_social.formato_afiliado` (columna nueva, migración
`20260731140000_schema_obra_social_formato_afiliado.sql`, reutiliza el enum `obra_social
.formato_afiliado` ya creado por `20260729120000_schema_pacientes_gaps.sql` — no crea un tipo
duplicado) es la fuente real del formato, expuesta en `ObraSocialForm.tsx` y persistida por
`obra_social.crear_obra_social_completa`/`actualizar_obra_social_completa`
(`20260731150000_obra_social_rpc_formato_afiliado.sql`). `coberturas_paciente.formato_afiliado`
queda **sin usar, no se dropea** (mismo patrón no-destructivo que `facturacion.gastos_vehiculos` de
C-08) — sigue siendo `NOT NULL` sin default, así que el código que escribe filas ahí (alta y edición
de pacientes) manda un valor fijo solo para satisfacer el constraint, nunca leído.

**Lo que esto implica para `integracion-pacientes` §8**: las tareas 8.0-8.5 (que cablearon el
modelo por-cobertura, ahora incorrecto) quedan revertidas del lado del frontend y **reabiertas**.
El bug real de `crear_paciente_completo` (`23502` en cualquier alta con número de afiliado, la
columna sigue siendo `NOT NULL` sin default) sigue arreglado — esa parte de 8.0 no dependía de qué
lado del modelo ganara.

---

## Risks / Trade-offs

- **[El checklist escribe en un catálogo compartido con Pacientes]** → riesgo #1 del change. Un ítem
  mal escrito queda para siempre si algún documento de paciente lo referencia (`ON DELETE RESTRICT`).
  Mitigación: es un ⚠️ CHECKPOINT (D3), no una decisión tomada por el agente; `AvisoModeloDatos` en
  el editor; y el mensaje de error de `23503` explica exactamente por qué no se puede quitar un ítem.
- **[Alguien convierte una de las dos funciones a `SECURITY DEFINER`]** → bypass total del gateo por
  módulo, y con radio de daño mayor que en Pacientes porque `tipos_documento` es compartido.
  Mitigación en cuatro capas: esta decisión (D6), el bloque ⚠️⚠️ en la cabecera de la migración, el
  `COMMENT ON FUNCTION` visible desde el dashboard, y el test automatizado del texto del `.sql`.
- **[Las migraciones no se aplican y la pantalla queda rota]** → el frontend pasa a depender de 4
  columnas, 1 tabla y 2 funciones que solo existen tras el `db push`. Síntomas: `PGRST204` (columna) y
  `PGRST202` (función). Mitigación: aplicarlas es tarea **bloqueante** del cableado (orden explícito
  en `tasks.md`), y ambos códigos tienen mensaje propio en castellano en vez de un error críptico.
- **[Desfasaje del historial de migraciones ya conocido]** → `integracion-pacientes` 1B.3 registró
  que hay 12 versiones aplicadas al remoto entre 2026-07-29 y 2026-07-30 que nunca se commitearon, y
  que la migración de esa fase se aplicó por SQL Editor sin quedar en
  `supabase_migrations.schema_migrations`. **Este change hereda ese problema**: un `supabase db push`
  puede fallar con "ya existe". Mitigación: tarea explícita de verificar el estado del historial
  **antes** de aplicar, y `supabase migration repair --status applied` documentado como salida.
- **[`ALTER TABLE … ADD COLUMN NOT NULL DEFAULT` sobre una tabla con filas]** → en Postgres 11+ no
  reescribe la tabla y no hay ventana de bloqueo relevante; la tabla es un maestro pequeño. Riesgo
  bajo, se anota para que quien revise no lo confunda con un cambio destructivo.
- **[El CHECK de `tipo_factura` rompe el deploy]** → mitigado por el `NOT VALID` + `VALIDATE` en dos
  pasos (D4). Si hay filas violatorias, aparecen en el paso 2 y se reportan a backend en vez de
  bloquear la migración.
- **[`obra_social.cuit` es `NOT NULL UNIQUE` y el formulario podría mandar vacío]** →
  `validateObraSocialForm` ya exige CUIT no vacío, pero el mock nunca lo hizo cumplir a nivel de
  almacenamiento. Con la base real, dos obras sociales sin CUIT colisionarían en `''`. Mitigación:
  test dedicado de que `23505` sobre `cuit` produce el mensaje correcto, y la validación del
  formulario se mantiene como está (no se relaja).
- **[Reordenar el checklist reescribe todas las filas de vínculo]** → aceptado. Son unos pocos ítems
  por obra social (10 en el caso más grande, OSECAC) y el `DELETE`+`INSERT` ocurre dentro de una sola
  transacción. La alternativa (update fila por fila con `orden` único diferido) es más código para
  ganar nada a esta escala.
- **[Regresión en la suite existente]** → safety net obligatorio: correr `cd frontend && npx vitest
  run` **antes** de tocar cualquier archivo existente y registrar el baseline. Referencia:
  `integracion-pacientes` cerró en 1385 tests; el baseline real se mide, no se asume, porque
  `vehiculo-mantenimiento-registro` está corriendo en paralelo por la usuaria.
- **[Colisión con `vehiculo-mantenimiento-registro`]** → `CHANGES.md` avisa que la usuaria lo está
  llevando por separado y que no hay que tocar esos archivos. Este change no toca nada de
  `features/vehiculos/` ni de `shared/lib/vehiculos/`; el único punto de contacto posible es el
  conteo del baseline de tests.
- **[El fake del query builder se desincroniza de supabase-js]** → tests verdes contra una API que
  cambió. Mitigación: consultar `https://supabase.com/changelog.md` antes de implementar (regla de la
  skill `supabase`) y mantener el fake en el subconjunto mínimo usado.

---

## Migration Plan

1. **Checkpoint de diseño** con la usuaria: D3 (get-or-create sobre catálogo compartido) y D8
   (Prestadores fuera de scope). No se escribe código hasta tener respuesta.
2. Verificar que el schema `obra_social` está en *Exposed schemas* del Data API. **Ya confirmado** por
   la tarea 1.2 de `integracion-pacientes` (2026-07-30, `Accept-Profile: obra_social` → `42501`, no
   `PGRST106`) — se reconfirma pero no se espera trabajo.
3. Verificar el **estado del historial de migraciones** contra el remoto antes de escribir nada nuevo
   (`supabase migration list --linked`), por el desfasaje conocido de `integracion-pacientes` 1B.3.
4. Escribir `20260731120000_obra_social_config_facturacion.sql` (expand aditivo) y
   `20260731120001_obra_social_rpc.sql` (las dos funciones). Revisarlas contra el checklist de
   `supabase-postgres-best-practices` y correr `supabase db advisors --linked --type security`
   **antes** de aplicar (para tener la línea base de hallazgos preexistentes) y **después**.
5. **Aplicar las dos migraciones** al proyecto real. **Las corre la usuaria / Enzo, no el agente**: el
   sandbox no tiene Docker ni credenciales. Este paso **bloquea** el paso 8.
6. Verificación manual de las dos funciones con **tres cuentas reales** (checklist completo en
   `tasks.md` §1B): `obra_social: write` → alta completa; `obra_social: read` sin `write` → `42501` y
   cero filas (la prueba de que `INVOKER` está haciendo su trabajo); reorden del checklist → el orden
   persiste; `select prosecdef from pg_proc where proname in ('crear_obra_social_completa',
   'actualizar_obra_social_completa')` → `false` en ambas.
7. Fase de los 4 campos del docx (D9) **enteramente sobre el mock**: tipo, `SCHEMA_VERSION` 1→2,
   fixture, formulario, ficha, tests. Al terminar, la app anda igual que antes pero con 4 campos más.
   Punto de corte limpio y revertible por sí solo.
8. Implementar `obraSocialMapping.ts` y `SupabaseObraSocialRepository.ts` por TDD estricto (nada de
   esto toca producción todavía: nadie los importa).
9. Cambiar `ObraSocialesRoute.tsx` — **el corte real**. A partir de este commit la pantalla usa datos
   reales.
10. Documentar las discrepancias (KB + `CHANGES.md` + `10_preguntas_abiertas.md`) y sumar los
    `AvisoModeloDatos`.
11. Verificación manual en navegador con las tres cuentas del paso 6.
12. Actualizar `ROADMAP-FRONTEND.md` §FE-8 y la fila 2 del §Plan de integración de `CHANGES.md`.

**Rollback**: revertir el commit del paso 9 (un import y una prop en `ObraSocialesRoute.tsx`). La app
vuelve al mock al instante y los archivos del paso 8 quedan inertes. Las migraciones **no hace falta
revertirlas**: las columnas nuevas quedan con su `DEFAULT`, la tabla nueva queda vacía y las
funciones sin llamador son inertes. Si aun así se quiere limpiar: `DROP FUNCTION` × 2 +
`DROP TABLE obra_social.campos_plantilla_factura` + `ALTER TABLE … DROP COLUMN` × 4 + `DROP
CONSTRAINT` del CHECK. **Ningún dato existente se transforma ni se borra en ningún paso del plan.**

---

## Open Questions

- **¿`ObraSocial.cuit` es el CUIT de la obra social o el del prestador?** El tipo del frontend lo
  documenta como *"CUIT del prestador/entidad pagadora"*, pero la base tiene `obra_social.cuit` **y**
  `prestadores.cuit` como columnas distintas de tablas distintas. RN-ID-01 solo separa CUIT (empresa)
  de CUIL (titular del paciente); no dice cuál empresa. Si el campo del frontend está guardando el
  CUIT equivocado, lo arrastran las facturas. **No se resuelve acá** (D8) — cartel + pregunta.
  **Decisor**: cliente / quien mantiene el docx.
- **¿Cuál es la relación entre `prestadores` y `obra_social`?** No hay FK en la migración ni
  definición en el docx (1:N, N:N, o ninguna). Bloquea el diseño del change `prestadores-crud`.
- **¿Qué valores admite `condicion_iva`?** El docx tiene el campo, ninguna fuente enumera los
  valores. Se deja `TEXT` libre sin CHECK. Si son los de ARCA (Responsable Inscripto / Monotributo /
  Exento / Consumidor Final), conviene cerrarlo antes de que Facturación (C-07) lo consuma.
- **¿El editor de checklist debe pasar a ser un selector sobre el catálogo?** (D3, opción B). Hoy es
  texto libre con get-or-create. Si la usuaria prefiere el selector, es un change propio de UI.
- **¿Quién administra `obra_social.tipos_documento`?** No hay pantalla para ver, renombrar ni borrar
  tipos de documento, y `ON DELETE RESTRICT` desde `pacientes.documentos` hace que un tipo mal
  cargado sea permanente. ¿Change propio de administración del catálogo?
- **IN-01 (qué campo va en la factura) sigue abierta.** Este change la vuelve configurable en columna
  (`obra_social.identificador_origen`, default `'paciente.numeroAfiliado'`) sin resolver cuál es el
  correcto — eso lo confirma el cliente antes de C-07.
- **RN-ID-02 (formato del identificador de afiliado en la ficha) — CERRADA (2026-07-31, mismo día,
  dos vueltas).** Primero se decidió derivar el formato de la obra social (D12). Al aplicar, se
  encontró que backend ya había resuelto esto antes y al revés: `coberturas_paciente.formato_afiliado`
  ya existe. La usuaria confirmó dejarlo como está construido — D12 queda revertida (ver el bloque
  arriba). No queda nada pendiente de decisión; lo que queda es ejecución en `integracion-pacientes`
  §8 (bug `23502` + cableado del frontend), independiente de este change.
- **"FIM" sigue sin significado confirmado.** Se conserva la sigla literal como nombre de ítem del
  checklist de OSECAC, sin inventar expansión. Si el fixture de OSECAC alguna vez se convierte en
  seed de producción, la sigla queda en el catálogo compartido (D3) — razón de más para cerrarla.
- **¿Se siembra OSECAC en la base real?** `buildOsecacFixture()` es un fixture de desarrollo con 10
  ítems de checklist y 10 campos de plantilla. Este change **no** lo convierte en migración de seed:
  sembrarlo escribiría 10 filas en el catálogo compartido `tipos_documento` (D3) sin que nadie lo
  haya pedido. Si el cliente quiere OSECAC precargada en producción, es una decisión de datos, no de
  código. **Decisor**: usuaria / cliente.
- **¿Se monta pgTAP (o `supabase start`)?** Segunda vez consecutiva que un change de esta serie
  verifica funciones de Postgres a mano. `integracion-pacientes` 1B.5 ya lo registró como decisión
  pendiente *"antes del segundo change de integración"* — **este es el segundo change**. Con dos
  funciones más, el costo acumulado de no automatizarlo son dos checklists SQL manuales por change,
  siete changes por delante. **Decisor**: equipo técnico. No se monta acá.
- **¿Los índices de las FK que faltan en otros schemas?** Este change agrega los de `requisitos_os` y
  el de la tabla nueva, pero `integracion-pacientes` ya reportó que las FK `paciente_id` de las
  tablas hijas de Pacientes siguen sin índice. Sigue sin resolverse, fuera de scope acá.
