# Tasks — documentos-previsualizacion

> **⚠️ STRICT TDD ACTIVO.** `openspec/config.yaml` tiene `testing.strict_tdd: true`. Toda tarea que
> escriba código de producción se implementa con el ciclo **RED → GREEN → TRIANGULATE → REFACTOR**, y
> **antes** de modificar cualquier archivo existente se corre el safety net
> (`cd frontend && npx vitest run`) y se registra el baseline. Test runner:
> `cd frontend && npx vitest run`.
>
> **⚠️ GOVERNANCE — recomendación CRÍTICO, sin confirmar.** `design.md` Checkpoint (c) recomienda
> tratar este change como CRÍTICO, por dos motivos: (1) precedente inmediato —
> `pacientes-documentos-multiples` (aplicado 2026-08-06) se declaró CRÍTICO por tocar la pantalla del
> dominio Pacientes; (2) este change **abre una superficie de lectura nueva sobre documentos
> clínicos**, que es exactamente lo que `integracion-documentos` §D7 evitó a propósito. Ninguna tarea
> de la §1 en adelante corre sin que Enzo confirme el nivel en la tarea `0.1`. Si se confirma CRÍTICO,
> aplica aprobación humana explícita documentada antes de cada tarea de escritura de código.
>
> **⚠️ Este documento es propose-only.** No se escribe código de producción, no se escribe SQL, no se
> corre `supabase db push`. Este change **no crea ninguna tabla nueva**, así que la regla dura de RLS
> ("toda tabla nueva define sus policies en el mismo change") no se activa — confirmado
> explícitamente, no asumido. La implementación arranca recién en `/opsx:apply`, después de que los
> cinco checkpoints de `design.md` estén resueltos.
>
> **⚠️ Los checkpoints (a) y (b) pueden cambiar el alcance y hasta el nombre de este change.** El (a)
> decide si el change es aplicable hoy o queda bloqueado detrás de `integracion-documentos` (1/55
> tasks). El (b) decide si absorbe la descarga (`documentos-descarga-firmada`). **No empezar por §1
> sin esos dos veredictos.**
>
> **Reglas duras aplicables** (`CLAUDE.md`): nunca `any` (usar `unknown` + narrowing); nunca
> `style={{}}` (solo utilidades Tailwind v4, valores desde el `@theme` de `frontend/src/index.css`);
> **revisar `frontend/src/design-system/components.tsx` antes de escribir markup** — acá el componente
> de ventana **no existe** (verificado: ningún export `Modal`/`Dialog`/`Drawer`/`Sheet`/`Popover`), así
> que este change **lo crea ahí**, nunca ad-hoc dentro de `DocumentChecklist.tsx`; nunca
> `SUPABASE_SERVICE_ROLE_KEY` desde frontend; type-check con `npx tsc -b --noEmit` (nunca
> `tsc --noEmit` a secas); Conventional Commits.

## 0. Checkpoints de diseño (antes de escribir código) — GOVERNANCE recomendado CRÍTICO

