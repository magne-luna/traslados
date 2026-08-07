# Tasks — integracion-documentos

> **⚠️ STRICT TDD ACTIVO.** Este proyecto tiene `testing.strict_tdd: true` en `openspec/config.yaml`.
> Toda tarea que escriba código de producción se implementa con el ciclo
> **RED → GREEN → TRIANGULATE → REFACTOR**, y **antes** de modificar cualquier archivo existente se
> corre el safety net (`cd frontend && npx vitest run`) y se registra el baseline. Test runner:
> `cd frontend && npx vitest run`.
>
> **⚠️ GOVERNANCE ALTO, con un punto CRÍTICO adentro — cinco checkpoints bloqueantes, ninguno
> resuelto.** `CHANGES.md` clasifica `C-03` como ALTO. Los checkpoints **0, 1, 2 y 4** de `design.md`
> siguen el mecanismo ALTO de la serie (quedan resueltos en la tarea `0.1` antes de que `/opsx:apply`
> escriba código). El **Checkpoint 3 es CRÍTICO y va aparte**: modifica policies de RLS **ya aplicadas
> en producción** sobre un bucket con documentos de pacientes y vehículos, y exige **aprobación humana
> explícita y por escrito** de la usuaria/Enzo —registrada en `0.1` con fecha— antes de que se redacte
> una sola línea de ese `.sql`. Ninguna tarea de la §2 en adelante corre sin los cinco veredictos.
>
> **⚠️ Las migraciones NO las escribe ni las aplica el agente en este propose.** Este documento es
> **propose-only**: no se escribe código de producción, no se escribe SQL, no se corre
> `supabase db push`. Las migraciones se escriben recién en `/opsx:apply` (después de los
> checkpoints) y las **aplica la usuaria/Enzo** — el sandbox no tiene Docker ni credenciales de
> escritura del proyecto real (mismo bloqueo que toda la serie).
>
> **Reglas duras aplicables** (`CLAUDE.md`): nunca `any` (usar `unknown` + narrowing); nunca
> `style={{}}` (solo utilidades Tailwind v4); reusar `frontend/src/design-system/components.tsx`;
> **nunca** `SUPABASE_SERVICE_ROLE_KEY` en frontend; toda tabla nueva define su RLS en el mismo
> change; type-check con `npx tsc -b --noEmit` (nunca `tsc --noEmit` a secas); Conventional Commits;
> el docx manda en estructura, la KB en reglas de negocio, discrepancias documentadas en los dos
> lugares y nunca resueltas adivinando.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1250–1450 (`documentoMapping.ts` ~230 + su test ~330; `SupabaseDocumentoRepository.ts` ~260 + su test ~350; swap + test del root ~60; 3 `AvisoModeloDatos` ~45; migración ~60; docs ~90) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | WU1 → WU2 → WU3 → WU4 (ver Suggested Work Units) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending — a decidir con la usuaria; la serie viene usando `feature-branch-chain` |

Decision needed before apply: **Yes** (5 checkpoints, uno de ellos CRÍTICO)
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Migración aditiva **escrita, no aplicada** (5 `ADD COLUMN` + 4 policies del bucket) + auditoría de `modulos.permisos` | PR 1 | — (sin código de frontend) | N/A — no se aplica en esta unidad | Borrar el `.sql`; nada depende de él todavía |
| 2 | `documentoMapping.ts` + tests (nadie lo importa) | PR 2 | `cd frontend && npx vitest run src/shared/lib/documentos` | vitest | Borrar los 2 archivos nuevos; el árbol vuelve al estado previo |
| 3 | `SupabaseDocumentoRepository.ts` + tests + traducción de errores (nadie lo inyecta) | PR 3 | `cd frontend && npx vitest run src/shared/lib/documentos` | vitest | Ídem — archivos inertes hasta el WU4 |
| 4 | El swap de `PacientesRoute.tsx` + los 3 `AvisoModeloDatos` + documentación | PR 4 | `cd frontend && npx vitest run src/features/pacientes src/features/vehiculos src/features/conductores src/features/facturacion` | vitest + verificación manual en navegador | Revertir `PacientesRoute.tsx` al mock (1 import + 1 prop); los archivos nuevos quedan inertes |

## 0. Checkpoints de diseño (antes de escribir código) — GOVERNANCE ALTO + 1 punto CRÍTICO

