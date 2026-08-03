# Tasks — integracion-presupuestos

> **⛔ GOVERNANCE ALTO — ESTE CHANGE NO ESTÁ APROBADO PARA APPLY.**
> Presupuestos es dominio **ALTO** (`CHANGES.md` §C-06): *proponer y esperar revisión antes de
> escribir*. La sección **0** es un portón, no una formalidad: **ninguna tarea de la sección 1 en
> adelante puede ejecutarse hasta que la usuaria responda las cinco aprobaciones de `design.md`
> §Governance.** Si el apply arranca sin esas respuestas, se detiene y se pregunta.
>
> **⚠️ STRICT TDD ACTIVO.** Este proyecto tiene `testing.strict_tdd: true` en `openspec/config.yaml`.
> Toda tarea que escriba código de producción se implementa con el ciclo
> **RED → GREEN → TRIANGULATE → REFACTOR**, y **antes** de modificar cualquier archivo existente se
> corre el safety net y se registra el baseline. **No caer en Standard Mode.**
> Test runner: `cd frontend && NODE_OPTIONS="--no-experimental-webstorage" npx vitest run`
> (el flag es obligatorio en este sandbox — ver 0.7).
>
> **⚠️ Las migraciones NO las aplica el agente, y las Edge Functions NO se redeployan.** Lo hace la
> usuaria / Enzo (backend). Es governance, no un límite técnico: el CLI del sandbox tiene sesión
> válida contra el proyecto real y se usó **solo para lectura** durante el propose. Las verificaciones
> con cuentas reales son tareas de coordinación explícitas (§1B), no pasos escondidos dentro de otra
> tarea.
>
> **Reglas duras aplicables** (`CLAUDE.md`): nunca `any` (usar `unknown` + narrowing); nunca
> `style={{}}` (solo utilidades Tailwind v4); reusar `frontend/src/design-system/components.tsx`;
> nunca `SUPABASE_SERVICE_ROLE_KEY` en frontend; type-check con **`npx tsc -b --noEmit`** (con `-b`,
> nunca `tsc --noEmit` a secas — sin `-b` compila cero archivos y siempre reporta 0 errores);
> Conventional Commits; el docx manda en estructura y la KB en reglas de negocio, y toda discrepancia
> se documenta en KB + `CHANGES.md` + `AvisoModeloDatos`.
>
> **Orden de fases pensado para no dejar el árbol a medias**: las §2 y §3 escriben archivos que
> **nadie importa todavía** — la app sigue andando con mocks. El swap real ocurre en un único commit
> en la §4. Cada fase es revertible por sí sola.

## 0. ⛔ Portón de governance — nada se ejecuta sin esto

- [x] 0.1 **D2 — transporte.** Confirmar con la usuaria que este módulo consume las **Edge Functions
      `presupuestos`/`autorizaciones` ya deployadas** (`supabase.functions.invoke`) en vez de
      PostgREST + RLS directo como los cuatro changes de integración anteriores. Presentar el cuadro
      comparativo de `design.md` D2 completo, incluido el costo (dos patrones conviviendo, D12).
      **Si la respuesta es "PostgREST", este `design.md` hay que reescribirlo, no parchearlo.**
      **✅ Aprobado por la usuaria (2026-08-02): Edge Functions.**
- [x] 0.2 **D3 — postura de seguridad.** Confirmar que se acepta que, para este módulo, el portón de
      autorización sea el `requirePermiso('presupuestos', …)` de la Edge Function y que RLS quede como
      segunda capa (adentro de la función se opera con `service_role`). **No lo introduce este
      change** — ya está deployado por `C-06` — pero nadie lo aprobó del lado del frontend.
      **✅ Aprobado por la usuaria (2026-08-02).**
