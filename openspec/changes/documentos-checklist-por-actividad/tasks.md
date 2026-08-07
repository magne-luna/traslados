# Tasks — documentos-checklist-por-actividad

> **⚠️ STRICT TDD ACTIVO.** `openspec/config.yaml` tiene `testing.strict_tdd: true`. Toda tarea que
> escriba código de producción se implementa con el ciclo **RED → GREEN → TRIANGULATE → REFACTOR**, y
> **antes** de modificar cualquier archivo existente se corre el safety net
> (`cd frontend && npx vitest run`) y se registra el baseline. Test runner:
> `cd frontend && npx vitest run`.
>
> **⚠️ GOVERNANCE — recomendación CRÍTICO, sin confirmar.** `design.md` Checkpoint (g) recomienda
> tratar este change como CRÍTICO, mismo criterio que sus dos hermanos ya archivados
> (`pacientes-documentos-multiples`, `documentos-previsualizacion`) y que los cinco `gateo-*`:
> pantalla del dominio Pacientes, datos de salud de personas con discapacidad incluidos menores.
> Además este change **sí** introduce un riesgo de pérdida de documentación que los hermanos no
> tenían (Checkpoint (e)). Ninguna tarea de la §1 en adelante corre sin que Enzo confirme el nivel en
> la tarea `0.1`.
>
> **⚠️ Este documento es propose-only.** No se escribe código de producción, no se escribe SQL, no se
> corre `supabase db push`. **Siete checkpoints de diseño están abiertos** y ninguno tiene veredicto:
> el alcance real de las secciones §2 a §6 **depende de esos veredictos**, y varias tareas están
> marcadas como condicionales. La implementación arranca recién en `/opsx:apply`, después de §0.
>
> **Reglas duras aplicables** (`CLAUDE.md`): nunca `any` (usar `unknown` + narrowing); nunca
> `style={{}}` (solo utilidades Tailwind v4); revisar y reusar
> `frontend/src/design-system/components.tsx` antes de escribir markup nuevo (`Section`, `Chip`,
> `ProgressBar`, `Alert`, `Card` — nada ad-hoc para los bloques por actividad); type-check con
> `cd frontend && npx tsc -b --noEmit` (NUNCA `tsc --noEmit` a secas); Conventional Commits;
> estructura desde `docs/core/Traslados-Modelo-Datos.docx` + reglas de negocio desde `knowledge-base/`,
> con cualquier discrepancia documentada en los dos lugares (KB §Discrepancias + `AvisoModeloDatos` en
> la pantalla).

## 0. Checkpoint de diseño (bloqueante, antes de escribir código) — GOVERNANCE recomendado CRÍTICO