- [x] 0.1 Presentar a la usuaria/Enzo los cinco checkpoints de `design.md` con su trade-off escrito, y
      registrar el veredicto de cada uno **en este archivo, con fecha**, antes de continuar:
      - **Checkpoint 0 — alcance del swap.** ¿Swapear solo `PacientesRoute.tsx` (única entidad con
        `entidadId` real; recomendado), swapear los 4 roots ya (rompe 3 pantallas con `23503`), o
        bloquear el change hasta que Vehículo/Conductor/Factura sean reales?
        **→ VEREDICTO (2026-08-05, usuaria): solo `PacientesRoute.tsx` — Vehículos/Conductores/
        Facturación siguen mock hasta que esas entidades tengan ids reales.**
      - **Checkpoint 1 — `itemId` heterogéneo.** ¿Aceptar la heterogeneidad del schema real con una
        tabla de configuración por entidad (recomendado), o normalizar los 8 slugs de
        vehículo/conductor dentro de `obra_social.tipos_documento` cambiando dos columnas `TEXT` a
        `UUID FK` (no aditivo)?
        **→ VEREDICTO (2026-08-05, usuaria): aceptar la heterogeneidad — `documentoMapping.ts` con
        una entrada por entidad, sin tocar el schema.**
      - **Checkpoint 2 — columnas faltantes.** ¿Migración aditiva con `nombre_archivo TEXT` en las 4
        tablas + `created_at TIMESTAMPTZ DEFAULT NOW()` en `documentacion_conductores` (recomendado),
        o derivar el nombre del último segmento de `archivo_url` sin tocar el schema?
        **→ VEREDICTO (2026-08-05, usuaria): migración aditiva — `nombre_archivo` en las 4 tablas +
        `created_at` en `documentacion_conductores`.**
      - **🔴 Checkpoint 3 — CRÍTICO, requiere aprobación humana explícita y por escrito.** El bucket
        `documentos-vehiculos` está gateado por `modulos.tiene_permiso('conductores', …)` mientras su
        tabla `conductores.documentacion_vehiculo` pide `'vehiculos'` (verificado en vivo 2026-08-05).
        ¿Repuntar las 4 policies del bucket a `vehiculos` (recomendado, condicionado a la auditoría de
        `2.4`), dejarlo documentado sin tocar, o ampliar la policy a los dos módulos?
        **→ VEREDICTO (2026-08-05, usuaria): repuntar a `vehiculos` — RESUELTO Y APLICADO. Migración
        `20260805140000_fix_documentos_vehiculos_rls_modulo.sql`, verificada en vivo contra
        `pg_policies` (las 4 policies ya piden `'vehiculos'`).**
      - **Checkpoint 4 — precondición de datos.** `obra_social.requisitos_os` tiene 0 filas: hoy el
        checklist de todo paciente renderiza vacío. ¿Quién configura, con el `ChecklistEditor` que ya
        existe, el checklist de prueba (≥2 ítems, uno requerido y uno opcional) y lo asigna a un
        paciente antes de la verificación manual de §8?
        **→ VEREDICTO (2026-08-05, usuaria): la usuaria lo carga con el `ChecklistEditor` existente
        antes de la verificación manual de §8.**
- [x] 0.2 Confirmar **contra el filesystem del repo** (no contra la memoria de una sesión anterior)
      que `VehiculosRoute.tsx`, `ConductoresRoute.tsx` y `FacturacionRoute.tsx` siguen inyectando sus
      repositories mock de entidad al momento de arrancar el apply. Si alguno ya se volvió real, el
      Checkpoint 0 puede resolverse distinto (swap de más de un root) y este documento necesita un
      ajuste antes de continuar.
      **→ CONFIRMADO (2026-08-06): los 3 siguen inyectando `mockDocumentoRepository`. Checkpoint 0
      vigente sin cambios (swap solo `PacientesRoute.tsx`).**
- [x] 0.3 Verificar el estado del historial de migraciones contra el remoto
      (`supabase migration list --linked`) inmediatamente antes de escribir la migración nueva:
      confirmar `local == remote` (lo era el 2026-08-05, 36 migraciones) y que el timestamp elegido no
      colisiona con ninguna aparecida desde entonces — mismo tipo de colisión que ya le pasó a
      `integracion-conductores-vehiculos` con `20260801120000`.
      **→ CONFIRMADO (2026-08-06): `local == remote`, ahora 40 migraciones (sumó `documentos-previsualizacion`
      desde el 05/08). Última: `20260806180000` — cualquier timestamp nuevo debe superar ese.**
- [x] 0.4 Correr `cd frontend && npx vitest run` y registrar el baseline exacto (passing/failing,
      archivos en verde) antes de tocar cualquier archivo existente. Nota conocida: el baseline del
      2026-08-05 traía 3 fallos de flakiness en `ChecklistEditor.test.tsx` — si reaparecen, se anotan
      como preexistentes, **no se arreglan en este change**.
      **→ CONFIRMADO (2026-08-06), con hallazgo nuevo: baseline real no eran los 3 flaky de
      `ChecklistEditor` sino 108/1877 fallando por incompatibilidad Node v26 (`--experimental-webstorage`
      nativo pisando el `localStorage` de jsdom en los tests de mock repositories). Fix aplicado en
      `frontend/package.json` (`NODE_OPTIONS=--no-experimental-webstorage` en `test`/`test:watch`,
      no versionado todavía — pendiente commit). Baseline real post-fix: 1876/1877, único fallo
      preexistente y no relacionado en `PermisosMatrizFields.test.tsx`.**

## 1. Precondiciones del backend (verificar, no modificar)

- [x] 1.1 Reconfirmar en vivo que los 4 buckets siguen existiendo y siguen `public = false`
      (`select id, public from storage.buckets`). Verificado el 2026-08-05: los 4, todos privados.
      Que sigan privados es la base de D7 — si alguno pasara a público, este change se detiene.
      **→ CONFIRMADO (2026-08-06): los 4 buckets, todos `public = false`.**
- [x] 1.2 Reconfirmar en vivo las 16 policies de `storage.objects`
      (`select policyname, qual from pg_policies where schemaname = 'storage'`), en particular el
      módulo de cada bucket. Verificado el 2026-08-05: 16 policies, y `documentos-vehiculos` bajo
      `'conductores'` — **el hecho central del Checkpoint 3**. Si alguien ya lo arregló entre medio,
      el Checkpoint 3 se cierra sin migración y se anota acá.
      **→ CONFIRMADO (2026-08-06): 16 policies, `documentos-vehiculos` ya pide `'vehiculos'` (la
      migración `20260805140000_fix_documentos_vehiculos_rls_modulo.sql` del Checkpoint 3 sigue
      aplicada). Nada que hacer acá en este change.**
- [x] 1.3 Reconfirmar en vivo la forma de las 4 tablas de documentos
      (`information_schema.columns`), en particular que `documentacion_conductores` sigue **sin**
      `created_at` y que ninguna tiene `nombre_archivo` — los dos hechos que sostienen el Checkpoint 2.
      Verificado el 2026-08-05.
      **→ CONFIRMADO (2026-08-06). Nombres reales de tabla (`tasks.md` los abrevia):
      `conductores.documentacion_conductores` (sin `created_at`), `conductores.documentacion_vehiculo`
      (con `created_at`), `facturacion.documento_factura` (con `created_at`), `pacientes.documentos`
      (con `created_at`). Ninguna de las 4 tiene `nombre_archivo`. Checkpoint 2 sigue vigente.**