- [x] 0.3 **D5 — archivo adjunto.** Elegir entre A (mapeo no destructivo + `AvisoModeloDatos`,
      propuesta), B (deshabilitar el input hasta que exista Storage) o C (implementar la subida acá).
      **Es el riesgo funcional más alto del change**: hoy el usuario adjunta un archivo, ve su nombre
      en pantalla y contra la base real lo pierde. **No avanzar a la §3 sin respuesta.**
      **✅ Decidido por la usuaria (2026-08-02): opción A (mapeo no destructivo + `AvisoModeloDatos`).
      La subida real de Storage queda como change propio futuro (`presupuestos-documentacion-storage`).**
- [x] 0.4 **D7b — la migración de 3 índices.** Aprobar `CREATE INDEX` **sin `CONCURRENTLY`** sobre
      `presupuesto.paciente_id`, `presupuesto.obra_social_id` y `autorizacion.presupuesto_id`. Se
      aparta de una regla dura de `database-schema-design`; la justificación (0 filas) se re-verifica
      en 1B.1 inmediatamente antes de aplicar.
      **✅ Aprobado por la usuaria (2026-08-02).**
- [x] 0.5 **D11 — orden respecto de `integracion-facturacion`.** Confirmar que Presupuestos se swapea
      **primero** y que `FacturacionRoute.tsx` queda en mocks hasta que ese change lo resuelva,
      sabiendo que en el medio la app tiene dos fuentes distintas para la misma entidad.
      **✅ Aprobado por la usuaria (2026-08-02).**
- [ ] 0.6 Verificar contra `https://supabase.com/changelog.md` y contra los tipos de
      `@supabase/supabase-js@^2.49.4` (la versión fijada en `frontend/package.json`) que
      `functions.invoke(name, { method, body })` soporta: (a) `method: 'GET' | 'POST' | 'PATCH'`;
      (b) segmento de path en el nombre (`'presupuestos/<uuid>'`); (c) querystring en el nombre
      (`'autorizaciones?presupuestoId=<uuid>'`); y (d) que adjunta automáticamente el `Authorization`
      de la sesión activa. **Anotar lo verificado con la versión exacta** — el fake de la §3 se
      construye sobre esto y un supuesto equivocado da tests verdes contra una API que no es la real.
- [ ] 0.7 Safety net inicial: correr la suite completa y **registrar el baseline real** (número de
      tests y de archivos). No asumirlo del último change. Recordar el hallazgo de entorno de
      `integracion-obra-social` 0.3: sin `NODE_OPTIONS="--no-experimental-webstorage"` fallan ~112
      tests por el `localStorage` nativo de Node shadoweando el de jsdom — **no es una regresión de
      código y no se "arregla" tocando `vite.config.ts`**.

## 1. Precondiciones del backend (verificar, no modificar)

> Todo lo de esta sección es **solo lectura**. Ninguna tarea acá corre DDL ni redeploya nada.
> Los valores de referencia son los verificados el **2026-08-02** durante el propose; si alguno
> cambió, **el hallazgo manda sobre el `design.md`** y hay que anotarlo acá antes de seguir.

- [ ] 1.1 `supabase functions list` → confirmar que `presupuestos` y `autorizaciones` siguen `ACTIVE`.
      Anotar la versión (durante el propose: **2**). Si cambió, releer los `index.ts` antes de mapear
      nada: el contrato de `toApi()` es la fuente de verdad del mapeo, no este documento.
- [ ] 1.2 Confirmar contra `information_schema.columns` que `facturacion.autorizacion` sigue teniendo
      `monto_autorizado` y `vigencia_desde`, y que **ni `presupuesto` ni `autorizacion` tienen**
      `archivo_nombre` / `archivo_cargado_en` (los dropeó `20260730120000`). Es la base fáctica de D5.
- [ ] 1.3 Confirmar contra `pg_policies` que las cuatro policies de `facturacion.presupuesto` y
      `facturacion.autorizacion` siguen gateadas por **`modulos.tiene_permiso('presupuestos', …)`** y
      **no** por `'facturacion'` (el comentario de `20260724100005_schema_facturacion.sql` dice lo
      contrario — la base manda). Es la trampa que `integracion-facturacion` D9 dejó anotada.
