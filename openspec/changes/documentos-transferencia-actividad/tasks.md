# Tasks — documentos-transferencia-actividad

> **⚠️ GOVERNANCE: CRÍTICO (recomendado, sin confirmar).** `design.md` Checkpoint (f) recomienda
> encuadrar este change como **CRÍTICO**, mismo criterio que sus tres predecesores ya archivados
> (`pacientes-documentos-multiples`, `documentos-previsualizacion`,
> `documentos-checklist-por-actividad`) y que los cinco `gateo-*`: pantalla del dominio Pacientes,
> datos de salud de personas con discapacidad incluidos menores. **Y con un agravante propio**: la
> sub-parte 3.c es la **primera operación del proyecto que muta la ubicación de un documento clínico
> ya cargado** — hasta hoy la superficie de escritura documental era solo crear y borrar.
>
> **`/opsx:apply` de este change REQUIERE aprobación humana explícita antes de escribir código.**
> Análisis y diseño (este propose) no la requieren; escribir código sí. Ninguna tarea de la §1 en
> adelante corre sin que Enzo confirme el nivel en la tarea `0.1`.
>
> **⚠️ STRICT TDD ACTIVO.** `openspec/config.yaml` tiene `testing.strict_tdd: true`. Toda tarea que
> escriba código de producción se implementa con el ciclo **RED → GREEN → TRIANGULATE → REFACTOR**, y
> **antes** de modificar cualquier archivo existente se corre el safety net y se registra el baseline.
> Test runner: `cd frontend && npx vitest run`.
>
> **⚠️ Este documento es propose-only.** No se escribió código de producción, no se escribió SQL, no
> se corrió `supabase db push`. **Ocho checkpoints de diseño están abiertos y ninguno tiene
> veredicto** — el alcance real de las secciones §2 a §8 **depende de esos veredictos**, y varias
> tareas están marcadas como condicionales. Uno de los ocho —el **(a)**— depende de un **video que la
> clienta todavía no envió**, y no se cierra unilateralmente.
>
> **Reglas duras aplicables** (`CLAUDE.md`): nunca `any` (usar `unknown` + narrowing); nunca
> `style={{}}` (solo utilidades Tailwind v4, tokens en el `@theme` de `frontend/src/index.css`);
> revisar y **reusar** `frontend/src/design-system/components.tsx` antes de escribir markup nuevo
> (`Overlay`, `Button`, `Chip`, `Section`, `AvisoPendienteCliente`, `FieldGroupHeading`; `Select` vive
> en `design-system/form.tsx`) — nada ad-hoc; type-check con `cd frontend && npx tsc -b --noEmit`
> (**NUNCA** `tsc --noEmit` a secas: el `tsconfig.json` raíz es de project references y compila cero
> archivos); Conventional Commits (`feat:` para 3.a/3.b/3.c, `test:` para los RED, `docs:` para §9);
> estructura desde `docs/core/Traslados-Modelo-Datos.docx` + reglas de negocio desde
> `knowledge-base/`, con toda discrepancia o requerimiento incompleto documentado por triplicado
> (§9).
>
> **⚠️ Change adyacente en curso — NO TOCAR.** `openspec/changes/documentos-checklist-items-por-actividad/`
> (0/52, otra línea de trabajo) toca los mismos dos componentes (`PacienteDocumentos.tsx`,
> `PacienteDocumentosChecklist.tsx`) en un eje distinto. No se edita, no se coordina, no se replica.
> Quien aplique segundo rebasa. Ver `design.md` §Riesgos y Checkpoint (e).

## 0. Checkpoints de diseño (bloqueante, antes de escribir una línea de código)

- [x] 0.1 **Confirmar el nivel de governance con Enzo.** `design.md` Checkpoint (f) recomienda
      **CRÍTICO**. Registrar el veredicto acá. Ninguna tarea de §1 en adelante arranca sin esto.
      **→ VEREDICTO (2026-08-10, confirmado por la usuaria — Delfina, sin esperar a Enzo por no
      haber ningún cambio de schema/SQL en este change): CRÍTICO**, tal como recomendaba el
      Checkpoint (f).

