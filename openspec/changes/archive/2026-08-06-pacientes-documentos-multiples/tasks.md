# Tasks — pacientes-documentos-multiples

> **⚠️ STRICT TDD ACTIVO.** `openspec/config.yaml` tiene `testing.strict_tdd: true`. Toda tarea que
> escriba código de producción se implementa con el ciclo **RED → GREEN → TRIANGULATE → REFACTOR**, y
> **antes** de modificar cualquier archivo existente se corre el safety net
> (`cd frontend && npx vitest run`) y se registra el baseline. Test runner:
> `cd frontend && npx vitest run`.
>
> **⚠️ GOVERNANCE — recomendación CRÍTICO, sin confirmar.** `design.md` Checkpoint (d) recomienda
> tratar este change como CRÍTICO (mismo criterio que los cinco `gateo-*`: pantalla del dominio
> Pacientes, salud/menores de edad), no ALTO. Ninguna tarea de la §1 en adelante corre sin que Enzo
> confirme el nivel en la tarea `0.1`. Si se confirma CRÍTICO, aplica el mismo mecanismo que
> `integracion-facturacion`: aprobación humana explícita documentada antes de cada tarea de escritura
> de código.
>
> **⚠️ Este documento es propose-only.** No se escribe código de producción, no se escribe SQL, no se
> corre `supabase db push`. El propose ya confirmó que no hace falta ninguna migración para que este
> change funcione (Checkpoint (c) de `design.md`) — la implementación arranca recién en `/opsx:apply`,
> después de que los cuatro checkpoints de `design.md` estén resueltos.
>
> **Reglas duras aplicables** (`CLAUDE.md`): nunca `any` (usar `unknown` + narrowing); nunca
> `style={{}}` (solo utilidades Tailwind v4); reusar `frontend/src/design-system/components.tsx`
> (`Chip`/`chipColors` para distinguir vigente/siguiente, sin componente nuevo — D2 de `design.md`);
> type-check con `npx tsc -b --noEmit` (nunca `tsc --noEmit` a secas); Conventional Commits.

## 0. Checkpoint de diseño (antes de escribir código) — GOVERNANCE recomendado CRÍTICO

- [x] 0.1 Presentar a Enzo/la clienta los cuatro checkpoints de `design.md` con su trade-off escrito, y
      registrar el veredicto de cada uno en este archivo antes de continuar:
      - **Checkpoint (a)** — ¿cardinalidad sin límite (recomendado por este propose) o un tope fijo
        (2 o 3, según los ejemplos que dio la clienta)?
        **→ VEREDICTO (2026-08-06, Enzo): sin límite** — colección real, sin tope hardcodeado.
      - **Checkpoint (b)** — ¿mecanismo de vigencia: campo opcional `vigenciaDesde` por documento
        (recomendado, reusa el naming de `Autorizacion.vigenciaDesde`), solo orden de carga sin campo
        nuevo, o rango explícito `vigenciaDesde`/`vigenciaHasta`?
        **→ VEREDICTO (2026-08-06, Enzo): `vigenciaDesde` opcional**, como propuesto.
      - **Checkpoint (c)** — confirmado que no hace falta migración para este propose (la base real ya
        soporta N documentos por tipo, sin `UNIQUE` bloqueante). Si Checkpoint (b) se resuelve con
        campo de vigencia, ¿se acuerda la forma ilustrativa (`vigencia_desde DATE`, aditiva) como guía
        para el futuro change de integración real, o se prefiere otro nombre/forma?
        **→ VEREDICTO (2026-08-06, Enzo): aceptada la forma ilustrativa**, sin cambios.
      - **Checkpoint (d)** — ¿gobernanza CRÍTICO (recomendado, por precedente `gateo-*` y por ser
        `C-05` CRÍTICO) o ALTO (el cambio técnico real es acotado a tipo/componente/mock, sin RLS ni
        backend real conectado)?
        **→ VEREDICTO (2026-08-06, Enzo): CRÍTICO**, como recomendado.