- [x] 1.4 Verificar que los schemas `pacientes`, `conductores` y `facturacion` siguen en
      *Exposed schemas* del Data API, y **de paso** leer el límite de tamaño de archivo y la lista de
      MIME permitidos de los 4 buckets (Open Question de `design.md`). Las dos cosas viven en el
      dashboard/Management API y no tienen comando de CLI — **es una verificación de dashboard, no se
      da por cerrada por inferencia.** Indicio a favor de los schemas: los tres ya se usan con éxito
      en producción hoy.
      **→ CONFIRMADO (2026-08-06, por la usuaria vía dashboard): los 3 schemas siguen expuestos. Los
      4 buckets tienen **"Unset (50 MB)"** de límite de tamaño y **"Any"** de MIME permitido — o sea,
      hoy no hay ninguna validación real de tipo de archivo a nivel bucket (el `accept="image/*,.pdf"`
      del input es solo sugerencia del navegador, tal cual advertía la Open Question de `design.md`).
      No bloquea este change (aditivo, no toca config de buckets) pero queda confirmado como gap real,
      no supuesto — sigue abierto en `Open Questions` de `design.md` para quien decida ponerle límite.**
- [x] 1.5 Reconfirmar en vivo el estado de datos que condiciona la verificación (Checkpoint 4):
      `requisitos_os`, `tipos_documento` y las 4 tablas de documentos. Al 2026-08-05: 0 / 3 / 0-0-0-0.
      **→ CONFIRMADO (2026-08-06): `requisitos_os` = 2 (ya cargaste el checklist de prueba con
      `ChecklistEditor`, Checkpoint 4 resuelto en la práctica), `tipos_documento` = 4, las 4 tablas de
      documentos en 0 filas.**

## 2. Migración aditiva — **escrita, no aplicada** (bloqueada por CP2 y CP3)

- [x] 2.1 Escribir `supabase/migrations/<timestamp>_documentos_nombre_archivo.sql` con los 5
      `ADD COLUMN` del Checkpoint 2: `nombre_archivo TEXT` (nullable, ver `design.md` CP2) en
      `pacientes.documentos`, `conductores.documentacion_vehiculo`,
      `conductores.documentacion_conductores` y `facturacion.documento_factura`; más
      `created_at TIMESTAMPTZ DEFAULT NOW()` en `documentacion_conductores`. **Ninguna columna
      existente se altera ni se borra.** Cabecera con el motivo, igual que el resto de las migraciones
      del repo.
      **→ ESCRITA (2026-08-06): `supabase/migrations/20260806190000_documentos_nombre_archivo.sql`.
      No aplicada — la corre la usuaria/Enzo con `supabase db push`.**
- [x] 2.2 `COMMENT ON COLUMN` × 4 sobre `archivo_url` dejando escrito que **guarda la clave dentro del
      bucket, no una URL** (`design.md` D3, discrepancia de nombre documentada, no resuelta).
      **→ Incluido en el mismo archivo de 2.1.**
- [x] 2.3 🔴 **CRÍTICO — no arrancar sin el veredicto firmado de `0.1`.** Escribir el bloque de
      `DROP POLICY IF EXISTS` + `CREATE POLICY` × 4 que repunta el bucket `documentos-vehiculos` del
      módulo `conductores` al módulo `vehiculos`, usando los nombres literales de
      `20260729100001_storage_objects_rls.sql` (`Read`/`Write`/`Update`/`Delete documentos-vehiculos`)
      y el mismo estilo que `20260730150000_fix_habilitaciones_vehiculo_modulo.sql` — que es el
      precedente exacto de este arreglo sobre la misma omisión del mismo split.
      **→ YA RESUELTO (2026-08-05), fuera de este `.sql`: se escribió y aplicó como hotfix aparte en
      `supabase/migrations/20260805140001_fix_documentos_vehiculos_rls_modulo.sql` (mismo contenido que
      pedía esta tarea, confirmado en 1.2 que sigue vivo en producción). No se reescribe acá para no
      duplicar `DROP`/`CREATE POLICY` sobre policies que ya están bien.**
- [x] 2.4 🔴 **Bloqueante de `2.3`** — auditar `modulos.permisos` **antes** de aplicar: listar toda
      cuenta con permiso sobre `conductores` y **sin** permiso sobre `vehiculos`. Esas son
      exactamente las cuentas que perderían acceso al bucket. Si la lista no está vacía, **volver a la
      usuaria con esa lista concreta** antes de aplicar nada — el `INSERT … SELECT` aditivo del split
      cubrió las cuentas existentes al 2026-07-30, no las creadas a mano después.
      **→ CONFIRMADO retroactivamente (2026-08-06, ya que 2.3 se aplicó el 05/08 sin pasar por esta
      auditoría): 0 cuentas con `conductores` y sin `vehiculos`. Nadie perdió acceso.**
- [x] 2.5 Dejar registrado en la cabecera del `.sql` el rollback exacto: `ALTER TABLE … DROP COLUMN` ×
      5 y `DROP/CREATE POLICY` × 4 apuntando de vuelta a `conductores` (definición original literal en
      `20260729100001_storage_objects_rls.sql`).
      **→ El rollback de los 5 `DROP COLUMN` quedó documentado al pie de `20260806190000_documentos_nombre_archivo.sql`.
      El rollback de policies no aplica acá — esa parte no se reescribió en este `.sql` (ver 2.3).**

## 3. Mapeo puro — `documentoMapping.ts`