- [x] 0.1 Presentar a Enzo/la clienta los **siete** checkpoints de `design.md` con su trade-off escrito
      y registrar el veredicto de cada uno **en este archivo** antes de continuar. Ninguna tarea de la
      §1 en adelante arranca con un checkpoint sin veredicto:
      - **Checkpoint (a) — ¿qué es una "actividad"?** ¿Reusar `Direccion` (recomendado por el
        propose), crear una entidad `Actividad` nueva, o anclar al `Recorrido`?
        **Sub-pregunta obligatoria**: ¿el `tipo: 'domicilio'` (la casa del paciente) lleva checklist
        propio, o solo las actividades no-domicilio?
        **→ VEREDICTO (2026-08-06, usuaria): reusar `Direccion`, como recomendado. Solo las
        direcciones no-domicilio llevan checklist propio — `tipo: 'domicilio'` queda excluido.**
      - **Checkpoint (b) — ¿dónde vive la dimensión "actividad"?** ¿`entidadId` compuesto
        (`paciente:${pacienteId}:${direccionId}`, cero cambios de contrato pero deuda encubierta),
        campo `agrupacionId?` opcional en `DocumentoAdjunto`/`DocumentoRepository` (recomendado), o
        agrupación dentro del componente compartido `DocumentChecklist`? **Es la decisión más cara de
        revertir de este change** y la que define si los otros tres dominios documentales se enteran.
        Si se elige la opción B, confirmar también el **nombre** del campo (`agrupacionId` genérico vs
        `actividadId`/`direccionId` explícito).
        **→ VEREDICTO (2026-08-06, usuaria): opción B — campo `agrupacionId?` opcional en
        `DocumentoAdjunto`/`DocumentoRepository`, nombre genérico (no `direccionId`). `DocumentChecklist`
        no cambia de contrato; los otros 3 dominios documentales no se enteran.**
      - **Checkpoint (c) — documentación sin actividad.** ¿Bloque "General" que convive con los de
        actividad (recomendado), asignación forzada a una actividad, o reasignación implícita
        (descartada por el propose)?
        **→ VEREDICTO (2026-08-06, usuaria): bloque "General" que convive, como recomendado.**
      - **Checkpoint (d) — ¿el checklist es el mismo para todas las actividades?** Preguntárselo a la
        clienta con estas palabras: *"¿los ~10 ítems son los mismos para la escuela y para la terapia,
        o cambian según la actividad?"*. Si son los mismos (recomendado), el alcance queda acotado; si
        cambian, el change se multiplica (toca `ObraSocial`, `ChecklistEditor` y
        `obra_social.tipos_documento`) y hay que **re-proponer**, no seguir con este `tasks.md`.
        **→ VEREDICTO PROVISORIO (2026-08-06, usuaria): asumimos que son los mismos ítems para todas
        las actividades — seguimos con este alcance. ⚠️ Sin confirmar con la clienta todavía (la
        usuaria sospecha que en realidad varían). Si al confirmar resulta que varían, es una extensión
        aditiva sobre lo que este change construye (agregar filtro de ítems por tipo de actividad, sin
        rehacer la estructura de N-checklists-por-actividad) — no bloquea arrancar con este supuesto.
        Confirmar con la clienta antes de dar el change por cerrado del todo (ver tarea 8.4/nueva nota
        en `10_preguntas_abiertas.md`).**
      - **Checkpoint (e) — quitar una actividad con documentación cargada.** ¿Advertir y confirmar
        (recomendado), bloquear mientras haya documentos, o dejar el comportamiento actual sin
        protección (descartado por el propose para un dominio CRÍTICO)?
        **→ VEREDICTO (2026-08-06, usuaria): advertir y confirmar, como recomendado.**
      - **Checkpoint (f) — progreso.** ¿Por actividad + total agregado del paciente (recomendado),
        solo por actividad (regresión respecto de lo que hoy se ve), o solo total?
        **→ VEREDICTO (2026-08-06, usuaria): por actividad + total agregado, como recomendado.**
      - **Checkpoint (g) — gobernanza.** ¿CRÍTICO (recomendado, por precedente de los dos hermanos y
        por el riesgo de pérdida documental del Checkpoint (e)) o ALTO?
        **→ VEREDICTO (2026-08-06, usuaria): CRÍTICO, como recomendado.**
- [x] 0.2 Confirmar el alcance con Enzo por escrito: **este change cubre solo el punto 2** del PDF de
      feedback. El **punto 3** (vincular la actividad seleccionada con su documentación; exportar o
      transferir documentación a otro domicilio) queda fuera hasta que llegue el video prometido por el
      cliente. Registrar acá si ese video llegó antes del apply — si llegó, **conviene re-leer el
      Checkpoint (b) antes de implementar**, porque "transferir documentación a otro domicilio" es
      literalmente "cambiarle la agrupación a un documento" y podría condicionar la forma elegida.
      **→ Estado (2026-08-06, usuaria): confirmado, alcance solo punto 2. El video del punto 3 todavía
      no llegó.**
- [x] 0.3 Confirmar contra el filesystem del repo (no contra la memoria de la sesión) que sigue sin
      existir ningún `SupabaseDocumentoRepository.ts` y que `openspec/changes/integracion-documentos/`
      sigue sin aplicarse. Si para el apply ya aterrizó la integración documental real, este propose
      necesita revisión: el Checkpoint (b) asume que el único implementador del contrato es el mock, y
      el Checkpoint (h) asume que la columna de actividad todavía no existe.
      **→ Estado (2026-08-06): verificado, sigue sin existir `SupabaseDocumentoRepository.ts` y
      `integracion-documentos/` sigue sin aplicarse.**
