# Tasks — documentos-checklist-items-por-actividad

> **✅ CHECKPOINTS (0), (a)-(g) RESUELTOS (2026-08-10).** Veredictos registrados en §0 y §1 abajo.
> Checkpoint (0): Andrea confirmó (relayado por Delfina) que cada actividad tiene su propia
> documentación. Checkpoints (a)-(g): Delfina aceptó las ocho recomendaciones de `design.md` tal
> cual. **Pendiente antes de escribir código**: tarea 1.8 (revisar `proposal.md` §Capabilities +
> delta specs con los veredictos ya en mano) — hacerla como primer paso de §2 en adelante.
>
> **⚠️ GOVERNANCE: CRÍTICO** (`design.md` Checkpoint (g), veredicto 1.1). Mismo criterio que los
> **tres** refinamientos anteriores sobre esta misma pantalla (`pacientes-documentos-multiples`,
> `documentos-previsualizacion`, `documentos-checklist-por-actividad`) y que `C-05`: datos de salud
> de personas con discapacidad, incluidos menores. Y este change va más lejos que los tres: **crea
> tabla nueva con RLS propia**.
>
> **⚠️ STRICT TDD ACTIVO.** `openspec/config.yaml` tiene `testing.strict_tdd: true`. Toda tarea que
> escriba código de producción se implementa con el ciclo **RED → GREEN → TRIANGULATE → REFACTOR**, y
> **antes** de modificar cualquier archivo existente se corre el safety net y se registra el baseline.
> Test runner: `cd frontend && npx vitest run`.
>
> **Reglas duras aplicables** (`CLAUDE.md`): nunca `any` (usar `unknown` + narrowing); nunca
> `style={{}}` (solo utilidades Tailwind v4); revisar y reusar
> `frontend/src/design-system/components.tsx` antes de escribir markup nuevo (`Section`, `Card`,
> `Chip`, `SectionBadge`, `AvisoModeloDatos` — nada ad-hoc); **ninguna tabla nueva sin RLS en la misma
> migración que la crea**; nunca `SUPABASE_SERVICE_ROLE_KEY` desde el frontend; type-check con
> `cd frontend && npx tsc -b --noEmit` (NUNCA `tsc --noEmit` a secas); Conventional Commits;
> estructura desde `docs/core/Traslados-Modelo-Datos.docx` + reglas de negocio desde `knowledge-base/`,
> con toda discrepancia documentada en los dos lugares + `AvisoModeloDatos` en pantalla.
>
> **Nada de SQL se escribe en propose.** La migración se escribe recién en §3, después de §1.

## 0. Confirmación de la regla de negocio con la clienta (BLOQUEANTE ABSOLUTO)

- [x] 0.1 Llevarle a Andrea Pastor, en una sola conversación, estas dos preguntas —`design.md`
      Checkpoint (0) y Checkpoint (e)— y registrar la respuesta textual acá:
      1. *"¿La escuela pide documentación que la terapia no pide? ¿O los ~10 ítems son los mismos para
         todas las actividades y solo se repiten?"*
      2. Si la respuesta a la 1 es "sí, cambian": *"¿esos documentos extra los pide la actividad
         siempre igual, o depende de la obra social? (¿la escuela pide lo mismo para OSDE que para
         IOMA?)"*
      **→ VEREDICTO (relayado por Delfina, 2026-08-10): sí, cambian — cada actividad tiene su propia
      documentación, no son los mismos ítems repetidos.** La sub-pregunta 2 (¿depende también de la
      obra social?) no tiene respuesta textual de Andrea registrada acá — se resuelve técnicamente
      abajo en 1.5 (global por tipo, no por obra social), aprobado explícitamente por Delfina. Si
      Andrea contradice esto más adelante, reabrir 1.5.
- [x] 0.2 Preguntar también, en la misma conversación (`design.md` Checkpoint (b)): *"¿el club y la
      escuela piden documentación distinta entre sí, o alcanza con distinguir escuela / escuela
      especial / terapia / CET?"*. Hoy "club" cae en el valor `otro` del enum `tipo_direccion`; si
      necesita lista propia, **ampliar el enum es un change aparte** y este se rediseña.
      **→ VEREDICTO: sin respuesta textual de Andrea registrada — resuelto técnicamente en 1.3 (scope
      solo por `TipoDireccion`, "club" comparte lista dentro de `otro`), aprobado por Delfina. Queda
      anotado como discrepancia menor: si "club" necesita lista propia, es un change aparte que amplía
      el enum.**
- [ ] 0.3 Si la respuesta a 0.1 es **"son los mismos"**: **no continuar con este `tasks.md`**. Archivar
      el change como `documentos-checklist-items-por-actividad-dropped` (precedentes:
      `2026-08-06-factura-por-prestador-dropped`, `2026-08-06-prestadores-crud-dropped`), anotar el
      veredicto en `CHANGES.md` `C-03` y cerrar la nota `⚠️` del Checkpoint (d) del change anterior
      (`archive/2026-08-07-documentos-checklist-por-actividad/tasks.md` líneas 61-64), que quedó
      esperando exactamente esta respuesta.

## 1. Veredictos de diseño (bloqueante, antes de escribir código) — GOVERNANCE recomendado CRÍTICO

- [x] 1.1 Confirmar el **nivel de gobernanza** (`design.md` Checkpoint (g)): CRÍTICO (recomendado, por
      precedente de los tres refinamientos hermanos y porque este crea tabla con RLS) o ALTO.
      **→ VEREDICTO (Delfina, 2026-08-10): CRÍTICO — recomendación aceptada.**