- [ ] 1.4 Confirmar contra `pg_proc` / `information_schema.triggers` que el trigger
      `facturacion.validar_autorizacion_monto` sigue vivo sobre `facturacion.autorizacion`, y
      **copiar el texto literal del `RAISE EXCEPTION`** desde
      `20260729130000_schema_autorizacion_monto_vigencia.sql` — lo necesita el test de 3.3.
- [ ] 1.5 `count(*)` de `facturacion.presupuesto`, `facturacion.autorizacion`, `pacientes.paciente` y
      `obra_social.obra_social`. Durante el propose: **0 / 0 / 1 / 3**. Es el insumo de D9 (la pantalla
      va a arrancar vacía) y de la condición de caducidad de D7b.
- [ ] 1.6 Confirmar contra `pg_indexes` que el schema `facturacion` sigue sin índices fuera de sus 7
      primary keys, y en particular que `autorizacion.presupuesto_id` sigue sin indexar. Si
      `integracion-facturacion` ya aplicó su migración de índices, anotarlo: el `IF NOT EXISTS` de
      1B.2 lo cubre, pero conviene saberlo.

## 1B. Migración de índices y verificación manual (coordinación con backend)

> **Bloqueada por 0.4.** El agente **escribe** el `.sql`; **la usuaria / Enzo lo aplica**. La
> verificación con cuentas reales es un checklist de coordinación, no un paso automatizado.
>
> **⚠️ Este change no crea tablas, ni columnas, ni funciones, ni policies.** Si en el apply aparece la
> necesidad de crear alguna, **eso es un hallazgo que cambia el alcance** y hay que volver al portón,
> no resolverlo sobre la marcha.

- [ ] 1B.1 **Re-verificar `count(*)`** de `facturacion.presupuesto` y `facturacion.autorizacion`
      **inmediatamente antes** de aplicar la migración. Si alguna ya tiene filas en volumen, la
      justificación de D7b caduca y hay que rehacer los índices con `CONCURRENTLY` **fuera de
      transacción**, en un script aparte. No es opcional.
- [ ] 1B.2 Escribir `supabase/migrations/20260802100000_presupuesto_autorizacion_indices.sql`:
      `CREATE INDEX IF NOT EXISTS` sobre `facturacion.presupuesto(paciente_id)`,
      `facturacion.presupuesto(obra_social_id)` y `facturacion.autorizacion(presupuesto_id)`.
      Cabecera del archivo con: por qué sin `CONCURRENTLY`, el `count(*)` medido y su fecha, y la
      condición de caducidad. **Ninguna otra sentencia en este archivo.**
- [ ] 1B.3 **BLOQUEADA — requiere a la usuaria / Enzo.** Aplicar la migración al proyecto real.
      Después, `supabase db advisors --linked --type security` y confirmar que **no agrega hallazgos**
      respecto de la línea base (correr el mismo comando **antes** para tenerla).