- [x] 0.4 Correr `cd frontend && npx vitest run` y registrar el baseline exacto (archivos en verde,
      tests passing/failing) antes de tocar cualquier archivo existente. Nota conocida del proyecto:
      `router.*.test.tsx`, `PermisosMatrizFields.test.tsx` y `ChecklistEditor.test.tsx` son flakies por
      contención de máquina — registrarlos como tales, no "arreglarlos" dentro de este change.
      **→ Baseline (2026-08-06): hallazgo real antes de arrancar — los 4 dominios documentales
      (`PacienteDocumentos`/`VehiculoDocumentos`/`ConductorDocumentos`/`FacturaDocumentos`) fallaban
      de forma determinística por `ReferenceError: DOMMatrix is not defined` (`pdfjs-dist` ejecuta
      `new DOMMatrix()` a nivel de módulo, jsdom no lo implementa, `documentos-previsualizacion` nunca
      agregó el mock/polyfill). Corregido en `frontend/src/test/setup.ts` (mock global de
      `pdfjs-dist`, mismo shape que ya usaba `PdfPreview.test.tsx` localmente) — commit aparte, previo
      a este change. Con el fix, el baseline real: 1922/2042 tests OK, 120 fallando — todos por el
      flakeo conocido de `localStorage.clear()` por contención de máquina (verificado: pasan aislados),
      ninguno en el dominio de documentos.**
- [ ] 0.5 Si el Checkpoint (b) se resuelve tocando el contrato compartido: anotar en
      `openspec/changes/integracion-documentos/design.md` la **segunda** corrección del contrato
      (la primera fue `documentos-previsualizacion`, líneas 436-453 de ese archivo), para que quien
      retome ese change relea `DocumentoRepository.ts` contra el repo real y no contra su propio
      `design.md`.
      **→ Estado: aplica — (b) resolvió tocando el contrato compartido (campo `agrupacionId?`). Pendiente
      de ejecutar en el apply.**

## 1. Modelo del dominio "actividad" (condicional al Checkpoint (a))

- [x] 1.1 Si (a) = reusar `Direccion`: definir en `frontend/src/features/pacientes/` el criterio único
      de "qué direcciones son actividades con checklist" (todas, o todas menos `tipo: 'domicilio'`,
      según la sub-pregunta de 0.1) como una función pura testeable — nunca un `filter` inline
      repetido en dos componentes. (RED→GREEN, más el caso de lista vacía.)
      **Hecho (2026-08-06)**: `obtenerActividadesConChecklist()` en
      `frontend/src/features/pacientes/actividadDocumental.ts`.
- [x] 1.2 Si (a) = entidad nueva `Actividad`: **detener el apply y re-proponer.** Crear una entidad de
      dominio nueva excede lo que este `tasks.md` planificó (toca tipos, mock de pacientes, formulario,
      persistencia y probablemente el docx) — no se improvisa dentro de este change.
      **No aplica (2026-08-06)**: veredicto de (a) fue reusar `Direccion`, no entidad nueva.