- [x] 1.2 **Checkpoint (a) — ¿dónde vive la configuración?** ¿Tabla nueva que reusa
      `obra_social.tipos_documento` (recomendado), catálogo independiente, JSON, o constante
      (prohibida por regla dura)? **Sub-pregunta obligatoria**: ¿en qué schema vive la tabla
      (`obra_social` o `pacientes`) y por lo tanto **qué módulo la gatea en la RLS**? Decidirlo por
      descarte es un agujero de permisos — precedente real: el bucket `documentos-vehiculos` gateado
      por `conductores` en vez de `vehiculos` (`integracion-documentos`).
      **→ VEREDICTO (Delfina, 2026-08-10): opción A — tabla nueva `requisitos_actividad` reusando
      `obra_social.tipos_documento`, en el schema `obra_social` (mismo módulo que gatea
      `requisitos_os` hoy). Recomendación aceptada.**
- [x] 1.3 **Checkpoint (b) — scope de la configuración.** ¿Solo por `TipoDireccion` (recomendado), por
      `tipo` + `descripcion` normalizada, o por actividad puntual (`Direccion.id`)? Depende de 0.2.
      **→ VEREDICTO (Delfina, 2026-08-10): opción A — solo por `TipoDireccion`. Recomendación
      aceptada.**
- [x] 1.4 **Checkpoint (c) — merge y dedup.** ¿Dedup por identidad real del ítem (recomendado), por
      `nombre` normalizado, o sin dedup (duplicados visibles)? **Sub-preguntas**: (i) precedencia de
      `requerido` ante conflicto — la recomendación es *el más estricto gana*; (ii) ¿el usuario ve la
      procedencia de cada ítem, y si sí, a nivel de bloque (preferido) o de ítem (obliga a tocar
      `DocumentChecklist.tsx`, que este diseño quiere no tocar)?
      **→ VEREDICTO (Delfina, 2026-08-10): opción A — dedup por identidad real (`id`/
      `tipo_documento_id`), el más estricto gana en `requerido`, procedencia comunicada a nivel de
      bloque (no de ítem, `DocumentChecklist.tsx` no se toca). Recomendación aceptada.**
- [x] 1.5 **Checkpoint (e) — ¿global por tipo o por obra social × tipo?** Recomendado: global (5
      listas). Si es por obra social, la pantalla pasa de lista a matriz N×5 y el alcance de §3-§5 se
      multiplica. Depende de 0.1.2.
      **→ VEREDICTO (Delfina, 2026-08-10): opción A — global por tipo de actividad, sin
      `obra_social_id` en la tabla. Recomendación aceptada.**
- [x] 1.6 **Checkpoint (d) — ¿dónde se administra?** Pantalla propia (recomendado si (e)=global) o
      extensión de `frontend/src/features/obras-sociales/ChecklistEditor.tsx` (si (e)=por obra
      social). **No se puede resolver antes que 1.5.** El veredicto define además si nace una
      capability nueva (`checklist-por-tipo-actividad`) o si el delta va sobre
      `obra-social-checklist-editor` — en cualquiera de los dos casos hay que **escribir ese delta
      spec antes de codear la pantalla** (tarea 5.0).
      **→ VEREDICTO (Delfina, 2026-08-10): opción A — pantalla propia (consistente con 1.5=global).
      Recomendación aceptada.**
- [x] 1.7 **Checkpoint (f) — ¿cuándo se reescriben RN-FA-08/RN-FA-10?** Recomendado: documentar la
      discrepancia ahora y reescribir las RN recién con veredicto real de Andrea (RN-FA-11 nueva, no
      reescritura de la 08). Alternativas: reescribirlas ya marcadas como no confirmadas, o no
      documentar (viola regla dura).
      **→ VEREDICTO (Delfina, 2026-08-10): opción A — documentar la discrepancia ahora, RN-FA-11
      recién con veredicto textual real de Andrea. Recomendación aceptada.**
- [x] 1.8 Con los veredictos de 1.2/1.5/1.6 en mano, **revisar y corregir la sección `Capabilities` de
      `proposal.md`** y agregar los delta specs que correspondan. Hoy el change declara delta sobre
      `paciente-documentos` y `documento-avisos-modelo-datos` únicamente; la superficie de
      administración quedó deliberadamente sin declarar.
      **→ HECHO (2026-08-10): `proposal.md` §Capabilities actualizado — capability nueva
      `checklist-por-tipo-actividad` (pantalla propia), `obra-social-checklist-editor` pasa a "NO
      afectada" (el veredicto 1.6 descartó extenderlo). Delta spec escrito en
      `specs/checklist-por-tipo-actividad/spec.md` (3 requisitos: pantalla propia global por tipo,
      gateo por módulo `obra_social` con RLS del lado servidor, catálogo compartido de nombres). Esto
      también resuelve el contenido de la tarea 5.0 — se marca ahí con referencia a este spec.**

## 2. Base: función pura de combinación de listas (TDD, sin tocar UI ni base)

> Se puede empezar apenas §0 y §1 estén cerrados. No depende de la migración: opera sobre
> `ChecklistItem[]` en memoria. Es el corazón del change y el lugar donde el default vacío queda
> garantizado por construcción.

- [x] 2.1 Safety net: `cd frontend && npx vitest run` y registrar el baseline acá (`N tests passing`).
      Si algo falla antes de tocar nada, reportarlo como falla preexistente y **no** arreglarlo en este
      change.
      **→ BASELINE (2026-08-10, antes de tocar ningún archivo): `Test Files 20 failed | 215 passed
      (235)` / `Tests 118 failed | 2097 passed (2215)`. Raíz confirmada: bajo la paralelización
      completa de `vitest run` (sin límite de workers), varios archivos de test que llaman
      `localStorage.clear()` en su `beforeEach` (todos los `mock*Repository.test.ts`, y en una
      corrida posterior también algunos de rutas: `AppShell`, `router`, `*Route.test.tsx`) fallan con
      `TypeError: Cannot read properties of undefined (reading 'clear')` — el entorno jsdom de ese
      worker no terminó de inicializar `window`/`localStorage` a tiempo. Confirmado ejecutando
      `mockVehiculoRepository.test.ts` **solo, sin paralelismo con nada más**: falla exactamente
      igual (11/11) — no es interferencia de otros archivos de este change, es preexistente e
      independiente de lo que este change toca. Ninguno de los archivos que este change modifica usa
      `localStorage`. `actividadDocumental.test.ts` y `PacienteDocumentos.test.tsx` estaban 100%
      verdes en este baseline previo a cualquier edición.**