- [ ] 1B.4 **BLOQUEADA — requiere a la usuaria / Enzo (3 cuentas reales).** Verificación manual de las
      dos Edge Functions. Registrar el resultado de cada punto:
      (a) cuenta con `presupuestos: write` → `POST /presupuestos` con `pacienteId`/`obraSocialId`
      reales crea la fila; `PATCH` la edita; `GET /presupuestos/:id` la devuelve;
      (b) cuenta con `presupuestos: read` **sin** `write` → `POST` y `PATCH` responden **403** y
      **cero filas** quedan escritas — es la prueba de que el gateo de D3 funciona;
      (c) cuenta con `facturacion: read/write` **y sin `presupuestos: read`** → `GET /presupuestos`
      responde **403 explícito**, **no** `200 []`. **Este es el punto que cierra la trampa de RLS de
      `integracion-facturacion` D9** — si responde `200 []`, hay que reabrir D2/D11;
      (d) `POST /autorizaciones` con `montoAutorizado` **mayor** al `monto` del presupuesto → el
      trigger rechaza; anotar el **texto exacto** del `error` que devuelve la función (lo necesita
      3.3);
      (e) `POST /autorizaciones` con `montoAutorizado` igual y menor → aceptado (RN-PA-01);
      (f) `POST /autorizaciones` con `vigenciaDesde` anterior a `fechaRespuesta` → aceptado
      (RN-PA-02, carga retroactiva);
      (g) `GET /autorizaciones?presupuestoId=<uuid sin autorización>` → **404** con el mensaje
      `este presupuesto todavia no tiene autorizacion asociada` (lo absorbe D4);
      (h) `PATCH /presupuestos/<uuid inexistente>` → **404** (lo propaga D4, no lo absorbe);
      (i) `auditoria.logs` tiene el rastro del alta y de la edición de (a) (RN-GL-02) — los triggers
      `trg_audit_presupuestos` / `trg_audit_autorizacion` ya existen desde `20260724100005`.
- [ ] 1B.5 Anotar en `knowledge-base/10_preguntas_abiertas.md` el costo acumulado de no tener harness
      automatizado para servidor: cuarto change de la serie que verifica a mano, ahora también sobre
      **Edge Functions** además de RPC. Dejar escrito que acá el costo es **menor** (este change no
      escribe lógica de servidor) para no inflar el argumento.

## 2. Mapeos puros (TDD estricto, nadie los importa todavía)

> **⛔ Precondición**: 0.1 (transporte) y 0.3 (archivo adjunto) respondidas.
>
> Todas las tareas de esta sección: RED (test primero) → GREEN (mínimo) → TRIANGULATE (≥2 casos por
> comportamiento: happy path + borde) → REFACTOR. Archivos nuevos, no requieren safety net previo.
> **El contrato de referencia es el `toApi()`/`toDb()` real de los `index.ts`, leído en 1.1** — nunca
> lo que dice este documento.

- [ ] 2.1 `presupuestoMapping.ts` → `parsePresupuestoApi(value: unknown): Presupuesto | null`.
      TRIANGULATE: objeto completo; `monto` nulo → `null` (se descarta, D6); `fechaEmision` nula →
      `null`; `archivoUrl` ausente → `archivo: undefined`; valor que no es objeto → `null`.
- [ ] 2.2 Mapeo de `archivoUrl` → `ArchivoAdjunto` (D5, opción elegida en 0.3). Con la propuesta A:
      `nombre` = último segmento del path con `decodeURIComponent`, `cargadoEn` = `fechaEmision`.
      TRIANGULATE: URL simple; URL con querystring (`?token=…`) que **no** debe contaminar el nombre;
      nombre percent-encoded (`presupuesto%20abril.pdf` → `presupuesto abril.pdf`); string vacío →
      `undefined`.
- [ ] 2.3 `toCrearPresupuestoPayload(NuevoPresupuesto)`: body del `POST`. Claves **exactamente** las
      que lee el `toDb()` real (`pacienteId`, `obraSocialId`, `monto`, `fechaEmision`, `archivoUrl`).
      **`archivo` elegido en el input NO produce `archivoUrl`** (D5): solo viaja si vino de una lectura
      previa. TRIANGULATE: presupuesto mínimo; con archivo de round-trip; con archivo recién elegido
      (no viaja).
- [ ] 2.4 `toActualizarPresupuestoPayload(ActualizacionPresupuesto)`: **la semántica parcial es lo que
      se está testeando** (D6b). Clave ausente ⇒ **no aparece** en el body. TRIANGULATE con al menos:
      solo `monto`; solo `fechaEmision`; objeto vacío ⇒ body vacío. Este es el test que impide pisar
      campos que el usuario no tocó.