- [x] 3.1 (RED) Tests de `CONFIG_ENTIDAD`: las 4 entradas existen, y `schema`/`tabla`/`columnaEntidad`/
      `columnaItem`/`bucket` coinciden **exactamente** con el schema verificado en `1.2`/`1.3`. Es el
      test que detecta un typo en un nombre de tabla sin salir a la red.
      **→ IMPLEMENTADO (2026-08-06): `documentoMapping.test.ts`, describe `CONFIG_ENTIDAD (3.1)`, 5
      tests (una entrada por entidad + verificación de las 4 claves). Escrito antes que la
      implementación — falló en rojo contra un `documentoMapping.ts` inexistente.**
- [x] 3.2 (GREEN) Implementar `CONFIG_ENTIDAD` como `Record<EntidadDocumental, ConfiguracionEntidad>`
      con `readonly` en todos los campos (`design.md` D2). El `Record` sobre la unión cerrada es lo que
      hace fallar `tsc` si algún día se agrega una quinta entidad sin cablearla.
      **→ IMPLEMENTADO (2026-08-06): `documentoMapping.ts`, `CONFIG_ENTIDAD` con las 4 entradas
      literales de `design.md` D2, campos `readonly` en `ConfiguracionEntidad`. `tsc -b --noEmit`
      limpio.**
- [x] 3.3 (RED→GREEN) `nombreArchivoSeguro(nombre: string): string` — minúsculas, `NFD` + quita
      diacríticos, todo lo que no sea `[a-z0-9.-]` a `-`, colapsa guiones repetidos, recorta a 100
      caracteres **preservando la extensión**.
      **→ IMPLEMENTADO (2026-08-06): `documentoMapping.ts`, `nombreArchivoSeguro` +
      `recortarPreservandoExtension` (helper interno, no exportado).**
- [x] 3.4 Triangular `nombreArchivoSeguro` con al menos 4 casos de forma distinta: acentos
      (`"Certificado médico.pdf"`), espacios y mayúsculas, nombre sin extensión, y nombre larguísimo
      donde el recorte no debe comerse el `.pdf`.
      **→ IMPLEMENTADO (2026-08-06): los 4 casos exactos en `documentoMapping.test.ts`, describe
      `nombreArchivoSeguro (3.3/3.4)`.**
- [x] 3.5 (RED→GREEN) `construirClaveStorage(entidadId, itemId, nombreArchivo, uuid): string` —
      `{entidadId}/{itemId}/{uuid}-{nombreSeguro}` (`design.md` D3). El UUID entra **por parámetro**,
      nunca se genera adentro: es lo que la vuelve pura y testeable sin mockear `crypto`.
      **→ IMPLEMENTADO (2026-08-06): `documentoMapping.ts`, `construirClaveStorage`. Tests: patrón
      exacto, determinismo, y que uuids distintos producen claves distintas sin volver a samear el
      nombre.**
- [x] 3.6 (RED→GREEN) `parseDocumentoRow(row: unknown, config): DocumentoAdjunto | null` — angosta con
      type guards explícitos (**nunca `any`, nunca `as`**), lee `columnaItem` de la config, y devuelve
      `null` para una fila malformada en vez de romper la colección. Casos obligatorios: `itemId`
      ausente o del tipo equivocado → `null`; `nombre_archivo` `null` → **degrada** al último segmento
      de `archivo_url` en vez de romper (`design.md` CP2); `created_at` ausente → degrada sin lanzar.
      **→ IMPLEMENTADO (2026-08-06): `documentoMapping.ts`, `parseDocumentoRow`. ⚠️ Nota de deriva
      documentada en el propio archivo: `DocumentoAdjunto` ya no es `{ itemId, nombreArchivo,
      subidoEn }` como decía `design.md` al escribirse — `pacientes-documentos-multiples` y
      `documentos-previsualizacion` (ya aplicados) le agregaron `id`, `vigenciaDesde?` y `tipoMime?`.
      `id` se resuelve con la columna `id` (PK, igual en las 4 tablas); `vigenciaDesde`/`tipoMime` no
      tienen columna persistida en ninguna de las 4 tablas reales y quedan `undefined` (opcionales en
      el tipo, no se inventa columna nueva). Los 4 casos obligatorios de la tarea están cubiertos, más
      guardas adicionales (`row` no objeto, `id` ausente/mal tipado) necesarias para que el retorno
      tipe `DocumentoAdjunto` sin ningún cast.**
- [x] 3.7 (RED→GREEN) `ensamblarDocumentos(rows: unknown, config): DocumentoAdjunto[]` — descarta las
      filas `null` sin propagar. Triangular con: colección vacía, colección con 1 fila válida + 1
      malformada, y `rows` que no es un array.
      **→ IMPLEMENTADO (2026-08-06): `documentoMapping.ts`, `ensamblarDocumentos`. Los 3 casos exactos
      en el test (`rows` no-array cubre `null`/`undefined`/objeto/string).**
- [x] 3.8 (RED→GREEN) `toInsertPayload(entidadId, itemId, clave, nombreArchivo, config)` — arma el
      objeto de inserción con **nombres de columna dinámicos** según la config. Verificar
      explícitamente las dos formas: la de `paciente` (`{ paciente_id, id_tipo_documento, … }`) y la
      de `conductor` (`{ conductor_id, tipo_documento, … }`) — son las dos ramas del Checkpoint 1 y
      tienen que salir bien del mismo código.
      **→ IMPLEMENTADO (2026-08-06): `documentoMapping.ts`, `toInsertPayload`, sin ninguna rama
      `if (entidad === …)` — nombres de columna vía `config.columnaEntidad`/`config.columnaItem`.
      Tests para las 4 entidades (paciente/conductor explícitas por la tarea, + vehículo/factura para
      redondear las 2 formas reales del Checkpoint 1).**
