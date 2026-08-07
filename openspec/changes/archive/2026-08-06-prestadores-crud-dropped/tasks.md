# Tasks — prestadores-crud

> **⚠️ RAMA DE DEMO.** Todo este trabajo vive en `feature/prestadores-crud` para mostrarle el
> concepto a Andrea. Los **5 supuestos provisorios** de `proposal.md` (relación N:N, ambigüedad de
> CUIT, mudanza de `plazoCobroDias`/`tipoComprobante` a `Prestador`, alcance de 6 campos, selección
> de Prestador al facturar en modo general) **NO se relitigan en `tasks.md`** — ninguna tarea de
> abajo los resuelve, y ninguna debe redactarse como si los resolviera. **No mergear a `main` sin
> validarlos con Andrea primero.**
>
> **⚠️ TESTING REDUCIDO A PROPÓSITO (decisión de Enzo, 2026-08-01)**: esta rama es para mostrarle un
> concepto a Andrea, no código production-hardened. **NO** aplica acá la convención habitual del
> proyecto de TDD estricto con triangulación exhaustiva ni el piso de cobertura ≥ 80 % de
> `openspec/config.yaml`. Cada archivo nuevo de dominio (mapeo, repository) lleva **como mucho un
> smoke test liviano** (un caso feliz), no una batería de casos de borde/errores como la de
> `obraSocialMapping.test.ts`. Los archivos de plomería/composition-root (`*Route.tsx`, context,
> page) **no llevan test dedicado**, mismo criterio que ya usa este repo para esos archivos. La
> **excepción** es la sección 2: ahí no se "escriben tests nuevos", se **corrigen ~59 ocurrencias
> existentes** en fixtures/tests ya escritos por otros changes para que `tsc`/`vitest` sigan en
> verde — eso no es negociable, sin eso el build queda roto.
>
> **⚠️ Las migraciones NO las aplica el agente.** `20260801100000_prestadores_condiciones_y_vinculo.sql`
> se escribe y se commitea, pero `supabase db push` sigue siendo acción manual y explícita de Enzo.
> **No se escribe ningún archivo `DROP COLUMN`** — D3 de `design.md` es explícito: esa migración
> queda solo documentada en comentario, nunca como archivo, hasta que Andrea confirme el modelo.
>
> **⚠️ Fuera de alcance, a propósito** (no crear tareas para esto): resolver el supuesto #5 (qué
> Prestador aplica al facturar en modo general), resolver la ambigüedad del CUIT (supuesto #2,
> discrepancia #12), o aplicar cualquier migración contra Supabase real.
>
> **Reglas duras aplicables** (`CLAUDE.md`): nunca `any` (usar `unknown` + narrowing); nunca
> `style={{}}` (solo utilidades Tailwind v4); reusar `frontend/src/design-system/components.tsx`;
> nunca `SUPABASE_SERVICE_ROLE_KEY` en frontend; toda tabla nueva define su RLS en el mismo archivo
> que la crea; type-check con `npx tsc -b --noEmit` (nunca `tsc --noEmit` a secas); Conventional
> Commits.
>
> **Orden de fases pensado para no dejar el árbol a medias** (Migration Plan de `design.md`): la §2
> (baja de campos en `ObraSocial` + fallback en Facturación) es **enteramente sobre lo existente** y
> termina con la app compilando igual que antes, salvo el default de `tipoComprobante`. Recién
> después arranca la construcción de la entidad `Prestador` nueva (§3-§5), que nadie importa hasta
> el corte real de §4.1. Cada fase es revertible por sí sola.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1900–2100 (dominio Prestador ~550, UI Prestador ~735, vínculo N:N ~150, baja de campos ObraSocial + fixtures ~400, fallback Facturación ~120, migración ~70, docs ~70 — testing reducido según nota de arriba) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 (ver Suggested Work Units) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending — propuesta: `feature-branch-chain` sobre `feature/prestadores-crud` como tracker (branch de demo, aún no decidida para `main`) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Migración escrita (no aplicada) + baja de `plazoCobroDias`/`tipoComprobante` en `ObraSocial` + fallback provisorio en Facturación + corrección de fixtures/tests existentes | PR 1 | `cd frontend && npx vitest run shared/lib/obrasSociales shared/lib/facturacion features/facturacion features/obras-sociales` | N/A — sin cuentas reales todavía, la migración no se aplica en esta unidad | Revertir `obraSocial.ts`, `obraSocialMapping.ts`, `ObraSocialForm.tsx`, los 3 archivos de Facturación y el `.sql`; nada más depende de esta unidad |
| 2 | Dominio de Prestador: `prestador.ts`, `PrestadorRepository`, `prestadorMapping.ts`, `SupabasePrestadorRepository.ts` (implementación + smoke tests livianos) | PR 2 | `cd frontend && npx vitest run shared/lib/prestadores` | N/A — nadie importa el repository todavía | Borrar `shared/types/prestador.ts` y `shared/lib/prestadores/`; ningún otro archivo los referencia aún |
| 3 | Pantalla de Prestador completa + ruta/ícono/sidebar | PR 3 | `cd frontend && npx vitest run features/prestadores app/AppShell.test.tsx` | Verificación manual en `npm run dev` navegando a `/prestadores` con una cuenta `obra_social: write` (una vez aplicada la migración de PR 1, tarea de Enzo) | Revertir `app/routes.ts`, `app/navIcons.tsx`, `app/router.tsx`, `AppShell.test.tsx` y borrar `features/prestadores/`; el dominio de PR 2 queda intacto y sin consumidores |
| 4 | Vínculo N:N (multi-select en `PrestadorForm`, panel de solo lectura en `ObraSocialDetail`) + documentación + verificación final | PR 4 | `cd frontend && npx vitest run features/prestadores features/obras-sociales` | Verificación manual con 3 cuentas reales (§7.6/§7.7), bloqueada hasta que la migración de PR 1 esté aplicada | Revertir el bloque de multi-select en `PrestadorForm.tsx`, borrar `PrestadoresDeObraSocial.tsx`, revertir `ObraSocialDetail.tsx`/`ObraSocialesRoute.tsx`; PR 3 sigue funcionando sin vínculo visible |

**Pendiente de decisión (ask-on-risk, no se decide unilateralmente acá)**: confirmar con la usuaria si
la cadena se maneja como **Feature Branch Chain** (cada PR apunta al anterior, `feature/prestadores-crud`
como tracker) o como **stacked-to-main** directo, antes de arrancar `sdd-apply`.

## 0. Checkpoint de diseño y supuestos (antes de escribir código)

- [x] 0.1 **Revisar, no relitigar.** Confirmar que los 5 supuestos provisorios de `proposal.md` quedan
      señalizados como NO confirmados con Andrea en cada artefacto donde aplican (código, specs,
      knowledge-base) — ninguna tarea de este documento los cierra. Confirmado: no se relitigó
      ninguno en este apply (work unit 1).
- [x] 0.2 Baseline: `cd frontend && npx vitest run` (con el flag `NODE_OPTIONS` del flake conocido) y
      registrar el conteo de tests **antes** de tocar nada. **Nota de apply**: se usó el baseline ya
      documentado en §7.3 (19 archivos / 114 tests con el flake `localStorage.clear is not a
      function`, confirmado en sesiones previas) en vez de una captura pristina pre-edit dentro de
      esta invocación — ver Work Unit Evidence del reporte de apply.
- [x] 0.3 Dejar explícito para quien ejecute §5 que **D2 de `design.md` ya decidió** que la UI del
      vínculo N:N vive en `PrestadorForm`, no en `ObraSocialForm` — no reabrir esa decisión sin
      volver a leer la tabla comparativa de D2. (No aplica a este work unit — §5 es trabajo futuro,
      dejado explícito para quien lo ejecute.)
- [x] 0.4 Dejar explícito que el testing de este change es **reducido a propósito** (ver nota de
      cabecera): no agregar cobertura exhaustiva "porque el resto del repo la tiene" — es una
      decisión consciente de Enzo para esta rama de demo, no un descuido.

## 1. Migración (D3 — solo escrita, nunca aplicada)

> **Deviación de apply registrada (work unit 1, 2026-08-01)**: el Migration Plan de `design.md`
> bundlea el `ALTER TABLE` de `obra_social.prestadores` y el `CREATE TABLE
> obra_social.obra_social_prestador` (vínculo N:N) en un único archivo
> `20260801100000_prestadores_condiciones_y_vinculo.sql`. La cadena de PRs de esta rama de demo
> (`feature-branch-chain`, ver Review Workload Forecast) escopea el work unit 1 **solo** a la baja
> de `plazoCobroDias`/`tipoComprobante` — el vínculo N:N es trabajo de una rama posterior de la
> cadena. Para no dejar el work unit 1 con una migración que ya cree una tabla que ningún código de
> esta rama usa todavía, el archivo se dividió en dos: `20260801100000_prestadores_condiciones.sql`
> (1.1, esta rama — solo el `ALTER TABLE`) y una migración posterior con el `CREATE TABLE`
> `obra_social.obra_social_prestador` + su RLS + trigger, a escribir en el work unit del vínculo
> N:N. Ninguna sentencia SQL cambia respecto a `design.md`, solo el corte de archivo.
>
> **Actualización (work unit 4, 2026-08-01)**: la migración diferida se escribió —
> `supabase/migrations/20260801110000_prestadores_vinculo_obra_social.sql`. `CREATE TABLE
> obra_social.obra_social_prestador` (PK compuesta `(obra_social_id, prestador_id)`, dos FK `ON
> DELETE CASCADE`), `CREATE INDEX idx_obra_social_prestador_prestador`, RLS con `GRANT` explícito
> por tabla + las dos policies `Read`/`Write obra_social_prestador` (`FOR ALL`/`USING`, sin `WITH
> CHECK`, mismo estilo que el resto del schema), y `trg_audit_obra_social_prestador`. Ninguna
> sentencia SQL distinta de la que ya describía `design.md` D2/D3 en el bloque conceptual único —
> solo el corte de archivo. **Tampoco se aplica** (ver 7.4, bloqueado, requiere a Enzo).

- [x] 1.1 Escribir `supabase/migrations/20260801100000_prestadores_condiciones.sql`: `ALTER
      TABLE obra_social.prestadores ADD COLUMN plazo_cobro_dias INT NOT NULL DEFAULT 90, ADD COLUMN
      tipo_comprobante facturacion.tipo_factura NOT NULL DEFAULT 'A'`. Incluye el comentario de
      cabecera con el contexto de US-300 y la advertencia de que es aditiva a propósito. **El
      `CREATE TABLE obra_social.obra_social_prestador` (PK compuesta, FKs `ON DELETE CASCADE`,
      índice, RLS, trigger `trg_audit_obra_social_prestador`) queda diferido al work unit del
      vínculo N:N** — ver nota de deviación arriba.
- [x] 1.2 **NO crear** ningún archivo `.sql` para el `DROP COLUMN` de `obra_social.obra_social` — D3
      es explícito: queda solo como comentario SQL comentado dentro de `design.md`/`proposal.md`.
      Revisión manual (sin test automatizado, ver nota de testing reducido) de que el archivo de 1.1
      no contiene ningún `DROP COLUMN` y que su `ADD COLUMN` tiene `NOT NULL DEFAULT` en ambas
      columnas. Confirmado.

## 2. Baja de `plazoCobroDias`/`tipoComprobante` en `ObraSocial` + fallback provisorio en Facturación
   (fase autocontenida y revertible, sobre lo existente — sin Prestador todavía)

> **Safety net obligatorio antes de esta sección**: `cd frontend && npx vitest run`, comparar con el
> baseline de 0.2. Al terminar, la app compila y pasa tests igual que antes, salvo que el tipo de
> comprobante ya no se precarga desde la obra social — spec: `obra-social-contract` (MODIFIED),
> `obra-social-crud` (MODIFIED), `factura-crud` (MODIFIED). **Esta sección es corrección mecánica de
> tests/fixtures existentes, no escritura de tests nuevos — no se recorta por la nota de testing
> reducido.**

- [x] 2.1 Quitar `plazoCobroDias`/`tipoComprobante` de `shared/types/obraSocial.ts` y de
      `obraSocialMapping.ts` (incluidas las constantes privadas `DEFAULT_PLAZO_COBRO_DIAS` /
      `DEFAULT_TIPO_COMPROBANTE` — se recrean en `prestadorMapping.ts` en §3, no acá). Ajustar
      `obraSocialMapping.test.ts` quitando las aserciones sobre esos 2 campos.
- [x] 2.2 Comentario en `shared/types/obraSocial.ts` documentando que esos 2 campos se mudaron a
      `Prestador` como lectura literal de US-300, supuesto #3, **sin confirmar con Andrea**.
- [x] 2.3 `ObraSocialForm.tsx` / `ObraSocialForm.test.tsx`: quitar los 2 campos del formulario y sus
      tests asociados (el selector de Prestadores vinculados se agrega recién en §5, no acá).
- [x] 2.4 Añadir la constante provisoria a `shared/lib/facturacion/constantes.ts`:
      `TIPO_COMPROBANTE_DEFAULT: TipoComprobante = 'A'` con el doc-comment `⚠️ PROVISORIO` que cita
      el supuesto #5 y referencia `design.md` D4 — **no redactar este comentario como si fuera la
      resolución definitiva de RN-FA-07**, es el marcador de que falta resolverla.
- [x] 2.5 `FacturaForm.tsx`: borrar el `useEffect` de las líneas 118-122 completo (precargaba
      `tipoComprobante` desde `obraSocial.tipoComprobante`); reemplazar el literal
      `tipoComprobante: 'A'` de la línea 32 por `TIPO_COMPROBANTE_DEFAULT`; actualizar los
      comentarios de `:47`/`:71-72` que hoy dicen "precargado desde la obra social". Ajustar
      `FacturaForm.test.tsx` para reflejar que el campo ya no se deriva del paciente/obra social.
- [x] 2.6 `useEmisionFactura.ts:73`: reemplazar `plazoObraSocial: obraSocial?.plazoCobroDias` por
      `plazoObraSocial: undefined` (`calcularFechaEstimadaCobro` ya cae en
      `PLAZO_COBRO_DEFAULT_DIAS` por esa rama, sin tocar la función pura). Ajustar
      `useEmisionFactura.test.ts` si alguna aserción dependía del valor anterior. (No existe
      `useEmisionFactura.test.ts` dedicado — se ejercita indirectamente por
      `FacturaDetail.test.tsx`, sin aserciones sobre el valor numérico del plazo; sin ajuste
      necesario.)
- [x] 2.7 `FacturaResumen.tsx:25-31`: borrar la rama "plazo propio de {nombre}" de `motivoPlazo()` —
      quedan amparo judicial (45 días) y plazo general (90). Ajustar
      `FacturaResumen.test.tsx` correspondientemente.
- [x] 2.8 **Triage de fixtures y tests existentes** — la tarea grande de esta sección, del mismo
      tamaño que la corrección de `formatoAfiliado` hecha hoy en esta misma sesión: `plazoCobroDias`
      aparece **59 veces en 31 archivos** (design.md, riesgo #2). Recorrer cada ocurrencia y, según
      el caso:
      - literal `ObraSocial`/`NuevaObraSocial` en un fixture o test → quitar las 2 propiedades;
      - aserción que lee `.plazoCobroDias`/`.tipoComprobante` de una `ObraSocial` → adaptar o borrar
        si el comportamiento ya lo cubre §2.5-§2.7;
      - **no** tocar ningún archivo de `shared/lib/prestadores/` (todavía no existe) ni de
        `features/prestadores/` (se crean en §3-§5).
      Ir archivo por archivo, no con un reemplazo global ciego — `npx tsc -b --noEmit` marca cada
      propiedad excedente, usarlo como lista de trabajo. **Hallazgo de apply**: 2 consumidores
      reales adicionales no listados explícitamente en la tarea original (`ObraSocialDetail.tsx` y
      `ObrasSocialesList.tsx`, ambos leían `tipoComprobante`/`plazoCobroDias` para mostrarlos en
      pantalla) también se ajustaron, quitando el Chip/bloque correspondiente y su cartel de test
      asociado — ver Deviations en el reporte de apply. 24 archivos tocados en total contando los 2
      consumidores reales (no 31, porque varios de los ~31 originalmente estimados por design.md
      resultaron ser el mismo archivo con múltiples ocurrencias).
- [x] 2.9 `cd frontend && npx tsc -b --noEmit` limpio + `npx vitest run` sin regresiones contra el
      baseline de 0.2 (el único cambio esperado en conteo es el ajuste de tests de §2.1-§2.8, no una
      caída). Ver Work Unit Evidence del reporte de apply para los resultados exactos.

## 3. Dominio de Prestador — mapeo puro y repository real (implementación + smoke tests livianos)

> Espeja archivo por archivo a `shared/lib/obrasSociales/` (D1), pero **sin** la batería exhaustiva
> de triangulación que tiene el original — ver nota de testing reducido. Spec: `prestador-contract`
> (ADDED).

- [x] 3.1 `shared/types/prestador.ts`: `Prestador` con `id`, `razonSocial`, `cuit`, `direccion?`,
      `telefono?`, `plazoCobroDias`, `tipoComprobante` (`'A' | 'B' | 'C'`), más
      `NuevoPrestador = Omit<Prestador, 'id'>` y `ActualizacionPrestador =
      Partial<Omit<Prestador, 'id'>> & { obrasSocialesIds?: string[] }`. Sin `any`. Comentario de
      cabecera: campos movidos desde `ObraSocial`, supuesto #3, SIN confirmar con Andrea.
- [x] 3.2 `shared/lib/prestadores/PrestadorRepository.ts`: interfaz con `list(): Promise<Prestador[]>`,
      `getById(id): Promise<Prestador | null>`, `create(data): Promise<Prestador>`,
      `update(id, data): Promise<Prestador>`, `listarPorObraSocial(obraSocialId):
      Promise<Prestador[]>` (para el panel de solo lectura de §5). Sin test — es solo una interfaz.
- [x] 3.3 `shared/lib/prestadores/prestadorMapping.ts`: `parsePrestadorRow` (renombre
      `razon_social`→`razonSocial`, NULLables → `undefined`, `tipo_comprobante`/`plazo_cobro_dias`
      inválidos → defaults `DEFAULT_TIPO_COMPROBANTE`/`DEFAULT_PLAZO_COBRO_DIAS`, mudados desde
      `obraSocialMapping.ts` en §2.1, más el parseo del embed `obra_social_prestador (
      obra_social_id )` hacia `obrasSocialesIds: string[]`, tolerante a embed ausente/vacío),
      `toCrearPrestadorPayload`, `toActualizarPrestadorPayload` (semántica parcial: clave ausente ⇒
      no viaja en el payload; `obrasSocialesIds` no viaja acá, se resuelve por diff en el repository
      en §3.4). **Un solo smoke test** (`prestadorMapping.test.ts`) que arma una fila completa,
      parsea, y confirma el objeto `Prestador` resultante — no se testean todas las ramas
      defensivas por separado. **Nota de apply**: `parsePrestadorRow` devuelve `PrestadorConVinculo`
      (`Prestador & { obrasSocialesIds: string[] }`, tipo exportado nuevo) en vez de `Prestador`
      puro — `Prestador` (§3.1) no declara `obrasSocialesIds` como campo de lectura, así que el
      embed se parsea en una propiedad extra estructuralmente compatible con `Prestador[]`/
      `Prestador | null` (los retornos declarados por `PrestadorRepository`), consumida hoy solo por
      el diff interno de `update()` (§3.4) y disponible para quien la necesite en §5 (work unit
      futuro). Ningún archivo de este work unit lee `.obrasSocialesIds` de un valor tipado
      `Prestador`.
- [x] 3.4 `shared/lib/prestadores/SupabasePrestadorRepository.ts`: `list()`/`getById()`/`create()`/
      `update()`/`listarPorObraSocial()` sobre `obra_social.prestadores`, con el embed del vínculo en
      `list()`/`getById()`/`listarPorObraSocial()`. `update()` implementa el diff de D2: `.update()`
      de los campos planos y, solo si `cambios.obrasSocialesIds !== undefined`, `.select()` del
      vínculo actual + `.delete()` de los quitados + `.insert()` de los agregados, después
      `getById()`. `mapearErrorPrestador`: `23505` sobre `cuit`, `42501`/`PGRST301`, `PGRST204`,
      `PGRST106`, genérico — mensajes en castellano, nunca el texto crudo de Postgres.
      `listarPorObraSocial()` usa `obra_social_prestador!inner ( obra_social_id )` +
      `.eq('obra_social_prestador.obra_social_id', obraSocialId)` para filtrar por el lado embebido
      (PostgREST, sin tarea que especificara la sintaxis exacta — resuelto pragmáticamente).
- [x] 3.5 **Un solo smoke test** (`SupabasePrestadorRepository.test.ts`), con el mismo fake tipado
      mínimo (sin `any`/`as`) usado en `SupabaseObraSocialRepository.test.ts`: cubre `create()` +
      `update()` con `obrasSocialesIds` sin cambios reales (confirma que **no** dispara
      `.delete()`/`.insert()` de más — es la única aserción de este change que vale la pena
      proteger con test, el resto de las ramas de error quedan sin cubrir a propósito en esta rama
      de demo). **Nota de apply**: el fake se recortó/adaptó (builder único `FakeQueryBuilder` con
      `select`/`insert`/`update`/`delete`/`.eq()`/`.in()`/`.maybeSingle()`/`.single()`) porque
      `SupabaseObraSocialRepository.test.ts` no ejercita `.update()`/`.delete()`/`.in()` (usa RPC,
      no PostgREST directo) — se tomó como base más cercana el fake de
      `SupabasePacienteRepository.test.ts`, que sí los tiene, agregándole `.in()`.
- [x] 3.6 `cd frontend && npx tsc -b --noEmit` limpio sobre `shared/lib/prestadores/`. Sin gate de
      cobertura mínima (ver nota de testing reducido). **Resultado de apply**: limpio, 0 errores,
      corrido también sobre todo `frontend/` (no solo los archivos nuevos) por ser rama encadenada
      sobre el work unit 1 — ver Work Unit Evidence del reporte de apply.

## 4. Pantalla de Prestador (UI) — espejo de `features/obras-sociales/`

> Spec: `prestador-crud` (ADDED). Safety net antes de esta sección:
> `cd frontend && npx vitest run`, comparar con el conteo de §3. **Sin test dedicado** para los
> archivos de plomería/composition-root (`PrestadoresRoute.tsx`, `PrestadorRepositoryContext.tsx`,
> `PrestadoresPage.tsx`) — mismo criterio que ya usa este repo para ese tipo de archivo.

- [x] 4.1 `features/prestadores/PrestadorRepositoryContext.tsx`: Context + Provider + hook que lanza
      si falta el Provider (espejo de `ObraSocialRepositoryContext.tsx`). Sin test.
- [x] 4.2 `usePrestadores.ts`: `loading`/`error`/`recargar`/`crear`/`actualizar`, `err.message`
      directo a la UI. Sin test dedicado (se ejercita indirectamente por el smoke test de §4.6).
- [x] 4.3 `features/prestadores/PrestadoresRoute.tsx`: **único** archivo que importa
      `SupabasePrestadorRepository` — corte real del change (Migration Plan paso 6 de `design.md`).
      Sin test dedicado (plomería de composition-root).
- [x] 4.4 `features/prestadores/PrestadoresPage.tsx`: `View = list | detail`. Sin test dedicado.
- [x] 4.5 `PrestadoresList.tsx`: grid de tarjetas, búsqueda local, estados vacío/error/loading. Sin
      test dedicado (cubierto indirectamente por el smoke test de §4.6 si se monta junto).
- [x] 4.6 `PrestadorDetail.tsx`: ficha + form embebido, edición diferida (nunca modal). Incluye el
      `AvisoModeloDatos` de la ambigüedad del CUIT (spec `prestador-crud` §Señalización de la
      ambigüedad del CUIT — supuesto #2, sin resolver). **Un solo smoke test**
      (`PrestadorDetail.test.tsx` o `PrestadorForm.test.tsx`, el que resulte más directo): completa
      los campos requeridos y confirma que el alta se dispara — no se testean por separado todas las
      validaciones de campo. **Resultado de apply**: se eligió `PrestadorDetail.test.tsx` (más
      directo — ejercita PrestadorForm embebido igual que el smoke original de ObraSocialDetail).
- [x] 4.7 `PrestadorForm.tsx` + `validatePrestadorForm.ts`: estado controlado plano (sin librería,
      YAGNI), captura de los 6 campos (razón social, CUIT, dirección opcional, teléfono opcional,
      plazo de cobro, tipo de comprobante). Validación mínima de campos requeridos (razón social,
      CUIT) — sin test propio más allá del smoke de §4.6.
- [x] 4.8 Gateo `<AvisoSoloLectura />` + `<CamposSoloLectura>` + `<Button requiereEscritura>` con
      `modulo: 'obra_social'` — **no** se crea módulo `prestadores` nuevo (spec §Gateo por el
      módulo de permisos obra_social). Sin test dedicado (la policy real es la defensa; ver §7.6).
- [x] 4.9 Ruta e ícono: `app/routes.ts` (`section: 'Operación'`, `modulo: 'obra_social'`),
      `app/navIcons.tsx` + `IconKey` (SVG 24x24 `currentColor`), `app/router.tsx`
      (`ELEMENT_POR_RUTA` → `<PrestadoresRoute />`).
- [x] 4.10 `app/AppShell.test.tsx`: ajustar las aserciones de navegación existentes de 8 a 9
      entradas (esto es corregir un test existente para que compile, no escribir uno nuevo).
      **Hallazgo de apply**: no hizo falta ningún edit — `AppShell.test.tsx` ya itera
      dinámicamente sobre `APP_ROUTES` (`for (const route of APP_ROUTES) ...`) en las 3
      aserciones de navegación relevantes, sin ningún conteo hardcodeado de "8 entradas" en el
      archivo; agregar `/prestadores` a `APP_ROUTES` (4.9) alcanza para que las 25 pruebas de
      `AppShell.test.tsx` sigan pasando sin tocar el archivo. Confirmado corriendo
      `AppShell.test.tsx` con el flag del flake conocido — ver Work Unit Evidence del reporte de
      apply.
- [x] 4.11 `cd frontend && npx tsc -b --noEmit` y `npx oxlint` limpios. Ver Work Unit Evidence del
      reporte de apply para el resultado exacto (corrido sobre todo `frontend/`, no solo los
      archivos nuevos, por ser rama encadenada sobre los work units 1-2).

## 5. Vínculo N:N ObraSocial↔Prestador (D2/D6 — la UI vive en `PrestadorForm`, no en `ObraSocialForm`)

> Spec: `obra-social-prestador-vinculo` (ADDED), `obra-social-crud` (MODIFIED, selector + panel).
> Recorte de menor prioridad si hace falta acortar la demo (design.md D2 lo dice explícito) —
> siempre después de §4. Sin batería de tests dedicada — el smoke test de `update()` en §3.5 ya
> cubre la aserción que importa (no-op sobre el vínculo si no hay cambios reales).

- [x] 5.1 Multi-select de ObrasSociales dentro de `PrestadorForm.tsx` (no en `ObraSocialForm.tsx` —
      decisión D2, ver checkpoint 0.3): lista las obras sociales existentes, precarga las ya
      vinculadas en edición, y en el submit arma `cambios.obrasSocialesIds` para
      `usePrestadores().actualizar`. **Nota de apply (work unit 4, 2026-08-01)**: el multi-select
      solo se muestra en edición (`obrasSocialesVinculadasIds !== undefined`) — en alta no hay
      forma de que el vínculo viaje (`toCrearPrestadorPayload`/`NuevoPrestador` no lo declaran, D2
      lo resuelve con un `update()` posterior), mismo criterio que "el checklist solo se edita con
      la obra social ya creada" de `ObraSocialDetail.tsx`. La lista de ObrasSociales se resuelve
      inyectando `supabaseObraSocialRepository` por prop en `PrestadoresRoute.tsx` →
      `PrestadoresPage.tsx` (mismo patrón que `PacientesRoute.tsx`/`PacientesPage.tsx`, no un
      Context nuevo). La precarga de vinculadas usa un type guard nuevo `tieneVinculo()` en
      `prestadorMapping.ts` (angosta `Prestador` a `PrestadorConVinculo` sin `as`, ver su
      comentario) porque `PrestadorRepository` solo declara `Prestador` en sus retornos (D1), no
      `PrestadorConVinculo`.
- [x] 5.2 `features/prestadores/PrestadoresDeObraSocial.tsx`: componente de solo lectura que consume
      `PrestadorRepository.listarPorObraSocial(obraSocialId)`, montado dentro de
      `ObraSocialDetail.tsx`. Sin test dedicado.
- [x] 5.3 `ObraSocialesRoute.tsx`: montar `PrestadorRepositoryProvider` junto al de ObraSocial —
      único lugar que conoce ambas implementaciones concretas (design.md D2 §Panel de solo lectura).
      Ajustar `ObraSocialesRoute.test.tsx` con el doble correspondiente si el test existente lo
      exige para compilar. **Hallazgo de apply**: `ObraSocialesRoute.test.tsx` no necesitó ajuste
      (se queda en la vista de lista, nunca monta el detalle) pero **sí hicieron falta ajustes en
      `ObraSocialDetail.test.tsx` y `ObraSocialesPage.test.tsx`** — ninguno de los dos estaba
      listado en esta tarea y ambos SÍ navegan a modo edición, donde `PrestadoresDeObraSocial`
      exige el Provider en el árbol. Se agregó un `fakePrestadorRepository` tipado (sin `any`/`as`)
      y se envolvió cada `render(...)` — en `ObraSocialDetail.test.tsx` sombreando localmente el
      `render` importado (cero cambios en los ~20 call-sites existentes), en
      `ObraSocialesPage.test.tsx` editando los dos helpers `renderPage`/`renderPageConPermiso`.
      Detectado por una corrida completa de `vitest run` (2 tests rojos), no por lectura de código.
- [x] 5.4 Verificar con grep dirigido que `shared/types/obraSocial.ts`, `obraSocialMapping.ts` y
      `SupabaseObraSocialRepository.ts` **no** se tocaron por el vínculo (solo por la baja de §2) —
      D2 lo exige explícitamente. **Confirmado** (`git status --porcelain` de este work unit): los
      3 archivos no aparecen en el diff de esta rama del apply — los únicos archivos de Obra Social
      tocados son `ObraSocialDetail.tsx`/`.test.tsx` y `ObraSocialesRoute.tsx`/
      `ObraSocialesPage.test.tsx` (composition-root y su panel de solo lectura, no el contrato).
- [x] 5.5 `cd frontend && npx tsc -b --noEmit` y `npx oxlint` limpios + `npx vitest run` sin
      regresiones contra el baseline de §4. Ver Work Unit Evidence del reporte de apply para el
      resultado exacto (0 fallos, no el baseline histórico del flake — ver nota de Fase 7).

## 6. Documentación (fuera del código)

- [x] 6.1 `knowledge-base/10_preguntas_abiertas.md`: agregar los 5 supuestos provisorios como
      preguntas abiertas (relación N:N sin confirmar, ambigüedad de CUIT, mudanza de
      `plazoCobroDias`/`tipoComprobante`, alcance de 6 campos) y la pregunta **#5 nueva** —
      selección de Prestador al facturar en modo general cuando hay varios vinculados, marcada como
      bloqueante real del futuro `desacople-prestacion-factura`, no de este change. Nueva sección
      `## Preguntas nuevas — prestadores-crud (2026-08-01)`, mismo formato que la sección
      equivalente de `integracion-obra-social`.
- [x] 6.2 `knowledge-base/04_modelo_de_datos.md` §Discrepancias: mover la nota de "condiciones por
      prestador" de "resuelta en ObraSocial" a "movida a Prestador, provisorio — SIN confirmar con
      Andrea", documentando `plazo_cobro_dias`/`tipo_comprobante` como vestigiales en
      `obra_social.obra_social` hasta el día del `DROP` (no escrito, D3). Agregar la tabla nueva
      `obra_social.obra_social_prestador` a la sección de entidades. **Nota de apply**: se agregó
      discrepancia nueva #18 (bullet 6-9 original solo decía "resuelto", ahora aclara que
      `plazoCobroDias` queda excluido de esa resolución) y una sección `### Prestador` nueva en
      §Entidades, junto a un ajuste del bullet de `ObraSocial` (quita "condiciones por prestador"
      de sus atributos, agrega nota de mudanza + relación N:N).
- [x] 6.3 `CHANGES.md`: registrar `prestadores-crud` como change de rama de demo, con las mismas 5
      preguntas sin cerrar y la referencia a que `integracion-facturacion` debe coordinarse antes de
      cerrar sus propias aprobaciones si el modelo se confirma (proposal.md §Impacto). **Nota de
      apply**: se agregó como bullet nuevo dentro de la sección `[C-04] obras-sociales-prestadores`
      existente (mismo lugar donde vive `integracion-obra-social`), no como sección nueva de nivel
      superior — no existía precedente de una sección "ramas de demo" separada del roadmap C-01..
      C-11, y `prestadores-crud` es literalmente la continuación de D8 de ese mismo change.

## 7. Verificación

- [x] 7.1 `cd frontend && npx tsc -b --noEmit` sin errores (nunca `tsc --noEmit` a secas).
      **Resultado de apply (work unit 4)**: 0 errores.
- [x] 7.2 `cd frontend && npx oxlint` limpio. **Resultado de apply**: 0 errores — quedan las mismas
      15 advertencias preexistentes `react(only-export-components)` sobre archivos `*Context.tsx`
      (incluido `PrestadorRepositoryContext.tsx`, ya presente desde el work unit 4 anterior), sin
      ninguna advertencia nueva de este work unit.
- [x] 7.3 `cd frontend && npx vitest run` verde. **Corrección de nota (work unit 4, 2026-08-01)**:
      el flake `localStorage.clear is not a function` (Node v25/v26 + jsdom + vitest, 19
      archivos/114 tests) que este ítem pedía documentar como baseline **ya no existe** — corriendo
      con `NODE_OPTIONS="--no-experimental-webstorage" npx vitest run` (mismo flag usado en el resto
      de esta sesión) el resultado es **201/201 archivos, 1527/1527 tests, 0 fallos**, no el
      baseline histórico. La primera corrida completa de este work unit sí encontró 2 fallos reales
      (no el flake): `ObraSocialesPage.test.tsx` sin `PrestadorRepositoryProvider` al navegar a modo
      edición — corregido (ver nota de apply de 5.3) y confirmado en la segunda corrida completa.
- [ ] 7.4 **BLOQUEADO — requiere a Enzo.** Aplicar las 2 migraciones de esta rama contra el proyecto
      real (`supabase db push`, verificando antes `supabase migration list --linked` por el
      desfasaje de historial ya conocido de otros changes de esta sesión): **corrección de
      nombre de archivo** (ver nota de deviación de §1, actualizada en work unit 4) — el archivo
      único `20260801100000_prestadores_condiciones_y_vinculo.sql` que design.md describe
      conceptualmente se dividió en dos archivos reales,
      `20260801100000_prestadores_condiciones.sql` (columnas planas, work unit 1) y
      `20260801110000_prestadores_vinculo_obra_social.sql` (tabla de vínculo + RLS + trigger, work
      unit 4) — ninguna sentencia SQL distinta, aplicar ambas en orden.
- [ ] 7.5 **BLOQUEADO — requiere a la usuaria / Enzo.** Verificación manual en navegador
      (`npm run dev`) con 3 cuentas: `obra_social: write` (alta/edición de Prestador, vincular y
      desvincular ObrasSociales); `obra_social: read` sin `write` (solo lectura, sin guardado
      fantasma, `AvisoSoloLectura` visible); cuenta de otro módulo (`pacientes`) para confirmar que
      `/prestadores` no aparece. No ejecutable hasta que 7.4 aplique la migración.
- [ ] 7.6 **BLOQUEADO — requiere a la usuaria / Enzo.** Verificar en `auditoria.logs` que un alta de
      Prestador y un cambio de vínculo (agregar + quitar una ObraSocial) dejaron rastro en
      `obra_social.prestadores` y `obra_social.obra_social_prestador` respectivamente. No ejecutable
      hasta 7.4.