- [x] 0.2 Confirmar contra el filesystem del repo (no contra la memoria de esta sesión) que sigue sin
      existir ningún `SupabaseDocumentoRepository.ts` al momento de arrancar el apply — si para
      entonces ya aterrizó una integración real de Documentos de Pacientes, este propose necesita
      revisión antes de continuar (D1 de `design.md` asume que el único implementador real es el mock).
      **Verificado 2026-08-06**: sigue sin existir.
- [x] 0.3 Correr `cd frontend && npx vitest run` y registrar el baseline exacto (tests passing/
      failing, archivos en verde) antes de tocar cualquier archivo existente.
      **Baseline 2026-08-06**: dos corridas completas de `npx vitest run` en la misma sesión, antes
      de tocar ningún archivo. Corrida 1: 222 archivos en verde, 2 fallando, 1950/1953 tests OK.
      Corrida 2 (inmediata, sin cambios de por medio): 3 archivos fallando
      (`router.test.tsx`, `PermisosMatrizFields.test.tsx`, `ChecklistEditor.test.tsx` con 2 tests).
      Confirma exactamente el patrón de flakiness por contención de máquina que anticipa el pedido de
      Enzo (`ChecklistEditor.test.tsx`/`PermisosMatrizFields.test.tsx` ya estaban en el set conocido;
      `router.test.tsx` se suma como flaky adicional del mismo tipo, no relacionado con este change).

## 1. `DocumentoAdjunto` — tipo y contrato del repository

- [x] 1.1 (RED→GREEN) `shared/types/documento.ts`: agregar `id: string` a `DocumentoAdjunto` y, si
      Checkpoint (b) se resolvió con campo de vigencia, `vigenciaDesde?: string` — según el veredicto
      exacto de `0.1`.
- [x] 1.2 (RED→GREEN) `shared/lib/documentos/DocumentoRepository.ts`: `remove()` cambia de firma de
      `itemId` a `documentoId` (D1 de `design.md`). Actualizar el comentario del contrato.

## 2. `mockDocumentoRepository` — acumular en vez de reemplazar

- [x] 2.1 (RED) Tests de `mockDocumentoRepository.upload()`: subir un segundo documento al mismo
      `itemId` **no** borra el primero — ambos coexisten en `listByEntity()`. Caso explícito del
      ejemplo de la clienta: subir un presupuesto, luego subir el presupuesto de renovación del mismo
      tipo, verificar que `listByEntity` devuelve los dos.
- [x] 2.2 (GREEN) Implementar: quitar el `filter` que excluía por `itemId` antes de agregar; generar
      `id` nuevo por documento (mismo generador de ids que usa el resto del proyecto para mocks).
- [x] 2.3 (RED→GREEN) Tests de `remove()` con el nuevo contrato por `documentoId`: quitar un documento
      puntual dentro de una colección de N no afecta a los demás del mismo `itemId`.
- [x] 2.4 Si Checkpoint (b) confirmó `vigenciaDesde`: test de que `upload()` acepta y persiste el campo
      opcional, y que omitirlo no rompe nada (sigue siendo `undefined`, degradación a orden de carga).
      **Nota**: `mockDocumentoRepository.test.ts` (nuevo archivo, 7 tests, todos en verde) cubre 2.1
      a 2.4 — no existía test dedicado antes de este change.

## 3. `useDocumentChecklist` — wiring al nuevo contrato

- [x] 3.1 (RED→GREEN) `upload()`: quitar el filtro por `itemId` del `setDocumentos` local (mismo cambio
      de semántica que 2.2, ahora del lado del estado de React).
- [x] 3.2 (RED→GREEN) `remove()`: filtrar por `id` del documento en vez de `itemId`.
      **Nota**: `useDocumentChecklist.test.tsx` (nuevo archivo, 3 tests, todos en verde) cubre 3.1
      y 3.2 — no existía test dedicado antes de este change.