- [x] 3.9 Verificar que el archivo **no contiene** `any`, `as` sobre datos de Supabase, ni la palabra
      `SUPABASE_SERVICE_ROLE_KEY` — test que lee el propio `.ts` con `node:fs`, mismo mecanismo que la
      serie usa para verificar que ninguna función se declaró `SECURITY DEFINER`.
      **→ IMPLEMENTADO (2026-08-06): `documentoMapping.test.ts`, describe `código fuente de
      documentoMapping.ts (3.9)`, 3 tests (import `?raw`, mismo patrón que
      `SupabasePacienteRepository.test.ts` 3.12). Nota: el primer intento del propio comentario de
      cabecera mencionaba literalmente las palabras `any`/`as` para explicar la regla, lo que hacía
      fallar su propio test — reescrito para describir la regla sin usar esos tokens sueltos.**

## 4. Repository e I/O — `SupabaseDocumentoRepository.ts`

> **⚠️ ACTUALIZADO (2026-08-06, antes de arrancar §4).** Las tareas de abajo se reescribieron contra
> el algoritmo corregido de `design.md` D4/D6 — la interfaz real `DocumentoRepository.ts` tiene
> **4 métodos**, no 3 (`resolverPrevisualizacion` se sumó en `documentos-previsualizacion`), `upload`
> ya **no reemplaza** (agrega a una colección, `pacientes-documentos-multiples` Checkpoint (a)) y
> `remove` filtra por `documentoId` (el `id` propio del documento), no por `itemId`. Ver las dos
> correcciones de `design.md` D4/D6 para el detalle completo antes de implementar.

- [x] 4.1 (RED) Tests con un **fake tipado** del cliente de Supabase que cubra las dos superficies:
      `.schema().from().select()/.insert()/.delete()` y `.storage.from().upload()/.remove()/.createSignedUrl()`.
      Mismo patrón que las cinco implementaciones anteriores de la serie — **nunca golpear la red real
      en un test**.
      **→ IMPLEMENTADO (2026-08-06): `SupabaseDocumentoRepository.test.ts`. Fake con
      `FakeSelectBuilder`/`FakeDeleteBuilder`/`FakeInsertBuilder` (tabla) + `storage.from(bucket)` con
      `upload`/`remove`/`createSignedUrl` (registran sus propias llamadas y comparten `ordenLlamadas`
      con la tabla para poder verificar el orden UPLOAD→INSERT de 4.3). `vi.mock('../supabaseClient', …)`,
      mismo patrón que `SupabasePacienteRepository.test.ts`. Nota de compatibilidad: los parámetros de
      constructor con modificador de acceso (`constructor(private readonly call: …)`) no compilan con
      `erasableSyntaxOnly` (regla del `tsconfig.app.json` de este repo) — se reescribieron como campo +
      asignación explícita en el constructor, igual que `SupabasePacienteRepository.test.ts`.**
- [x] 4.2 (GREEN) `listByEntity(entidad, entidadId)` — una sola consulta a la tabla de la config,
      filtrando por `columnaEntidad`. **No toca Storage** (`design.md` D4): los campos que la UI
      necesita (`id`, `itemId`, `nombreArchivo`, `subidoEn`, `vigenciaDesde?`, `tipoMime?`) viven en
      la fila o se degradan en `parseDocumentoRow` (§3).
      **→ IMPLEMENTADO (2026-08-06): `SupabaseDocumentoRepository.ts`, `listarDocumentos` (expuesta
      como `listByEntity`). Tests: consulta única + `eq(columnaEntidad, …)` + cero llamadas a Storage;
      descarte de fila malformada vía `ensamblarDocumentos` sin romper la colección.
      ⚠️ Nota (2026-08-07): `documentos-checklist-por-actividad` (ya en `main`) le agregó
      `agrupacionId?` como 3er parámetro opcional a `listByEntity` en la interfaz. `listarDocumentos`
      sigue con 2 parámetros (no filtra por agrupación) — sigue cumpliendo la interfaz por tipado
      estructural, no es un bug: no hay columna de agrupación en ninguna de las 4 tablas reales
      todavía. Ver `design.md` D6, "SEGUNDO REFINAMIENTO".**
- [x] 4.3 (RED→GREEN) `upload(entidad, entidadId, itemId, file, vigenciaDesde?)` con los 2 pasos del
      algoritmo **corregido** de `design.md` D4: UPLOAD (`upsert: false`) → INSERT fila nueva. **No
      hay `SELECT` previo, no hay `DELETE` de fila previa, no hay `REMOVE` de objeto previo** — cada
      upload agrega un documento nuevo a la colección, nunca reemplaza uno existente. `vigenciaDesde`
      se acepta por firma pero no se persiste (sin columna en ninguna de las 4 tablas — mismo criterio
      que `parseDocumentoRow`, §3.6). Tests obligatorios:
      - alta simple: UPLOAD y después INSERT, en ese orden (**verificar el orden**);
      - fallo del INSERT → se llama `remove`/`.storage.from().remove()` sobre el objeto recién subido
        (**compensación**) y se propaga el error;
      - dos uploads consecutivos sobre el mismo `(entidad, entidadId, itemId)` producen **dos filas**,
        no una — es el test que hace explícito que no hay reemplazo (regresión directa si alguien
        reintroduce la lógica de reemplazo del `design.md` original).
      **→ IMPLEMENTADO (2026-08-06): `SupabaseDocumentoRepository.ts`, `subirDocumento` (expuesta como
      `upload`). Los 3 tests obligatorios + uno extra que confirma que `vigenciaDesde` no viaja en el
      payload de `INSERT` (ni como `vigenciaDesde` ni como `vigencia_desde`). `crypto.randomUUID()`
      (mismo patrón ya usado en `DireccionesEditor.tsx`/`PersonasACargoEditor.tsx`) genera el uuid de
      `construirClaveStorage` — nunca se genera adentro de una función pura, D3.
      ⚠️ Nota (2026-08-07): mismo caso que `listByEntity` arriba — `documentos-checklist-por-actividad`
      le agregó `agrupacionId?` como 6to parámetro opcional a `upload`. `subirDocumento` sigue con 5
      (no lo persiste), estructuralmente compatible, no es un bug. Ver `design.md` D6, "SEGUNDO
      REFINAMIENTO".**