- [x] 0.1 Presentar a Enzo/la clienta los cinco checkpoints de `design.md` con su trade-off escrito, y
      registrar el veredicto de cada uno en este archivo antes de continuar:
      - **Checkpoint (a) — ¿qué se previsualiza, si hoy no se guarda nada?** El mock descarta el
        `File` y `DocumentoAdjunto` no tiene campo de contenido. Opción A: mock previsualizable con
        `ObjectURL` (recomendada — el change es autocontenido y aplicable ya). Opción B: bloquear
        hasta `integracion-documentos` (1/55 tasks). Opción C: híbrido, contrato + componente ahora
        con estado degradado explícito.
        **→ VEREDICTO (2026-08-06): Opción A** — mock previsualizable con `ObjectURL`, como recomendado.
      - **Checkpoint (b) — ¿qué pasa con `documentos-descarga-firmada`?** Hallazgo: ese change **no
        existe** como carpeta, **no está** en `CHANGES.md`, y la anotación que
        `integracion-documentos` §D6 prometió dejar en `10_preguntas_abiertas.md` **nunca se
        escribió**. Opción B1: fusionar (este change cubre ver + bajar, cierra US-900 completo).
        Opción B2 (recomendada): complementarios por capa — este es la UI contra mock, el otro se
        reformula como la resolución real + descarga. Opción B3: dejarlos separados (= el estado
        actual, que es el problema).
        **→ VEREDICTO (2026-08-06): Opción B2** — complementarios por capa, como recomendado.
      - **Checkpoint (c) — gobernanza: ¿CRÍTICO, ALTO o MEDIO?** Recomendado CRÍTICO (precedente
        `pacientes-documentos-multiples` + apertura deliberada de una superficie de lectura sobre datos
        clínicos, revirtiendo la postura explícita de `integracion-documentos` §D7).
        **→ VEREDICTO (2026-08-06): CRÍTICO**, como recomendado.
      - **Checkpoint (d) — el componente nuevo del design system.** Forma (overlay centrado con
        backdrop / panel inline / drawer — recomendado overlay, D-i), nombre (castellano específico vs.
        inglés genérico, según el patrón ya vigente en `components.tsx`), y alcance (genérico
        reutilizable vs. cerrado a documentos). Incluye resolver por escrito la **tensión con
        `knowledge-base/08_arquitectura_propuesta.md:28** (*"nunca como modal"*) — que este propose lee
        como una regla sobre **formularios de edición**, no sobre superficies de solo lectura.
        **→ VEREDICTO (2026-08-06): overlay centrado con backdrop (D-i), genérico y reutilizable, en
        `components.tsx`**, como recomendado — la tensión con "nunca modal" se resuelve por escrito ahí
        mismo (regla sobre formularios de edición, no sobre superficies de solo lectura).
      - **Checkpoint (e) — formatos y visor.** `accept="image/*,.pdf"` define el universo. Recomendado:
        `<img>` para imágenes, `<iframe>` nativo **sandboxeado** para PDF, sin dependencias nuevas; y
        estado explícito de "no previsualizable" para todo lo demás.
        **→ VEREDICTO (2026-08-06): `<img>` + `<iframe>` sandboxeado**, como recomendado, sin
        dependencias nuevas.
- [x] 0.2 Confirmar contra el filesystem del repo (no contra la memoria de esta sesión) que al arrancar
      el apply sigue sin existir `frontend/src/shared/lib/documentos/SupabaseDocumentoRepository.ts` y
      que `integracion-documentos` sigue sin aplicarse
      (`grep -c '\[x\]' openspec/changes/integracion-documentos/tasks.md`). Si para entonces ya
      aterrizó, **este propose necesita revisión completa**: los checkpoints (a) y (b) cambian de
      respuesta y D2 deja de ser un método nuevo sobre un contrato que solo implementa el mock.
      **Estado al momento del propose (2026-08-06)**: no existe el archivo; `integracion-documentos`
      en 1 de 55 tasks.
      **Re-confirmado al arrancar el apply (2026-08-06)**: `find frontend/src/shared/lib/documentos`
      NO lista `SupabaseDocumentoRepository.ts` (solo `DocumentoRepository.ts`,
      `mockDocumentoRepository.ts` + sus `.test.*`, `useDocumentChecklist.ts` + `.test.tsx`).
      `grep -c '\[x\]' openspec/changes/integracion-documentos/tasks.md` → `1` (de 55, verificado con
      `grep -c '\[ \]\|\[x\]'`). **Sin cambios respecto del estado documentado — los checkpoints (a) y
      (b) siguen vigentes.** Adicionalmente se confirmó que `mockDocumentoRepository` es el único
      objeto tipado como `DocumentoRepository` en `frontend/src` (ver 1.3).
- [x] 0.3 Correr `cd frontend && npx vitest run` y registrar el baseline exacto (tests passing/failing,
      archivos en verde) antes de tocar cualquier archivo existente. **Nota heredada del baseline de
      `pacientes-documentos-multiples` (2026-08-06)**: hay flakiness conocida por contención de máquina
      en `router.test.tsx`, `PermisosMatrizFields.test.tsx` y `ChecklistEditor.test.tsx` — correr dos
      veces y registrar ambas corridas. Un fallo en esos tres archivos es **pre-existente**, no se
      arregla en este change: se reporta.
      **Baseline real registrado al arrancar el apply (2026-08-06), dos corridas de
      `cd frontend && npx vitest run`:**
      - Corrida 1: `Test Files 21 failed | 206 passed (227)` · `Tests 126 failed | 1850 passed (1976)`
        · Duration 123.16s.
      - Corrida 2: `Test Files 21 failed | 206 passed (227)` · `Tests 126 failed | 1850 passed (1976)`
        · Duration 108.66s.
      - **Ambas corridas fallan exactamente en los mismos 21 archivos** (no varía entre corridas, no es
        random-flaky): `src/app/AppShell.test.tsx`, `src/app/router.cuentas.test.tsx`,
        `src/app/router.test.tsx`, `src/features/conductores/ConductoresRoute.test.tsx`,
        `src/features/cuentas/PermisosMatrizFields.test.tsx`,
        `src/features/facturacion/FacturacionRoute.test.tsx`,
        `src/features/obras-sociales/ChecklistEditor.test.tsx`,
        `src/features/obras-sociales/ObraSocialesRoute.test.tsx`,
        `src/features/pacientes/PacientesRoute.test.tsx`,
        `src/features/presupuestos/PresupuestosRoute.test.tsx`,
        `src/features/vehiculos/VehiculosRoute.test.tsx`, y los 10 `shared/lib/mocks/mock*Repository.test.ts`
        (Autorizacion, Cobro, Conductor, Factura, HojaDeRuta, ObraSocial, Paciente, Prestador,
        Presupuesto, Vehiculo).
      - **⚠️ Esto excede lo documentado arriba** (solo 3 archivos con flakiness conocida). El síntoma
        dominante es `TypeError: Cannot read properties of undefined (reading 'clear')` sobre
        `localStorage` en `beforeEach`, y los tiempos de `environment` reportados por vitest
        (716.41s / 629.28s de wall-clock 108-123s) indican contención real del pool de workers jsdom
        en esta máquina en este momento, consistente con la causa ya anotada (contención), pero con
        alcance mayor al descripto. **Ninguno de los 21 archivos pertenece a `documentos/` ni es tocado
        por la §1 de este pase** (que solo toca `shared/types/documento.ts` y
        `shared/lib/documentos/DocumentoRepository.ts`), así que no bloquea el safety net específico de
        §1 — pero se deja registrado tal cual, sin minimizarlo, para que quien continúe con §2 en
        adelante sepa que el baseline real es peor que el anotado y no asuma que solo son 3 archivos.
        No se investiga ni se arregla en este pase (pre-existente, fuera de alcance de
        `documentos-previsualizacion`).
- [x] 0.4 Si el Checkpoint (c) se confirma CRÍTICO: documentar la aprobación humana explícita antes de
      arrancar la §1, y repetirla antes de la §5 (el corte visible).
      **Aprobación humana explícita para arrancar la §1 (2026-08-06)**: los cinco checkpoints (a)-(e)
      de `design.md` fueron confirmados por el usuario en esta sesión vía respuestas explícitas a cada
      uno (veredictos registrados arriba en 0.1: A, B2, CRÍTICO, D-i genérico en `components.tsx`,
      `<img>`+`<iframe>` sandboxeado). Gobernanza CRÍTICA reconocida y respetada: la §1 no escribe SQL,
      no toca RLS, no toca buckets ni usa `SUPABASE_SERVICE_ROLE_KEY` — es tipo + contrato puros. La
      aprobación para la §5 (el corte visible, donde el usuario ve algo por primera vez) **queda
      pendiente** y debe repetirse explícitamente antes de esa sección, como exige este mismo punto.

## 1. Tipo compartido y contrato del repository (D1, D2 de `design.md`)

> Invisible para el usuario. Nadie consume esto todavía.

- [x] 1.1 (RED→GREEN→TRIANGULATE) `shared/types/documento.ts`: agregar a `DocumentoAdjunto` el campo
      opcional de tipo de contenido (`tipoMime?: string` según D1, sujeto al veredicto de (a)).
      **Opcional a propósito**: los documentos ya cargados antes de este change no lo tienen. Respetar
      el principio del encabezado del archivo — el campo va al **tipo compartido**, nunca a un tipo
      paralelo por dominio.
      **Hecho (2026-08-06)**, mismo patrón que `vehiculo.notas.types.test.ts` /
      `conductor.restricciones.types.test.ts` (señal RED/GREEN real = `tsc -b --noEmit`, `vitest run`
      no type-checkea): test nuevo
      `frontend/src/shared/types/documento.tipoMime.types.test.ts`. RED confirmado (tsc: 3 errores
      `TS2353`/`TS2339` sobre `tipoMime`) → campo agregado a `DocumentoAdjunto` con comentario de
      contrato → GREEN confirmado (`tsc -b --noEmit` exit 0). Triangulado: con `tipoMime` y sin
      `tipoMime` (2 casos). `npx vitest run` sobre el archivo: 2/2 passed (complemento runtime, no la
      señal RED/GREEN).
- [x] 1.2 (RED→GREEN) `shared/lib/documentos/DocumentoRepository.ts`: agregar
      `resolverPrevisualizacion(entidad, entidadId, documentoId): Promise<string | null>` con el
      comentario de contrato que explique por qué es **bajo demanda y no un campo persistido** (el
      resultado es efímero: `ObjectURL` en mock, URL firmada con expiración contra Storage privado).
      Distinguir por contrato: `null` = "no hay nada que previsualizar" (caso normal); throw = fallo
      real (permiso, red, expiración).
      **Hecho (2026-08-06)**: test nuevo
      `frontend/src/shared/lib/documentos/DocumentoRepository.previsualizacion.types.test.ts`, con un
      stub local (no `mockDocumentoRepository` — ese es §2, fuera de alcance) tipado contra la
      interfaz. RED confirmado (tsc: `TS2353` propiedad inexistente + `TS7006` implicit any en los
      parámetros del stub, porque el método no existía todavía) → método agregado a la interfaz con el
      comentario de contrato (D2) → GREEN confirmado sobre el stub. Triangulado en el stub: URL
      resuelta, `null` (sin contenido), error real (rechaza con `.rejects.toThrow()`) — 3 casos.
      `npx vitest run` sobre el archivo: 3/3 passed.
- [x] 1.3 Triangulación de tipos: verificar con `npx tsc -b --noEmit` que agregar el método **rompe**
      cualquier implementación de `DocumentoRepository` que no lo tenga — y confirmar que el único
      implementador hoy es `mockDocumentoRepository` (si aparece otro, volver a `0.2`).
      **Verificado (2026-08-06)**: `npx tsc -b --noEmit` pasa a fallar apenas se agrega el método (era
      GREEN antes de 1.2). `grep -rln ": DocumentoRepository = {" src --include="*.ts" --include="*.tsx" | grep -v ".test."`
      confirma que `mockDocumentoRepository.ts` sigue siendo el **único implementador de producción**
      — 0.2 y los checkpoints (a)/(b) **siguen vigentes**, no hace falta volver a 0.2.
      **Hallazgo que 1.3 no anticipaba** (el texto original decía "el único implementador hoy es
      `mockDocumentoRepository`", en singular, un solo archivo roto): el radio real de ruptura de
      `tsc -b --noEmit` son **16 archivos**, no 1 — `mockDocumentoRepository.ts` (producción) **+ 15
      archivos `*.test.tsx`/`*.test.ts`** que construyen objetos tipados contra `DocumentoRepository`
      como test doubles/fakes para inyectar en tests de componentes. Lista exacta, extraída de
      `npx tsc -b --noEmit | sed -E 's/\(.*//' | sort -u` (verificada dos veces): `ConductorDetail.test.tsx`,
      `ConductorDocumentos.test.tsx`, `ConductoresPage.test.tsx`, `FacturaDetail.test.tsx`,
      `FacturaDocumentos.test.tsx`, `FacturacionPage.test.tsx`,
      `PresupuestosFacturacionCoherencia.test.tsx`, `HojaDeRutaPage.coherencia.test.tsx`,
      `PacienteDetail.test.tsx`, `PacienteDocumentos.test.tsx`, `PacientesPage.test.tsx`,
      `VehiculoDetail.test.tsx`, `VehiculoDocumentos.test.tsx`, `VehiculosPage.test.tsx`,
      `useDocumentChecklist.test.tsx` (15 test files) + `mockDocumentoRepository.ts` (producción).
      **Nota**: `ConductoresRoute.test.tsx` y `VehiculosRoute.test.tsx` (que sí aparecen en el baseline
      de fallos de `vitest` de 0.3, por la causa no relacionada de contención de máquina) **no**
      aparecen acá — son dos listas distintas, de dos herramientas distintas, no confundir. Son fakes
      de test, **no** implementaciones de producción — no invalidan (a)/(b) — pero **quien continúe con
      §2/§6 tiene que actualizar estos 15 archivos de test** además de `mockDocumentoRepository.ts`, no
      solo el mock. Se deja anotado acá para que no se descubra recién en §6. **Estado deliberado al
      cierre de este pase**: `npx tsc -b --noEmit` queda en rojo (16 archivos) — es el resultado
      esperado y buscado por esta tarea, no un error a corregir en este pase (arreglarlo es §2/§6,
      fuera de alcance).

## 2. `mockDocumentoRepository` — conservar el contenido y resolverlo

> Condicionado al veredicto del Checkpoint (a). Si sale Opción B, esta sección entera no se hace y el
> change se detiene acá.

- [x] 2.1 (RED→GREEN) `mockDocumentoRepository.upload()`: dejar de descartar el `File`. Guardar el
      binario (o su `ObjectURL`) en el store interno junto al `DocumentoAdjunto`, y poblar `tipoMime`
      desde `file.type`. **La forma pública de `DocumentoAdjunto` que devuelve `upload()` no cambia
      más allá del campo nuevo** — la URL no viaja en el modelo (D1).
      **Hecho (2026-08-06)**: safety net previo (`mockDocumentoRepository.test.ts`, único archivo
      modificado por esta tarea) registrado en verde — 7/7 passing antes de tocar nada. Nuevo Map
      interno `contenidoPorDocumentoId` (documentoId → ObjectURL), separado del `store` público —
      la URL nunca viaja en `DocumentoAdjunto` (D1). RED confirmado: 3 tests nuevos fallando
      (`tipoMime` undefined, `createObjectURL` no llamado). `upload()` ahora hace
      `contenidoPorDocumentoId.set(nuevo.id, URL.createObjectURL(file))` y puebla
      `tipoMime: file.type || undefined`. GREEN confirmado. Triangulado: `tipoMime` poblado, forma
      pública del objeto sin campos de URL (`Object.keys` exacto), `URL.createObjectURL` llamado
      con el mismo `File` recibido (spy).
- [x] 2.2 (RED→GREEN→TRIANGULATE) Implementar `resolverPrevisualizacion()`: devuelve el `ObjectURL`
      del documento pedido, o `null` si ese `id` no tiene contenido asociado. Triangular al menos:
      documento con contenido, documento sin contenido (cargado "antes"), `id` inexistente.
      **Hecho (2026-08-06)**: RED confirmado (`resolverPrevisualizacion is not a function` sobre el
      mock — el stub de 1.2 no cuenta, es un objeto distinto). Implementado: valida pertenencia del
      `documentoId` contra `listByEntity` de esa `entidad`/`entidadId` (no solo el store de
      contenido, para no filtrar existencia de documentos de otra entidad) y, si pertenece, devuelve
      `contenidoPorDocumentoId.get(documentoId) ?? null`. GREEN confirmado. Triangulado en 3 casos
      reales (no fake-it): (1) documento con contenido → URL real vía `createObjectURL`; (2)
      documento sin contenido "cargado antes" → construido con un test seam nuevo,
      `seedDocumentoSinContenidoParaTest(entidad, entidadId, documento)` (export adicional del
      módulo, **no** parte de la interfaz `DocumentoRepository` ni usado fuera de tests — necesario
      porque, desde 2.1, la API pública `upload()` siempre guarda contenido, así que no hay forma de
      producir por la API pública un documento "viejo" sin contenido; se deja documentado en el
      propio archivo de producción, comentario arriba de la función) → `null`; (3) `id` inexistente
      → `null`. Nota: (2) y (3) devuelven `null` por el mismo camino de código (no pertenece a la
      lista o no tiene contenido) — es el comportamiento correcto según el contrato D2 ("`null` = no
      hay nada que previsualizar, caso normal"), no una limitación del test.
- [x] 2.3 (RED→GREEN) `remove()`: al quitar un documento, **revocar su `ObjectURL`**
      (`URL.revokeObjectURL`) para no filtrar memoria. Test que verifique que se llama.
      **Hecho (2026-08-06)**: RED confirmado (`revokeObjectURL` 0 llamadas esperando 1). `remove()`
      ahora, tras filtrar el documento del `store`, busca su URL en `contenidoPorDocumentoId`, llama
      `URL.revokeObjectURL(url)` y borra la entrada del Map. GREEN confirmado. Triangulado: (1) spy
      sobre `URL.revokeObjectURL` llamado exactamente 1 vez al remover un documento con contenido;
      (2) tras `remove()`, `resolverPrevisualizacion()` para ese mismo id vuelve a resolver `null`
      (consistencia end-to-end, no solo el spy).
- [x] 2.4 Confirmar que **no** hace falta `SCHEMA_VERSION` (D6 de `design.md`): el store sigue siendo
      un `Map` en memoria de sesión, sin `localStorage`, así que no hay dato viejo que migrar. Dejarlo
      escrito como comentario en el archivo, no solo en el design.
      **Hecho (2026-08-06)**: comentario agregado en `mockDocumentoRepository.ts`, arriba de la
      declaración de `contenidoPorDocumentoId` — explica que sigue siendo memoria de sesión pura (un
      segundo `Map`, ningún `localStorage`), que no hace falta `SCHEMA_VERSION` porque no hay dato
      persistido con forma vieja que migrar, y que el `File`/`Blob` detrás del `ObjectURL` tampoco
      sería serializable si algún día se agregara persistencia (decisión aparte, fuera de este
      change). No es solo la nota de `design.md` — vive en el propio archivo de producción.
      **Verificación de cierre de §2 (2026-08-06)**: `cd frontend && npx tsc -b --noEmit` sigue en
      rojo pero bajó de 16 a **15 archivos** — comparado exactamente contra la lista de 1.3:
      `mockDocumentoRepository.ts` **ya no aparece** (el mock ahora implementa
      `resolverPrevisualizacion()` con la firma completa). Quedan los 15 test doubles/fakes
      señalados en 1.3, sin cambios en la lista: `ConductorDetail.test.tsx`,
      `ConductorDocumentos.test.tsx`, `ConductoresPage.test.tsx`, `FacturaDetail.test.tsx`,
      `FacturaDocumentos.test.tsx`, `FacturacionPage.test.tsx`,
      `PresupuestosFacturacionCoherencia.test.tsx`, `HojaDeRutaPage.coherencia.test.tsx`,
      `PacienteDetail.test.tsx`, `PacienteDocumentos.test.tsx`, `PacientesPage.test.tsx`,
      `VehiculoDetail.test.tsx`, `VehiculoDocumentos.test.tsx`, `VehiculosPage.test.tsx`,
      `useDocumentChecklist.test.tsx` — se ajustan en §6, fuera de alcance de esta pasada.
      `cd frontend && npx vitest run src/shared/lib/documentos/mockDocumentoRepository.test.ts`:
      15/15 passed (7 preexistentes de `pacientes-documentos-multiples` + 8 nuevos de §2).
      `npx oxlint` sobre `mockDocumentoRepository.ts` y su test: limpio, exit 0, sin hallazgos.
      **No se avanzó a §3.**

## 3. Componente de ventana en el design system (Checkpoint (d))

> Paralelizable con §1-§2: no depende del contrato de documentos. Esa independencia es justamente la
> razón de que el componente sea genérico y viva en el design system.

- [x] 3.1 (RED→GREEN→TRIANGULATE) Crear el componente en
      `frontend/src/design-system/components.tsx` con el nombre y la forma que fije el veredicto de
      (d). Requisitos mínimos, independientes del veredicto:
      - `createPortal` de `react-dom` — **precedente ya existente y justificado por escrito** en el
        propio archivo: `Tooltip` (`components.tsx:359`) lo usa para escapar del stacking context.
      - `role="dialog"` + `aria-modal="true"` + `aria-labelledby` apuntando a su título.
      - Cierre con `Escape` **y** con click en el backdrop.
      - Foco: mover el foco al abrir y **devolverlo al elemento que lo abrió** al cerrar.
      - Solo Tailwind v4, tokens del `@theme` (`border-border`, `bg-surface`, `text-ink`, `rounded-md`,
        `gap-*`) — cero `style={{}}`, mismo criterio que el resto de `components.tsx`.
      - Comentario en el propio componente declarando que es para **contenido de solo lectura** y que
        **no** es un vehículo para formularios de edición (`knowledge-base/08_arquitectura_propuesta.md`
        líneas 28 y 35).
      **Hecho (2026-08-06)**: componente `Overlay` (nombre elegido de los candidatos que dejó
      `design.md` — genérico en inglés, mismo criterio que `Button`/`Chip`/`Section`/`Table`, no
      `VentanaPrevisualizacion` porque el veredicto de 0.1 pidió explícitamente "genérico y
      reutilizable"). Safety net previo sobre `components.test.tsx` (único archivo existente
      tocado): 3/3 passing antes de escribir nada. RED confirmado: 7 tests nuevos en
      `frontend/src/design-system/components.test.tsx` (`describe('Overlay', …)`) fallando con
      `Element type is invalid… got: undefined` (import de un named export que no existía
      todavía) — señal real de runtime, no solo de tipos, mismo criterio que §2. Implementado:
      `useId()` genera el id del título internamente (el caller no maneja ids, a diferencia de
      `Panel` que sí lo expone — decisión deliberada para minimizar la superficie de API de un
      componente pensado para reuso amplio); `useRef` + dos `useEffect` para foco/Escape/trampa de
      Tab (documento-level `keydown`, no el nodo del diálogo, para que Escape funcione tenga el
      foco lo que tenga adentro); `createPortal(…, document.body)`. GREEN confirmado: 10/10 passing
      (3 preexistentes + 7 nuevos), corrido dos veces para descartar flakiness de foco/timing —
      estable en ambas corridas. Cero `style={{}}`: backdrop y contenedor usan solo clases
      Tailwind con tokens del `@theme` (`bg-ink/50`, `border-border`, `bg-surface`, `text-ink`,
      `rounded-md`, `gap-md`, `shadow-card`); el botón de cierre usa `InlineIcon` con un path SVG
      de X inline (no emoji, mismo criterio que el resto del archivo — se evaluó agregar el ícono a
      `icons.tsx` pero se descartó por no tener otro consumidor todavía, se deja el path inline
      dentro de `Overlay` para no ensanchar el catálogo compartido de íconos sin un segundo uso
      real). Comentario de contrato agregado arriba del componente, resolviendo por escrito la
      tensión con `knowledge-base/08_arquitectura_propuesta.md:28,35` ("nunca como modal" es sobre
      formularios de edición, no sobre superficies de solo lectura) — mismo texto que ya había
      quedado escrito en el veredicto de 0.1, ahora también en el código.
- [x] 3.2 Triangular accesibilidad y teclado: abrir/cerrar con `Escape`, cerrar con backdrop, foco
      devuelto, y que el contenido de fondo no sea alcanzable por tabulación mientras está abierto.
      **Hecho (2026-08-06)**, dentro del mismo ciclo RED→GREEN que 3.1 (7 tests, cada uno un caso
      distinto, no una sola prueba genérica): (1) `open=false` no renderiza nada; (2) `open=true`:
      `role="dialog"` + `aria-modal="true"` + `aria-labelledby` resuelve al `id` real del `<h2>`
      con el texto del título; (3) `Escape` llama `onClose` una vez; (4) click en el backdrop llama
      `onClose`, click dentro del contenido **no** lo llama (verificado con el mismo texto de
      contenido, para distinguir ambos casos); (5) al abrir, el contenedor del diálogo
      (`tabIndex={-1}`) recibe el foco (`toHaveFocus()`); (6) al cerrar con `Escape`, el foco vuelve
      al botón que abrió el overlay (`OverlayHost`, componente de test con estado real de
      open/close — necesario porque el efecto de devolución de foco depende del ciclo de vida real
      del componente, no se puede simular con props estáticas); (7) trampa de teclado: dentro del
      diálogo hay dos elementos tabulables (el botón "Cerrar" y un botón de contenido de ejemplo) —
      `Tab` desde el contenedor va a "Cerrar", después a "Botón interno", y un tercer `Tab` **vuelve
      a "Cerrar"** (wrap hacia adelante) en vez de escapar a "Botón de fondo" (fuera del diálogo,
      antes en el DOM); `Shift+Tab` desde "Cerrar" wrappea hacia atrás a "Botón interno". Nota:
      la primera versión de este test asumía un solo elemento tabulable adentro (solo "Botón
      interno") y falló en GREEN porque el botón "Cerrar" también es tabulable — se corrigió el
      test para reflejar los dos elementos reales, no se cambió el comportamiento del componente.
      `npx vitest run src/design-system/components.test.tsx`: 10/10 passing, dos corridas.
- [x] 3.3 Agregar la entrada de catálogo en `frontend/src/design-system/DesignSystem.tsx` — **no
      negociable**: es donde el resto del equipo descubre que el componente existe, y es lo que hace
      que la regla dura de "revisar el design system antes de escribir markup" siga funcionando.
      **Hecho (2026-08-06)**: `Overlay` agregado al import de `./components`; nueva `Section
      label="18"` con un botón que dispara un `OverlayCatalog` de ejemplo (mismo criterio que
      `DocumentosDemo` más arriba — demuestra el componente funcionando, no solo su forma
      estática) y un párrafo que explica el alcance genérico y la restricción de "no formularios de
      edición". `DesignSystem.tsx` no tiene test propio (no existía antes de este pase — mismo
      estado que el resto del catálogo, ej. la Section 10 de `DocumentChecklist`), así que la
      verificación de esta tarea es `npx tsc -b --noEmit` (sigue en los mismos 15 archivos rojos
      de §2, `DesignSystem.tsx` no aparece) — no hay ciclo RED→GREEN de test automatizado para
      esta tarea puntual, consistente con que tampoco lo tuvo la Section 10 (`DocumentChecklist`)
      cuando se agregó.
- [x] 3.4 (REFACTOR) Revisar que el componente no haya quedado acoplado a documentos: si tiene alguna
      referencia a `DocumentoAdjunto`, está en el archivo equivocado.
      **Verificado (2026-08-06)**: `grep -n "DocumentoAdjunto\|documento" frontend/src/design-system/components.tsx`
      no encuentra ningún import ni referencia de tipo a `DocumentoAdjunto` — las únicas coincidencias
      de "documento" son prosa de comentarios (uno preexistente de `useDesbordaViewport`, y el propio
      comentario de `Overlay` explicando que su primer consumidor será la previsualización de
      documentos pero que el componente "no sabe nada de documentos"). `Overlay` no importa nada de
      `shared/types/documento.ts` ni de `shared/lib/documentos/`. Sin cambios de código en esta tarea
      (la revisión confirmó que no hacía falta refactor). `npx tsc -b --noEmit` y
      `npx vitest run src/design-system/components.test.tsx` re-verificados después de esta
      confirmación: mismos resultados que 3.1/3.2 (15 archivos rojos preexistentes de §2, 10/10
      tests passing). `npx oxlint` sobre `components.tsx`, `components.test.tsx` y
      `DesignSystem.tsx`: exit 0, solo 2 warnings preexistentes de `react(only-export-components)`
      (línea de `export { chipColors }` y de `redondearProgreso`, ninguna introducida por `Overlay`
      — verificado que ambas ya existían antes de este pase). **No se avanzó a §4.**

## 4. `useDocumentChecklist` — exponer la resolución a la UI

- [x] 4.1 (RED→GREEN) Exponer desde el hook la capacidad de resolver la previsualización de un
      documento por su `id`, delegando en el repository inyectado. No guardar la URL en el estado del
      hook más allá de lo que dure la ventana abierta — es un dato efímero (D2).
      **Hecho (2026-08-06)**: safety net previo sobre `useDocumentChecklist.test.tsx` (único archivo
      de test existente tocado): 3/3 passing antes de escribir nada. RED confirmado: nuevo describe
      `'useDocumentChecklist — resolverPrevisualizacion() delega en el repository (tasks.md 4.1)'`
      fallando con `TypeError: result.current.resolverPrevisualizacion is not a function` (señal de
      runtime real, mismo criterio que 3.1/2.2 — no solo de tipos). Implementado: `resolverPrevisualizacion(documentoId)`,
      un `useCallback` que devuelve directo `repository.resolverPrevisualizacion(entidad, entidadId, documentoId)`,
      **sin** `useState` propio para la URL — se verificó leyendo el resto del hook (`upload`/`remove`)
      que el único estado persistido es `documentos`/`loading`; acá no se agrega ningún `useState`
      nuevo, la función es pura delegación. GREEN confirmado: test pasa, `repository.resolverPrevisualizacion`
      llamado con `('paciente', 'p1', 'doc-1')`. **Desviación del texto literal**: para que este test
      (y los de 4.2/4.3) tipen contra `DocumentoRepository` — que desde 1.2 exige el método como
      obligatorio — se agregó un default `resolverPrevisualizacion: vi.fn().mockResolvedValue(null)`
      a `buildFakeRepository()` en este mismo archivo. Esto no estaba en el texto de 4.1, pero era
      inevitable: sin ese default, los objetos devueltos por `buildFakeRepository({...})` no son
      asignables a `DocumentoRepository` y el archivo no compila. Efecto colateral verificado: este
      archivo **sale** de la lista de "15 archivos rojos" que dejó anotada 1.3/2.4 (baja a 14) — no
      se tocó ningún otro de los 14 restantes, confirmado con `tsc -b --noEmit` antes/después.
- [x] 4.2 (RED→GREEN→TRIANGULATE) Manejar los tres desenlaces del contrato: resuelto, `null` (no
      previsualizable) y error. Triangular los tres; el error **no** debe dejar el estado en "cargando"
      (D5 de `design.md`, mismo criterio que el spec de `paciente-documentos` ya exige para la carga
      del checklist).
      **Hecho (2026-08-06)**, mismo ciclo RED→GREEN que 4.1 (3 tests nuevos, cada uno un desenlace
      distinto, no un solo test genérico con mocks intercambiados): (1) **resuelto** —
      `repository.resolverPrevisualizacion` resuelve `'blob:doc-1-url'` → la función del hook
      devuelve exactamente esa URL; (2) **`null`** — resuelve `null` → la función del hook resuelve
      `null` sin lanzar (verificado explícitamente que la promesa **no** rechaza en este caso, es el
      caso normal según D2: documento sin contenido previsualizable); (3) **error** — el repository
      **rechaza** con `new Error('403: sin permiso para este documento')` → verificado con
      `.rejects.toThrow('403: sin permiso para este documento')` que la función del hook **propaga
      el error real**, no lo traga ni lo convierte en `null`. Se revisó primero cómo maneja errores
      el resto del hook (no hay ningún `try/catch` en `upload`/`remove` tampoco — dejan que el error
      de `repository.*` se propague sin capturar, y es el `try/finally` de quien llama —
      `usePacientes.ts` es el patrón externo del proyecto para eso— el que apaga su propio
      "cargando"); se siguió el mismo criterio acá en vez de inventar un `try/catch` nuevo dentro
      del hook. **Verificación explícita del requisito "no debe dejar el estado en cargando"**: tras
      el `.rejects.toThrow(...)` del caso (3), se afirma `result.current.loading` sigue en `false`
      — el error de `resolverPrevisualizacion()` no toca ni deja colgado el `loading` general del
      hook (que es de la carga inicial del checklist, un estado completamente distinto). RED
      confirmado antes de implementar (mismos 3 tests fallando con
      `TypeError: result.current.resolverPrevisualizacion is not a function`, agrupados en el mismo
      commit RED que 4.1 — no se implementó nada entre escribir estos tests y correr el RED). GREEN
      confirmado: 8/8 passing (3 preexistentes + 5 nuevos de 4.1-4.3), corrido dos veces para
      descartar flakiness — estable en ambas.
- [x] 4.3 (RED→GREEN) Revocar el `ObjectURL` al cerrar la ventana / desmontar, para no filtrar memoria
      durante una sesión larga.
      **Hecho (2026-08-06)**, mismo ciclo RED→GREEN que 4.1/4.2: RED confirmado (mismo
      `TypeError: ... is not a function`, ahora sobre `revocarPrevisualizacion`). Implementado:
      `revocarPrevisualizacion(url)`, función pura (sin `useState`, sin `useEffect`) que llama
      `URL.revokeObjectURL(url)`. **Decisión de diseño, documentada acá porque no es 1:1 con el
      texto literal de la tarea**: el hook **no** rastrea internamente "cuál es la URL actualmente
      abierta" para revocarla solo en unmount de forma automática — eso violaría 4.1 ("no guardar la
      URL en el estado del hook... el hook expone una función, no un valor que vive en el estado
      global del checklist"). En su lugar, el hook expone la función de revocación como una segunda
      pieza simétrica a `resolverPrevisualizacion()`: `<DocumentChecklist />` (D3, §5 — fuera de
      alcance de este pase) es quien sabe "qué documento y qué URL está mostrando ahora mismo" y
      quien decide cuándo llamarla (al cerrar con Escape/backdrop/botón, y en el cleanup de su
      propio `useEffect` de desmontaje) — el hook solo provee el mecanismo de revocar de forma
      centralizada y testeable, sin duplicar estado. `URL.revokeObjectURL` es un no-op inofensivo
      si la URL no vino de `URL.createObjectURL` (p. ej. una URL firmada real de
      `integracion-documentos`), así que la función sirve sin cambios cuando el repository deje de
      ser el mock. Test: `vi.spyOn(URL, 'revokeObjectURL')` — llamado exactamente 1 vez con la URL
      resuelta por `resolverPrevisualizacion()` en el mismo test (end-to-end: resolver → revocar,
      no un spy aislado). GREEN confirmado. Nota: el mock ya revoca su propio `ObjectURL` en
      `remove()` (tasks.md 2.3) sobre el store interno del repository — esto es un revoke distinto,
      de la URL que quedó en manos del consumidor del hook mientras la ventana estuvo abierta, sin
      relación con el store del mock.
      **Verificación de cierre de §4 (2026-08-06)**: `cd frontend && npx vitest run src/shared/lib/documentos/useDocumentChecklist.test.tsx`:
      8/8 passing, dos corridas, estable. `cd frontend && npx tsc -b --noEmit`: baja de 15 a **14**
      archivos rojos (mismos 14 de la lista de 1.3/2.4 menos `useDocumentChecklist.test.tsx`, que
      salió por el default agregado a `buildFakeRepository()` en 4.1 — ningún otro archivo cambió de
      estado, verificado con diff exacto de la lista antes/después). `npx oxlint` sobre
      `useDocumentChecklist.ts` y `useDocumentChecklist.test.tsx`: exit 0, sin hallazgos. **No se
      avanzó a §5.**

## 5. `DocumentChecklist.tsx` — acción "Ver" y montaje del overlay (D3, D4)

> **Corte real: acá recién se ve algo.** Si la gobernanza quedó CRÍTICA, repetir la aprobación humana
> explícita antes de esta sección.

**Aprobación humana explícita re-confirmada para arrancar la §5 (2026-08-06)**: el usuario confirmó
explícitamente en esta misma sesión, después de recordarle el requisito de `0.4`, dar inicio a esta
sección puntual — gobernanza CRÍTICA reconocida (checkpoint (c)) y respetada. Esta es la sección que
tasks.md marca como "el corte real: acá recién se ve algo"; la aprobación cubre específicamente
§5.1-§5.7, no §6 en adelante.

**Safety net previo (2026-08-06), antes de tocar `DocumentChecklist.tsx`/`.test.tsx`**:
`cd frontend && npx vitest run src/shared/components/DocumentChecklist.test.tsx` → 9/9 passing.
`cd frontend && npx vitest run src/features/obras-sociales/ChecklistEditor.test.tsx` (por 5.6, antes de
tocar nada que pueda afectar su preview `readOnly`) → **2 failed | 12 passed (14)**, pre-existente y ya
anotado en el baseline general de `0.3` (uno de los 21 archivos con la causa `TypeError: Cannot read
properties of undefined (reading 'clear')`/contención de localStorage — acá específicamente el fallo es
`Unable to find … role "button" name /^agregar$/i` porque el botón real dice "+ Agregar", un bug de
test preexistente no relacionado con este change). Re-verificado al cierre de §5: mismo resultado exacto
(2 failed | 12 passed (14)) — sin regresión.

**Decisión de diseño no explícita en el texto literal de la §5, documentada acá**: para que
`DocumentChecklist` pueda llamar a `resolverPrevisualizacion`/`revocarPrevisualizacion` (que viven en
`useDocumentChecklist`, instanciado por cada wrapper, no por `DocumentChecklist`), se agregan dos props
nuevas **opcionales**: `onResolverPrevisualizacion?: (documentoId: string) => Promise<string | null>` y
`onRevocarPrevisualizacion?: (url: string) => void`. Opcionales a propósito: los 6 puntos de montaje
(§6, fuera de alcance de esta pasada) todavía no las pasan, y la firma pública de
`DocumentChecklistProps` **no se vuelve una ruptura** para ningún consumidor existente — sin esto, tocar
solo `DocumentChecklist.tsx` habría forzado tocar los 6 wrappers en esta misma pasada, violando el
límite explícito de la tarea. Consecuencia de diseño: mientras un wrapper no pase
`onResolverPrevisualizacion`, el botón "Ver" **no se renderiza en absoluto** (no un botón deshabilitado
sin capacidad detrás) — esto es lo que mantiene el preview `readOnly` de `ChecklistEditor.tsx` sin
cambios visibles (5.6) y es coherente con D3 ("los seis puntos de montaje no cambian de forma"): ningún
wrapper necesita tocarse para que esta sección compile, pase sus tests y no rompa nada corriente.

- [x] 5.1 (RED→GREEN) Agregar la acción "Ver" **por documento** (no por ítem — un ítem puede tener N
      documentos desde `pacientes-documentos-multiples`), en la misma fila donde ya vive "Quitar".
      **Hecho (2026-08-06)**: RED confirmado — test nuevo en `DocumentChecklist.test.tsx`
      (`describe('DocumentChecklist — acción "Ver" por documento (tasks.md 5.1)')`) fallando
      (`getByRole('button', { name: /ver/i })` no encuentra nada). Implementado: nueva prop opcional
      `onResolverPrevisualizacion` en `DocumentChecklistProps`; botón "Ver" con ícono `iconOjo`
      (`design-system/icons.tsx`, ya existente, no se agregó ninguno), montado en la misma fila que
      "Quitar" (mismo `<div className="flex items-center gap-sm">` contenedor de ambos botones,
      "Ver" antes que "Quitar"), renderizado condicionalmente solo si `onResolverPrevisualizacion` está
      presente. GREEN confirmado: 11/11 passing (9 preexistentes + 2 nuevos: "muestra Ver cuando se
      provee la prop" y "sin la prop no se renderiza ningún Ver").
- [x] 5.2 (RED→GREEN→TRIANGULATE) `aria-label` distinguible por documento, siguiendo el patrón ya
      establecido: `aria-label={\`Quitar ${item.nombre} - ${doc.nombreArchivo}\`}`. Con N documentos por
      ítem, un label genérico produce N botones indistinguibles para lector de pantalla **y para los
      tests**. Triangular con un ítem de 2+ documentos.
      **Hecho (2026-08-06)**: RED confirmado — test nuevo con 2 documentos del mismo ítem
      (`presupuesto-2025.pdf`/`presupuesto-2026.pdf`) esperando labels exactos
      `'Ver Presupuesto - presupuesto-2025.pdf'`/`'Ver Presupuesto - presupuesto-2026.pdf'`; falla
      porque la implementación de 5.1 usaba `aria-label={\`Ver ${doc.nombreArchivo}\`}` (sin el nombre
      del ítem) — con archivos de nombre distinto ya eran técnicamente distinguibles, pero no seguían
      el patrón exacto pedido ni serían distinguibles si dos documentos de ítems distintos tuvieran el
      mismo nombre de archivo. Corregido a `aria-label={\`Ver ${item.nombre} - ${doc.nombreArchivo}\`}`
      (mismo patrón exacto que "Quitar"). GREEN confirmado: 12/12 passing, triangulado con 2 documentos
      reales del mismo ítem, cada uno con su botón "Ver" localizable por `getByRole` sin ambigüedad.
- [x] 5.3 (RED→GREEN) Estado local de "qué documento estoy viendo" **dentro de `DocumentChecklist`**
      (D3), igual que hoy vive ahí el `useRef` de los file inputs. Los seis puntos de montaje no
      cambian de forma.
      **Hecho (2026-08-06)**: RED confirmado — test nuevo verificando que clickear "Ver" llama a
      `onResolverPrevisualizacion(doc.id)` y monta un `role="dialog"`; falla porque el botón de 5.1/5.2
      no tenía `onClick`. Implementado: `useState<DocumentoEnVista | null>` (documento + nombre del
      ítem, para el título del overlay), `useState<EstadoPrevisualizacion>` (unión de 4 variantes:
      `cargando`/`lista`/`sin-contenido`/`error`, ver 5.4/5.5), y dos `useRef` auxiliares
      (`vistaIdRef` para descartar resoluciones obsoletas si se cierra o se abre otro documento antes
      de que la promesa anterior resuelva; `urlAbiertaRef` para poder revocar la URL en el cleanup de
      unmount sin depender de que `estadoPreview` esté actualizado ahí). `abrirPreview()` dispara
      `onResolverPrevisualizacion` y transiciona el estado; `cerrarPreview()` revoca la URL abierta
      (si `onRevocarPrevisualizacion` fue provisto) y limpia el estado. `<Overlay>` (§3) se monta una
      sola vez al final del componente (no por documento), con `open={enVista !== null}`. Se agregó
      también la prop opcional `onRevocarPrevisualizacion` (ver nota de diseño arriba del §5).
      **Desviación/anticipación documentada**: junto con el estado se implementó también un
      `useEffect` de cleanup en unmount que revoca `urlAbiertaRef.current` si el componente se
      desmonta con la ventana todavía abierta — este comportamiento es, en rigor, el alcance de 5.7,
      pero se construyó acá porque es la misma pieza de estado (`urlAbiertaRef`) y separarlo habría
      significado escribir la mitad de la lógica de cierre dos veces. La responsabilidad exacta
      ("`DocumentChecklist` decide cuándo llamar a `revocarPrevisualizacion`, el hook no lo hace solo")
      es la que dejó anotada `useDocumentChecklist.ts` (tasks.md 4.3) como pendiente de esta sección.
      GREEN confirmado: 13/13 passing.
- [x] 5.4 (RED→GREEN→TRIANGULATE) Renderizar el contenido según el veredicto de (e): `<img>` para
      imágenes, `<iframe>` **sandboxeado** (`sandbox` sin `allow-scripts` ni `allow-same-origin`) para
      PDF, estado explícito de "no previsualizable" para el resto. **El sandbox no es opcional**: un
      PDF o SVG subido por un usuario puede ejecutar script en el origen de la app si el iframe no está
      sandboxeado, y eso aplica igual en mock (`ObjectURL` es same-origin) que contra URL firmada.
      **Hecho (2026-08-06)**: RED confirmado — 3 tests nuevos (imagen/PDF/tipo no soportado, cada uno
      con su propio `tipoMime` y aserciones distintas, no un test genérico con mocks intercambiados),
      los 3 fallando porque el overlay solo mostraba el placeholder "Cargando previsualización…" sin
      transicionar nunca a contenido real. Implementado: componente `ContenidoPreview({ estado,
      documento })`, que decide por `estado.status` y, en `'lista'`, por `documento.tipoMime`:
      `tipoMime?.startsWith('image/')` → `<img src={url} alt={nombreArchivo}>`;
      `tipoMime === 'application/pdf'` → `<iframe src={url} title={nombreArchivo} sandbox="">`
      (`sandbox=""` — el valor vacío es deliberado: sandboxea con la política más restrictiva posible,
      sin conceder `allow-scripts` ni `allow-same-origin`, exactamente lo que pide el checkpoint (e));
      cualquier otro `tipoMime` (incluido `undefined`) → `Alert tone="secondary"` con "Este tipo de
      archivo no se puede previsualizar acá". GREEN confirmado: 16/16 passing. Triangulado con 3
      `tipoMime` reales y distintos (`image/jpeg`, `application/pdf`, `application/zip`), cada test
      verificando además la **ausencia** de los otros elementos (ej. el test de PDF no verifica que no
      haya `<img>`, pero el test de "no soportado" sí verifica explícitamente `queryByRole('img')` y
      `document.querySelector('iframe')` ambos ausentes, para no dejar pasar una implementación que
      renderice los tres a la vez).
- [x] 5.5 (RED→GREEN→TRIANGULATE) Estados de carga / error / no-previsualizable visibles (D5), con
      mensaje comprensible y **sin propagar el mensaje crudo del error** a la UI (mismo requisito duro
      que toda la serie de integración de este proyecto). Triangular los tres.
      **Hecho (2026-08-06), con una desviación real del ciclo RED→GREEN que se documenta explícitamente
      en vez de ocultarla**: los 3 tests nuevos (cargando con promesa pendiente controlada a mano /
      error con `.mockRejectedValue(new Error('403: sin permiso para este documento'))` verificando
      `queryByText(/403/)` y `queryByText(/sin permiso/i)` ambos ausentes / `null` mostrando "no tiene
      contenido para previsualizar") **pasaron en verde en la primera corrida**, sin una fase RED
      propia — porque `ContenidoPreview` (5.4) ya necesitó implementar las cuatro ramas de
      `EstadoPrevisualizacion` (incluidas `cargando`/`error`/`sin-contenido`) para poder tipar
      exhaustivamente el `switch` antes de llegar a la rama `'lista'` que sí tenía tests propios en
      5.4. El mensaje de error genérico (`Alert tone="danger"`, "No se pudo cargar la previsualización.
      Probá de nuevo en un momento.") y el de `sin-contenido` (`Alert tone="secondary"`, "Este documento
      no tiene contenido para previsualizar.") se escribieron durante 5.4, guiados directamente por el
      requisito explícito de D5 y por el patrón ya usado en el proyecto (`AsignacionPanel.tsx`: mensajes
      de error siempre hardcodeados, nunca `error.message` crudo — verificado antes de escribir el
      código, no asumido) — no por un test de 5.5 en rojo. Los tests de 5.5 quedan como triangulación
      explícita y confirmatoria de un comportamiento ya implementado, con foco puntual en la
      aserción dura del requisito ("nunca el mensaje crudo"), que 5.4 no verificaba. GREEN confirmado:
      19/19 passing, con los 3 desenlaces cubiertos por tests independientes.
- [x] 5.6 (RED→GREEN) Decidir e implementar el comportamiento en `readOnly` según el veredicto de (c):
      la recomendación es que **"Ver" siga disponible** (`readOnly` gatea escritura; el principio ya
      escrito en los wrappers dice que el gateo de cliente nunca debe ser más restrictivo que la RLS).
      Verificar que el preview de configuración de `obras-sociales/ChecklistEditor.tsx` no quede raro.
      **Hecho (2026-08-06)**: la implementación de 5.1 había copiado `disabled={readOnly}` del botón
      "Quitar" al botón "Ver" por similitud estructural — una decisión por defecto, no la decisión
      correcta según el checkpoint (c). RED confirmado con un test explícito (`readOnly` + `onResolverPrevisualizacion`
      provisto → "Ver" debe seguir `toBeEnabled()` mientras "Agregar otro"/"Quitar" quedan
      `toBeDisabled()`), que falló contra la implementación heredada de 5.1 (`disabled=""` presente en
      "Ver"). Corregido: se quitó `disabled={readOnly}` del botón "Ver" (y las clases
      `disabled:cursor-not-allowed disabled:opacity-40`, que ya no aplican) — con un comentario en el
      propio componente explicando por qué, citando el mismo principio ya escrito en
      `PacienteDocumentosChecklist.tsx` ("el gateo de cliente nunca debe ser más restrictivo que la RLS
      del servidor"). GREEN confirmado: 20/20 passing. **Verificación explícita de `ChecklistEditor.tsx`
      (obras-sociales)**: `grep -n "DocumentChecklist" ChecklistEditor.tsx` confirma que monta
      `<DocumentChecklist items={items} documentos={[]} onUpload={noop} onRemove={noop} readOnly />`
      — no pasa `onResolverPrevisualizacion`, así que "Ver" **no se renderiza ahí** (por la prop
      opcional gateada, ver nota de diseño arriba de §5) y `documentos=[]` de todos modos no tendría
      ningún documento sobre el que mostrar "Ver". `cd frontend && npx vitest run
      src/features/obras-sociales/ChecklistEditor.test.tsx` re-corrido después del cambio: **2 failed
      | 12 passed (14)**, idéntico byte a byte al safety net previo — sin regresión, los 2 fallos son
      el mismo bug preexistente de regex `/^agregar$/i` contra el texto real "+ Agregar", ya anotado
      arriba y en el baseline general de `0.3`.
- [x] 5.7 (REFACTOR) Cerrar la ventana no debe recargar el checklist ni perder el progreso ni la marca
      de "Vigente" — test explícito, es un requisito del spec.
      **Hecho (2026-08-06), con la misma desviación honesta que 5.5**: 2 tests nuevos — (1) abrir "Ver",
      cerrar con `Escape`, y verificar que "1 de 2 documentos cargados" y el chip "Vigente" sobre
      `presupuesto.pdf` siguen exactamente igual, que `onUpload`/`onRemove` **nunca** se llamaron, y que
      `onRevocarPrevisualizacion` sí se llamó con la URL resuelta; (2) desmontar el componente
      (`unmount()` de Testing Library) con la ventana todavía abierta (sin `Escape` ni backdrop) y
      verificar que la URL igual se revoca. **Ambos pasaron en verde en la primera corrida** — el
      cierre no toca `documentos`/`items` (son props del padre, nunca mutadas acá) por construcción
      desde 5.3, y el `useEffect` de cleanup en unmount ya se había escrito en 5.3 (ver nota de
      desviación ahí) precisamente para cubrir este caso. No hubo código nuevo de producción en esta
      tarea — es la confirmación explícita, con test, de una garantía que ya existía por diseño, más el
      caso de unmount que sí era una pieza real de 5.3 sin test propio hasta acá. GREEN confirmado:
      22/22 passing.
      **Verificación de cierre de §5 (2026-08-06)**: `cd frontend && npx vitest run
      src/shared/components/DocumentChecklist.test.tsx` corrido dos veces adicionales: 22/22 passing,
      estable en ambas. `cd frontend && npx tsc -b --noEmit`: **exactamente los mismos 14 archivos
      rojos** que dejó §4 (mismo `sed -E 's/\(.*//' | sort -u`, diff exacto contra la lista de 4.3) —
      `DocumentChecklist.tsx` no rompió tipado de ningún consumidor porque las dos props nuevas son
      opcionales (ver nota de diseño arriba de §5). `npx oxlint src/shared/components/DocumentChecklist.tsx
      src/shared/components/DocumentChecklist.test.tsx`: exit 0, sin hallazgos. Corrida completa `cd
      frontend && npx vitest run` (todo el repo): **21 archivos fallando, 208 pasando (229)** · **126
      tests fallando, 1888 pasando (2014)** — mismos 21 archivos y mismos 126 tests fallando que el
      baseline de `0.3`/cierre de `0.4`, ninguno nuevo introducido por esta pasada; el conteo total de
      tests subió (1976→2014, +38) por los tests ya agregados en §1-§4 (commits previos) más los 13
      tests nuevos de esta pasada — no por regresión. **No se avanzó a §6.**

## 6. Ajuste de los tests existentes (seis puntos de montaje)

- [ ] 6.1 Verificar que siguen en verde, sin cambio de comportamiento esperado:
      `shared/components/DocumentChecklist.test.tsx`,
      `shared/lib/documentos/useDocumentChecklist.test.tsx`,
      `features/pacientes/PacienteDocumentos.test.tsx`,
      `features/conductores/ConductorDocumentos.test.tsx`,
      `features/facturacion/FacturaDocumentos.test.tsx`.
- [ ] 6.2 Verificar los montajes sin test propio: `features/vehiculos/VehiculoDocumentos.tsx`,
      `features/pacientes/PacienteDocumentosChecklist.tsx`,
      `features/obras-sociales/ChecklistEditor.tsx` (preview `readOnly`) y la demo del catálogo
      `design-system/DesignSystem.tsx:200`.
- [ ] 6.3 **No contar `features/presupuestos/PresupuestoForm.tsx`**: aparece en el `grep` de
      `DocumentChecklist` pero **solo en un comentario** que dice lo contrario (*"archivo único
      (Decisión 3, Discrepancia 1 — NO DocumentChecklist)"*). Presupuestos no usa el checklist y no
      entra en el alcance.
- [ ] 6.4 `cd frontend && npx tsc -b --noEmit` en verde (nunca `tsc --noEmit` a secas — el `tsconfig`
      raíz es de project references y sin `-b` compila cero archivos).
- [ ] 6.5 `cd frontend && npx oxlint` sin regresiones.

## 7. Documentación y cierre del tracking huérfano

> Esta sección **repara un hallazgo**, no es papeleo: `integracion-documentos` §D6 prometió una
> anotación que nunca se escribió, y por eso `documentos-descarga-firmada` quedó huérfano.

- [ ] 7.1 `CHANGES.md`: agregar la nota de refinamiento posterior bajo `C-03` y bajo `C-05` (mismo
      patrón que usó `pacientes-documentos-multiples`, líneas 188 y 496), con el nivel de gobernanza
      confirmado en `0.1`.
- [ ] 7.2 `CHANGES.md` + `knowledge-base/10_preguntas_abiertas.md`: dejar escrita la relación entre
      `documentos-previsualizacion` y `documentos-descarga-firmada` según el veredicto de (b), de forma
      que **las dos entradas no se contradigan**. Si el veredicto es B2, además **crear efectivamente**
      la entrada de `documentos-descarga-firmada` (hoy no existe en ningún lado salvo como mención
      dentro de un `design.md`).
- [ ] 7.3 `knowledge-base/10_preguntas_abiertas.md`: escribir la anotación sobre US-900 que
      `integracion-documentos` §D6 prometió y nunca se escribió (*"para que el criterio de aceptación
      de US-900 no quede tácitamente dado por cumplido"*). Verificado al momento del propose: ese
      archivo **no menciona** descarga de documentos ni US-900.
- [ ] 7.4 `openspec/changes/integracion-documentos/design.md`: corregir §D6, que afirma que ese change
      **no toca la interfaz `DocumentoRepository`**. Si `documentos-previsualizacion` se aplica primero,
      esa interfaz pasa a tener cuatro métodos y `integracion-documentos` tiene que implementarlos
      todos. **Es un supuesto roto y hay que avisarlo ahí, no descubrirlo durante su apply.**
- [ ] 7.5 `knowledge-base/06_funcionalidades.md` §US-900: **no tildar** el criterio *"Se pueden
      consultar y descargar"* mientras corra sobre mock. Si el veredicto de (b) fue B1 (fusión) y hay
      backend real, recién ahí corresponde tildarlo.
- [ ] 7.6 Confirmar por escrito en el cierre que **no hubo discrepancia docx↔KB** en este change (es
      una funcionalidad de UI, sin contraparte estructural en
      `docs/core/Traslados-Modelo-Datos.docx`) y que por lo tanto **no corresponde** ningún
      `AvisoModeloDatos` nuevo ni nota en `04_modelo_de_datos.md` §Discrepancias.

## 8. Verificación manual (bloqueante, a cargo de Enzo / la usuaria)

- [ ] 8.1 Subir una imagen a un ítem del checklist de un paciente y previsualizarla sin salir de la
      pantalla. Confirmar que es **el documento que se subió** (el propósito declarado por la clienta:
      control de errores de carga).
- [ ] 8.2 Subir un PDF y previsualizarlo. Verificar en al menos dos navegadores — el visor de PDF en
      `<iframe>` es nativo y **su comportamiento varía**; en algunos móviles descarga en vez de mostrar.
- [ ] 8.3 Con un ítem que tenga 2+ documentos (el caso de `pacientes-documentos-multiples`: presupuesto
      vigente + renovación), previsualizar cada uno y confirmar que se abre **el correcto**.
- [ ] 8.4 Cerrar con `Escape`, con el backdrop y con el botón de cierre. Confirmar que el checklist
      queda igual (progreso, "Vigente", documentos).
- [ ] 8.5 Verificar los otros tres dominios (Vehículos, Conductores, Facturas): heredan la
      previsualización por ser el mismo componente compartido. Confirmar que no se rompió nada ahí,
      aunque ninguno la haya pedido.
- [ ] 8.6 Mostrarle el resultado a la clienta **advirtiendo explícitamente** que corre sobre mock (si
      el veredicto de (a) fue Opción A): lo que ve funciona con el archivo en memoria del navegador,
      no contra el almacenamiento real, que todavía no está conectado. **Evitar que apruebe una demo
      que después se comporte distinto** — riesgo listado en `proposal.md`.
- [ ] 8.7 Preguntarle a la clienta si además espera previsualizar **antes de confirmar la carga** (ver
      `design.md` §Open Questions). Su propósito declarado —*"evitar subir un documento en el
      checklist equivocado"*— sugiere que el momento de más valor es antes de que la carga se
      consolide, y el flujo actual no tiene paso de confirmación. **No dar el punto 4 por cerrado sin
      preguntarlo.**