- [ ] 2.5 `autorizacionMapping.ts` → `parseAutorizacionApi(value: unknown): Autorizacion | null`.
      TRIANGULATE: objeto completo; `estado` nulo → `'pendiente'` (D6); `estado` fuera de la unión
      `EstadoAutorizacion` → `'pendiente'`; `montoAutorizado`/`vigenciaDesde`/`cupoMensualDias`/
      `cupoMensualKm` ausentes → `undefined`; sin `presupuestoId` → `null`.
- [ ] 2.6 `toCrearAutorizacionPayload(NuevaAutorizacion)` y
      `toActualizarAutorizacionPayload(ActualizacionAutorizacion)`, mismo criterio que 2.3/2.4.
      TRIANGULATE del parcial con al menos: solo `estado`; solo `montoAutorizado`; solo
      `vigenciaDesde`; objeto vacío.
- [ ] 2.7 REFACTOR + `npx tsc -b --noEmit` limpio. Anotar el conteo de tests nuevo.

## 3. `edgeFunctionErrors.ts` + los dos repositories (TDD estricto, nadie los importa todavía)

> El fake de `supabase.functions.invoke` se construye a mano con interfaces propias, **sin `any`, sin
> `as`**, siguiendo `frontend/src/shared/lib/cuentas/SupabaseCuentaRepository.test.ts` como
> referencia de estilo (es el único precedente del repo que mockea `functions.invoke`). El fake debe
> **registrar** nombre de función, `method` y `body` de cada invocación. Ojo con `erasableSyntaxOnly`
> de `tsconfig.app.json`: prohíbe propiedades de parámetro de constructor.

- [ ] 3.1 `edgeFunctionErrors.ts` → `mapearErrorEdgeFunction(error: unknown, contexto): Promise<Error>`.
      Lee `error.context` cuando es `Response` y despacha por `status`, igual que
      `SupabaseCuentaRepository`. Un test por rama de la tabla de `design.md` D7: `401`, `403` lectura,
      `403` escritura, `400` genérico, error sin `context` (red), y `Error` no reconocido.
- [ ] 3.2 Test dedicado: **el texto crudo de Postgres nunca llega a la UI**. Alimentar el traductor con
      un `400` cuyo body sea un mensaje real del motor y afirmar que el `.message` resultante **no lo
      contiene**. No es redundante con 3.1: 3.1 verifica el mapeo, este verifica la fuga.
- [ ] 3.3 Rama **RN-PA-01**: un `400` cuyo `error` empieza con el prefijo del `RAISE EXCEPTION` del
      trigger → `La autorización no puede superar el monto del presupuesto.` **Usar el texto literal
      copiado en 1.4/1B.4(d)**, no una paráfrasis de este documento.
- [ ] 3.4 Fake tipado de `functions.invoke` + `SupabasePresupuestoRepository.list()`: una sola
      invocación `GET /presupuestos`, cero invocaciones adicionales por fila (**test anti N+1**), y
      filas malformadas descartadas sin tumbar el listado (D6).
- [ ] 3.5 `SupabasePresupuestoRepository.getById()`: `200` → `Presupuesto`; **`404` → `null`, no
      lanza**; `403` → lanza con el mensaje de lectura. Los tres caminos con test propio y nombre
      explícito — el 404→`null` es contrato de la interfaz, no un detalle.
- [ ] 3.6 `SupabasePresupuestoRepository.create()`: una sola invocación `POST` con el body de 2.3, y
      la respuesta `201` mapeada. Tests de error: `403`, `400` de campos faltantes, `400` de FK
      (`23503`, el caso de D8 si los selectores quedaran en mock).
- [ ] 3.7 `SupabasePresupuestoRepository.update()`: `PATCH` con el body de 2.4 —verificando **sobre lo
      que el fake registró** que las claves ausentes no viajan— y **`404` ⇒ lanza** con el mensaje
      idéntico al del mock (`No existe un presupuesto con id "…".`). **Esta asimetría con 3.5 es la
      trampa más fácil del change**: que el nombre del test lo diga.