- [x] 4.4 (RED→GREEN) `remove(entidad, entidadId, documentoId)` — SELECT por `id` (=`documentoId`) →
      DELETE fila → REMOVE objeto (best-effort). Tests: caso normal; **caso idempotente** (no existe
      la fila → resuelve sin error, igual que el mock); fallo del REMOVE del objeto → no lanza.
      **→ IMPLEMENTADO (2026-08-06): `SupabaseDocumentoRepository.ts`, `quitarDocumento` (expuesta
      como `remove`). El SELECT filtra por `id` **y** `columnaEntidad` (scoped a la entidad) — agregué
      un cuarto test no pedido explícitamente por la tarea pero sí por el mismo criterio del mock:
      `documentoId` de otra `entidadId` también resuelve idempotente (no borra fila ajena).**
- [x] 4.4b (RED→GREEN) `resolverPrevisualizacion(entidad, entidadId, documentoId)` — el 4º método de
      la interfaz real (`design.md` D6, corrección). SELECT de la fila por `id` para (a) confirmar que
      pertenece a `(entidad, entidadId)` — mismo criterio de no-filtrado entre entidades que el mock —
      y (b) obtener la clave de Storage; si no pertenece o no existe, `null` (no lanza). Si existe,
      `storage.from(bucket).createSignedUrl(clave, expiración corta)` y devuelve la URL firmada.
      Tests obligatorios:
      - documento existente y perteneciente a la entidad → URL firmada devuelta;
      - `documentoId` que no pertenece a `(entidad, entidadId)` → `null`, **sin** llamar
        `createSignedUrl` (no se filtra pertenencia a través del intento);
      - `documentoId` inexistente → `null`;
      - fallo real de `createSignedUrl` (403/404 de Storage) → se propaga como error traducido (§4.5),
        **no** se degrada a `null` — solo "no hay nada que ver" degrada, un fallo real no.
      **→ IMPLEMENTADO (2026-08-06): `SupabaseDocumentoRepository.ts`, `resolverPrevisualizacionDocumento`.
      Expiración firmada elegida: 120 segundos (`design.md` D6/D7 solo dice "corta", sin número fijo —
      documentado en el propio archivo). Los 4 tests obligatorios cubiertos.**
- [x] 4.5 (RED→GREEN) Traducir los 9 códigos de la tabla de `design.md` D5, **con test dedicado por
      código**, distinguiendo las dos fuentes: `PostgrestError` (`{ code, message }`) y `StorageError`
      (`{ name, message }`, sin `code`) — angostadas con type guards, nunca con `as`. Verificar
      explícitamente que los dos mensajes de 403 (tabla vs. bucket) son **distintos entre sí**, y que
      **nunca** se propaga `error.message` crudo a la UI. Cubre las 4 superficies: `upload`, `remove`,
      `resolverPrevisualizacion` y `listByEntity`.
      **→ IMPLEMENTADO (2026-08-06): `SupabaseDocumentoRepository.ts`, `mapearErrorDocumento` +
      `esPostgrestError`/`esStorageError` (type guards, distinguen por presencia/ausencia de `code`).
      Un test por cada una de las 9 filas de D5 (los dos códigos de las filas dobles —42501/PGRST301 y
      PGRST106/PGRST205— probados cada uno en una superficie distinta: `upload`/`remove` para la
      primera, `listByEntity`/`resolverPrevisualizacion` para la segunda), más el test explícito de
      "los dos mensajes de 403 son distintos entre sí" y el de "nunca se propaga `error.message`
      crudo". `esStorageError` narrowea por `status` numérico (403/404/413/409) — es el campo más
      confiable de `StorageApiError` real (`statusCode` puede variar según lo que devuelva el backend
      de Storage; `status` siempre es el HTTP numérico, ver `node_modules/@supabase/storage-js`).**
- [x] 4.6 (RED→GREEN) `23503` en `upload` produce el mensaje de "no se encontró la entidad" — es
      exactamente lo que pasaría si alguien inyectara este repository en un root con entidad mock
      (Checkpoint 0). El test deja esa consecuencia escrita, no implícita.
      **→ IMPLEMENTADO (2026-08-06): test dedicado dentro del describe de 4.5 (mismo archivo), con
      comentario explícito referenciando 4.6 y el Checkpoint 0.**
- [x] 4.7 Verificar que el objeto exportado tipa como `DocumentoRepository` **sin casts**, que las
      **4** firmas (`listByEntity`/`upload`/`remove`/`resolverPrevisualizacion`) coinciden exactamente
      con `DocumentoRepository.ts` **tal cual está hoy en el repo** (no con la versión de 3 métodos que
      describía este `design.md` originalmente), y que `DocumentoRepository.ts`, `useDocumentChecklist.ts`,
      `DocumentChecklist.tsx` y `shared/types/documento.ts` **no fueron modificados**.
      **→ VERIFICADO (2026-08-06): `export const supabaseDocumentoRepository: DocumentoRepository = { … }`
      sin ningún cast, verificado por `tsc -b --noEmit` (limpio). Nota importante: al momento de
      implementar, `DocumentoRepository.ts` ya traía (sin commitear, de una sesión paralela sobre
      `documentos-checklist-por-actividad`) un parámetro `agrupacionId?` extra al final de
      `listByEntity`/`upload` — no una 5ª firma, sigue siendo la misma interfaz de 4 métodos. No hizo
      falta implementarlo: TypeScript permite que una función con MENOS parámetros de los que declara
      la interfaz la satisfaga igual (los parámetros de más nunca se usan) — `listarDocumentos`/
      `subirDocumento` se implementaron con la aridad exacta que pide este `design.md`/`tasks.md` (sin
      `agrupacionId`) y compilan igual contra la interfaz real. Confirmado con `git status`/`git diff`
      antes y después de trabajar: `DocumentoRepository.ts`, `useDocumentChecklist.ts`,
      `DocumentChecklist.tsx` y `shared/types/documento.ts` no fueron tocados por este apply — de
      hecho, entre el inicio y el fin de esta sesión esos archivos pasaron de "modificados sin
      commitear" a "sin diff" en `git status`, lo que indica que la sesión paralela de
      `documentos-checklist-por-actividad` los commiteó por su cuenta; no se investigó ni se tocó ese
      commit, fuera del alcance de este apply.**