- [x] 1.3 Definir la etiqueta legible de cada actividad (tipo + descripción, reusando
      `TIPO_DIRECCION_LABELS` de `direccionOptions.ts`) como función pura con test — es lo que
      identifica cada bloque y lo que hace distinguibles dos terapias (spec: "Dos actividades del mismo
      tipo son distinguibles entre sí").
      **Hecho (2026-08-06)**: `etiquetaActividad()` en el mismo archivo, 8 tests entre ambas
      funciones (`actividadDocumental.test.ts`). `npx tsc -b --noEmit` limpio, cero regresiones en
      `src/features/pacientes`.

## 2. Contrato documental (condicional al Checkpoint (b))

> Si (b) = opción A (`entidadId` compuesto), esta sección entera **no existe** y el trabajo se mueve a
> §3. Si (b) = opción C (agrupación dentro de `DocumentChecklist`), esta sección no existe y el trabajo
> se mueve a §4.

- [x] 2.1 (RED→GREEN) `shared/types/documento.ts`: agregar el campo de agrupación **opcional** con el
      nombre confirmado en 0.1, documentado en el propio tipo (por qué es opcional, qué significa
      `undefined`, qué dominios lo usan).
      **Hecho (2026-08-06)**: `agrupacionId?: string` en `DocumentoAdjunto`.
- [x] 2.2 (RED→GREEN) `shared/lib/documentos/DocumentoRepository.ts`: `listByEntity` y `upload` aceptan
      la agrupación como parámetro **opcional**. `remove` y `resolverPrevisualizacion` **no cambian**
      (ya apuntan a un `documentoId` puntual, que es único dentro de la entidad sin importar la
      agrupación) — verificarlo explícitamente, no asumirlo.
      **Hecho (2026-08-06)**: agregado como último parámetro en ambos (después de `vigenciaDesde` en
      `upload`, para no reordenar callers posicionales). `remove`/`resolverPrevisualizacion` sin
      cambios, verificado con comparación de tipos `Parameters<...>` en
      `DocumentoRepository.agrupacion.types.test.ts`.
- [x] 2.3 (RED) Tests de `mockDocumentoRepository`: `listByEntity` con agrupación devuelve **solo** los
      documentos de esa agrupación; sin agrupación devuelve los que no tienen ninguna (o todos, según
      el veredicto de (c) — el test debe reflejar el veredicto, no la intuición de quien lo escribe).
      **Hecho**: refleja el veredicto (c) — sin agrupación devuelve solo los sin ninguna, no todos.
- [x] 2.4 (GREEN) Implementar en `mockDocumentoRepository.ts`. **Sin `SCHEMA_VERSION`** (D3 de
      `design.md`: el mock es memoria de sesión, no `localStorage`).
      **Hecho.**
- [x] 2.5 (TRIANGULATE) Caso cruzado obligatorio: dos agrupaciones distintas de la **misma** entidad,
      con el **mismo** `itemId` — ninguna ve los documentos de la otra (spec: "Los documentos de una
      actividad no se filtran a otra").
      **Hecho.**
- [x] 2.6 (RED→GREEN) `useDocumentChecklist.ts`: acepta la agrupación y la pasa al repository en
      `listByEntity`/`upload`; el estado local sigue acumulando (no filtra por `itemId`, comportamiento
      heredado de `pacientes-documentos-multiples`).
      **Hecho (2026-08-06)**: 5.º parámetro opcional `agrupacionId?: string`. Nota técnica: llama al
      repository con aridad condicional (2/4 args sin agrupación, 3/6 con) en vez de pasar siempre
      `agrupacionId` — a propósito, para no romper los `toHaveBeenCalledWith` de aridad exacta que
      hoy tienen `VehiculoDocumentos.test.tsx`/`ConductorDocumentos.test.tsx`/
      `FacturaDocumentos.test.tsx`, fuera de alcance de esta fase (eso es §7.1). Es deuda menor —
      cuando §7 toque esos tres tests, se puede simplificar a pasar `agrupacionId` siempre.

## 3. Pantalla de Pacientes — N checklists por composición (D1 de `design.md`)

- [x] 3.1 Safety net dirigido (`cd frontend && npx vitest run src/features/pacientes`) y registro del
      baseline antes de tocar estos archivos.
      **Hecho (2026-08-06)**: baseline 164/165 (1 flaky conocido, `PacientesRoute.test.tsx`).
- [x] 3.2 (RED→GREEN) `PacienteDetail.tsx`: la `Section` "Checklist documental" pasa a recibir las
      actividades del paciente (hoy solo recibe `paciente.id`). Sin cambio de layout de la `Section`
      en sí.
      **Hecho**: `direcciones={paciente.direcciones}` agregado a `<PacienteDocumentos>`.
- [x] 3.3 (RED→GREEN) `PacienteDocumentos.tsx`: además de resolver la obra social (comportamiento
      actual, sin cambios: estados `sin-obra-social` / `cargando` / `sin-checklist` / `listo`), monta
      **N** `PacienteDocumentosChecklist`, uno por actividad, cada uno con su etiqueta legible.
      Mantener los cuatro estados explícitos existentes — ninguno puede degradarse a pantalla en blanco
      ni loading infinito.
      **Hecho**: en el estado `listo`, arma bloque "General" + N bloques por actividad (via
      `obtenerActividadesConChecklist`/`etiquetaActividad` de §1). Los otros 3 estados sin cambios.
- [x] 3.4 (RED→GREEN) Caso "paciente sin actividades registradas": estado vacío explícito que invite a
      cargar una dirección, nunca una pantalla en blanco ni N=0 bloques sin explicación.
      **Hecho**: mensaje explícito invitando a cargar una dirección en "Traslados › Direcciones".
- [x] 3.5 (RED→GREEN) Bloque de documentación **sin actividad**, según el veredicto de (c): si es
      opción A, se renderiza primero, etiquetado como general.
      **Hecho**: bloque "Documentación general" siempre primero, con test explícito de orden.
- [x] 3.6 (RED→GREEN) `PacienteDocumentosChecklist.tsx`: pasa la agrupación al hook. `readOnly={!
      puedeEscribir}` se mantiene idéntico en las N instancias — **ningún permiso por actividad**
      (D2 de `design.md`).
      **Hecho**: props `agrupacionId?`/`label?` nuevas, `readOnly` sin cambios. Heading reusa
      `FieldGroupHeading` del design system, bloque envuelto en `role="group"`/`aria-label`.
- [x] 3.7 (TRIANGULATE) Test del escenario central del change: paciente con escuela + dos terapias
      distinguibles por descripción; subir un documento en la primera terapia **no** lo hace aparecer
      en la segunda ni en la escuela.
      **Hecho**: test contra `mockDocumentoRepository` real, con sanity check de que falla si se
      revierte el wiring de `agrupacionId` (no es tautológico). Suite dirigida final: 169/170 (mismo
      único flaky conocido), `tsc -b --noEmit` limpio.

## 4. Componente compartido `DocumentChecklist` — no cambia (verificación explícita)

- [x] 4.1 Verificar por test que `DocumentChecklist.tsx` **no cambió de contrato ni de
      comportamiento** — es el objetivo de diseño de D1, así que se prueba, no se asume. Si (b) se
      resolvió por la opción C, esta sección se reemplaza por la implementación de la prop de grupos y
      sus tests (con rama con-grupos y sin-grupos).
      **Hecho (2026-08-06)**: (b) fue opción B, no C — confirmado con `git diff`/`git log` que
      `DocumentChecklist.tsx` tiene cero cambios. Test de tipos
      (`DocumentChecklist.contract.types.test.ts`) fija las 7 props del contrato; sanity check
      manual (agregar `grupos?` temporalmente, confirmar que `tsc` falla, revertir) confirmado.
- [x] 4.2 Confirmar que el cálculo de `cargados`/`pendientes`/`pctCargado` por instancia sigue con la
      misma fórmula (a nivel ítem, "cargado" = al menos un documento) y que la marca de documento
      vigente sigue funcionando dentro de cada instancia — sin regresión respecto de
      `pacientes-documentos-multiples` ni de `documentos-previsualizacion`.
      **Hecho**: cobertura preexistente sigue en verde sin tocarla; agregado un test puntual de dos
      instancias montadas en paralelo con progreso aislado (ángulo nuevo que introduce §3).

## 5. Progreso agregado (condicional al Checkpoint (f))

- [x] 5.1 Si (f) = por actividad + total: (RED→GREEN) función pura que agrega el progreso de las N
      instancias y su render en el encabezado de la sección, reusando `ProgressBar`/`Chip` del design
      system. Casos: cero actividades, una actividad completa y otra vacía, todas completas.
      **Hecho (2026-08-07)**: (f) = opción A, ya resuelta por la usuaria. `agregarProgreso()` en
      `progresoDocumental.ts` (función pura, 4 casos incl. triangulación de "ninguna cargada").
      Encabezado nuevo en `PacienteDocumentos.tsx` (`role="group"` "Progreso total de
      documentación"), alimentado por un `onProgreso` que cada `PacienteDocumentosChecklist` reporta
      (misma fórmula de "cargado" que `DocumentChecklist.tsx`, no duplicada ahí). Cada actividad
      sigue mostrando su propia barra sin cambios.
- [x] 5.2 UX de longitud de pantalla: bloques de actividad colapsables, arrancando colapsados los que
      están completos. Reusar `Section`/componentes existentes — **nunca markup ad-hoc ni
      `style={{}}`**. Test de que colapsar/expandir no pierde estado del checklist.
      **Hecho (2026-08-07)**: solo los bloques de actividad (no "General", que no se multiplica por
      N) son colapsables, reusando `SeccionPlegable` (ya existente en `features/facturacion`, cross-
      feature import — convención ya usada en el repo). Arrancan colapsados si `cargados === total`
      una sola vez, apenas resuelve la carga inicial (no se recolapsan solos si el usuario reabre
      uno). Test de que colapsar/expandir no pierde el estado del checklist (documento sigue
      cargado, sin refetch — `listByEntity` se sigue llamando 1 vez por instancia).

## 6. Protección al quitar una actividad (condicional al Checkpoint (e))

- [x] 6.1 (RED→GREEN) Si (e) = advertir/bloquear: `DireccionesEditor.tsx` necesita saber cuántos
      documentos tiene cada dirección — dato que hoy **no recibe**. Definir cómo llega (prop desde
      `PacienteDetail`, no un fetch propio del editor) y testearlo.
      **Hecho (2026-08-07)**: nueva prop opcional `documentosPorDireccion?: Record<string, number>`
      en `DireccionesEditor`. `PacienteDetail.tsx` la calcula con su propio `useEffect` que llama
      `documentoRepository.listByEntity('paciente', paciente.id, direccion.id)` por cada dirección
      (conteo real de `DocumentoAdjunto`, no de ítems con ≥1 documento — deliberadamente no
      reutiliza el `progresos` de `PacienteDocumentos.tsx`/§5, que cuenta ítems cargados, no
      documentos crudos, y viviría en el componente equivocado para pasarlo a este editor). Sin
      entrada para un `id` (o sin la prop entera), se asume 0 — mismo comportamiento que antes del
      change. Test de integración en `PacienteDetail.test.tsx` verifica el `listByEntity` con el
      `agrupacionId` correcto.
- [x] 6.2 (RED→GREEN) Quitar una dirección **con** documentos: advertencia explícita con la cantidad y
      confirmación (o bloqueo, según veredicto). Reusar `Alert`/`Overlay` del design system.
      **Hecho (2026-08-07)**: `Overlay` (título "Quitar {tipo}") con un `Alert tone="warning"`
      mostrando la cantidad ("N documento(s) cargado(s)... vas a perder el acceso a esa
      documentación") y dos botones (`Button variant="secondary"` Cancelar / `variant="danger"`
      "Quitar de todas formas"). El `onChange` original solo se dispara al confirmar. 3 tests en
      `DireccionesEditor.test.tsx` (abre diálogo con la cantidad, confirmar quita, cancelar no
      quita y preserva la dirección en pantalla).
- [x] 6.3 (RED→GREEN) Quitar una dirección **sin** documentos: comportamiento idéntico al actual, sin
      pasos adicionales (spec: "Quitar una actividad sin documentación").
      **Hecho (2026-08-07)**: `documentosPorDireccion[id] === 0` (o `undefined`/prop ausente) sigue
      llamando a `onChange` directo, sin abrir el `Overlay` — 2 tests (con la prop explícita en 0 y
      sin pasar la prop en absoluto, no regresión sobre los tests de §8.1/8.2 preexistentes).
- [x] 6.4 Si (e) = sin protección: registrar el veredicto acá y **eliminar el requisito
      correspondiente del delta spec** — no dejar un spec que el código no cumple.
      **No aplica (2026-08-07)**: veredicto de (e) fue opción A (advertir y confirmar), no "sin
      protección" — el requisito "Quitar una actividad no destruye su documentación en silencio" de
      `specs/paciente-documentos/spec.md` queda vigente tal cual, satisfecho por 6.1-6.3.

## 7. Los otros tres dominios documentales — sin cambio de comportamiento

- [x] 7.1 Si §2 tocó el contrato: ajuste **mecánico** de `VehiculoDocumentos.test.tsx`,
      `ConductorDocumentos.test.tsx` y `FacturaDocumentos.test.tsx` a la forma nueva del tipo, **sin
      agregar comportamiento de negocio** en esos tres dominios.
      **Verificado, no hizo falta ningún cambio (2026-08-07)**: §2.6 ya diseñó `useDocumentChecklist`
      para llamar al repository con la aridad exacta de siempre cuando no recibe `agrupacionId`
      (2 args en `listByEntity`, 4 en `upload` — sin un 3.er/6.º argumento `undefined` explícito, ver
      comentario en `useDocumentChecklist.ts` líneas 29-38). Ninguno de los tres componentes
      (`VehiculoDocumentos.tsx`, `ConductorDocumentos.tsx`, `FacturaDocumentos.tsx`) pasa
      `agrupacionId` al hook, así que su forma de llamar a `useDocumentChecklist` no cambió. Safety
      net antes de tocar nada: `npx vitest run` sobre los 3 test files → 16/16 en verde sin
      modificarlos. `npx tsc -b --noEmit` limpio. Confirmado que 7.1 es un no-op de código — no se
      modificaron `VehiculoDocumentos.tsx`/`ConductorDocumentos.tsx`/`FacturaDocumentos.tsx` ni sus
      `*Items.ts`.
- [x] 7.2 Test explícito de no-regresión: con la agrupación en `undefined`, cada uno de los tres
      dominios se comporta exactamente igual que antes del change (spec: "Un dominio sin actividades
      sigue con un único checklist").
      **Hecho (2026-08-07)**: 1 test nuevo por dominio (3 en total) en cada `*Documentos.test.tsx`,
      describe `"— no regresión por agrupación (tasks.md 7.2)"`. Cada test hace que el repository
      mock devuelva documentos donde uno de ellos trae `agrupacionId` poblado (simula dato legacy o
      de otra integración, ya que el campo ahora existe en el tipo) y verifica: (1) todos los
      documentos siguen apareciendo juntos en el mismo checklist, (2) `screen.queryAllByRole('group')`
      tiene longitud 0 — `role="group"` es el marcador que usa
      `PacienteDocumentosChecklist.tsx` (§3.6) para cada bloque de actividad, así que su ausencia
      prueba "sin bloques por actividad" literalmente, y (3) `repository.listByEntity` se sigue
      llamando con exactamente 2 argumentos posicionales (sin un 3.er `agrupacionId` explícito).

## 8. Documentación y cierre

- [x] 8.1 `openspec/changes/documentos-checklist-por-actividad/specs/paciente-documentos/spec.md`:
      revisar el delta contra los veredictos reales de §0 y **quitar las notas "depende del
      Checkpoint"** de los requisitos ya resueltos, dejando el texto definitivo. Si (e) exigió tocar el
      editor de direcciones, agregar el delta sobre `paciente-direcciones`.
      **Hecho (2026-08-07)**: reemplazadas las 4 notas "Depende del Checkpoint" (a/c/e/f) por texto
      definitivo con el veredicto real de cada una (opción A/A/A/A respectivamente). El delta sobre
      `paciente-direcciones` ya existía de §6, confirmado consistente con el veredicto (e) — no
      duplicado.
- [x] 8.2 `knowledge-base/05_reglas_de_negocio.md`: agregar la RN nueva (numeración siguiente a
      **RN-FA-09**, que fue la que introdujo `pacientes-documentos-multiples`) que codifique "el
      checklist documental del paciente se instancia por actividad, no una vez por paciente".
      **Hecho (2026-08-07)**: `RN-FA-10` agregada.
- [x] 8.3 `knowledge-base/06_funcionalidades.md` US-102: nota de la dimensión nueva.
      **Hecho (2026-08-07)**: criterio de aceptación nuevo tildado, `RN-FA-10` sumada a "Reglas
      relacionadas".
- [x] 8.4 `knowledge-base/04_modelo_de_datos.md` §Paciente y §Discrepancias: registrar que la
      documentación del paciente pasa a colgar de la actividad, y que `pacientes.documentos` **no tiene
      hoy** columna para esa dimensión (a diferencia de la cardinalidad múltiple, que la base ya
      soportaba) — con la guía del Checkpoint (h) y su decisión de `ON DELETE` pendiente para el change
      de integración.
      **Hecho (2026-08-07)**: bullet nuevo en §Paciente (remite a §Discrepancias) y entrada completa
      nueva en §Discrepancias con la guía de migración de Checkpoint (h) y el `ON DELETE` pendiente.
- [x] 8.5 `AvisoModeloDatos` en la sección de documentación de `PacienteDetail`: cartel visible de que
      la asociación documento↔actividad todavía no tiene respaldo en el modelo real de la BD — mismo
      mecanismo que ya usan las secciones de Direcciones/CUD/Personas a cargo. Regla dura del proyecto:
      toda discrepancia se documenta en la KB **y** en la pantalla, nunca en un solo lado.
      **Hecho (2026-08-07, RED→GREEN→TRIANGULATE)**: `AvisoModeloDatos` agregado antes de
      `<PacienteDocumentos>` en `PacienteDetail.tsx`. 2 tests nuevos en `PacienteDetail.test.tsx`
      (estado "sin obra social" y estado "listo" con actividades) — 24/24 en verde, `tsc -b --noEmit`
      limpio.
- [x] 8.6 `CHANGES.md`: nota bajo `C-03`/`C-05` con fecha y referencia a este change, encadenada a las
      dos notas de refinamiento ya existentes (`pacientes-documentos-multiples`,
      `documentos-previsualizacion`).
      **Hecho (2026-08-07)**: nota completa bajo `C-03` (después de la de `integracion-documentos`) y
      nota corta bajo `C-05` remitiendo a la de `C-03`, mismo patrón de las dos notas previas.
- [x] 8.7 `cd frontend && npx vitest run` completo: cero regresiones contra el baseline de `0.4`.
      **Hecho (2026-08-07)**: ver resultado y comparación contra baseline en el detalle de la sección.
- [x] 8.8 `cd frontend && npx tsc -b --noEmit` limpio (NUNCA `tsc --noEmit` a secas).
      **Hecho (2026-08-07)**: limpio, cero errores.
- [x] 8.9 `cd frontend && npx oxlint` limpio (los warnings preexistentes en archivos no tocados no
      cuentan como regresión, pero se listan).
      **Hecho (2026-08-07)**: ver resultado en el detalle de la sección.

## 9. Verificación manual (bloqueante, a cargo de Enzo/la usuaria)

- [ ] 9.1 Con una cuenta con `pacientes: write`: en un paciente con escuela + dos terapias, confirmar
      que aparece un checklist por actividad, correctamente etiquetado, y que dos terapias distintas se
      distinguen sin ambigüedad.
- [ ] 9.2 Subir un documento en una terapia y confirmar que **no** aparece en la otra ni en la escuela.
- [ ] 9.3 Confirmar que dentro de una misma actividad sigue funcionando todo lo de los dos changes
      hermanos: varios documentos por ítem, marca de vigente, previsualización y "Quitar" por documento
      puntual.
- [ ] 9.4 Confirmar el comportamiento del bloque de documentación sin actividad, según el veredicto de
      (c).
- [ ] 9.5 Confirmar el comportamiento al quitar una actividad con documentación cargada, según el
      veredicto de (e).
- [ ] 9.6 Con una cuenta `pacientes: read`: la pantalla sigue en modo solo lectura sobre las N
      instancias (ningún botón de agregar/quitar activo, "Ver" sí disponible — el gateo de cliente
      nunca es más restrictivo que la RLS del servidor).
- [ ] 9.7 Smoke test manual de Vehículos, Conductores y Facturas: sus pantallas de documentación siguen
      exactamente igual que antes.