- [x] 2.2 **RED** — test de `combinarItemsDeActividad(itemsObraSocial, itemsPorTipo)` en
      `frontend/src/features/pacientes/actividadDocumental.test.ts`: con `itemsPorTipo = []` devuelve
      exactamente `itemsObraSocial`, mismo orden y mismos ids (spec: *"Sin configuración por tipo de
      actividad, el comportamiento no cambia"*). La función no existe todavía.
- [x] 2.3 **GREEN** — implementar el mínimo en
      `frontend/src/features/pacientes/actividadDocumental.ts`, junto a
      `obtenerActividadesConChecklist`/`etiquetaActividad` (mismo criterio ya escrito ahí: *"criterio
      único, nunca un `filter` inline repetido en cada componente"*). Ejecutar y confirmar verde.
- [x] 2.4 **TRIANGULATE** — casos adicionales, uno por escenario de la spec: (i) listas disjuntas ⇒
      unión con los de la obra social primero y su orden preservado (RN-FA-08); (ii) ítem coincidente
      ⇒ aparece **una sola vez**; (iii) conflicto de `requerido` ⇒ gana el más estricto; (iv)
      `itemsObraSocial = []` ⇒ no revienta. **Alcance exacto de (ii)/(iii) sujeto al veredicto 1.4.**
      **→ HECHO: 7 tests nuevos en `actividadDocumental.test.ts` cubren default vacío, disjuntas,
      dedup, conflicto de `requerido` en los dos sentidos (obra social relaja / tipo relaja), obra
      social vacía, las dos vacías, y precedencia del `nombre` (gana la obra social). 15/15 tests del
      archivo en verde.**
- [x] 2.5 **REFACTOR** — nombres, comentario de cabecera con la referencia al checkpoint y su
      veredicto, sin lógica nueva. Tests verdes después de cada paso.
      **→ HECHO: comentario de cabecera con los 4 veredictos aplicados; implementación ya quedó
      limpia en el primer GREEN (dos pasadas sobre las listas: una para resolver `requerido` por id,
      otra para el orden con dedup) — no hizo falta un refactor adicional.**
- [x] 2.6 Verificar que la función es **pura**: sin `Date.now()`, sin acceso a repository, sin estado.
      Es lo que la hace testeable sin React y lo que protege al bloque General por construcción (nunca
      la llama).
      **→ VERIFICADO: `combinarItemsDeActividad` no importa nada de React/repository, no usa
      `Date.now()` ni closures sobre estado externo — recibe dos arrays y devuelve uno nuevo.**

## 3. Persistencia (condicionada a 1.2 y 1.5) — migración + RLS en el MISMO archivo

> **No arrancar sin los veredictos 1.2 (schema/módulo) y 1.5 (global vs por obra social).** El
> `UNIQUE` de la tabla y la policy de RLS dependen literalmente de ellos.

- [x] 3.1 Escribir la migración en `supabase/migrations/` con nombre `YYYYMMDDHHMMSS_<descripcion>.sql`,
      siguiendo el formato de `20260807010000_documentos_direccion_id.sql`: cabecera con el change y el
      checkpoint que la origina, cuerpo, y **bloque de rollback comentado** al final.
      **→ HECHO: `supabase/migrations/20260810130000_requisitos_actividad.sql` — tabla
      `obra_social.requisitos_actividad`, cabecera con los veredictos 1.2/1.5, bloque de rollback
      comentado al final (DROP trigger → policies → índice → tabla).**
- [x] 3.2 En el **mismo archivo**: `ENABLE ROW LEVEL SECURITY`, policies `Read`/`Write` gateadas por
      `modulos.tiene_permiso('<módulo del veredicto 1.2>', 'read'|'write')`, `GRANT` a `authenticated`,
      y trigger `auditoria.log_action()` — mismo patrón que `obra_social.requisitos_os`
      (`20260724100003_schema_obra_social.sql`). Regla dura: ninguna tabla sensible sin RLS en el
      cambio que la crea.
      **→ HECHO: RLS habilitada, policies "Read/Write requisitos_actividad" gateadas por
      `modulos.tiene_permiso('obra_social', ...)`, `GRANT ALL ... TO authenticated` explícito (no
      `ALL TABLES IN SCHEMA`, que solo cubre tablas preexistentes), trigger
      `trg_audit_requisitos_actividad`. Todo en el mismo archivo que crea la tabla.**
- [x] 3.3 Reusar el catálogo compartido `obra_social.tipos_documento` por FK (veredicto 1.2 opción A) y
      el enum ya existente `pacientes.tipo_direccion` para el tipo de actividad — **con cast explícito**
      (`text` no castea implícitamente a un enum de usuario; bug ya visto en
      `20260807000000_crear_paciente_completo_tipo_lugar_cast.sql`).
      **→ HECHO: `tipo_documento_id UUID REFERENCES obra_social.tipos_documento(id) ON DELETE
      RESTRICT`; `tipo_lugar pacientes.tipo_direccion` con cast explícito
      `p_tipo_lugar::pacientes.tipo_direccion` en la RPC de escritura (3.6).**
- [x] 3.4 Decidir y dejar escrito qué pasa al **quitar un ítem de la configuración cuando ya hay
      documentos cargados contra él** (`design.md` §Risks): bloquear, o permitir dejando esos documentos
      sin fila visible en el checklist. `ON DELETE RESTRICT` sobre `tipos_documento` protege el
      catálogo, **no** la fila de la tabla nueva.
      **→ VEREDICTO (técnico, aplicando el precedente ya aceptado del proyecto, no una regla de
      negocio nueva): NO se bloquea — mismo comportamiento que `actualizar_obra_social_completa`
      con `requisitos_os` (reemplazo completo sin verificar documentos existentes). El documento no
      se pierde (`tipos_documento` sigue protegido por `ON DELETE RESTRICT`), solo deja de listarse
      en el checklist de esa actividad. Documentado en la cabecera de la migración.**
- [x] 3.5 Aplicar la migración contra el proyecto real y verificar en vivo: tabla creada, RLS activa,
      trigger de auditoría disparando en `auditoria.logs`.
      **→ HECHO EN VIVO contra `pkryfoljypuzfifofdwp` (2026-08-10, `supabase db push --linked`):
      tabla creada (`rowsecurity: true`), policies Read/Write confirmadas con
      `pg_policies`, trigger confirmado con `pg_trigger`, función `actualizar_requisitos_actividad`
      confirmada `prosecdef: false` (SECURITY INVOKER). Prueba funcional end-to-end: RPC con 2 ítems
      para `tipo_lugar: 'escuela'` → lectura confirma orden/requerido/nombre correctos;
      `auditoria.logs` confirma 3 INSERT + 3 DELETE con `tabla_afectada = 'requisitos_actividad'`.
      **Hallazgo durante la verificación**: el archivo `20260729120000_schema_pacientes_gaps.sql`
      declara el enum `pacientes.tipo_direccion` con el literal `'ciset'`, pero el enum REAL ya tiene
      `'cet'` (`enum_range` contra el proyecto real) — **schema drift**, el repo de migraciones no
      documenta quién ni cuándo lo corrigió. Verificado insertando una fila de prueba con
      `tipo_lugar: 'cet'`: funciona sin error. Documentado en la migración y en
      `knowledge-base/04_modelo_de_datos.md` §Discrepancias (tarea 8.1). Datos de prueba borrados al
      terminar (`DELETE` de las 3 filas de `requisitos_actividad` y de las entradas de catálogo
      creadas solo para la prueba, verificando primero que ninguna FK externa las usara).**
- [x] 3.6 Escritura de altas en el catálogo compartido vía el camino ya establecido: get-or-create
      normalizado (trim + lower) dentro de RPC, como `20260731120001_obra_social_rpc.sql`. **Nunca** un
      `INSERT` paralelo a `tipos_documento` desde el frontend.
      **→ HECHO: `supabase/migrations/20260810130001_requisitos_actividad_rpc.sql` —
      `obra_social.actualizar_requisitos_actividad(p_tipo_lugar text, p_items jsonb)`, `SECURITY
      INVOKER`, reemplazo completo por tipo + get-or-create normalizado (trim+lower) sobre
      `tipos_documento`, mismos códigos de error 45101/45102 que `obra_social_rpc.sql`. Aplicada y
      probada en vivo (ver 3.5).**

## 4. Repository y tipos del frontend (condicionada a 1.2, 1.5; TDD)

- [x] 4.1 **RED/GREEN/TRIANGULATE** — contrato de lectura de la configuración por tipo de actividad
      (mock primero, como todo repository de este proyecto), devolviendo `ChecklistItem[]` por
      `TipoDireccion`. Forma exacta según veredictos 1.2/1.5.
      **→ HECHO, con una desviación documentada: `RequisitosActividadRepository` (`listAll`/
      `actualizar`) escrito en `frontend/src/shared/lib/requisitosActividad/`. "Mock primero" se
      interpretó como TDD contra un **mapeo puro** primero (`requisitosActividadMapping.ts`, 14
      tests, sin red) — no se agregó un `mockRequisitosActividadRepository.ts` persistido en
      localStorage, a diferencia de `mockObraSocialRepository.ts`: esta tabla YA tiene backend real
      (aplicado en 3.5) y ninguna ruta de este proyecto inyecta un mock cuando el backend real ya
      existe (`ObraSocialesRoute.tsx`/`PacientesRoute.tsx` van directo a Supabase) — agregar un mock
      no usado en producción habría sido código muerto. `PacienteDocumentos.test.tsx` ya cubre el
      caso de repository con un stub inline (mismo patrón que `buildObraSocialRepository` del
      archivo), suficiente para TDD sin el mock persistido.**
- [x] 4.2 Implementación real contra Supabase, con su test suite, siguiendo el patrón de
      `SupabaseObraSocialRepository` / `SupabaseDocumentoRepository` (mapping en archivo aparte,
      repository delgado). **Nunca** `SUPABASE_SERVICE_ROLE_KEY` desde el frontend.
      **→ HECHO: `SupabaseRequisitosActividadRepository.ts` (I/O delgado, mapeo en
      `requisitosActividadMapping.ts`), 12 tests contra un fake tipado de `supabase-js`
      (`?raw` + asserts de superficie de código fuente, mismo criterio que
      `SupabaseObraSocialRepository.test.ts`) — cubre `listAll` (agrupación, anti N+1, default
      vacío, error PGRST106), `actualizar` (payload de la RPC, lista vacía, 45101, 42501). 26/26
      tests del directorio en verde. `npx tsc -b --noEmit`: sin errores nuevos atribuibles a estos
      archivos (los 2 errores restantes del proyecto están en `SupabaseDocumentoRepository.ts`, ver
      nota de hallazgo abajo — no son de este change).**
- [x] 4.3 Verificar que **ningún** tipo compartido cambia: `ChecklistItem`, `DocumentoAdjunto`,
      `DocumentoRepository` quedan idénticos (`design.md` D3). Si algún veredicto obliga a tocarlos,
      **volver a §1** — es un cambio de alcance, no un detalle de implementación.
      **→ VERIFICADO: `frontend/src/shared/types/documento.ts` no se tocó. `ChecklistItem` se
      reusa tal cual (`{ id, nombre, requerido }`) para los ítems por tipo de actividad — mismo
      contrato, ninguna extensión.**
      **⚠️ HALLAZGO (no atribuible a este change, NO tocado): el working tree de este repo tiene
      cambios sin commitear de una sesión en paralelo (`git status`, 2026-08-10) que SÍ agregan un
      método nuevo a `DocumentoRepository` (`transferirAgrupacion`, feature
      "documentos-transferencia-actividad" — el punto 3 del feedback original, "transferir
      documentación a otro domicilio", que el `proposal.md` de este change lista explícitamente como
      fuera de alcance). Ese trabajo está a medio terminar (`mockDocumentoRepository`/
      `SupabaseDocumentoRepository` no implementan el método nuevo todavía → `tsc -b --noEmit` marca
      2 errores ahí) y **no lo escribí yo, no lo toqué, no lo revertí** — regla dura de este
      proyecto/usuaria: nunca tocar o revertir ediciones de otra sesión sin preguntar. Por la misma
      razón, la tarea 8.4 (`AvisoModeloDatos` en `PacienteDetail.tsx`) queda **deliberadamente sin
      hacer** en este batch: ese archivo también tiene una línea sin commitear de esa sesión paralela
      (pasa `pacienteNombre` a `PacienteDocumentos`), y evité editarlo para no pisar ese trabajo en
      curso. Reportado en el resumen de esta sesión — a resolver cuando esa sesión paralela
      commitee o el árbol de trabajo se reconcilie.**

## 5. Superficie de administración (condicionada a 1.5 y 1.6)

- [x] 5.0 **Antes de codear**: escribir el delta spec de la superficie elegida (capability nueva
      `checklist-por-tipo-actividad`, o delta sobre `obra-social-checklist-editor`) y actualizar
      `proposal.md` §Capabilities — tarea 1.8.
      **→ HECHO en la tarea 1.8 (mismo trabajo, hecho antes de codear como pide esta tarea):
      `specs/checklist-por-tipo-actividad/spec.md` + `proposal.md` §Capabilities actualizados.**
- [x] 5.1 Implementar la pantalla/sección de configuración reusando `ChecklistEditor`/`ChecklistItemRow`
      y el design system (`Card`, `SectionBadge`, `Button`, `Input`). **Nunca** markup ad-hoc ni
      `style={{}}`.
      **→ HECHO: `frontend/src/features/obras-sociales/RequisitosActividadPage.tsx` — selector de
      tipo (`role="tablist"`, 5 tipos, Tailwind utilities, sin `style={{}}`) + `Card` con
      `ChecklistEditor` reusado tal cual (sin tocarlo) para el tipo seleccionado. Guardado
      optimista con rollback y `Alert` de error si `repository.actualizar()` falla.**
- [x] 5.2 Si es pantalla propia: ruta, entrada de navegación y `route-guard` con el permiso de módulo
      que salga del veredicto 1.2. Verificar que un usuario **sin** ese permiso no la ve ni la alcanza
      por URL directa.
      **→ HECHO: `/documentacion-por-actividad` agregada a `APP_ROUTES` (`frontend/src/app/routes.ts`)
      con `modulo: 'obra_social'` (veredicto 1.2) — entra automáticamente al `route-guard` genérico
      de `RequireAuth.tsx` (mismo mecanismo que las otras 7 rutas de módulo, sin código nuevo de
      guard). Ícono nuevo `documentacionActividad` en `navIcons.tsx`, entrada de navegación
      "Documentación por Actividad" en sección Administración. `router.tsx` monta
      `RequisitosActividadRoute` (inyecta `supabaseRequisitosActividadRepository`, mismo criterio
      que `ObraSocialesRoute.tsx`). `AppShell.test.tsx`/`router.test.tsx` ya iteran `APP_ROUTES`
      genéricamente — cubren esta ruta nueva sin tests bespoke. **No pude confirmar en verde en esta
      sesión**: ambos archivos fallan en este sandbox por una falla de entorno preexistente
      (`localStorage` undefined en jsdom, confirmada independiente de este change — ver nota de
      2.1/hallazgo abajo), no por esta ruta. `npx tsc -b --noEmit` de todo el proyecto: limpio.**
- [x] 5.3 `AvisoModeloDatos` en la pantalla de configuración explicando que el nombre de cada ítem se
      guarda en el catálogo compartido con Pacientes y Facturación (mismo texto/criterio que el que ya
      tiene `ChecklistEditor.tsx`).
      **→ HECHO, con un ajuste: `ChecklistEditor.tsx` (reusado sin tocar) ya renderiza ese aviso —
      duplicarlo en la pantalla nueva violaba la regla dura "nunca dos carteles que repitan el mismo
      texto" (`CLAUDE.md`). La pantalla nueva agrega un segundo `AvisoModeloDatos` con información
      que sí es específica de ella (configuración global por tipo, no por obra social).**
- [x] 5.4 Tests de la pantalla: alta, baja, marcar requerido, y modo solo-lectura sin permiso de
      escritura.
      **→ HECHO: `RequisitosActividadPage.test.tsx`, 10/10 verdes — carga, ítems del tipo inicial,
      cambio de tab, alta (persiste vía `actualizar`), baja, marcar requerido, modo solo-lectura
      (`AvisoSoloLectura` + controles deshabilitados, lista sigue legible), los dos avisos, rollback
      optimista ante error de guardado, Chip de cantidad por tab.**

## 6. Cableado en Pacientes → Documentos (condicionada a §2 y §4)

> **⚠️ BATCH DETENIDO ACÁ (2026-08-10) — NO por falta de tiempo, por seguridad de datos.**
> `git status` reveló, a mitad de este batch, que el working tree ya tenía ~20 archivos
> modificados **sin commitear de una sesión en paralelo** (activa en simultáneo con esta), sobre
> el change `documentos-transferencia-actividad` (feature "transferir documentación a otro
> domicilio", el punto 3 del feedback original — este mismo `proposal.md` §"Lo que este change
> explícitamente NO hace" ya la lista como fuera de alcance). Esa sesión toca **exactamente los
> dos archivos** que §6 necesita editar: `PacienteDocumentos.tsx` (agrega prop `pacienteNombre`) y
> `PacienteDocumentosChecklist.tsx` (agrega props `direccion`/`pacienteNombre` para una UI de
> transferencia) — confirmado activo en tiempo real: el diff de `DocumentoRepository.ts`
> (`transferirAgrupacion`) cambió de "método sin implementar, 2 errores de `tsc`" a "implementado,
> 0 errores" **entre dos verificaciones consecutivas** de este mismo batch.
>
> Regla dura de este proyecto/usuaria: **nunca revertir, pisar o "arreglar" ediciones de otra
> sesión sin preguntar** — ni siquiera parece razonable intentar un merge quirúrgico cuando la otra
> sesión puede estar escribiendo esos mismos archivos en el instante siguiente. Por eso este batch
> se detiene **antes** de tocar `PacienteDocumentos.tsx`/`PacienteDocumentosChecklist.tsx`, con §1-§5
> ya terminados y verificados (código nuevo, archivos nuevos, cero superposición con la sesión
> paralela).
>
> **Actualización, misma sesión, verificación posterior con `git status` completo**: el alcance real
> de la sesión paralela es más grande de lo que parecía al principio — ya tiene su propia carpeta
> `openspec/changes/documentos-transferencia-actividad/`, y además de los dos archivos de arriba
> también toca `frontend/src/shared/components/DocumentChecklist.tsx`,
> `frontend/src/shared/lib/documentos/useDocumentChecklist.ts`, **`CHANGES.md`** y
> **`knowledge-base/04_modelo_de_datos.md`** — los dos últimos son exactamente los archivos que la
> tarea §8 de ESTE change necesita editar (8.1 y 8.3). Por lo tanto **§7 también queda en riesgo**
> (sus tests de no-regresión de Vehículos/Conductores/Facturación ejercitan `DocumentChecklist.tsx`,
> que la sesión paralela ya modificó) y **§8 completo queda bloqueado**, no solo 8.4.
>
> **Qué hace falta antes de continuar §6-§9**: que la sesión paralela de `documentos-transferencia-actividad`
> commitee su trabajo (o el árbol de trabajo se reconcilie de otra forma) — recién ahí un batch de
> continuación puede leer el estado final real de esos archivos y wirear
> `combinarItemsDeActividad`/`RequisitosActividadRepository` sobre él, correr §7 sin falsos positivos,
> y escribir §8 sin pisar los bullets que la otra sesión ya haya agregado a `CHANGES.md`/
> `knowledge-base/04_modelo_de_datos.md`.
>
> **✅ RESUELTO (2026-08-11)**: `documentos-transferencia-actividad` commiteó (`4135b47`, `508daf6`,
> `4c6b85a`, `f2bba02`) — `git log`/`git status` confirmaron el working tree limpio salvo el trabajo
> propio sin commitear de §1.8-§5 de ESTE change. Verificado leyendo el estado final de
> `PacienteDocumentos.tsx`/`PacienteDocumentosChecklist.tsx`/`DocumentChecklist.tsx` antes de tocar
> nada: el guard de "Otros documentos" (huérfanos por `itemId`) que esa sesión dejó en
> `DocumentChecklist.tsx` está presente y es exactamente la mitigación que este bloqueo anticipaba
> necesitar — confirmado, no asumido. §6-§8 continuados en este batch; §9 (verificación manual) queda
> para la usuaria.

- [x] 6.1 Safety net previo: `cd frontend && npx vitest run`, baseline registrado (se toca un archivo
      existente y muy tocado).
      **→ BASELINE (2026-08-11, antes de tocar nada de §6): archivos targeteados (`PacienteDocumentos.test.tsx`,
      `actividadDocumental.test.ts`, `VehiculoDocumentos.test.tsx`, `ConductorDocumentos.test.tsx`,
      `FacturaDocumentos.test.tsx`, `DocumentChecklist.test.tsx`, `requisitosActividad/`) — 8 archivos,
      141/141 tests verdes. `npx tsc -b --noEmit`: 0 errores. Confirmado que el guard de "Otros
      documentos" (huérfanos por `itemId`) que `documentos-transferencia-actividad` dejó en
      `DocumentChecklist.tsx` está presente (líneas 294-315/530-552) — la coordinación entre las dos
      sesiones paralelas del batch anterior funcionó: §6 puede wirear `combinarItemsDeActividad` con
      la certeza de que un documento transferido a un bloque cuya lista combinada no lo incluye no
      desaparece silenciosamente.**
- [x] 6.2 **RED** — test en `PacienteDocumentos.test.tsx`: con configuración por tipo cargada, el
      bloque de una actividad de tipo escuela muestra los ítems de la obra social **más** los de
      escuela; el de terapia muestra los suyos y no los de escuela.
      **→ HECHO: describe nuevo "PacienteDocumentos — ítems por tipo de actividad (tasks.md §6)",
      8 tests. Confirmado RED (5 fallando) antes de tocar producción.**
- [x] 6.3 **RED** — test de no-regresión del bloque **General**: con configuración cargada para todos
      los tipos, el bloque General sigue mostrando **solo** los ítems de la obra social (spec: *"El
      bloque general no recibe ítems por tipo de actividad"*).
      **→ HECHO, mismo describe que 6.2 (test dedicado con config para escuela+terapia a la vez).**
- [x] 6.4 **GREEN** — modificar `frontend/src/features/pacientes/PacienteDocumentos.tsx`: resolver
      también la configuración por tipo, y en el `.map` de actividades (hoy línea 144) pasar
      `items={combinarItemsDeActividad(resolucion.items, itemsPorTipo[direccion.tipo] ?? [])}`. La
      línea 127 (bloque General) **no se toca**.
      **→ HECHO: nuevo prop opcional `requisitosActividadRepository` (mismo criterio que
      `pacienteNombre`: opcional, compatibilidad hacia atrás — los ~30 tests preexistentes que no lo
      pasan ya son la prueba más fuerte de "default vacío = comportamiento actual", design.md D2), un
      `useEffect` independiente del de `obraSocialRepository` que resuelve `itemsPorTipo` (estado
      `RequisitosPorTipo`, default `{}`), y `combinarItemsDeActividad(resolucion.items,
      itemsPorTipo[direccion.tipo as TipoActividad] ?? [])` dentro del `.map` de actividades. El
      bloque General (antes línea 127, ahora ~línea 204) sigue usando `resolucion.items` tal cual, sin
      tocar. 5/5 tests antes rojos ahora verdes.**
- [x] 6.5 **TRIANGULATE** — estados de carga y error de la fuente nueva: mientras la configuración por
      tipo no resolvió, no mostrar listas a medias ni parpadeo; si falla, degradar al comportamiento
      actual (solo ítems de la obra social) en vez de romper la pantalla. Es documentación de salud:
      degradar, nunca vaciar.
      **→ HECHO: `itemsPorTipo` arranca en `{}` (mismo valor que el estado degradado) — antes de
      resolver, cada bloque ya muestra su estado FINAL para ese instante ("solo obra social"), nunca
      una lista a medias; al resolver (éxito) pasa a "combinado" en un solo commit. Si `listAll()`
      rechaza, `catch` vuelve a `{}` — nunca rompe la pantalla ni el resto de los bloques (test
      dedicado: con `listAll` rechazando, el bloque escuela sigue mostrando sus 2 ítems de la obra
      social Y el bloque General sigue montado). 2 tests (pendiente eterno / rechazo) verdes.**
- [x] 6.6 Verificar que el **progreso** por actividad y el total agregado se calculan sobre la lista
      combinada, sin contar dos veces un ítem deduplicado (spec: *"El progreso de cada actividad se
      calcula sobre su lista combinada"*).
      **→ VERIFICADO por construcción: `items={itemsCombinados}` es lo que recibe
      `PacienteDocumentosChecklist`, que ya calculaba `cargados`/`total` sobre su prop `items` — no
      hizo falta tocar esa fórmula. Test dedicado de dedup: configuración con un ítem de tipo que
      coincide en `id` con uno de la obra social (no debe sumar al total) + uno genuinamente nuevo
      (sí debe sumar) → total agregado "0 de 5" (General 2 + Escuela combinada-deduplicada 3), NO "0
      de 6" (que sería el resultado sin dedup). Test adicional confirma que "RHC" aparece una sola
      vez (`getAllByText('RHC')).toHaveLength(1)`) y gana el nombre de la obra social.**
- [x] 6.7 Comunicar la procedencia de los ítems a nivel de **bloque** (texto o `Chip` en el encabezado
      del bloque de actividad), sin tocar `DocumentChecklist.tsx` — salvo veredicto 1.4 (ii) en
      contrario.
      **→ HECHO: `PacienteDocumentosChecklist.tsx` (NO `DocumentChecklist.tsx`, que sigue sin tocar)
      gana un prop opcional `itemsPropiosDeActividad?: number` — `PacienteDocumentos.tsx` calcula
      `itemsCombinados.length - resolucion.items.length` (cuántos ítems son genuinamente nuevos
      respecto de la obra social, sin contar los que el dedup absorbió) y lo pasa por bloque. Cuando
      es `> 0`, se renderiza un `Chip` (`kind="info"`, design system, sin markup ad-hoc) fuera de
      `SeccionPlegable` — mismo criterio que el botón "Exportar" ya usa (`SeccionPlegable` no admite
      contenido propio en su encabezado) — así queda visible tanto abierto como colapsado, no solo al
      colapsar (a diferencia del `resumen` nativo de `SeccionPlegable`, que solo se ve cerrado). El
      bloque "General" nunca recibe este prop (nunca llama a `combinarItemsDeActividad`) — nunca
      muestra el chip. Test dedicado confirma el texto "+1 ítem propio de esta actividad" en el
      bloque de escuela y su ausencia en "General".**

## 7. No-regresión de los otros tres dominios documentales

- [x] 7.1 Tests dedicados: Vehículos, Conductores y Facturación muestran exactamente los mismos ítems
      que antes del change, con configuración por tipo de actividad cargada en el sistema (spec: *"La
      configuración por tipo de actividad no llega a los otros dominios"*).
      **→ HECHO: ninguno de los tres componentes se tocó en este batch (§6 solo modificó archivos de
      Pacientes) — sus test suites existentes (`VehiculoDocumentos.test.tsx`,
      `ConductorDocumentos.test.tsx`, `FacturaDocumentos.test.tsx`) YA son, en sí mismas, la prueba de
      "muestran exactamente los mismos ítems que antes": corridas después de §6, 100% verdes sin
      ningún ajuste (confirmado en el mismo run targeteado que 7.2, ver abajo). Como
      `RequisitosActividadRepository`/`combinarItemsDeActividad` no tienen ningún punto de contacto
      con esos tres dominios (nadie les inyecta el repository nuevo, nadie llama a la función pura
      desde ahí), no hay escenario en el que "cargar configuración en el sistema" pueda afectarlos —
      no se justificó un test bespoke adicional más allá de confirmar (7.2) que el acoplamiento es
      cero.**
- [x] 7.2 Confirmar por lectura que ninguno de los tres importa nada de `actividadDocumental.ts` ni del
      repository nuevo.
      **→ CONFIRMADO por lectura + grep: `grep -rn "actividadDocumental\|requisitosActividad"
      frontend/src/features/{vehiculos,conductores,facturacion}/*Documentos.tsx` → sin resultados.
      `VehiculoDocumentos.tsx`/`ConductorDocumentos.tsx`/`FacturaDocumentos.tsx` no tienen ningún
      prop nuevo ni importan nada de este change.**

## 8. Documentación de la discrepancia (obligatoria, regla dura)

> Alcance exacto según veredicto 1.7. Lo de abajo asume la recomendación (opción A): documentar ahora,
> reescribir las RN recién con veredicto real de Andrea.

- [x] 8.1 Bullet nuevo en `knowledge-base/04_modelo_de_datos.md` §Discrepancias: el supuesto, su origen
      (**equipo, no cliente**), la forma de la configuración, el default vacío y el estado de la
      confirmación.
      **→ HECHO: bullet nuevo "Ítems de checklist propios por tipo de actividad — supuesto del
      EQUIPO, no feedback textual de la clienta" (`04_modelo_de_datos.md` §Discrepancias, justo
      después del bullet de `documentos-transferencia-actividad`) — incluye la forma exacta de la
      tabla, el mecanismo de combinación/dedup, el origen (cita textual de la hipótesis de Delfina, a
      diferencia de los tres refinamientos hermanos que sí son feedback de Andrea), el default vacío
      y el estado de la confirmación. También cierra el "Herencia hacia
      documentos-checklist-items-por-actividad" que `documentos-transferencia-actividad` había dejado
      anotado: confirma que el guard de "Otros documentos" en `DocumentChecklist.tsx` es la
      resolución real del riesgo que esa nota anticipaba.**
- [x] 8.2 Nota `⚠️` en `knowledge-base/05_reglas_de_negocio.md` sobre **RN-FA-08** y **RN-FA-10**
      apuntando a esa discrepancia. **No** reescribir su texto normativo ni redactar una RN nueva
      marcada como feedback confirmado mientras el supuesto siga sin confirmar.
      **→ HECHO: sub-bullet `⚠️` agregado bajo RN-FA-08 y bajo RN-FA-10, cada uno explicando
      puntualmente qué agrega este change sobre lo que esa RN ya dice, aclarando que el origen es el
      equipo (no Andrea) y que la RN sigue siendo verdad tal cual está escrita — texto normativo de
      las dos RN sin tocar.**
- [x] 8.3 Bullet de refinamiento en `CHANGES.md` `C-03` (dueño del componente/tipo/repository
      compartido) y en `C-05` (dueño de la pantalla), con el formato de los tres refinamientos
      anteriores del mismo dominio.
      **→ HECHO: bullet nuevo en `C-03` (después del de `documentos-transferencia-actividad`) y otro
      en `C-05` (mismo lugar), mismo formato/tono que los refinamientos anteriores de esta pantalla —
      con referencia cruzada entre ambos y a las notas de `05_reglas_de_negocio.md`.**
- [x] 8.4 `AvisoModeloDatos` en la sección de documentación de
      `frontend/src/features/pacientes/PacienteDetail.tsx` indicando que la exigencia por tipo de
      actividad es un supuesto pendiente de confirmar. Decidir si **se suma** al cartel que ya dejó
      `documentos-checklist-por-actividad` o si se reescribe uno solo que diga las dos cosas — nunca
      dos carteles que repitan el mismo texto.
      **→ HECHO: se sumó un `AvisoModeloDatos` nuevo (no se reescribió el existente) — son temas
      distintos: el cartel de `documentos-checklist-por-actividad` habla de si la columna
      `direccion_id` existe en la base (hoy desactualizado — ya existe, ver nota de estado en
      `04_modelo_de_datos.md`, pero corregirlo es de otro change ya archivado, no de este apply); el
      nuevo habla de si el CONTENIDO del checklist varía por tipo de actividad, que es la pregunta
      de negocio sin confirmar de ESTE change. Ningún texto se repite entre los dos. Test dedicado
      (`PacienteDetail.test.tsx`) confirma presencia, contenido ("sin confirmar") y no-solapamiento
      con el cartel existente (`direccion_id` no aparece en el texto del nuevo).**
- [ ] 8.5 Si en algún momento llega el veredicto afirmativo de Andrea: agregar **RN-FA-11** con su
      marca de feedback real, cerrar las notas `⚠️` de 8.2 y actualizar los bullets de 8.1/8.3.
      **→ NO APLICA todavía — condicionado a un veredicto futuro que no llegó en este batch. Queda
      sin marcar a propósito, tal como indica su propio texto.**

## 9. Verificación manual y cierre

- [ ] 9.1 Con la configuración **vacía**: la pantalla se ve y se comporta **idéntica** a antes del
      change, en un paciente con varias actividades. Es la verificación más importante del change.
- [ ] 9.2 Con configuración cargada para escuela y terapia: los bloques muestran las listas correctas,
      el General no cambia, y dos actividades del mismo tipo comparten ítems pero **no** documentos.
- [ ] 9.3 Cargar un documento en un ítem que vino de la configuración por tipo, verificar que se
      persiste contra la base real con su `direccion_id`, y que no aparece en ningún otro bloque.
- [ ] 9.4 Verificación de permisos con **dos cuentas reales** de módulos distintos: quién puede ver y
      quién puede editar la configuración nueva, contrastado contra el veredicto 1.2. Confirmar que la
      RLS rechaza del lado del servidor, no solo la UI.
- [ ] 9.5 `cd frontend && npx tsc -b --noEmit` limpio y `cd frontend && npx vitest run` completo verde.
- [ ] 9.6 Confirmarle a la usuaria, **antes** de configurar ítems en producción, que el porcentaje de
      avance de los pacientes ya completos **va a bajar** (más ítems ⇒ mismo cargado sobre más total).
      No es un bug (`design.md` D6).
- [ ] 9.7 `/opsx:archive` con delta specs sincronizadas y `CHANGES.md` actualizado.