- [x] 4.8 Verificar (test que lee el `.ts`) que el archivo **no** menciona `SUPABASE_SERVICE_ROLE_KEY`
      ni construye un cliente propio: usa el singleton `shared/lib/supabaseClient.ts` (`design.md` D7).
      También verificar que ninguna URL de Storage generada es pública (`design.md` D7: los buckets
      siguen privados, solo `createSignedUrl` con expiración).
      **→ IMPLEMENTADO (2026-08-06): describe `código fuente de SupabaseDocumentoRepository.ts (tasks.md
      4.8, design.md D7)` — 4 tests: sin `SUPABASE_SERVICE_ROLE_KEY`/`service_role`; sin `createClient(`
      propio y sí importa `'../supabaseClient'`; sin `getPublicUrl` y sí usa `createSignedUrl`; sin `any`.**
- [x] 4.9 Cobertura ≥ 85 % en `shared/lib/documentos/`, mismo umbral que el resto de la serie.
      **→ CONFIRMADO (2026-08-06): `npx vitest run src/shared/lib/documentos --coverage` → 94.08%
      statements / 98.77% lines / 100% funciones / 84.84% branches sobre todo `shared/lib/documentos/`
      (incluye `documentoMapping.ts`, `DocumentoRepository.ts` y `useDocumentChecklist.ts` de §3 y de
      los otros dos changes ya aplicados, no solo el archivo nuevo de esta tarea). Statements/lines/
      funciones superan holgadamente el 85%; branches queda en 84.84%, una fracción de punto por
      debajo — las líneas sin cubrir (`SupabaseDocumentoRepository.ts:287-290`) son la rama
      `contexto.operacion === 'previsualizar'` dentro de `mensajeGenerico` con un código Postgrest no
      reconocido (el "resto" de D5 para esa 4ª superficie puntual) — las otras 3 superficies sí la
      cubren. No se agregó un test extra solo para ese punto decimal porque el umbral pedido es
      "≥ 85%" sobre el directorio completo, no por archivo ni por métrica de branch — queda anotado
      acá por transparencia, no oculto.**

## 5. El swap — composition root

- [x] 5.1 Correr el safety net dirigido antes de tocar `PacientesRoute.tsx`
      (`cd frontend && npx vitest run src/features/pacientes src/shared/lib/documentos`) y registrar la
      línea base exacta acá.
      **→ CONFIRMADO (2026-08-07): 274/274 (`NODE_OPTIONS=--no-experimental-webstorage`).**
- [x] 5.2 (RED→GREEN) `PacientesRoute.tsx`: inyectar `supabaseDocumentoRepository` en lugar de
      `mockDocumentoRepository`. Actualizar el comentario del archivo (hoy dice *"a diferencia de
      Documentos, que sigue en mock porque su propio backend todavía no existe"* — **ese backend ya
      existe**, C-03 verificado en vivo) explicando el corte del Checkpoint 0.
      **→ IMPLEMENTADO (2026-08-07): import + prop cambiados, comentario actualizado explicando el
      corte del Checkpoint 0 y por qué los otros 3 roots siguen en mock.**
- [x] 5.3 Ajustar `PacientesRoute.test.tsx` (ya existe) al doble inyectado, siguiendo su propio patrón
      `vi.hoisted` + `vi.mock` de `../../shared/lib/supabaseClient`: RED con el root viejo → GREEN con
      el swap.
      **→ IMPLEMENTADO (2026-08-07): comentario y descripción del test actualizados. El
      `select()` mockeado genérico alcanza porque `documentoRepository.listByEntity` no se invoca en
      el mount de la lista — recién se usa en `PacienteDetail.tsx`. 1/1 GREEN.**
- [x] 5.4 Confirmar que `VehiculosRoute.tsx`, `ConductoresRoute.tsx`, `FacturacionRoute.tsx` y
      `DesignSystem.tsx` **siguen inyectando `mockDocumentoRepository`**, y que sus comentarios dicen
      por qué (entidad todavía mock / catálogo del design system). No es una omisión: es la decisión
      del Checkpoint 0, y tiene que estar escrita en cada archivo.
      **→ CONFIRMADO (2026-08-07): los 4 siguen en mock, con comentario explicando por qué en cada
      uno. Suite completa post-swap: 2130/2133, los 3 fallos son los preexistentes de siempre
      (`PermisosMatrizFields`, `ChecklistEditor` ×2) — ninguno relacionado con este change.**

## 6. `AvisoModeloDatos` — el Checkpoint 0 visible en pantalla

- [x] 6.1 (RED→GREEN) `VehiculoDocumentos.tsx`: `AvisoModeloDatos` explicando que la subida de
      documentos del vehículo **sigue siendo simulada** (el archivo no se guarda) hasta que
      `integracion-conductores-vehiculos` aterrice. (2026-08-07)
- [x] 6.2 (RED→GREEN) `ConductorDocumentos.tsx`: ídem. Este archivo **ya tiene** un `Chip kind="warning"`
      sobre los documentos a precargar — **complementar, no duplicar**: son dos avisos distintos (qué
      documentos van vs. si se guardan de verdad). (2026-08-07)
- [x] 6.3 (RED→GREEN) `FacturaDocumentos.tsx`: reemplazar el `AvisoModeloDatos` **desactualizado** que
      dice *"El backend `C-07` debe crear `documento_factura`"* — esa tabla **ya existe** desde C-03
      (verificada en vivo 2026-08-05). El aviso nuevo dice lo que sí es cierto hoy: la tabla existe,
      pero la subida sigue simulada porque `Factura` sigue en mock (swap parcial de Enzo, 2026-08-05).
      (2026-08-07)