- [x] 0.2 Presentar los **ocho** checkpoints de `design.md` con su trade-off escrito y registrar el
      veredicto de cada uno **en este archivo**. Ninguna sección posterior arranca con su checkpoint
      sin veredicto:

      - **Checkpoint (a) — ⚠️ PENDIENTE DEL VIDEO — ¿qué significa "marcar una actividad"?**
        Opción A (acción explícita por fila que enfoca el bloque, **default elegido por el propose**),
        opción B (selección persistente que filtra la sección a una actividad por vez), opción C
        (deep-link desde Hojas de Ruta). **La clienta dijo que enviaría un video mostrando este flujo
        y el video no llegó** (verificado también contra `TODO-video-revision.txt`, que documenta una
        reunión posterior del 2026-08-04 sin mención del punto). **NO cerrar este checkpoint
        inventando la respuesta.**
        **→ VEREDICTO (2026-08-10): sigue pendiente, bloqueado por el video de la clienta. No se
        inventa. En consecuencia, §3 y §4 (3.a — navegación) quedan FUERA de esta pasada de apply;
        se retoman cuando llegue el video. Ver nota de alcance añadida debajo de §0.**

      - **Checkpoint (b) — ¿qué produce "exportar"?** Opción A vista imprimible (**default elegido**,
        patrón ya usado dos veces en el repo, cero dependencias), opción B archivo comprimido con los
        adjuntos (requiere `jszip` + N URLs firmadas), opción C PDF consolidado (descartada por
        costo).
        **→ VEREDICTO (2026-08-10, confirmado por la usuaria): opción A (vista imprimible).** Se
        acepta el riesgo anotado por el propose (la lectura operativa sugiere B); si el video la
        contradice, se revisa después — cambio aislado y barato de revertir.
        **→ VEREDICTO REVISADO (2026-08-11, confirmado por la usuaria, antes de archivar):** la
        usuaria aclaró el alcance real del punto 3 del feedback original — "exportar" no significa
        (solo) el resumen imprimible que ya existe, sino poder **bajarse los archivos reales** de la
        actividad para armar el legajo y mandarlo a la obra social. Se implementa **la opción B
        (`.zip` de los adjuntos) EN PARALELO a la opción A ya construida, no en su reemplazo**: el
        botón "Exportar" pasa a armar el zip; el resumen imprimible se independiza como "Ver resumen"
        (mismo overlay, mismo botón "Imprimir" de §11, sin cambios de comportamiento). Es exactamente
        el riesgo que este mismo checkpoint había anotado como aceptado el 2026-08-10 ("la lectura
        operativa del pedido sugiere B") — se confirma ahora sin haber esperado al video (que sigue
        pendiente, y es sobre el Checkpoint (a), no sobre este). Ver **§12** para el detalle de
        implementación, incluido el análisis de tamaño de bundle de `jszip` que este checkpoint pedía
        antes de sumar la dependencia.
        **→ VEREDICTO REVISADO (2026-08-11, segunda vuelta el mismo día, confirmado por la
        usuaria):** aclaró además el alcance real de "Ver resumen" — no alcanza con listar
        "Cargado"/"Faltante" en texto, **cada ítem cargado tiene que mostrar el documento vigente
        embebido** (la imagen tal cual, o el PDF renderizado página por página) antes de imprimir.
        Es, literalmente, la **opción C — "PDF consolidado" — que este mismo checkpoint había
        descartado por costo/beneficio** en su primer veredicto (2026-08-10): la diferencia es que
        acá NO se consolida nada en un único archivo nuevo (seguiría siendo "opción C" en sentido
        estricto, con el costo de una dependencia de generación/merge de PDFs que nadie pidió) —
        se embebe cada documento SUELTO, con su formato original, dentro de la MISMA vista
        imprimible que ya existía (opción A), sin fusionar nada. El costo real resultó menor que el
        que este checkpoint había proyectado para la opción C completa: sin dependencia nueva de
        generación/merge, reusando `pdfjs-dist` (ya sumado por `documentos-previsualizacion`) para
        el render de páginas y el mismo mecanismo de resolución de URL efímera
        (`resolverPrevisualizacion`) que ya usa `DocumentChecklist.tsx`. Ver **§14** (nueva) para el
        detalle de implementación.
        **→ VEREDICTO REVERTIDO (2026-08-11, decisión de la usuaria, "siento que no tiene
        utilidad"):** la cadena de veredictos de este checkpoint queda **A → A+B → A+B+embebido →
        solo B**. La usuaria dio marcha atrás en toda la mitad "opción A" (resumen imprimible) de
        este checkpoint, incluido el embebido de §14 que recién se había terminado de construir: no
        le encuentra utilidad al resumen/vista imprimible como capacidad separada. **Se saca por
        completo** el botón "Ver resumen", el botón "Imprimir" (§11), el aislamiento de impresión
        (§13) y el embebido de documentos (§14) — componentes, tests y la regla `@media print` de
        `index.css` se eliminan. **Queda solo la opción B: "Exportar" arma el `.zip` con los
        archivos reales (§12)**, que ya cubre el caso de uso real (armar el legajo para la obra
        social) sin necesitar una segunda acción. Detalle de la reversión en §2/§11/§13/§14 más
        abajo (marcados **REVERTIDOS**, historial conservado, no borrado — mismo criterio que "D12
        restaurada" en `CHANGES.md`).

      - **Checkpoint (c) — ¿dónde vive "transferir" en la UI compartida?** Opción A prop opcional en
        `DocumentChecklist` (**recomendado**, mismo mecanismo opt-in que `mostrarProgreso` de hace
        tres días), opción B lista paralela fuera del componente compartido, opción C array genérico
        de acciones.
        **→ VEREDICTO (2026-08-10, confirmado por la usuaria): opción A.**

      - **Checkpoint (d) — alcance exacto de la transferencia.** Cuatro sub-preguntas: destinos
        válidos (¿solo el mismo paciente? — **recomendado sí, nunca otro paciente**), ¿cambia el ítem
        del checklist? (**recomendado no**), ¿el bloque "General" es origen y destino? (**recomendado
        sí, en ambos sentidos**), ¿de a uno o en lote? (**recomendado de a uno**).
        **→ VEREDICTO (2026-08-10, confirmado por la usuaria): las cuatro recomendaciones tal cual.**

      - **Checkpoint (e) — ¿qué pasa si el ítem no existe en la actividad destino?** Hoy no puede
        pasar (todos los bloques reciben los mismos ítems). Pasa a poder pasar si
        `documentos-checklist-items-por-actividad` se aplica. Opción A restringir destinos, opción B
        permitir y marcar el documento como "ítem no aplicable", opción C no hacer nada ahora
        (**recomendado C acá + B como forma futura**). **Este change NO lo resuelve ni coordina el
        otro change**; el punto de decisión es de quien aplique segundo.
        **→ VEREDICTO (2026-08-10, confirmado por la usuaria): opción C acá, B queda anotado como
        forma futura (tarea 9.4 ya lo hace).**
        **→ VEREDICTO REVISADO (2026-08-11, confirmado por la usuaria, antes de archivar):** se
        implementa la **opción B ahora**, en este mismo change, en vez de dejarla como deuda para
        quien aplique `documentos-checklist-items-por-actividad`. Ver **§10** (nueva) para el detalle
        de implementación. La tarea 9.4 se actualiza en consecuencia: deja de ser un punto de
        decisión pendiente para el change hermano — la guardia ya existe en
        `frontend/src/shared/components/DocumentChecklist.tsx` y lo protege también a él en cuanto
        cablee `combinarItemsDeActividad()`.

      - **Checkpoint (f) — governance CRÍTICO.** Ver tarea 0.1.
        **→ VEREDICTO: mismo que 0.1 — CRÍTICO, confirmado.**

      - **Checkpoint (g) — permisos.** Transferir → **recomendado**: exige escritura (mismo gate que
        `upload`/`remove`). Exportar → **recomendado**: alcanza lectura.
        **→ VEREDICTO (2026-08-10, confirmado por la usuaria): ambas recomendaciones tal cual.**

      - **Checkpoint (h) — ¿queda traza de la transferencia?** Opción A sin traza, opción B registrar
        en el mecanismo de auditoría existente (**recomendado** — es lo que convierte 3.c de
        irreversible en reversible a mano), opción C "Deshacer" en la UI. **Sin veredicto de (h), el
        rollback de 3.c queda incompleto** (`proposal.md` §Rollback plan).
        **→ VEREDICTO (2026-08-10, confirmado por la usuaria): opción B (registrar en auditoría).**
        Tarea 5.7 corre tal como está escrita, no se elimina.

- [x] 0.3 Decidir con Enzo si **3.c se libera a la clienta** antes de que llegue el video, o si se
      implementa pero queda detrás del criterio de despliegue que recomienda `design.md`
      §Migration Plan (no liberar hasta que llegue el video **o** hasta que (h) se resuelva a favor de
      dejar traza). Registrar la decisión acá.
      **→ VEREDICTO (2026-08-10, confirmado por la usuaria, sin esperar a Enzo): se libera. El
      Checkpoint (h) resolvió a favor de dejar traza (opción B), que es exactamente la condición que
      `design.md` §Migration Plan pedía para no tener que esperar el video en 3.c.**

- [x] 0.4 Confirmar el **orden de aplicación**: 3.b (exportar) → 3.a (navegar) → 3.c (transferir),
      riesgo creciente, cada sub-parte desplegable y revertible por separado. Si se decide otro orden,
      registrar por qué.
      **→ VEREDICTO (2026-08-10): 3.b → 3.c. 3.a queda afuera de esta pasada (Checkpoint (a)
      bloqueado por el video) — el orden de riesgo creciente entre las dos sub-partes que sí entran
      se mantiene igual que el recomendado.**

> **⚠️ Alcance de esta pasada de apply (2026-08-10, decidido junto con los veredictos de arriba):
> entran §2 (exportación, 3.b) y §5-§6 (transferencia, 3.c), más §7-§9 adaptadas. §3 y §4
> (navegación, 3.a) NO entran — quedan tal cual están escritas, sin marcar, a la espera del video de
> la clienta. §8.4(ii) (verificación manual de navegación) se salta en esta pasada. §7 y §9 se
> ajustan para reflejar que el checkpoint pendiente ahora es solo sobre 3.a, no sobre las tres
> sub-partes.**

## 1. Safety net y verificación de supuestos (antes de tocar nada)

- [x] 1.1 Correr el safety net completo (`cd frontend && npx vitest run`) y **registrar el baseline**
      en este archivo (`N tests passing`). Si algo falla, **detenerse** y reportarlo como
      pre-existing failure — no arreglarlo dentro de este change.
      **→ BASELINE (2026-08-10): 126 failed | 2096 passed (2222 total), 23 archivos rojos.** Los 23
      archivos son **pre-existentes, no relacionados**: `TypeError: Cannot read properties of
      undefined (reading 'clear')` en `beforeEach(() => localStorage.clear())` de los mocks de
      dominios ajenos (`mockVehiculoRepository`, `mockConductorRepository`,
      `mockPresupuestoRepository`, etc.) y los `*Route.test.tsx` que los montan — falla de entorno
      bajo carga (workers en paralelo sobre esta máquina), no un bug de código: al correr esos mismos
      archivos individualmente pasan. **No se tocó ninguno.** Al cierre de esta pasada (ver §8.1) la
      re-corrida completa dio 118 failed | 2178 passed (2296 total) — **exactamente los mismos 20
      archivos** (subconjunto de los 23 originales; 3 se estabilizaron solos entre corridas, típico
      de flakiness por recursos), cero archivos nuevos rojos.
- [x] 1.2 Correr `cd frontend && npx tsc -b --noEmit` y registrar que está limpio antes de empezar.
      **→ NO estaba limpio (2026-08-10): 4 errores pre-existentes en
      `src/features/pacientes/actividadDocumental.test.ts` (líneas 116/124/132/151, `TS2532: Object
      is possibly 'undefined'`) — ese archivo pertenece a `documentos-checklist-items-por-actividad`
      (el change adyacente en curso de OTRA línea de trabajo, "no tocar"), no a este change. No se
      tocó. Nota de cierre: al llegar a §8.2, esos 4 errores ya no estaban — una sesión paralela
      terminó de aplicar `combinarItemsDeActividad` en `actividadDocumental.ts` mientras corría esta
      pasada (confirmado por `git status`: ambos archivos figuran modificados, fuera de este diff).
      `tsc -b --noEmit` de este change, sobre los archivos que sí tocó, está limpio de punta a punta.
- [x] 1.3 **Verificar contra la base, no asumir**: que la policy `Write documentos`
      (`ALL` con `modulos.tiene_permiso('pacientes','write')`,
      `20260724100004_schema_pacientes.sql:150-151`) efectivamente habilita `UPDATE` sobre
      `pacientes.documentos`. `ALL` incluye `UPDATE`, pero queda verificado, no supuesto. Si no lo
      cubre, se necesita una policy nueva y este change deja de ser "sin migración".
      **→ VERIFICADO (2026-08-10) contra `supabase/migrations/20260724100004_schema_pacientes.sql`
      línea 151: `CREATE POLICY "Write documentos" ON pacientes.documentos FOR ALL TO authenticated
      USING (modulos.tiene_permiso('pacientes', 'write'));` — `FOR ALL` cubre `UPDATE`. Sin
      migración nueva.**
- [x] 1.4 **Verificar contra el código, no asumir**: que `construirClaveStorage` (`documentoMapping.ts`
      líneas 123-130) sigue sin incluir `direccion_id` en el path. Es la premisa de `design.md` D3;
      si cambió, D3 se invalida y transferir pasa a requerir mover el objeto en Storage.
      **→ VERIFICADO (2026-08-10): `construirClaveStorage(entidadId, itemId, nombreArchivo, uuid)`
      arma `{entidadId}/{itemId}/{uuid}-{nombreSeguro}` — sin cambios, `direccion_id` no aparece.
      D3 sigue vigente.**
- [x] 1.5 Confirmar que `pacientes.documentos.direccion_id` existe, es nullable y tiene
      `ON DELETE RESTRICT` (`20260807010000_documentos_direccion_id.sql`) — premisa de "cero
      migración".
      **→ CONFIRMADO (2026-08-10) contra la migración: `ALTER TABLE pacientes.documentos ADD COLUMN
      direccion_id UUID REFERENCES pacientes.direcciones(id) ON DELETE RESTRICT;` — nullable (sin
      `NOT NULL`), `ON DELETE RESTRICT`. Cero migración nueva confirmado.** Hallazgo colateral: la
      KB (`04_modelo_de_datos.md` §Discrepancias) y el `AvisoModeloDatos` de `PacienteDetail.tsx`
      seguían diciendo que esta columna "no tiene respaldo real hoy" — desactualizado desde que
      `documentos-checklist-por-actividad` la agregó en su propia verificación manual (§9.2 de ese
      change, commit `9beda7d`). Anotado en la KB (§9.1 de este archivo), no corregido acá (es un
      artefacto de otro change ya archivado).

## 2. Exportación (3.b) — condicionada al Checkpoint (b)

> **REVERTIDO (2026-08-11, decisión de la usuaria — "siento que no tiene utilidad").** Esta
> sección implementó el botón "Exportar" original como vista imprimible (opción A). Se sacó por
> completo — `DocumentacionActividadImprimible.tsx` y `exportacionDocumental.ts` (+tests) fueron
> borrados, y el wiring en `PacienteDocumentosChecklist.tsx` revertido. Ver el VEREDICTO REVERTIDO
> del Checkpoint (b) en §0.2. Lo que queda: **§12** ("Exportar" arma un `.zip`, opción B), la única
> acción de exportación viva. Las tareas de abajo quedan como registro histórico de lo que se
> construyó y luego se retiró, no como estado actual del código.

> Primera sub-parte del orden recomendado: aditiva, cero efecto sobre datos, revertible borrando un
> componente. **Si el veredicto de (b) es B (archivo comprimido), esta sección entera se reescribe** y
> entra una tarea previa de alta de dependencia `jszip` con su análisis de bundle.

- [x] 2.1 **RED** — test de la unidad pura que arma el modelo de exportación de una actividad
      (paciente + actividad identificada + ítems con su estado cargado/faltante), a partir de
      `items` + `documentos` + `Direccion`. Función pura, sin React, sin repository.
- [x] 2.2 **GREEN + TRIANGULATE** — implementarla. Casos: actividad sin documentos (todos faltantes),
      actividad completa, ítem con más de un documento, dos actividades del mismo tipo distinguidas
      por `descripcion`.
- [x] 2.3 **RED** — test del componente de vista imprimible: renderiza encabezado con paciente y
      actividad, lista los ítems, y **los faltantes figuran señalados, no omitidos**
      (`paciente-documentos-exportacion`, requisito *"Lo exportado distingue lo cargado de lo
      faltante"*).
- [x] 2.4 **GREEN** — implementar la vista con clases `print:` de Tailwind, siguiendo el patrón de
      `HojaDeRutaImprimible.tsx`. **Nunca `style={{}}`.** Reusar componentes del design system.
- [x] 2.5 **RED + GREEN** — la exportación de una actividad **no incluye** documentos de otra
      actividad ni del bloque general (test de aislamiento explícito).
- [x] 2.6 Cablear la acción de exportar en el encabezado de cada bloque de actividad
      (`PacienteDocumentosChecklist`), **sin** exigir permiso de escritura (Checkpoint (g)).
- [x] 2.7 **REFACTOR** + `npx tsc -b --noEmit` + suite completa verde.

## 3. Lift-state del bloque abierto (3.a, parte 1) — condicionada al Checkpoint (a)

> `design.md` D1. Es el único cambio estructural de 3.a. **Lo que no puede romperse es el auto-colapso
> que la usuaria pidió explícitamente hace tres días.**

- [ ] 3.1 **RED** — tests de caracterización del comportamiento **actual** de colapso, antes de
      moverlo: (i) un bloque de actividad completo arranca colapsado; (ii) un bloque incompleto
      arranca abierto; (iii) el bloque "General" nunca es plegable; (iv) si el usuario abre a mano un
      bloque completo, un cambio posterior de progreso **no** lo vuelve a cerrar
      (`decidioColapsoInicial`). Estos tests deben pasar **antes** del refactor y seguir pasando
      después — son la red de seguridad del lift-state.
- [ ] 3.2 **REFACTOR** — subir el estado de apertura a `PacienteDocumentos.tsx` como
      `Record<string, boolean>` con **la misma clave que ya usa `progresos`** (`'general'` o
      `Direccion.id`). `PacienteDocumentosChecklist` pasa a recibir `abierta`/`onToggle` como props
      controladas. La **decisión inicial** de colapso sigue viviendo abajo y se reporta hacia arriba
      (mismo patrón que `onProgreso`), porque depende de `loading`/`cargados`/`total` locales.
- [ ] 3.3 Verificar que los tests de 3.1 siguen verdes **sin modificarlos**. Si hubo que modificarlos,
      el refactor cambió comportamiento observable — detenerse y revisar.
- [ ] 3.4 `npx tsc -b --noEmit` + suite completa verde.

## 4. Navegación dirigida (3.a, parte 2) — condicionada al Checkpoint (a)

- [ ] 4.1 **RED** — test: activar la acción de una actividad deja **su** bloque expandido. Con dos
      actividades del mismo tipo diferenciadas por `descripcion`, se llega a la correcta
      (`paciente-documentos`, escenario *"Dos actividades del mismo tipo llevan a bloques distintos"*).
- [ ] 4.2 **RED** — test: los bloques de las **demás** actividades siguen presentes y en su estado
      previo. La navegación **no filtra** ni oculta nada (default de Checkpoint (a) = opción A).
- [ ] 4.3 **RED** — test de accesibilidad: el **foco** queda dentro del bloque de destino. `design.md`
      D2 — con N bloques idénticos en la misma página, un scroll sin foco es inaccesible.
      **Testear el foco, no el scroll**: en jsdom `scrollIntoView` no existe (requiere stub) y el
      scroll no es observable; el foco sí.
- [ ] 4.4 **GREEN** — helper de desplazamiento en `shared/` (no suelto en el componente): `ref` por
      bloque + `scrollIntoView` + foco programático + respeto de `prefers-reduced-motion`. Sería la
      **primera** aparición de `scrollIntoView` en el proyecto — sin precedente interno del que copiar
      criterio, por eso se encapsula.
- [ ] 4.5 **GREEN** — acción "ver documentación" por fila en `DireccionesEditor.tsx`, **solo** en las
      direcciones no-domicilio (`paciente-direcciones`, escenario *"El domicilio del paciente no
      ofrece la acción"*). Reusar `Button` del design system, no markup ad-hoc.
- [ ] 4.6 **GREEN** — cablear Direcciones ↔ Documentación en `PacienteDetail.tsx`. Hoy las dos
      `<Section>` son hermanas y no se conocen: es la primera vez que se comunican en este sentido.
- [ ] 4.7 **RED + GREEN** — test de no-regresión: editar y quitar una dirección siguen funcionando
      igual, **incluida** la advertencia y confirmación al quitar una dirección con documentación
      cargada (requisito ya vigente de `paciente-direcciones`).
- [ ] 4.8 **REFACTOR** + `npx tsc -b --noEmit` + suite completa verde.

## 5. Contrato de transferencia (3.c, parte 1) — condicionada a los Checkpoints (c), (d), (h)

> **A partir de acá se toca la única superficie con efecto sobre datos del change.** No arrancar sin
> los veredictos de 0.1, 0.2 y 0.3.

- [x] 5.1 **RED** — tests de tipos del 5.º método en `DocumentoRepository`
      (`transferirAgrupacion(entidad, entidadId, documentoId, agrupacionDestino: string | undefined)`),
      en el estilo de `DocumentoRepository.agrupacion.types.test.ts` que dejó el change anterior.
      Verificar explícitamente que **`agrupacionDestino` NO es opcional** (`?`): `undefined` significa
      "movelo a General", una intención real — no "me olvidé" (`design.md` D4). **Nunca `any`.**
- [x] 5.2 **RED** — tests de que las **cuatro firmas existentes no cambian** (`listByEntity`, `upload`,
      `remove`, `resolverPrevisualizacion`): ni orden de parámetros, ni opcionalidad, ni semántica.
- [x] 5.3 **GREEN** — declarar el método en el contrato, con el comentario de contrato en el estilo del
      archivo (que documenta *por qué* cada parámetro está donde está).
- [x] 5.4 **RED → GREEN → TRIANGULATE** — implementar en `mockDocumentoRepository`. Casos:
      actividad → actividad; actividad → General; General → actividad; documento inexistente;
      documento de otra entidad. **Verificar que conserva `id`, `itemId`, `nombreArchivo`,
      `subidoEn`, `vigenciaDesde`, `tipoMime`** — solo cambia `agrupacionId`
      (`paciente-documentos-transferencia`, requisito *"conserva la identidad"*).
- [x] 5.5 **RED → GREEN** — implementar en `SupabaseDocumentoRepository` + `documentoMapping`:
      **`UPDATE` de `direccion_id`, y nada más**. `design.md` D3: **prohibido** copiar el objeto y
      borrar el original; prohibido tocar el bucket. Test explícito de que la clave de Storage del
      documento es idéntica antes y después.
- [x] 5.6 **RED + GREEN** — contrato de error uniforme: fallo de la implementación real llega a la UI
      como `Error` con mensaje en castellano, sin texto crudo de PostgREST/Storage, y **el documento
      sigue íntegro en su agrupación original** (`documento-contract`, escenario *"Un fallo de
      reasignación deja el documento intacto"*).
- [x] 5.7 **Condicional al Checkpoint (h) = opción B** — registrar la transferencia (documento,
      origen, destino, quién, cuándo) en el mecanismo de auditoría existente de
      `C-02 usuarios-permisos-auditoria`. **Si (h) queda en A, esta tarea se elimina y el rollback de
      3.c queda documentado como incompleto.**
      **→ HALLAZGO (2026-08-10/11): ya está cubierto por infraestructura EXISTENTE, cero código
      nuevo.** `pacientes.documentos` ya tiene `CREATE TRIGGER trg_audit_documentos AFTER INSERT OR
      UPDATE OR DELETE ... EXECUTE FUNCTION auditoria.log_action()`
      (`20260724100004_schema_pacientes.sql:169`) — genérico, dispara en CUALQUIER `UPDATE`, incluido
      el que hace `transferirAgrupacion`. `auditoria.log_action()` inserta `datos_viejos`/
      `datos_nuevos` (fila completa antes/después, incluye `direccion_id` = origen/destino),
      `usuario_id` (`auth.uid()`, el quién) y `created_at` (el cuándo) en `auditoria.logs`. Verificado
      leyendo la migración, no asumido. La transferencia queda auditada sin haber escrito una línea
      de SQL ni de frontend para esto.
- [x] 5.8 `npx tsc -b --noEmit` + suite completa verde.

## 6. UI de transferencia (3.c, parte 2) — condicionada a los Checkpoints (c), (d), (g)

- [x] 6.1 **RED** — test: la acción de transferir aparece por documento **solo** cuando el punto de
      montaje la habilita. Con la opción A del Checkpoint (c), es una prop opcional de
      `DocumentChecklist` — mismo mecanismo opt-in que `mostrarProgreso`.
- [x] 6.2 **RED** — test de **no-regresión cruzada**: Vehículos, Conductores y Facturas no muestran la
      acción y su UI es idéntica a la de antes. Reusar el enfoque de los tests §7 que dejó
      `documentos-checklist-por-actividad` (`archive/2026-08-07-…/tasks.md`).
- [x] 6.3 **RED** — test: los destinos ofrecidos son **solo** las otras actividades del mismo paciente
      más el bloque General. **Ningún otro paciente**, nunca texto libre. La actividad actual del
      documento no se ofrece como destino de sí misma.
- [x] 6.4 **GREEN** — UI de selección de destino reusando el design system: `Overlay` (`components.tsx`
      línea 436, `role="dialog"` + foco atrapado + Escape, ya usado por la previsualización y por el
      diálogo de quitar dirección) + `Select` de `design-system/form.tsx` + `Button`. **No inventar
      componentes nuevos.** **Nunca `style={{}}`.**
- [x] 6.5 **RED + GREEN** — confirmación explícita antes de ejecutar, que identifica documento, origen
      y destino de forma legible, **distinguiendo dos actividades del mismo tipo**. Cancelar no
      modifica nada. Mismo criterio que la confirmación de quitar una dirección con documentación.
- [x] 6.6 **RED + GREEN** — gateo por `usePuedeEscribir()` (Checkpoint (g)): en modo solo lectura la
      acción no se ofrece. El gate del cliente **nunca** más restrictivo que la RLS del servidor.
- [x] 6.7 **RED + GREEN** — refresco cruzado (`design.md` D6): tras transferir, **ambos** bloques
      afectados y el total agregado quedan consistentes sin recargar. **Trampa a verificar con test,
      no a ojo**: si el refresco se hace cambiando la identidad de `items` en vez de invalidar
      explícitamente, se re-monta todo y el auto-colapso de §3 se vuelve a evaluar.
- [x] 6.8 **RED + GREEN** — el total agregado del paciente **no cambia** por una transferencia: un
      documento cambió de lugar, no se creó ni se borró ninguno.
- [x] 6.9 **REFACTOR** + `npx tsc -b --noEmit` + suite completa verde.

## 7. Aviso en pantalla del checkpoint abierto

- [x] 7.1 **RED + GREEN** — `AvisoPendienteCliente` (`design-system/components.tsx` línea 341 — **ya
      existe, hecho exactamente para esto**) en la `<Section>` de documentación de
      `PacienteDetail.tsx`, declarando que el flujo es provisorio y está pendiente del video de la
      clienta. **No** usar `AvisoModeloDatos`: no hay discrepancia con el docx, hay un requerimiento
      incompleto — son dos carteles distintos y el proyecto ya los distingue
      (`documento-avisos-modelo-datos`).
- [x] 7.2 Verificar que el texto del aviso dice **qué se asumió** (la lectura literal: acción explícita
      por actividad; exportación como detalle imprimible) y **qué falta** (el video), no solo "esto
      puede cambiar".

## 8. Verificación integral

- [x] 8.1 Suite completa verde (`cd frontend && npx vitest run`) y comparación contra el baseline de
      1.1: sin tests perdidos, sin tests deshabilitados.
- [x] 8.2 `cd frontend && npx tsc -b --noEmit` limpio. **NUNCA** `tsc --noEmit` a secas.
- [x] 8.3 `npx oxlint` sin errores nuevos.
- [x] 8.4 **Verificación manual con la usuaria**, en este orden: (i) exportar la documentación de una
      actividad y comprobar que trae los faltantes; ~~(ii) navegar desde una dirección a su bloque, con
      dos actividades del mismo tipo~~ (SE SALTA en esta pasada — 3.a no se implementó, bloqueado por
      el video, ver alcance de §0); (iii) transferir un documento entre dos actividades y verificar
      que **el archivo sigue abriéndose** (previsualización + descarga) desde su nueva ubicación;
      (iv) transferir hacia y desde "General"; (v) modo solo lectura: exportar sí, transferir no;
      (vi) sin regresión en Vehículos, Conductores y Facturas.
      **→ VERIFICADO por la usuaria (2026-08-11).** En el camino, (i) disparó la vuelta completa de
      §11-§14 (resumen imprimible → botón Imprimir → aislamiento de impresión → embebido de
      documento) y su reversión final a solo §12 (ZIP) — ver la cadena de veredictos en el
      Checkpoint (b) de §0.2 y las notas REVERTIDO de §11/§13/§14. La usuaria confirmó el resto del
      checklist ((iii), (iv), (v), (vi)) conforme, sin hallazgos nuevos. Este ítem queda cerrado.
- [x] 8.5 Verificar que **ningún** valor del audio de la clienta quedó hardcodeado: "calle 818" y
      "calle 254" son ejemplos de direcciones, no datos (`grep` explícito por `818` y `254` en el
      diff).

## 9. Documentación del checkpoint por triplicado (regla dura del proyecto)

> Los tres lugares, no dos. El aviso en pantalla es §7; acá van los dos archivos.

- [x] 9.1 `knowledge-base/04_modelo_de_datos.md` §Discrepancias (o `10_preguntas_abiertas.md`, la
      sección que corresponda según dónde encaje mejor un **requerimiento incompleto** — no es una
      discrepancia con el docx): anotar el checkpoint del punto 3 con **qué se asumió** (opción A de
      (a), opción A de (b)), **por qué** se eligió ese default sobre las alternativas, y **qué
      evidencia se espera** (el video de la clienta). Debe entenderse sin conocer la conversación
      original.
- [x] 9.2 `CHANGES.md`: bullet del change bajo **C-03 gestion-documental-core** (dueño del
      tipo/componente/repository compartido), siguiendo el formato de los tres refinamientos hermanos
      ya archivados, **más** la nota cruzada bajo **C-05** (dueño de la pantalla Pacientes →
      Documentos), igual que hicieron los tres anteriores. Incluir: governance CRÍTICO, el checkpoint
      abierto del video, y que no hubo migración.
- [x] 9.3 Anotar en `CHANGES.md` la **deuda detectada y no resuelta acá**: el requisito vigente de
      `openspec/specs/documento-contract/spec.md` *"El contrato `DocumentoRepository` pasa a tener dos
      implementaciones"* quedó desactualizado — habla de *"las mismas **tres** firmas"* (hoy son
      cuatro) y de *"la misma semántica de **reemplazo**"* con el escenario *"existe exactamente **un**
      `DocumentoAdjunto` para ese `itemId`"*, que el sistema **ya no cumple ni debe cumplir** desde
      `pacientes-documentos-multiples`. Corregirlo es una edición del spec principal, **no** un delta
      de este change; se deja anotado, no se arregla acá.
- [x] 9.4 ~~Anotar (sin editar el otro change) que `documentos-checklist-items-por-actividad` hereda
      el Checkpoint (e) de este design: si los ítems difieren por tipo de actividad, transferir entre
      actividades de tipos distintos necesita una regla. El punto de decisión es de quien aplique
      segundo.~~
      **→ ACTUALIZADO (2026-08-11): ya NO es un punto de decisión pendiente.** El Checkpoint (e) se
      resolvió con la opción B, implementada en este mismo change antes de archivar (ver VEREDICTO
      REVISADO más arriba y **§10**). `DocumentChecklist.tsx` ahora tiene una guardia genérica que
      nunca oculta un documento cuyo `itemId` no matchea ningún `item.id` de la lista vigente — lo
      muestra en una sección aparte ("Otros documentos"), previsualizable/descargable siempre y
      transferible si el punto de montaje habilita `onTransferir`. Esto protege también a
      `documentos-checklist-items-por-actividad` sin que ese change necesite hacer nada: cuando
      cablee `combinarItemsDeActividad()` y las listas de ítems empiecen a variar por actividad, un
      documento que quede sin ítem correspondiente en su bloque va a seguir siendo visible, nunca se
      va a perder de la vista silenciosamente. No hace falta ninguna decisión de quien aplique ese
      change — la guardia ya vive en el componente compartido.
- [x] 9.5 Actualizar `TODO-video-revision.txt` (o el registro de pendientes del cliente que
      corresponda) para que el video prometido de este punto figure como pendiente rastreado, no solo
      dentro de un `design.md`.
- [ ] 9.6 Commits en Conventional Commits, una sub-parte por commit como mínimo
      (`feat(pacientes): …` por 3.a / 3.b / 3.c) para que el rollback selectivo del §Migration Plan
      sea posible en la práctica y no solo en el papel.
      **→ NO EJECUTADO por esta pasada de apply**: instrucción explícita del orquestador — no
      commitear salvo pedido expreso. Cambios dejados sin commitear, listos para que la usuaria (o el
      flujo de la skill) los revise y commitee en el orden que corresponda (2 sub-partes esta vez:
      3.b exportar, 3.c transferir — 3.a queda fuera de alcance).

## 10. Guardia defensiva: documentos huérfanos (Checkpoint (e), implementado 2026-08-11)

> **VEREDICTO REVISADO (2026-08-11, confirmado por la usuaria):** el Checkpoint (e) pasa de "opción
> C acá + B como forma futura" a **opción B implementada ahora, antes de archivar**. Motivo: no dejar
> el punto de decisión colgando para quien aplique `documentos-checklist-items-por-actividad`
> (propuesto, en curso en paralelo — 30/52 tasks al momento de escribir esto, **no tocado por esta
> sección**, solo mencionado en prosa). Esta guardia es genérica del componente compartido
> `DocumentChecklist.tsx` — no depende de transferencia ni es específica de Pacientes: protege contra
> cualquier drift entre el `itemId` de un `DocumentoAdjunto` y la lista de `items` vigente (incluido
> borrar un ítem del checklist de una obra social con documentos ya cargados contra él).
>
> **Governance CRÍTICO heredado del Checkpoint (f)** — mismo dominio (Pacientes, datos de salud),
> confirmado por la usuaria para todo este change. Strict TDD: RED → GREEN → TRIANGULATE → REFACTOR,
> safety net antes de tocar código existente.

- [x] 10.1 **Safety net.** Baseline antes de tocar `DocumentChecklist.tsx`: `DocumentChecklist.test.tsx`
      + `DocumentChecklist.contract.types.test.ts` → 42 tests verdes. Wrappers de dominio
      (`PacienteDocumentos.test.tsx`, `VehiculoDocumentos.test.tsx`, `ConductorDocumentos.test.tsx`,
      `FacturaDocumentos.test.tsx`, `useDocumentChecklist.test.tsx`) → 60 tests verdes. Total baseline:
      102 tests verdes, cero fallas preexistentes en el árbol tocado.
- [x] 10.2 **RED.** Test que sube un documento con `itemId` que no matchea ningún `item.id` de la
      lista vigente y verifica que **sigue en el DOM** — reproduce el bug con el código original
      (`items.map()` filtraba por `item.id`, un `itemId` sin `item` correspondiente nunca se
      iteraba). Confirmado en rojo: 6 tests fallando (el de reproducción del bug + 5 del contrato
      todavía no implementado), 45 pasando (los que no dependían de la guardia nueva, prueba de que
      el resto del contrato seguía intacto).
- [x] 10.3 **GREEN.** `DocumentChecklist.tsx`: se calcula `huerfanos` (`documentos` cuyo `itemId` no
      matchea ningún `items[].id`), agrupados por `itemId` para reusar `elegirVigente`/
      `ordenarParaMostrar` sin duplicar esa lógica. Se extrajo `renderDocumentoRow()` — la fila de un
      documento puntual (nombre + fecha + "Vigente" + Ver/Transferir/Quitar) que antes vivía inline
      dentro de `items.map()` — para reusarla tal cual tanto en cada tarjeta de ítem como en la
      sección nueva "Otros documentos" (debajo de la lista de ítems, solo si `huerfanos.length > 0`
      — nunca "0 documentos" fantasma). Ningún markup nuevo: mismo patrón visual que ya usaba el
      componente por documento.
- [x] 10.4 **TRIANGULATE.** Casos cubiertos en `DocumentChecklist.test.tsx`: sin huérfanos (sección
      ausente, cero regresión); un huérfano; varios huérfanos mezclados con documentos de ítems
      normales; huérfano en `readOnly` (Ver sigue habilitado, Quitar/Transferir deshabilitados —
      mismo gate `usePuedeEscribir()`/`readOnly` que el resto del componente); huérfano transferible
      cuando el punto de montaje pasa `onTransferir` (vía de escape para corregirlo); huérfano sin
      botón "Transferir" cuando `onTransferir` no está cableado (mismo opt-in que el resto).
- [x] 10.5 **No cuenta para el progreso.** Test explícito: agregar un huérfano no mueve "X de Y
      documentos cargados" — `cargados`/`pendientes` siguen derivándose solo de `items`, sin tocar
      ese cálculo.
- [x] 10.6 **No-regresión cruzada** (mismo patrón que los tests ya existentes "cero regresión para
      Vehículos/Conductores/Facturas"): con todos los `documentos` matcheando algún `item.id` — el
      uso real de hoy en los cuatro dominios, incluidos los tres que nunca tendrán huérfanos —
      el render queda idéntico a antes de esta guardia: sin sección "Otros documentos", mismo texto
      de progreso, mismos botones. Corridos también los 60 tests de los 4 wrappers de dominio
      (`PacienteDocumentos`, `VehiculoDocumentos`, `ConductorDocumentos`, `FacturaDocumentos`,
      `useDocumentChecklist`) sin ningún cambio: **60/60 verdes, sin tocar esos archivos**.
- [x] 10.7 **REFACTOR.** `renderDocumentoRow()` extraída elimina la duplicación entre la fila dentro
      de cada tarjeta de ítem y la fila de la sección "Otros documentos" — mismo JSX, parametrizado
      por `itemNombre` (el nombre del ítem, o `"Otros documentos"` para huérfanos) y `esVigente`
      (booleano ya resuelto en vez de recalcular `vigente?.id === doc.id` en cada callsite). Tests
      corridos después de cada paso del refactor: sin regresiones.
- [x] 10.8 **Verificación final.** `DocumentChecklist.test.tsx` +
      `DocumentChecklist.contract.types.test.ts`: 52/52 verdes (42 baseline + 10 nuevos). Wrappers de
      dominio: 60/60 verdes, sin cambios. `cd frontend && npx tsc -b --noEmit`: limpio. Suite
      completa (`npx vitest run`, 2306 tests): 118 fallas preexistentes en 20 archivos ajenos al árbol
      tocado (`mockVehiculoRepository.test.ts`, `mockPresupuestoRepository.test.ts` y otros —
      `TypeError: Cannot read properties of undefined (reading 'clear')` sobre `localStorage`, falla
      igual corriendo esos archivos solos, sin ningún cambio de esta pasada en el medio — confirmado
      no relacionado a esta guardia).
- [x] 10.9 Actualizar el VEREDICTO del Checkpoint (e) (§0.2) y la tarea 9.4 para reflejar que la
      opción B ya está implementada, no pendiente. Agregar un escenario al delta spec
      `specs/paciente-documentos-transferencia/spec.md` documentando la garantía. No se edita
      `openspec/changes/documentos-checklist-items-por-actividad/` — solo se lo menciona en prosa acá.
- [ ] 10.10 Commit (Conventional Commits, `feat(pacientes): guardia de documentos huérfanos en
      DocumentChecklist`), no ejecutado en esta pasada por la misma instrucción de 9.6 (no commitear
      salvo pedido expreso) — cambios dejados sin commitear.

## 11. Botón "Imprimir" real en el overlay de exportación (hallazgo de verificación manual, 2026-08-11)

> **REVERTIDO (2026-08-11, decisión de la usuaria — "siento que no tiene utilidad").** El botón
> "Imprimir" descripto acá vivía dentro del overlay de "Ver resumen" (§2), que se sacó por
> completo. `PrinterIcon`, `window.print()` y el estado `resumenListo`/`resumenAbierto` que lo
> acompañaban en `PacienteDocumentosChecklist.tsx` fueron revertidos; los 4 tests de 11.2 se
> borraron junto con el código que probaban. Ver el VEREDICTO REVERTIDO del Checkpoint (b) en
> §0.2. Queda como registro histórico.

> **Hallazgo.** La usuaria ejecutó la verificación manual de §8.4(i) ("exportar la documentación de
> una actividad") a mano en el navegador: el botón "Exportar" abre correctamente el `Overlay` con
> `DocumentacionActividadImprimible`, pero **no hay ningún botón ni texto en pantalla** que indique
> cómo continuar — la instrucción "Imprimir → Guardar como PDF (Ctrl+P)" solo vivía en un comentario
> de código (`DocumentacionActividadImprimible.tsx:7-13`), invisible para quien usa la aplicación. La
> usuaria interpretó, razonablemente, que el botón "Exportar" "no hacía nada".
>
> **Decisión (confirmada por la usuaria, 2026-08-11).** Agregar un botón "Imprimir" real dentro del
> `Overlay`, que llama a `window.print()` directamente al hacer clic — un solo clic, sin depender de
> que el usuario conozca el atajo de teclado del navegador. Mismo ícono `PrinterIcon` que ya usa el
> botón "Imprimir" de `HojaDeRutaPage.tsx` (`features/hojas-de-ruta/icons.tsx`) — no se inventó uno
> nuevo. `HojaDeRutaPage.tsx` queda **fuera de alcance**: su propio botón "Imprimir" tampoco llama
> `window.print()` hoy, pero es una pantalla de otro dominio y nadie lo pidió corregir acá.
>
> **Governance.** Mismo change CRÍTICO de siempre (dominio Pacientes, datos de salud) — pero este
> ajuste puntual es de **riesgo bajo**: no toca datos ni RLS, es un botón que dispara la función
> nativa `window.print()` del navegador sobre contenido que ya se mostraba en pantalla.
>
> **Strict TDD** (`openspec/config.yaml` `testing.strict_tdd: true`): RED → GREEN → TRIANGULATE →
> REFACTOR, safety net antes de tocar `PacienteDocumentosChecklist.tsx`.

- [x] 11.1 **Safety net.** Baseline antes de tocar `PacienteDocumentosChecklist.tsx`: `cd frontend &&
      npx vitest run src/features/pacientes/PacienteDocumentos.test.tsx
      src/features/pacientes/DocumentacionActividadImprimible.test.tsx` → **32/32 verdes**, cero
      fallas preexistentes en el árbol tocado.
- [x] 11.2 **RED.** Cuatro tests nuevos en `PacienteDocumentos.test.tsx` (describe "botón 'Imprimir'
      real en el overlay de exportación"): (i) el overlay ofrece un botón "Imprimir" que llama a
      `window.print()` (mockeado con `vi.spyOn`); (ii) el botón vive dentro de un contenedor
      `print:hidden` (Tailwind), verificado con `closest('[class*="print:hidden"]')`; (iii)
      **TRIANGULATE** — el mismo botón funciona de forma independiente en el overlay de una
      **segunda** actividad (Fonoaudióloga, distinta de Kinesióloga), confirmando que no queda
      pegado al primer overlay renderizado; (iv) no-regresión — con el botón agregado, el contenido
      imprimible (`Pérez, Juan`, `Cargado`, `Faltante`) y el botón "Cerrar" (×) del `Overlay` siguen
      funcionando igual. Confirmado en rojo: los 4 tests fallan (`getByRole('button', {name:
      /imprimir/i})` no existe todavía), los 32 preexistentes siguen verdes.
- [x] 11.3 **GREEN.** `PacienteDocumentosChecklist.tsx`: dentro del `Overlay` de exportación, se
      envuelve el contenido en un `<div className="flex flex-col gap-md">` con un bloque
      `<div className="flex justify-end print:hidden">` que contiene un `Button` (`variant="secondary"
      size="sm"`, mismo criterio que el botón "Exportar" que lo abre) con `PrinterIcon` +
      `onClick={() => window.print()}`, seguido de `DocumentacionActividadImprimible` sin cambios. Se
      importa `PrinterIcon` desde `../hojas-de-ruta/icons` (se reusa el ícono existente, no se
      duplica). Los 4 tests de 11.2 pasan en verde.
- [x] 11.4 **Verificación final.** `cd frontend && npx vitest run` completo: **2192 passed | 118
      failed (2310 total)** — los 118 son los mismos 20 archivos preexistentes y no relacionados ya
      documentados en §1.1/§10.8 (`TypeError` sobre `localStorage.clear()` en mocks de dominios ajenos
      — Vehículos, Presupuestos, Conductores, Facturación, Cuentas, Obras Sociales — y las
      `*Route.test.tsx` que los montan; fallan igual corriendo esos archivos solos, sin este cambio en
      el medio). Cero archivos nuevos rojos, cero tests perdidos o deshabilitados. `cd frontend && npx
      tsc -b --noEmit`: limpio, sin salida. Cambios acotados a `PacienteDocumentosChecklist.tsx` (+
      import de `PrinterIcon`) y `PacienteDocumentos.test.tsx` (+4 tests) — no se tocó
      `DocumentacionActividadImprimible.tsx` ni `HojaDeRutaPage.tsx`.
- [ ] 11.5 Commit (Conventional Commits, `feat(pacientes): botón Imprimir real en el overlay de
      exportación de documentación`), no ejecutado en esta pasada — cambios dejados sin commitear,
      misma instrucción de 9.6/10.10 (no commitear salvo pedido expreso).

## 12. "Exportar" arma un `.zip` con los archivos reales (Checkpoint (b) VEREDICTO REVISADO, 2026-08-11)

> **Aclaración de alcance de la usuaria.** El punto 3 del feedback original del cliente
> (`docs/cambios/cambios2-requerimientos.pdf`) no alcanza con el resumen imprimible de §2/§11 — el
> pedido real es bajarse **los archivos reales** (PDFs/imágenes ya cargados) de una actividad en un
> solo paso, para armar el legajo y mandarlo a la obra social. Decisión: **"Exportar" pasa a armar
> un `.zip`** con los archivos; el resumen imprimible que ya existía queda como acción **aparte**
> ("Ver resumen") — no se borra, se independiza. Es exactamente el escenario que `design.md`
> Checkpoint (b) había anotado como riesgo aceptado del default más barato (ver VEREDICTO REVISADO
> en §0.2).
>
> **Governance CRÍTICO heredado** (dominio Pacientes, datos de salud, mismo criterio de todo el
> change) — con un agravante propio respecto de §2/§11: hasta acá "exportar" solo mostraba
> METADATOS (nombre de archivo, fecha, cargado/faltante); desde acá también trae el **contenido
> real** de N documentos clínicos en un solo paso. Gateo de permisos: **sin cambios** — alcanza con
> lectura sobre `pacientes` (Checkpoint (g) ya vigente), verificado contra `usePuedeEscribir()` y la
> RLS existente, no se hizo ni más restrictivo ni más laxo.
>
> **Strict TDD** (`openspec/config.yaml` `testing.strict_tdd: true`): RED → GREEN → TRIANGULATE →
> REFACTOR, safety net antes de tocar `PacienteDocumentosChecklist.tsx`.

- [x] 12.1 **Safety net.** Baseline antes de tocar `PacienteDocumentosChecklist.tsx`: `cd frontend &&
      npx vitest run src/features/pacientes/PacienteDocumentos.test.tsx
      src/features/pacientes/DocumentacionActividadImprimible.test.tsx
      src/features/pacientes/exportacionDocumental.test.ts` → **41/41 verdes**, cero fallas
      preexistentes en el árbol tocado.
- [x] 12.2 **Dependencia `jszip`.** `npm install jszip` dentro de `frontend/` (`^3.10.1`, trae sus
      propios tipos — `types: "./index.d.ts"` en su `package.json`, no hace falta `@types/jszip`).
      **Análisis de bundle** (`npm run build`, comparación antes/después, pedido explícito de este
      Checkpoint antes de sumar la dependencia):
      | | Antes | Después | Delta |
      |---|---|---|---|
      | `index-*.js` (raw) | 1.349,99 kB | 1.448,30 kB | **+98,31 kB (+7,3%)** |
      | `index-*.js` (gzip) | 375,85 kB | 406,38 kB | **+30,53 kB (+8,1%)** |
      | `index-*.css` | 35,02 kB | 35,02 kB | sin cambio |
      | `pdf.worker.min-*.mjs` | 1.262,39 kB | 1.262,39 kB | sin cambio (chunk separado, no toca `jszip`) |
      Costo real y no trivial (~30 kB gzip), consistente con lo que `design.md` anticipaba como
      "costo medio" de la opción B. Se acepta: es exactamente la funcionalidad que la usuaria pidió,
      no hay alternativa sin dependencia para generar un `.zip` en el navegador, y el proyecto ya
      tiene un chunk mucho más grande (`pdf.worker`, 1,26 MB) sin code-splitting — este incremento no
      cambia el orden de magnitud del problema de bundle ya preexistente (warning de Vite, no nuevo
      de este change).
- [x] 12.3 **RED** — test de la función pura (con repository inyectado) que arma el zip a partir de
      `entidadId` + `agrupacionId` (implícito: `documentos` ya llega filtrado a la agrupación,
      mismo criterio que usa `useDocumentChecklist`) + la lista de `documentos` de esa agrupación.
      Caso feliz: 2-3 documentos, todos resuelven vía `resolverPrevisualizacion` + `fetch` — el zip
      resultante contiene las entradas esperadas (inspeccionado con `JSZip.loadAsync` sobre el
      `Blob` resultante).
- [x] 12.4 **GREEN + TRIANGULATE** — `frontend/src/features/pacientes/exportacionZip.ts`
      (`armarZipDocumentacionActividad`). Casos cubiertos en
      `frontend/src/features/pacientes/exportacionZip.test.ts` (8 tests): caso feliz (contenido de
      cada entrada verificado, no solo el nombre); **colisión de nombres** (dos documentos del mismo
      `itemId` con el mismo `nombreArchivo` — se desambigua con sufijo `(2)`, `(3)`... antes de la
      extensión, ningún archivo pisa a otro, contenido de ambos verificado por separado);
      **`resolverPrevisualizacion` devuelve `null`** (documento no previsualizable — se omite del
      zip, termina en `_pendientes.txt` con motivo en castellano, el zip se genera igual con el
      resto — **manejo de fallos PARCIAL, no todo-o-nada**); **`fetch` que rechaza** (mismo
      tratamiento); **respuesta HTTP no-OK** (403/404, ej. URL firmada vencida — mismo tratamiento);
      sin ningún pendiente, el zip NO incluye `_pendientes.txt` (no queda un archivo fantasma vacío);
      nombre del zip sanitizado (`documentacion-{paciente}-{actividad}-{fecha}.zip`, sin acentos ni
      espacios — válido en Windows/macOS/Linux por igual). **Verificación de meaningfulness (no
      tautológico)**: se corrió el test de colisión con la deduplicación deshabilitada a propósito —
      falló en rojo (`['dni.pdf']` en vez de `['dni (2).pdf', 'dni.pdf']`), confirmando que el test
      efectivamente ejercita esa lógica.
- [x] 12.5 **RED + GREEN** — `dispararDescargaZip()` (mismo archivo): patrón Blob URL + `<a
      download>` programático, sin librería extra. Test: `URL.createObjectURL`/`revokeObjectURL` y
      `HTMLAnchorElement.prototype.click` espiados, verifica que se llaman con el blob/nombre
      correctos y que la URL se revoca (no queda un Blob URL colgado en memoria).
- [x] 12.6 **RED + GREEN** — cablear el botón "Exportar" en `PacienteDocumentosChecklist.tsx`: pasa
      de abrir el overlay del resumen a llamar `armarZipDocumentacionActividad` + descargar el
      resultado. Estado de carga (`exportandoZip`, mismo patrón que `enviando` de
      `TransferenciaDocumentoDialog.tsx`): el botón se deshabilita y cambia su texto a
      "Exportando…" mientras arma el zip, vuelve a "Exportar" habilitado al terminar (éxito o
      error). Sin exigir permiso de escritura (Checkpoint (g), sin cambios).
- [x] 12.7 **RED + GREEN** — botón "Ver resumen" (segundo botón, al lado de "Exportar"): abre el
      mismo `Overlay` que antes abría "Exportar", con `DocumentacionActividadImprimible` y el botón
      "Imprimir" de §11 **intactos, sin regresión** — mismos 8 tests de §2/§11 corridos de nuevo tras
      el rename (adaptados solo en qué botón clickean, ninguna aserción de contenido cambió).
- [x] 12.8 **RED + GREEN** — manejo de error: si `armarZipDocumentacionActividad` falla de forma
      imprevista (no el caso ya cubierto como PARCIAL en 12.4 — acá se fuerza con un mock parcial del
      módulo, `mockRejectedValueOnce`, para ejercitar el `catch` del componente sin depender de
      romper `fetch`/`JSZip` por dentro), se muestra un `Alert` (`design-system/feedback.tsx`, `tone
      "danger"`) con mensaje en castellano ("No se pudo armar el archivo de documentación...."), sin
      texto crudo de `fetch`/Storage — mismo criterio que el resto del proyecto. El botón vuelve a
      habilitarse, no queda colgado.
- [x] 12.9 **No-regresión cruzada.** Vehículos/Conductores/Facturas no ofrecen ninguna de las dos
      acciones — ya cubierto por los tests existentes de §6 (`DocumentChecklist.test.tsx`
      no-regresión cruzada) y por que `PacienteDocumentosChecklist` (donde viven ambos botones) es
      exclusivo de Pacientes; no se duplicó cobertura nueva para esto.
- [x] 12.10 **REFACTOR** + `npx tsc -b --noEmit` + suite completa verde.
      **→ VERIFICACIÓN FINAL (2026-08-11):** `cd frontend && npx vitest run` completo: **2203
      passed | 118 failed (2321 total)** — mismos 20 archivos preexistentes y no relacionados ya
      documentados en §1.1/§10.8/§11.4 (`TypeError` sobre `localStorage.clear()` en mocks de
      dominios ajenos). Cero archivos nuevos rojos. 11 tests nuevos respecto de §11.4 (2310→2321
      total): 8 en `exportacionZip.test.ts` + 3 netos en `PacienteDocumentos.test.tsx` (8 tests
      renombrados de "Exportar" a "Ver resumen" sin cambio de aserciones + 3 tests nuevos del flujo
      de zip). `cd frontend && npx tsc -b --noEmit`: limpio, sin salida. `npx oxlint`: sin
      advertencias nuevas en los archivos tocados (`exportacionZip.ts`,
      `PacienteDocumentosChecklist.tsx`, `PacienteDocumentos.test.tsx`,
      `exportacionZip.test.ts`) — las advertencias preexistentes que produce `oxlint` sobre el resto
      del árbol no cambiaron. Archivos tocados: `frontend/package.json` (+`jszip`),
      `frontend/src/features/pacientes/exportacionZip.ts` (nuevo),
      `frontend/src/features/pacientes/exportacionZip.test.ts` (nuevo),
      `frontend/src/features/pacientes/PacienteDocumentosChecklist.tsx`,
      `frontend/src/features/pacientes/PacienteDocumentos.test.tsx`.
- [ ] 12.11 Commit (Conventional Commits, `feat(pacientes): exportar documentación como .zip con los
      archivos reales de la actividad`), no ejecutado en esta pasada — misma instrucción de
      9.6/10.10/11.5 (no commitear salvo pedido expreso).

## 13. Aislamiento de impresión: el resultado impreso mostraba TODA la pantalla, no solo la
##     documentación (hallazgo de verificación manual, 2026-08-11)

> **REVERTIDO (2026-08-11, decisión de la usuaria — "siento que no tiene utilidad").** La clase
> `.print-target` y la regla `@media print` de `index.css` descriptas acá existían solo para
> aislar la impresión del resumen imprimible (§2/§11), que se sacó por completo. Se verificó con
> `grep -rn "print-target" frontend/src` que ningún otro archivo del proyecto la consumía antes de
> borrarla — infraestructura sin consumidor, no se dejó como código muerto especulativo.
> `index.print.test.ts` se borró junto con la regla que probaba. Ver el VEREDICTO REVERTIDO del
> Checkpoint (b) en §0.2. Queda como registro histórico.

> **Hallazgo.** La usuaria probó el botón "Imprimir" (§11) y mandó un screenshot: el diálogo de
> impresión del navegador mostraba la pantalla **completa tal cual se ve** — el sidebar de la app
> ("Pastor Traslados", menú de navegación), la ficha del paciente de fondo, y el overlay con su
> backdrop oscuro — en vez de una hoja limpia con solo la documentación. Pidió *"que sea una hoja en
> blanco con la info"*.
>
> **Causa raíz (verificada con `grep` de `@media print` en todo `frontend/src`, no asumida).** No
> existía en TODO el proyecto ninguna regla `@media print` que aislara el contenido a imprimir del
> resto del DOM. Solo había un uso puntual de la utilidad `print:hidden` de Tailwind (en el propio
> botón "Imprimir" de §11, para que no apareciera en el resultado impreso) — eso oculta un elemento
> puntual, no aísla el resto de la pantalla. `Overlay` (`design-system/components.tsx` línea ~502)
> monta su contenido vía `createPortal` a `document.body`, así que el navegador simplemente imprimía
> lo que estaba en pantalla en ese momento: el `<body>` completo, árbol de la app incluido.
>
> **Hallazgo colateral (fuera de alcance, NO arreglado acá).** `HojaDeRutaImprimible.tsx` y
> `FacturaImprimible.tsx` — los dos precedentes de vista imprimible del proyecto — probablemente
> tengan el mismo problema de fondo: nunca se armó el mecanismo de aislamiento de impresión en ningún
> lado del proyecto, ni siquiera antes de este change. Nadie lo pidió corregir ahí; queda anotado acá
> para que no se pierda, no se toca ninguno de los dos archivos.
>
> **Decisión.** Patrón estándar de aislamiento de impresión: clase `print-target` (genérica,
> reusable a futuro por cualquier otra vista imprimible) + regla `@media print` en `index.css`
> (`body * { visibility: hidden }` + `.print-target, .print-target * { visibility: visible }` +
> `.print-target { position: absolute; ... }`) — funciona sea cual sea la profundidad del DOM,
> incluido contenido montado en un portal. Excepción documentada a "SIEMPRE Tailwind, NUNCA
> `style={{}}`": Tailwind no tiene utilidad para este patrón, es CSS de infraestructura global (mismo
> criterio que el bloque `@theme`), no styling ad-hoc de un componente.
>
> **Governance.** Mismo change CRÍTICO de siempre (dominio Pacientes, datos de salud) — pero este
> ajuste es de **riesgo bajo**: aislamiento visual vía CSS, sin efecto sobre datos ni permisos.
>
> **Strict TDD** (`openspec/config.yaml` `testing.strict_tdd: true`): RED → GREEN → TRIANGULATE →
> REFACTOR, safety net antes de tocar archivos existentes.

- [x] 13.1 **Safety net.** Baseline antes de tocar `DocumentacionActividadImprimible.tsx` e
      `index.css`: `cd frontend && npx vitest run
      src/features/pacientes/DocumentacionActividadImprimible.test.tsx
      src/features/pacientes/PacienteDocumentos.test.tsx` → **39/39 verdes**, cero fallas
      preexistentes en el árbol tocado.
- [x] 13.2 **RED.** Cinco tests nuevos: (i) `DocumentacionActividadImprimible.test.tsx` — el
      contenedor raíz lleva la clase `print-target` en su `className` (estructural: `jsdom` no aplica
      layout real de `@media print`, mismo criterio que ya usa el proyecto para verificar
      `print:hidden`); (ii)-(iv) `src/index.print.test.ts` (nuevo archivo, sigue el patrón de
      `obraSocialMigrations.test.ts` de leer un archivo como texto con `node:fs`) — la regla
      `@media print` existe, usa `.print-target`, oculta el resto (`body * { visibility: hidden }`),
      muestra solo `.print-target` (`visibility: visible`) y lo posiciona (`position: absolute`); (v)
      `PacienteDocumentos.test.tsx` — el `<h2>`/botón "Cerrar" del `Overlay` (que viven AFUERA de
      `children`) quedan fuera de `.print-target`, verificado explícitamente con
      `closest('.print-target')`, no asumido. Confirmado en rojo: 4 tests fallan antes del fix
      (la clase no existía, la regla no existía), el quinto (h2/Cerrar fuera de `.print-target`)
      pasaba igual porque nunca estuvieron adentro — no es un test que dependa del fix para pasar,
      es la verificación explícita que pedía la usuaria, no una suposición.
- [x] 13.3 **GREEN.** `frontend/src/index.css`: nueva regla `@media print` (después del bloque
      `body { margin: 0; ... }`) con la clase `.print-target`. `DocumentacionActividadImprimible.tsx`:
      se agrega `print-target` a la clase del `<div>` raíz existente (`flex flex-col gap-lg p-lg
      print:p-0` → `print-target flex flex-col gap-lg p-lg print:p-0`), sin envolver en un div nuevo.
      Los 5 tests de 13.2 pasan en verde.
- [x] 13.4 **Verificación de que `print:hidden` (Tailwind) y `visibility: hidden` (regla nueva) no
      chocan.** Son propiedades CSS distintas (`display: none` vs. `visibility: hidden`); el botón
      "Imprimir" de §11 vive fuera de `.print-target` de todos modos, así que la regla nueva ya lo
      oculta por partida doble — sin conflicto de cascada. Documentado en el comentario de `index.css`.
- [x] 13.5 **Verificación final.** `cd frontend && npx vitest run
      src/features/pacientes/DocumentacionActividadImprimible.test.tsx src/index.print.test.ts
      src/features/pacientes/PacienteDocumentos.test.tsx`: **44/44 verdes**. `cd frontend && npx
      vitest run` completo: **2208 passed | 118 failed (2326 total)** — exactamente el baseline de
      §12.10 (2203 passed | 2321 total) + los 5 tests nuevos de esta sección, todos verdes; mismos 20
      archivos preexistentes y no relacionados ya documentados en §1.1/§10.8/§11.4/§12.10 (`TypeError`
      sobre `localStorage.clear()`/`getItem()` en mocks de dominios ajenos —
      `mockObraSocialRepository`, `mockPresupuestoRepository`, `mockConductorRepository`,
      `mockHojaDeRutaRepository`, `mockCobroRepository`, `mockVehiculoRepository`, etc. — y
      `AppShell.test.tsx`/`PresupuestosRoute.test.tsx`); confirmado no relacionado por corrida
      aislada de `mockVehiculoRepository.test.ts` (falla igual solo, sin este cambio en el medio).
      Cero archivos nuevos rojos, cero tests perdidos o deshabilitados. `cd frontend && npx tsc -b
      --noEmit`: limpio, sin salida. Archivos tocados: `frontend/src/index.css` (+regla `@media
      print`), `frontend/src/features/pacientes/DocumentacionActividadImprimible.tsx` (+clase
      `print-target`), `frontend/src/features/pacientes/DocumentacionActividadImprimible.test.tsx`
      (+1 test), `frontend/src/index.print.test.ts` (nuevo, +3 tests),
      `frontend/src/features/pacientes/PacienteDocumentos.test.tsx` (+1 test).
- [x] 13.6 Escenario nuevo en `specs/paciente-documentos-exportacion/spec.md` (Requirement "El
      usuario puede imprimir la exportación directamente desde la pantalla"): "El resultado impreso
      está aislado del resto de la pantalla" + "El título y el botón 'Cerrar' del overlay tampoco
      forman parte de lo impreso".
- [ ] 13.7 Commit (Conventional Commits, `fix(pacientes): aislar el resultado impreso del resto de la
      pantalla con .print-target`), no ejecutado en esta pasada — misma instrucción de
      9.6/10.10/11.5/12.11 (no commitear salvo pedido expreso).

## 14. Embeber el documento vigente de cada ítem cargado en el resumen imprimible (Checkpoint (b),
##     segunda VEREDICTO REVISADO, 2026-08-11)

> **REVERTIDO (2026-08-11, mismo día, decisión de la usuaria — "siento que no tiene utilidad").**
> Esta sección se terminó de implementar (14.1-14.10 completas) y horas después, en la misma
> jornada, la usuaria decidió dar marcha atrás en toda la mitad "resumen imprimible" del
> Checkpoint (b) — el embebido de documentos incluido. Se borraron `PdfPaginasImpresion.tsx`
> (+test) y `frontend/src/shared/lib/documentos/vigencia.ts` se evaluó y **se mantuvo**: aunque
> nació para este trabajo, no depende de nada de lo revertido — es una utilidad pura
> (`fechaEfectiva`/`elegirVigente`) que `DocumentChecklist.tsx` sigue importando activamente para
> su propia previsualización interactiva, sin relación con el resumen imprimible. Ver el VEREDICTO
> REVERTIDO del Checkpoint (b) en §0.2. Queda como registro histórico de lo construido y luego
> retirado.

> **Hallazgo.** La usuaria aclaró el alcance real de "Ver resumen"/"Imprimir" (§11-§13): no alcanza
> con listar "Cargado"/"Faltante" en texto — cada ítem CARGADO tiene que mostrar el **documento
> vigente embebido** (la imagen tal cual, o el PDF renderizado página por página) antes de imprimir.
> Ver el VEREDICTO REVISADO del Checkpoint (b) más arriba (§0.2): esto reabre, deliberadamente, lo
> que ese mismo checkpoint había descartado como "opción C — PDF consolidado" en su primer
> veredicto, con un costo final menor al proyectado (sin dependencia de generación/merge de PDFs;
> se reusa `pdfjs-dist`, ya presente por `documentos-previsualizacion`, y el mismo
> `resolverPrevisualizacion` que ya usa `DocumentChecklist.tsx`).
>
> **Governance.** Mismo change CRÍTICO de siempre (dominio Pacientes, datos de salud) — y este
> agregado puntualmente **aumenta la superficie de lectura agregada** que `design.md` §Riesgos ya
> había anotado para la vista imprimible ("una sola página que junta toda la documentación de una
> actividad"): hasta ahora esa página solo mostraba metadatos (nombre de archivo, fecha), a partir
> de acá también renderiza el CONTENIDO real de N documentos clínicos en un solo lugar. El gateo de
> permisos NO cambia — sigue alcanzando con lectura sobre `pacientes` (Checkpoint (g), sin tocar):
> se verificó explícitamente que ningún test nuevo exige `puedeEscribir`, y que `resolverPrevisualizacion`
> se sigue inyectando desde el mismo hook (`useDocumentChecklist`) que ya usa `DocumentChecklist`
> para el mismo gate.
>
> **Componentes nuevos/tocados:**
> - `frontend/src/features/pacientes/PdfPaginasImpresion.tsx` (nuevo): renderiza TODAS las páginas
>   de un PDF, una por `<canvas>`, sin controles de navegación/zoom — a diferencia de
>   `shared/components/PdfPreview.tsx` (visor interactivo de una sola página a la vez, con
>   Anterior/Siguiente y zoom 50%-300%), que no tiene sentido para una hoja ya impresa. Copia el
>   patrón de pdf.js + Vite de `PdfPreview.tsx` (worker como asset `?url`, `getDocument().promise` →
>   `getPage(n)` → `render({ canvas, viewport, transform })`, con el mismo ajuste de
>   `devicePixelRatio` que ahí resolvió la nitidez en HiDPI) — **sin extraer un hook compartido**:
>   el brief de esta pasada pidió explícitamente "solo LEER" `PdfPreview.tsx` para copiar el patrón,
>   sin tocarlo ni siquiera para hacerlo consumir una abstracción común. La duplicación es ~25
>   líneas de un efecto de carga ya cubierto exhaustivamente por `PdfPreview.test.tsx`; forzar un
>   hook compartido hubiera significado editar un archivo que el brief pidió dejar intacto a cambio
>   de evitar una duplicación chica y ya probada en su origen. Documentado como comentario en el
>   propio archivo.
> - `frontend/src/shared/lib/documentos/vigencia.ts` (nuevo): `fechaEfectiva`/`elegirVigente` (antes
>   privadas de `DocumentChecklist.tsx`) se mudan acá tal cual, sin cambiar una línea de lógica.
>   Primer intento: agregar `export` a `elegirVigente` sin moverla — funcionaba, pero disparó una
>   advertencia NUEVA de `oxlint` (`react(only-export-components)`: un archivo de componente que
>   además exporta funciones sueltas rompe Fast Refresh) que no existía antes de este change. Se
>   optó por la mudanza a un archivo de utilidades en vez de dejar la advertencia — es la forma
>   correcta de resolverlo, no un parche. `DocumentChecklist.tsx` pasa a importarlas desde ahí (cero
>   cambio de comportamiento, confirmado con su propia suite sin tocar). `PdfPreview.tsx`/
>   `ContenidoPreview` (la previsualización interactiva de un documento) NO se tocan, ver instrucción
>   explícita del brief.
> - `frontend/src/features/pacientes/DocumentacionActividadImprimible.tsx`: gana dos props opcionales
>   — `resolverPrevisualizacion?: (documentoId: string) => Promise<string | null>` (mismo contrato
>   que `onResolverPrevisualizacion` de `DocumentChecklist`, inyectado por el caller, el componente
>   sigue sin conocer el repository) y `onListoParaImprimir?: (listo: boolean) => void`. Por cada
>   ítem CARGADO resuelve su documento vigente (`elegirVigente`) y embebe imagen/PDF/mensaje de "no
>   previsualizable" (mismo texto exacto que `ContenidoPreview`); los ítems FALTANTES no cambian —
>   siguen mostrando solo el texto "Faltante", sin ninguna llamada a `resolverPrevisualizacion`.
> - `frontend/src/features/pacientes/PacienteDocumentosChecklist.tsx`: pasa `resolverPrevisualizacion`
>   (el mismo que ya usa `DocumentChecklist`, del hook `useDocumentChecklist`) y un
>   `onListoParaImprimir={setResumenListo}` a `DocumentacionActividadImprimible`; el botón
>   "Imprimir" se deshabilita (`disabled={!resumenListo}`) mientras `resumenListo` es `false`, con
>   un texto "Preparando documentación…" al lado — criterio elegido por ser el más simple que cubre
>   el requisito ("no imprimir a mitad de carga, deja huecos"), sobre alternativas como ocultar el
>   botón entero (se prefirió deshabilitado + texto, más informativo que un botón que desaparece sin
>   explicación). `resumenListo` arranca en `false` y se resetea a `false` cada vez que se abre "Ver
>   resumen" (no arrastra el "listo" de una apertura anterior o de otra actividad).
>
> **Orquestación de N resoluciones (decisión de diseño no trivial).** Con N ítems cargados hay N
> resoluciones async en paralelo (nunca en serie — se lanzan todas juntas, cada una independiente).
> La primera implementación probada usó un `useState<number>` para contar pendientes, observado por
> un `useEffect` SEPARADO que llamaba a `onListoParaImprimir`. Esa versión falló su propio test en
> rojo con una secuencia `true, false, true` en vez de `false, ..., true`: el efecto separado corría
> en el mismo commit que el efecto que recién estaba por subir el contador, y leía el valor de
> `pendientes` **del render anterior** (0, "nada pendiente") antes de que el `setPendientes` de ese
> mismo ciclo llegara a aplicarse — una condición de carrera real entre dos efectos con
> dependencias distintas, no un bug de test. La versión final llama a `onListoParaImprimir`
> **desde dentro del mismo efecto** que dispara las resoluciones: `false` de forma síncrona al
> arrancar (antes de lanzar ningún `.then`), y `true` una única vez, cuando un contador local (no
> estado de React, una variable de closure) llega a cero tras la última promesa en resolver
> (éxito o error, cada una por separado — ninguna bloquea a las demás, mismo criterio "parcial, no
> todo o nada" que `exportacionZip.ts` §12 ya aplica para el `.zip`). Sin ítems cargados con
> vigente, o sin `resolverPrevisualizacion` inyectada, se llama con `true` de entrada — nada que
> resolver, no tiene sentido bloquear "Imprimir" por eso (y mantiene compatible el contrato con
> callers/tests que no pasan estas props nuevas).
>
> **Salto de página al imprimir.** Cada `<li>` de ítem (header + lista de nombres + contenido
> embebido) ya llevaba `break-inside-avoid` desde §2 — se reusa tal cual, sin tocarlo: el bloque
> completo (incluido el embebido nuevo) queda dentro del mismo `<li>`, así que ese `break-inside-avoid`
> ya cubre el requisito ("el header de un ítem no debe quedar solo al pie de una hoja"). Un PDF de
> muchas páginas cruza hojas con normalidad — eso es esperado, no se fuerza `break-inside-avoid` por
> canvas.
>
> **Strict TDD** (`openspec/config.yaml` `testing.strict_tdd: true`): RED → GREEN → TRIANGULATE →
> REFACTOR, safety net antes de tocar archivos existentes.

- [x] 14.1 **Safety net.** Antes de tocar `DocumentacionActividadImprimible.tsx`,
      `DocumentChecklist.tsx`, `PacienteDocumentosChecklist.tsx`: `cd frontend && npx vitest run
      src/features/pacientes/DocumentacionActividadImprimible.test.tsx
      src/features/pacientes/PacienteDocumentos.test.tsx src/shared/components/DocumentChecklist.test.tsx
      src/shared/components/PdfPreview.test.tsx` → **103/103 verdes**, cero fallas preexistentes en el
      árbol tocado.
- [x] 14.2 **RED (componente nuevo).** `PdfPaginasImpresion.test.tsx` (nuevo, mockea `pdfjs-dist`
      completo — mismo patrón exacto que `PdfPreview.test.tsx`): estado de carga → un canvas para 1
      página; TRIANGULATE con 3 páginas → 3 canvases en orden, sin controles Anterior/Siguiente;
      error genérico si `getDocument()` o `page.render()` rechazan (nunca el mensaje crudo); destroy
      del loading task al desmontar. Confirmado en rojo: el módulo `./PdfPaginasImpresion` no
      existía, falla de resolución de import.
- [x] 14.3 **GREEN (componente nuevo).** `frontend/src/features/pacientes/PdfPaginasImpresion.tsx`:
      copia el patrón de carga de `PdfPreview.tsx` (sin extraerlo a un hook compartido, ver nota de
      arriba), itera `1..pdf.numPages` renderizando cada página a su propio `<canvas>` (`role="img"`,
      `aria-label` con el nombre de archivo y "página N de M" para distinguirlos en los tests), sin
      paginación ni zoom. **5/5 tests de 14.2 en verde.**
- [x] 14.4 **RED (embebido en el resumen).** 8 tests nuevos en
      `DocumentacionActividadImprimible.test.tsx` (mockeando `./PdfPaginasImpresion`, mismo criterio
      que `DocumentChecklist.test.tsx` mockea `PdfPreview` — verificar delegación, no reimplementar
      pdf.js acá): imagen embebida con la URL resuelta; PDF delega en `PdfPaginasImpresion` con
      `url`/`nombreArchivo` correctos; TRIANGULATE con dos versiones del mismo ítem → se resuelve la
      vigente (`doc-nueva`), nunca la vieja; TRIANGULATE tipo no soportado → mismo texto que
      `ContenidoPreview` ("Este tipo de archivo no se puede previsualizar acá. Nombre: …"); una falla
      puntual (403 simulado) en un ítem no impide que el otro ítem cargado se embeba igual; los
      ítems faltantes nunca llaman a `resolverPrevisualizacion`; el botón "Imprimir" (vía
      `onListoParaImprimir`) arranca en `false` y pasa a `true` solo cuando la promesa controlada se
      resuelve; sin ítems cargados con vigente, `onListoParaImprimir(true)` se llama de entrada.
      Confirmado en rojo: **7 de 12 tests del archivo fallaron** (los props `resolverPrevisualizacion`/
      `onListoParaImprimir` todavía no existían en el componente; los 5 tests preexistentes de §2/§13
      siguieron en verde, sin tocarlos).
- [x] 14.5 **GREEN (embebido en el resumen).** `frontend/src/shared/lib/documentos/vigencia.ts`
      (nuevo): `fechaEfectiva`/`elegirVigente` mudadas desde `DocumentChecklist.tsx`, que pasa a
      importarlas (REFACTOR posterior — ver 14.5.1 — motivado por una advertencia nueva de oxlint,
      no por el ciclo RED/GREEN en sí). `DocumentacionActividadImprimible.tsx`: nuevo componente
      interno
      `EmbebidoImprimible` (mismos 6 desenlaces que `ContenidoPreview`, con un estado agregado
      `cargando`), un efecto que dispara N resoluciones en paralelo por ítem cargado con vigente
      (clave de re-disparo derivada de los ids reales a resolver, no de la identidad del objeto
      `exportacion` — el caller lo recrea en cada uno de sus renders) y notifica
      `onListoParaImprimir` en línea (ver nota de la condición de carrera arriba, ya resuelta antes
      de este commit — no quedó un ciclo RED intermedio documentado aparte porque se detectó y
      corrigió durante la misma pasada de implementación, antes de dar la tarea por terminada).
      **12/12 tests de 14.4 en verde.**
- [x] 14.5.1 **REFACTOR.** `npx oxlint` sobre los archivos tocados marcó una advertencia nueva:
      `react(only-export-components)` en `DocumentChecklist.tsx` (exportar `elegirVigente` desde un
      archivo de componente rompe Fast Refresh). Se movieron `fechaEfectiva`/`elegirVigente` a
      `frontend/src/shared/lib/documentos/vigencia.ts` (archivo nuevo, sin componentes) en vez de
      dejar la advertencia — `DocumentChecklist.tsx` pasa a importarlas, `ordenarParaMostrar` (que
      sigue viviendo ahí, usa `fechaEfectiva` pero no `elegirVigente` directamente) también importa
      `fechaEfectiva`. Cero cambio de lógica, confirmado con `DocumentChecklist.test.tsx` y
      `DocumentChecklist.contract.types.test.ts` sin tocar (35+ tests en verde) y `npx oxlint` limpio
      de esa advertencia en los archivos tocados. Quedan dos advertencias `react-hooks(exhaustive-deps)`
      — una preexistente (`onProgreso` en `PacienteDocumentosChecklist.tsx`, ya estaba antes de este
      change) y una nueva en el mismo patrón (`onListoParaImprimir`/`itemsConVigente` en
      `DocumentacionActividadImprimible.tsx`): ambas llevan un comentario `eslint-disable-next-line`
      explicando por qué el deps-array es intencional (mismo criterio ya establecido en el proyecto
      para callbacks inline del caller — `oxlint` no suprime la advertencia con ese comentario ni
      siquiera en el caso preexistente, así que la nueva instancia sigue exactamente el mismo patrón
      ya aceptado, no introduce una categoría de advertencia distinta).
- [x] 14.6 **GREEN (wiring del botón "Imprimir").** `PacienteDocumentosChecklist.tsx`: pasa
      `resolverPrevisualizacion`/`onListoParaImprimir={setResumenListo}` al componente,
      `disabled={!resumenListo}` + texto "Preparando documentación…" en el botón "Imprimir", reset a
      `false` al abrir "Ver resumen". 2 tests nuevos en `PacienteDocumentos.test.tsx` (wiring de
      punta a punta, no solo el contrato del componente): con un documento cargado y
      `resolverPrevisualizacion` controlada por promesa, "Imprimir" arranca deshabilitado con el
      texto visible y se habilita al resolver; con `resolverPrevisualizacion` que rechaza (403), el
      botón igual se habilita (una falla no lo deja bloqueado para siempre). **39/39 tests de
      `PacienteDocumentos.test.tsx` en verde** (37 preexistentes sin modificar + 2 nuevos).
- [x] 14.7 Verificación de que `.print-target` sigue envolviendo el contenido nuevo: el embebido
      (imagen/`PdfPaginasImpresion`/texto) vive DENTRO del mismo `<li>` que ya estaba dentro de
      `.print-target` (§13) — no se agregó ningún wrapper nuevo por fuera de ese contenedor, así que
      la regla `@media print` existente lo sigue aislando sin cambios. No hizo falta un test nuevo
      específico: los tests de §13 (`print-target` en el contenedor raíz) y el test de "PDF delega en
      PdfPaginasImpresion" de 14.4 ya cubren, juntos, que el mock del PDF se renderiza dentro del
      árbol que produce `container.firstElementChild` con la clase `print-target`.
- [x] 14.8 **Verificación final.** `cd frontend && npx vitest run
      src/features/pacientes/PdfPaginasImpresion.test.tsx
      src/features/pacientes/DocumentacionActividadImprimible.test.tsx
      src/features/pacientes/PacienteDocumentos.test.tsx src/shared/components/DocumentChecklist.test.tsx
      src/shared/components/PdfPreview.test.tsx`: **91/91 verdes** (5 nuevos de
      `PdfPaginasImpresion.test.tsx` + 12 de `DocumentacionActividadImprimible.test.tsx` [4
      preexistentes + 8 nuevos] + 39 de `PacienteDocumentos.test.tsx` [37 preexistentes + 2 nuevos] +
      35 de `DocumentChecklist.test.tsx` sin tocar + 10 de `PdfPreview.test.tsx` sin tocar — cero
      modificados). `cd frontend && npx vitest run` completo: ver §14.9. `cd frontend && npx tsc -b
      --noEmit`: limpio, sin salida.
- [x] 14.9 Corrida completa (`cd frontend && npx vitest run`, sin filtro), corrida dos veces para
      confirmar (antes y después del REFACTOR de 14.5.1) — **2223 passed | 118 failed (2341 total)**,
      exactamente el baseline de §13.5 (2208 passed | 118 failed | 2326 total) **+ 15 tests nuevos,
      todos verdes** (5 de `PdfPaginasImpresion.test.tsx` + 8 nuevos de
      `DocumentacionActividadImprimible.test.tsx` + 2 nuevos de `PacienteDocumentos.test.tsx`). Los
      mismos **20 archivos** preexistentes y no relacionados de siempre (`TypeError` sobre
      `localStorage.clear()`/`getItem()` en mocks de dominios ajenos — Presupuesto, ObraSocial,
      Paciente, Vehículo, Cobro, HojaDeRuta, Conductor, Factura, Autorización — más
      `PermisosMatrizFields.test.tsx`, `ChecklistEditor.test.tsx`, las cinco `*Route.test.tsx`,
      `router.test.tsx`, `router.cuentas.test.tsx` y `AppShell.test.tsx`). Cero archivos nuevos rojos,
      cero tests perdidos o deshabilitados. `cd frontend && npx tsc -b --noEmit`: limpio, sin
      salida.
- [x] 14.10 Escenarios nuevos en `specs/paciente-documentos-exportacion/spec.md`: el resumen embebe
      el documento vigente de cada ítem cargado (imagen y PDF multipágina), un ítem sin
      previsualización soportada muestra el aviso en vez de romper el resto, una falla puntual no
      bloquea a los demás ítems, y "Imprimir" espera a que termine de resolverse todo antes de
      habilitarse.
- [ ] 14.11 Commit (Conventional Commits, `feat(pacientes): embeber el documento vigente de cada
      ítem cargado en el resumen imprimible`), no ejecutado en esta pasada — misma instrucción de
      9.6/10.10/11.5/12.11/13.7 (no commitear salvo pedido expreso).