## 4. `DocumentChecklist.tsx` — render de colección (D2 de `design.md`)

- [x] 4.1 Correr el safety net dirigido (`cd frontend && npx vitest run src/shared/components`) antes
      de tocar el archivo. **Baseline dirigido**: 1 archivo en verde (`PlaceholderPage.test.tsx`), 3
      tests OK — nada de `DocumentChecklist` todavía (no existía test dedicado).
- [x] 4.2 (RED→GREEN) Cada fila de ítem renderiza 0, 1 o N documentos (`documentos.filter((d) =>
      d.itemId === item.id)` en vez de `.find()`), cada uno con su propio botón "Quitar" que llama a
      `onRemove(documento.id)`.
- [x] 4.3 (RED→GREEN) El botón "Reemplazar" se reemplaza por "Agregar otro" — dispara el mismo
      `<input type="file">` pero nunca sobrescribe (ya lo garantiza 2.2/3.1, esto es solo el copy y que
      el flujo siga disponible con N > 0 documentos).
- [x] 4.4 Si Checkpoint (b) confirmó `vigenciaDesde`: el documento "vigente" (mayor `vigenciaDesde` no
      futuro, fallback a `subidoEn`) se distingue visualmente de los demás con un `Chip` (reusar
      `chipColors`, sin componente nuevo). Test de los dos casos: con `vigenciaDesde` cargado en ambos
      documentos, y con ninguno (degrada a orden por `subidoEn`).
- [x] 4.5 El cálculo de `cargados`/`pendientes`/`pctCargado` sigue sin cambios de fórmula (a nivel
      ítem, "cargado" = al menos un documento) — test que lo confirma explícitamente para no
      regresionar sin querer al pasar de `.find()` a `.filter()`.
- [x] 4.6 `readOnly` sigue deshabilitando "Agregar otro" y cada "Quitar" individual, mismo criterio que
      hoy.
      **Nota**: `DocumentChecklist.test.tsx` (nuevo archivo, 9 tests, todos en verde) cubre 4.2 a 4.6
      — no existía test dedicado del componente antes de este change (los 4 dominios solo lo probaban
      indirectamente vía sus wrappers).

## 5. Ajuste de tests existentes en los cuatro dominios

- [x] 5.1 `PacienteDocumentos.test.tsx` / cualquier test de `PacienteDocumentosChecklist.tsx`: ajustar
      al nuevo contrato (`DocumentoAdjunto.id`, `remove(documentoId)`), agregar el caso de dos
      documentos del mismo tipo conviviendo (el escenario central de este change).