- [ ] 3.8 `SupabaseAutorizacionRepository`: `list()`, `getById()`, `create()`, `update()` con los
      mismos criterios de 3.4-3.7 y los mensajes de dominio de autorización.
- [ ] 3.9 `SupabaseAutorizacionRepository.getByPresupuestoId()`: invoca
      `autorizaciones?presupuestoId=<id>` con el id **percent-encoded**; `200` → `Autorizacion`;
      **`404` → `null`** (el presupuesto todavía no tiene autorización — es el caso normal, no un
      error); `403` → lanza.
- [ ] 3.10 Test de código fuente vía `?raw` sobre los dos repositories: no contienen `service_role`,
      no contienen `any` **ni siquiera en los comentarios en castellano** (el regex `/\bany\b/` no
      distingue código de prosa — a `integracion-pacientes` 3.12 le pasó), y no consultan
      `modulos.permisos` ni `modulos.modulos` (no duplican la autorización, `security-review`).
- [ ] 3.11 REFACTOR + `npx tsc -b --noEmit` y `npx oxlint` limpios. Cobertura del código nuevo ≥ 85 %
      (`npx vitest run --coverage` sobre `shared/lib/presupuestos/`). **No** agregar tests
      tautológicos ni relajar aserciones para inflar el número: si falta cobertura, es comportamiento
      real sin test.

## 4. El swap (⚠️ el corte real)

> **Safety net obligatorio antes de esta sección**: correr la suite y comparar con el conteo de la §3.
>
> **⛔ Precondición**: 1B.4 (verificación con cuentas reales) confirmada. Sin eso, la pantalla puede
> quedar mostrando 403 en cada carga sin que nadie sepa si es la app o el permiso.
>
> Un solo commit. A partir de acá la pantalla usa datos reales.

- [ ] 4.1 `PresupuestosRoute.tsx`: reemplazar los **cuatro** mocks —`mockPresupuestoRepository`,
      `mockAutorizacionRepository`, `mockPacienteRepository`, `mockObraSocialRepository`— por
      `supabasePresupuestoRepository`, `supabaseAutorizacionRepository`, `supabasePacienteRepository`
      y `supabaseObraSocialRepository` (D8: los dos últimos ya existen y ya están cableados en
      `PacientesRoute.tsx`/`ObraSocialesRoute.tsx`; sin ellos toda alta falla con `23503`). Actualizar
      el comentario del composition root para que refleje el estado nuevo, siguiendo el criterio de
      `PacientesRoute.tsx` / `ObraSocialesRoute.tsx`.
- [ ] 4.2 `PresupuestosRoute.test.tsx`: ajustar el doble inyectado. Los tests de comportamiento de la
      feature siguen corriendo contra dobles, **nunca** contra Supabase real. La aserción pasa de
      *"aparece el fixture precargado (`Gómez, Martina` / `OSECAC`)"* a *"el composition root monta y
      muestra el encabezado sin colgarse en 'cargando'"* — verifica cableado, no contenido de un
      fixture que ya no está en este camino (D9). Patrón ya resuelto en `ObraSocialesRoute.test.tsx`.
- [ ] 4.3 Grep dirigido: ningún archivo de `features/presupuestos/` importa `supabaseClient`,
      `SupabasePresupuestoRepository` ni `SupabaseAutorizacionRepository` salvo el composition root.
      Y **ningún** archivo de `features/presupuestos/` importa ya un mock (los cuatro salieron).
- [ ] 4.4 Verificar que **`FacturacionRoute.tsx` sigue exactamente igual** (D11): sigue importando
      `mockPresupuestoRepository`/`mockAutorizacionRepository`. Es una tarea de **no hacer**, y está
      acá justamente para que quede constancia de que no se tocó por descuido.
