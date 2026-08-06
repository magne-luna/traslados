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

- [ ] 2.1 (RED→GREEN) `mockDocumentoRepository.upload()`: dejar de descartar el `File`. Guardar el
      binario (o su `ObjectURL`) en el store interno junto al `DocumentoAdjunto`, y poblar `tipoMime`
      desde `file.type`. **La forma pública de `DocumentoAdjunto` que devuelve `upload()` no cambia
      más allá del campo nuevo** — la URL no viaja en el modelo (D1).
- [ ] 2.2 (RED→GREEN→TRIANGULATE) Implementar `resolverPrevisualizacion()`: devuelve el `ObjectURL`
      del documento pedido, o `null` si ese `id` no tiene contenido asociado. Triangular al menos:
      documento con contenido, documento sin contenido (cargado "antes"), `id` inexistente.
- [ ] 2.3 (RED→GREEN) `remove()`: al quitar un documento, **revocar su `ObjectURL`**
      (`URL.revokeObjectURL`) para no filtrar memoria. Test que verifique que se llama.
- [ ] 2.4 Confirmar que **no** hace falta `SCHEMA_VERSION` (D6 de `design.md`): el store sigue siendo
      un `Map` en memoria de sesión, sin `localStorage`, así que no hay dato viejo que migrar. Dejarlo
      escrito como comentario en el archivo, no solo en el design.

## 3. Componente de ventana en el design system (Checkpoint (d))

> Paralelizable con §1-§2: no depende del contrato de documentos. Esa independencia es justamente la
> razón de que el componente sea genérico y viva en el design system.

- [ ] 3.1 (RED→GREEN→TRIANGULATE) Crear el componente en
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
- [ ] 3.2 Triangular accesibilidad y teclado: abrir/cerrar con `Escape`, cerrar con backdrop, foco
      devuelto, y que el contenido de fondo no sea alcanzable por tabulación mientras está abierto.
- [ ] 3.3 Agregar la entrada de catálogo en `frontend/src/design-system/DesignSystem.tsx` — **no
      negociable**: es donde el resto del equipo descubre que el componente existe, y es lo que hace
      que la regla dura de "revisar el design system antes de escribir markup" siga funcionando.
- [ ] 3.4 (REFACTOR) Revisar que el componente no haya quedado acoplado a documentos: si tiene alguna
      referencia a `DocumentoAdjunto`, está en el archivo equivocado.

## 4. `useDocumentChecklist` — exponer la resolución a la UI

- [ ] 4.1 (RED→GREEN) Exponer desde el hook la capacidad de resolver la previsualización de un
      documento por su `id`, delegando en el repository inyectado. No guardar la URL en el estado del
      hook más allá de lo que dure la ventana abierta — es un dato efímero (D2).
- [ ] 4.2 (RED→GREEN→TRIANGULATE) Manejar los tres desenlaces del contrato: resuelto, `null` (no
      previsualizable) y error. Triangular los tres; el error **no** debe dejar el estado en "cargando"
      (D5 de `design.md`, mismo criterio que el spec de `paciente-documentos` ya exige para la carga
      del checklist).
- [ ] 4.3 (RED→GREEN) Revocar el `ObjectURL` al cerrar la ventana / desmontar, para no filtrar memoria
      durante una sesión larga.

## 5. `DocumentChecklist.tsx` — acción "Ver" y montaje del overlay (D3, D4)

> **Corte real: acá recién se ve algo.** Si la gobernanza quedó CRÍTICA, repetir la aprobación humana
> explícita antes de esta sección.

- [ ] 5.1 (RED→GREEN) Agregar la acción "Ver" **por documento** (no por ítem — un ítem puede tener N
      documentos desde `pacientes-documentos-multiples`), en la misma fila donde ya vive "Quitar".
- [ ] 5.2 (RED→GREEN→TRIANGULATE) `aria-label` distinguible por documento, siguiendo el patrón ya
      establecido: `aria-label={\`Quitar ${item.nombre} - ${doc.nombreArchivo}\`}`. Con N documentos por
      ítem, un label genérico produce N botones indistinguibles para lector de pantalla **y para los
      tests**. Triangular con un ítem de 2+ documentos.
- [ ] 5.3 (RED→GREEN) Estado local de "qué documento estoy viendo" **dentro de `DocumentChecklist`**
      (D3), igual que hoy vive ahí el `useRef` de los file inputs. Los seis puntos de montaje no
      cambian de forma.
- [ ] 5.4 (RED→GREEN→TRIANGULATE) Renderizar el contenido según el veredicto de (e): `<img>` para
      imágenes, `<iframe>` **sandboxeado** (`sandbox` sin `allow-scripts` ni `allow-same-origin`) para
      PDF, estado explícito de "no previsualizable" para el resto. **El sandbox no es opcional**: un
      PDF o SVG subido por un usuario puede ejecutar script en el origen de la app si el iframe no está
      sandboxeado, y eso aplica igual en mock (`ObjectURL` es same-origin) que contra URL firmada.
- [ ] 5.5 (RED→GREEN→TRIANGULATE) Estados de carga / error / no-previsualizable visibles (D5), con
      mensaje comprensible y **sin propagar el mensaje crudo del error** a la UI (mismo requisito duro
      que toda la serie de integración de este proyecto). Triangular los tres.
- [ ] 5.6 (RED→GREEN) Decidir e implementar el comportamiento en `readOnly` según el veredicto de (c):
      la recomendación es que **"Ver" siga disponible** (`readOnly` gatea escritura; el principio ya
      escrito en los wrappers dice que el gateo de cliente nunca debe ser más restrictivo que la RLS).
      Verificar que el preview de configuración de `obras-sociales/ChecklistEditor.tsx` no quede raro.
- [ ] 5.7 (REFACTOR) Cerrar la ventana no debe recargar el checklist ni perder el progreso ni la marca
      de "Vigente" — test explícito, es un requisito del spec.

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