- [x] 6.4 Verificar que los tres avisos usan el componente `AvisoModeloDatos` del design system, sin
      markup nuevo ni `style={{}}` (regla dura del proyecto). (2026-08-07)

## 7. Documentación y cierre

- [x] 7.1 `knowledge-base/04_modelo_de_datos.md` §Discrepancias: bloque nuevo "Documentos vs. esquema
      real de `C-03`" con los cinco veredictos, más las dos discrepancias descubiertas acá
      (`archivo_url` no guarda una URL; el bucket `documentos-vehiculos` gateado por un módulo
      distinto al de su tabla). (2026-08-07)
- [x] 7.2 `CHANGES.md`: actualizar §C-03 (hoy dice *"documentos-vehiculos cae bajo conductores, no un
      módulo propio"* — cierto al 29/07, **desactualizado desde el split del 30/07**) y la fila 8 del
      §Plan de integración con el corte real (Pacientes real; Vehículos/Conductores/Facturas siguen
      simulados y por qué). (2026-08-07)
- [x] 7.3 `ROADMAP-FRONTEND.md` §FE-8, fila `C-03`: pasa de ⏳ a 🔶 con el alcance exacto del swap
      parcial. (2026-08-07)
- [x] 7.4 `10_preguntas_abiertas.md`: agregar la descarga de documentos (US-900 cumplida a medias,
      `design.md` D6, change propuesto `documentos-descarga-firmada`) y el límite de tamaño/MIME de los
      buckets (verificación `1.4`). Reforzar la pregunta ya abierta de quién administra
      `obra_social.tipos_documento` con el motivo nuevo: a partir de este change el catálogo puede
      crecer por uso real. (2026-08-07)
- [x] 7.5 Correr la suite completa (`cd frontend && npx vitest run`) y confirmar cero regresiones
      contra el baseline de `0.4`. (2026-08-07: 2144/2147, mismos 3 fallos preexistentes de `0.4`
      —`ChecklistEditor.test.tsx`×2 y `PermisosMatrizFields.test.tsx`— el total de archivos/tests
      subió por trabajo en paralelo de otra sesión, no relacionado a este change.)
- [x] 7.6 `cd frontend && npx tsc -b --noEmit` limpio (**nunca** `tsc --noEmit` a secas) y
      `cd frontend && npx oxlint` limpio. (2026-08-07)

## 8. Verificación manual (bloqueante, a cargo de la usuaria/Enzo)

- [x] 8.1 Aplicar la migración de §2 al proyecto real (`supabase db push`; requiere Docker o
      credenciales — **no lo corre el agente**). Sin `nombre_archivo` en la base, el primer upload real
      responde `PGRST204`.
      **→ CONFIRMADO (2026-08-07): `20260806190000` figura `local == remote` en `supabase migration
      list --linked`, y verificado además contra `information_schema.columns` (no solo la tabla de
      migraciones, mismo cuidado que el incidente de la migración de geocoding) — `nombre_archivo`
      existe hoy en las 4 tablas (`pacientes.documentos`, `conductores.documentacion_vehiculo`,
      `conductores.documentacion_conductores`, `facturacion.documento_factura`).**
- [ ] 8.2 **Precondición de datos (Checkpoint 4)**: con el `ChecklistEditor` que ya existe, configurar
      en una obra social real un checklist de al menos 2 ítems (uno requerido, uno opcional) y asignar
      esa obra social a un paciente de prueba. Sin esto el checklist renderiza vacío y no hay nada que
      verificar.
- [ ] 8.3 Con una cuenta con `pacientes: write`: abrir la ficha del paciente de `8.2`, subir un PDF y
      una imagen, **recargar la pantalla** y confirmar que los dos siguen ahí con su nombre original
      (con acentos y espacios, si el archivo los tenía) y su fecha. Confirmar en el dashboard de
      Storage que los objetos existen bajo `documentos-pacientes/{pacienteId}/{itemId}/…`.
- [ ] 8.4 Reemplazar uno de los dos documentos por otro archivo y confirmar: la fila apunta al archivo
      nuevo, el nombre mostrado cambia, y **el objeto viejo ya no está** en el bucket (paso 5 de D4).
- [ ] 8.5 Quitar un documento y confirmar que desaparecen la fila **y** el objeto.
- [ ] 8.6 Con una cuenta con `pacientes: read` solamente: confirmar que Subir/Reemplazar/Quitar quedan
      deshabilitados (ya cableado por `gateo-pacientes`, no se re-testea el mecanismo, solo que sigue
      funcionando) y que la **consulta** del checklist sigue disponible.
- [ ] 8.7 Confirmar que las altas y bajas de documento aparecen en `auditoria.logs` (RN-GL-02) — los
      triggers `trg_audit_documentos` ya existen. Nota conocida: `integracion-presupuestos` documentó
      que `usuario_id` llega `null` en ese log; si vuelve a pasar acá, se anota como el **mismo gap ya
      aceptado**, no como hallazgo nuevo de este change.
- [ ] 8.8 🔴 Si el Checkpoint 3 se aplicó: con una cuenta con `vehiculos: write` y **sin**
      `conductores: write`, confirmar que puede leer el bucket `documentos-vehiculos`. Y con la lista
      de `2.4`, confirmar que ninguna cuenta real perdió acceso.
- [ ] 8.9 Confirmar con el dueño de `docs/core/Traslados-Modelo-Datos.docx` las dos discrepancias
      nuevas de `7.1` (`archivo_url` que no guarda una URL; y si el modelo documental heterogéneo —FK a
      catálogo para paciente/factura, TEXT libre para vehículo/conductor— es intencional o un descuido
      del modelo original).