- [ ] 4.5 Suite completa verde sin regresiones contra el baseline de la §3 + `npx tsc -b --noEmit` +
      `npx oxlint` limpios.

## 5. Señalización de discrepancias en la UI

> Solo `AvisoModeloDatos` de `frontend/src/design-system/components.tsx`. Nunca `style={{}}`, nunca
> markup de alerta propio. Revisar el catálogo del design system antes de escribir markup. Criterio de
> agrupación: **un cartel por grupo temático**, no uno por campo.

- [ ] 5.1 `PresupuestoForm.tsx`: cartel del **archivo adjunto** (D5) — el archivo elegido todavía no se
      guarda en el servidor; el modelo real tiene una sola referencia (`archivo_url`) y la subida a
      Storage está pendiente de un change propio. **Es el cartel más importante del change.**
      *(Depende de la opción elegida en 0.3: con B, en vez de cartel va la deshabilitación del input.)*
- [ ] 5.2 `AutorizacionForm.tsx`: mismo cartel del archivo adjunto.
- [ ] 5.3 `AutorizacionForm.tsx`: revisar el `AvisoModeloDatos` **preexistente** sobre `vigenciaDesde`
      (lo puso `presupuestos-ui` diciendo que es *"un campo que el frontend agrega sobre el docx,
      pendiente de confirmar con backend"*). **Ya no es cierto**: `vigencia_desde` y `monto_autorizado`
      son columnas reales desde `C-06` (D13 #6). Actualizar el texto para que diga qué quedó resuelto
      — **no borrar el cartel entero sin leerlo**: la parte de "el docx no los tiene" sigue vigente.
- [ ] 5.4 `PresupuestoDetail.tsx`: cartel de que la pantalla ya lee datos reales del servidor mientras
      la validación de cupo de **Facturación** sigue leyendo datos de prueba (D11), para que nadie
      concluya de una pantalla lo que pasa en la otra.
- [ ] 5.5 Tests de los carteles siguiendo el patrón de `PacienteDetail.test.tsx`: escopear con
      `getAllByRole('note').find(...)` + `toHaveTextContent` (**no** `getByText` con regex — el texto
      usa `<strong>` y `getNodeText` de testing-library solo concatena los text nodes *directos*, así
      que un regex que cruza un límite `<strong>` no matchea), más un conteo `toHaveLength` para
      confirmar que ningún cartel se duplica.

## 6. Documentación (obligatoria, no opcional)

- [ ] 6.1 `knowledge-base/04_modelo_de_datos.md` §Discrepancias: bloque nuevo **"Presupuestos /
      Autorizaciones vs. esquema real de `C-06`"** con las 13 discrepancias de la tabla D13 de
      `design.md`, marcando cuáles quedan **resueltas** (#3 a #9) y cuáles siguen **abiertas** (#1/#2
      archivo, #10 dos patrones, #11 fuente mixta, #12 borrado). Mismo formato numerado que los
      bloques de `integracion-pacientes` / `integracion-obra-social`.
- [ ] 6.2 `knowledge-base/04_modelo_de_datos.md`: sección nueva con el **contrato de las dos Edge
      Functions** (rutas, códigos, forma de `toApi()`), dejando escrito que el portón de autorización
      es `requirePermiso('presupuestos', …)` y que adentro se opera con `service_role` (D3).
      **Confirmar leyendo los `index.ts` reales antes de escribirlo**, no asumirlo del `design.md`.
- [ ] 6.3 `knowledge-base/04_modelo_de_datos.md` §Presupuesto/Autorizacion: dejar escrito que las
      policies gatean por el módulo **`presupuestos`**, no `facturacion` como dice el comentario de
      `20260724100005_schema_facturacion.sql` — con la consecuencia práctica para perfiles que solo
      tienen `facturacion` (D11 punto 3).
- [ ] 6.4 `CHANGES.md` §`C-06`: bullet nuevo con el estado de `integracion-presupuestos` (mismo estilo
      que el bullet `🔶 Propose completo del swap de backend` de §C-07), más un bullet
      `⏳ Pendiente de decisión` con las cinco aprobaciones de la §0. Actualizar también la **fila 5**
      del §Plan de integración Backend↔Frontend, que hoy dice `🔴 bloqueado`.
- [ ] 6.5 `CHANGES.md` §`C-07`: anotar en el bullet de `integracion-facturacion` que su **D9 cambia de
      forma** cuando este change se cablee (las autorizaciones dejan de ser fixture del lado de
      Presupuestos; la trampa de RLS queda verificada y cerrada; y su remedio pasa a ser cambiar dos
      líneas de `FacturacionRoute.tsx`). **No editar `integracion-facturacion/` en sí** — es un change
      abierto de otro dominio, con su propio portón de governance.
- [ ] 6.6 `knowledge-base/10_preguntas_abiertas.md`: agregar las preguntas nuevas de §Open Questions
      —unificación Edge Functions vs. PostgREST (D12), subida a Storage (D5), siembra de datos (D9),
      `delete()` en las interfaces, orden del listado de autorizaciones, y dueño del contrato de las
      Edge Functions— con su decisor nombrado. **Ninguna se cierra acá.**
- [ ] 6.7 `ROADMAP-FRONTEND.md` §FASE FE-8: actualizar la fila de `C-06`. **Marcarla `✅` solo si las
      §4 y §7 están realmente completas**; si 1B.3/1B.4 siguen bloqueadas por backend, usar
      `🔶 En progreso` con el detalle de qué está hecho y qué falta — mismo criterio (y misma
      desviación deliberada) que la tarea 7.7 de `integracion-obra-social`: no afirmar en un documento
      que otros agentes usan como fuente de verdad algo que no es cierto.

## 7. Verificación

- [ ] 7.1 `cd frontend && npx tsc -b --noEmit` sin errores (**nunca** `tsc --noEmit` a secas: el
      `tsconfig.json` raíz es de project references y sin `-b` compila cero archivos).
- [ ] 7.2 `cd frontend && npx oxlint` limpio (los warnings preexistentes de
      `react(only-export-components)` en los `*RepositoryContext.tsx` son ajenos a este change).
- [ ] 7.3 Suite completa verde, sin regresiones contra el baseline de 0.7.
- [ ] 7.4 Cobertura final sobre `shared/lib/presupuestos/` ≥ 85 %, con los gaps residuales
      justificados uno por uno (no inflar con tests tautológicos).
- [ ] 7.5 **BLOQUEADA — requiere a la usuaria.** Verificación manual en navegador (`npm run dev`) con
      **tres** cuentas: `presupuestos: write` (alta con el paciente y una de las obras sociales
      reales, edición, carga de autorización, cambio de estado, intento de autorización mayor al
      presupuesto → mensaje traducido); `presupuestos: read` (solo lectura, sin guardado fantasma);
      y una cuenta con `facturacion` **sin** `presupuestos` (la pantalla no debe ser accesible, y si
      lo fuera por ruta directa debe mostrar el mensaje de falta de permiso, no una lista vacía).
      **Anticipar que la pantalla arranca vacía (D9) — no es una regresión.**
- [ ] 7.6 **BLOQUEADA — requiere a la usuaria.** Confirmar en `auditoria.logs` que el alta y la
      edición dejaron rastro (RN-GL-02). Sin escribir código: los triggers ya existen.
- [ ] 7.7 Ensayo de rollback: revertir `PresupuestosRoute.tsx` a los cuatro mocks, correr
      `npx tsc -b --noEmit` y la suite, confirmar que todo queda verde, y volver a aplicar el
      cableado real confirmando que queda idéntico al estado previo. Los índices no hace falta
      revertirlos.