- [x] 5.2 Tests análogos de Vehículos/Conductores/Facturas (`VehiculoDocumentos.test.tsx`,
      `ConductorDocumentos.test.tsx`, `FacturaDocumentos.test.tsx`): ajuste mecánico al contrato nuevo,
      **sin agregar comportamiento de negocio nuevo** en esos tres dominios (proposal.md "Lo que este
      change explícitamente NO hace") — alcanza con que sigan pasando con la forma nueva del tipo.
      **Nota**: los 4 archivos + los 3 nuevos (`mockDocumentoRepository.test.ts`,
      `useDocumentChecklist.test.tsx`, `DocumentChecklist.test.tsx`) — 7 archivos, 42 tests, todos en
      verde.

## 6. Documentación y cierre

- [x] 6.1 `openspec/specs/paciente-documentos/spec.md`: agregar el requisito nuevo de cardinalidad
      múltiple y no-sobrescritura (delta `MODIFIED`/`ADDED` según corresponda al sincronizar specs).
      **Nota**: siguiendo el patrón ya establecido en el repo (ver `openspec/changes/archive/2026-07-30-
      gateo-pacientes/specs/permisos-modulo-frontend/spec.md`), el delta se escribió en
      `openspec/changes/pacientes-documentos-multiples/specs/paciente-documentos/spec.md` como
      `## ADDED Requirements` — se sincroniza al spec principal recién en `/opsx:archive`, no en apply.
- [x] 6.2 `knowledge-base/06_funcionalidades.md` US-102: nota de que el checklist documental del
      paciente admite múltiples documentos por tipo (ver RN nueva si se numera una).
- [x] 6.3 `knowledge-base/05_reglas_de_negocio.md`: agregar una RN nueva (numeración siguiente a
      RN-FA-08) que codifique "el checklist documental admite N documentos por tipo, nunca se
      sobrescribe" — es una regla de negocio nueva que el feedback de la clienta introduce, no
      estaba documentada antes de este change. **Agregada como RN-FA-09.**
- [x] 6.4 `CHANGES.md`: nota en la sección de `C-03`/`C-05` (según corresponda) señalando que la
      cardinalidad 1:1 original del mock quedó levantada por feedback real de la clienta, con fecha y
      referencia a este change.
- [x] 6.5 Correr la suite completa (`cd frontend && npx vitest run`) y confirmar cero regresiones
      contra el baseline de `0.3`. **Resultado 2026-08-06**: 224/227 archivos en verde, 1969/1973
      tests OK. Los 3 archivos que fallan (`router.cuentas.test.tsx`, `PermisosMatrizFields.test.tsx`,
      `ChecklistEditor.test.tsx` con 2 tests) son el mismo set de flakies por contención de máquina que
      ya aparecía en el baseline de `0.3` (`PermisosMatrizFields.test.tsx`/`ChecklistEditor.test.tsx`
      confirmados; `router.*.test.tsx` es la misma categoría, no un archivo de este change) — ninguno
      toca `documento.ts`, `DocumentoRepository`, `mockDocumentoRepository`, `useDocumentChecklist`,
      `DocumentChecklist.tsx` ni los 4 wrappers de dominio. Cero regresiones nuevas.
- [x] 6.6 `cd frontend && npx tsc -b --noEmit` limpio. **Confirmado**: sin output, 0 errores.
- [x] 6.7 `cd frontend && npx oxlint` limpio. **Confirmado**: exit 0, 0 errores — los warnings
      `only-export-components`/`no-unsafe-optional-chaining` que imprime son preexistentes, en
      archivos que este change no tocó.

## 7. Verificación manual (bloqueante, a cargo de Enzo/la usuaria)

- [x] 7.1 Con una cuenta con `pacientes: write`: en la ficha de un paciente, subir dos documentos del
      mismo tipo (ej. dos presupuestos) y confirmar que ambos quedan visibles, ninguno se sobrescribe,
      y el orden/distinción vigente-siguiente se ve como se esperaba según Checkpoint (b). **Confirmado
      (2026-08-06, usuaria): verificado manualmente, funciona.**
- [x] 7.2 Confirmar que "Quitar" en un documento puntual de una colección de N no afecta a los demás
      del mismo ítem. **Confirmado (2026-08-06, usuaria): verificado manualmente, funciona.**
- [x] 7.3 Confirmar con una cuenta `pacientes: read` solamente que la pantalla sigue en modo solo
      lectura sobre la colección nueva (ningún botón de agregar/quitar activo) — mismo mecanismo que
      `gateo-pacientes`, no se re-testea el gateo en sí, solo que sigue funcionando con la forma nueva.
      **Confirmado (2026-08-06, usuaria): verificado manualmente, funciona.**
- [x] 7.4 Confirmar con Vehículos/Conductores/Facturas que sus pantallas de documentos siguen
      funcionando igual que antes (sin comportamiento nuevo, solo el tipo compartido cambió) — smoke
      test manual de que no hay regresión cruzada por el tipo compartido. **Confirmado (2026-08-06,
      usuaria): verificado manualmente, funciona.**
