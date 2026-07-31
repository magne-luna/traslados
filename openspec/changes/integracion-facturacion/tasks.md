# Tasks — integracion-facturacion

> **⛔ GOVERNANCE CRÍTICO — ESTE CHANGE NO ESTÁ APROBADO PARA APPLY.**
> Facturación es el dominio equivalente a *Billing* en la tabla de gobernanza del proyecto:
> **análisis solamente; cero código de aplicación sin aprobación humana explícita**. La sección **0**
> es un portón, no una formalidad: **ninguna tarea de la sección 1 en adelante puede ejecutarse hasta
> que la usuaria responda las cinco aprobaciones de `design.md` §Aprobaciones requeridas.**
> Si el apply arranca sin esas respuestas, se detiene y se pregunta.
>
> **⚠️ STRICT TDD ACTIVO.** Este proyecto tiene `testing.strict_tdd: true`. Toda tarea que escriba
> código de producción se implementa con el ciclo **RED → GREEN → TRIANGULATE → REFACTOR**, y
> **antes** de modificar cualquier archivo existente se corre el safety net y se registra el
> baseline. **No caer en Standard Mode.**
> Test runner: `cd frontend && NODE_OPTIONS="--no-experimental-webstorage" npx vitest run`
> (el flag es obligatorio en este sandbox — ver 0.6).
>
> **⚠️ Las migraciones NO las aplica el agente.** Las corre la usuaria / Enzo (backend). Es
> governance, no un límite técnico: el CLI del sandbox tiene sesión válida contra el proyecto real y
> se usó **solo para lectura** durante el propose. Las verificaciones de RLS con cuentas reales son
> tareas de coordinación explícitas (§1B), no pasos escondidos dentro de otra tarea.
>
> **Reglas duras aplicables** (`CLAUDE.md`): nunca `any` (usar `unknown` + narrowing); nunca
> `style={{}}` (solo utilidades Tailwind v4); reusar `frontend/src/design-system/components.tsx`;
> nunca `SUPABASE_SERVICE_ROLE_KEY` en frontend; toda tabla nueva define su RLS en el mismo change;
> type-check con **`npx tsc -b --noEmit`** (con `-b`, nunca `tsc --noEmit` a secas — sin `-b` compila
> cero archivos y siempre reporta 0 errores); Conventional Commits; el docx manda en estructura y la
> KB en reglas de negocio, y toda discrepancia se documenta en KB + `CHANGES.md` + `AvisoModeloDatos`.
>
> **Orden de fases pensado para no dejar el árbol a medias**: las §3 y §4 escriben archivos que
> **nadie importa todavía** — la app sigue andando con mocks. El swap real ocurre en un único commit
> en la §5. Cada fase es revertible por sí sola.

---

## 0. ⛔ Portón de governance — nada se ejecuta sin esto

- [ ] 0.1 **Aprobación D3** — agregar la columna `facturacion.facturas.fecha_factura DATE` (nullable).
      Es la única modificación de schema del change y toca un dominio financiero.
      **Respuesta de la usuaria requerida: sí / no.**
- [ ] 0.2 **Aprobación D4** — crear las dos funciones RPC `SECURITY INVOKER`
      (`crear_factura_completa`, `actualizar_factura_completa`). Son código de servidor que escribe
      facturas, sin harness automatizado que las verifique.
      **Respuesta de la usuaria requerida: sí / no.**
- [ ] 0.3 **Aprobación D6** — incluir el swap de `CobroRepository` en este mismo change (el argumento
      de por qué es obligatorio y no opcional está en `design.md` D6).
      **Respuesta de la usuaria requerida: sí / no / change aparte.**
- [ ] 0.4 **Aprobación D9 (CHECKPOINT de mayor riesgo funcional)** — dejar la validación de cupo
      (RN-FA-02) operando sobre fuente mixta: facturas reales × autorizaciones de fixture, con cartel
      visible. Opciones A / B / C en `design.md` D9.
      **Respuesta de la usuaria requerida: A, B o C.**
- [ ] 0.5 **Aprobación D10** — `CREATE INDEX` sin `CONCURRENTLY`, justificado en que las 6 tablas
      tienen 0 filas hoy. Se aparta de una regla dura de `database-schema-design`.
      **Respuesta de la usuaria requerida: sí / no.**
- [ ] 0.6 **Coordinación con backend (Enzo), previa a escribir el `.sql` de D3.** Confirmar que
      `fecha_factura` no está ya planeada con otro nombre. Es el aprendizaje directo de D12-revertida
      de `integracion-obra-social`: el schema real viene por delante del repo desde hace tres changes.
- [ ] 0.7 Revisar `https://supabase.com/changelog.md` por cambios en `schema()`, embeds,
      `maybeSingle()` o `rpc()` desde la última verificación (2026-07-31, `@supabase/supabase-js`
      `^2.49.4`). Registrar hallazgos o "sin novedades".
- [ ] 0.8 **Safety net / baseline.** Correr
      `cd frontend && NODE_OPTIONS="--no-experimental-webstorage" npx vitest run` y registrar el
      número exacto de tests y archivos. **No asumir el baseline** — hay trabajo concurrente de otra
      sesión sobre el repo (`CHANGES.md` §Plan de integración, fila 3). Sin el flag `NODE_OPTIONS`
      fallan ~112 tests por un bug de entorno diagnosticado (Node v26 + jsdom 29 + vitest 4: el
      `localStorage` nativo experimental de Node shadowea el de jsdom) — **no es regresión y no se
      "arregla" tocando `vite.config.ts`**, que es compartido con el trabajo en paralelo.

---

## 1. Precondiciones del backend (verificar, no modificar)

> Todo lo de esta sección es **solo lectura**. Ninguna tarea acá corre DDL.

- [ ] 1.1 Reconfirmar que el schema `facturacion` está expuesto en el Data API. Método verificado el
      2026-07-31: `curl` con la `anon key` contra
      `GET /rest/v1/facturas?select=id&limit=1` con `Accept-Profile: facturacion` →
      `401 {"code":"42501","message":"permission denied for schema facturacion"}` (**no**
      `PGRST106`/`PGRST205`). Control negativo con `Accept-Profile: obra_social` → `404 PGRST205`.
- [ ] 1.2 Revisar el estado del historial de migraciones (`supabase migration list --linked`) por el
      desfasaje ya conocido y **agravado** en este dominio: 2 tablas y 10+ columnas de `facturacion`
      existen en producción sin ninguna migración commiteada que las cree (discrepancia N6 de
      `design.md` D12). Registrar el estado, **no correr `migration repair`** (es decisión de backend).
- [ ] 1.3 **Volver a verificar el schema real antes de escribir nada**, no confiar en lo capturado en
      el propose. Contra el proyecto vinculado, con `supabase db query --linked`:
      columnas de `facturacion.facturas` / `asistencia_prestacion` / `cobros`
      (`information_schema.columns`), los enums (`pg_enum`), las FK y CHECK (`pg_constraint`), los
      índices (`pg_indexes`), las policies (`pg_policies`), los GRANT
      (`information_schema.role_table_grants`) y los triggers. Comparar contra el bloque §Context de
      `design.md` y **reportar toda diferencia antes de continuar** — es el tercer change consecutivo
      en que la base va por delante del documento.
- [ ] 1.4 **Verificar `count(*)` de las 6 tablas de `facturacion`.** Es la condición que sostiene D10
      (índices sin `CONCURRENTLY`). Si alguna tiene filas en volumen, **la migración de índices se
      rehace con `CONCURRENTLY` fuera de transacción** y se vuelve a consultar a la usuaria.
- [ ] 1.5 Confirmar que el módulo `facturacion` existe en `modulos.modulos` (verificado el
      2026-07-31) y averiguar qué permisos tiene realmente la cuenta *Facturación* de
      `VITE_TEST_ACCOUNTS` — en particular **si tiene o no `presupuestos: read`**, porque es la que
      expone la trampa de D9.

## 1B. Migraciones y verificación manual (coordinación con backend)

> **Bloqueada por 0.1, 0.2, 0.5 y 0.6.** El agente **escribe** los `.sql`; **la usuaria / Enzo los
> aplica**. La verificación manual es un checklist de coordinación, no un paso automatizado.

- [ ] 1B.1 Escribir `supabase/migrations/2026XXXXXXXXXX_factura_fecha_emision_indices.sql`:
      `ALTER TABLE facturacion.facturas ADD COLUMN fecha_factura DATE;` (nullable, sin default — ver
      D3 para por qué no lleva `NOT NULL` ni `CHECK` correlacionado) + los **6 índices** de D10
      (`facturas.paciente_id`, `facturas.domicilio_id`, `asistencia_prestacion.factura_id`,
      `cobros.facturas_id`, `documento_factura.factura_id`, `documento_factura.id_tipo_documento`),
      todos con `IF NOT EXISTS`. Cabecera con: qué se agrega, por qué, plan de rollback explícito
      (`DROP COLUMN` + `DROP INDEX` × 6), y la condición de caducidad del `CONCURRENTLY`.
      **No se toca ninguna columna, policy ni tabla existente.**
- [ ] 1B.2 Escribir `supabase/migrations/2026XXXXXXXXXX_factura_rpc.sql` con las dos funciones
      `plpgsql`, **`SECURITY INVOKER` explícito**, `SET search_path = ''`,
      `REVOKE ALL … FROM PUBLIC, anon`, `GRANT EXECUTE … TO authenticated` y `COMMENT ON FUNCTION`
      con la prohibición de `DEFINER` escrita para quien lea la base sin abrir el design.
      Cabecera con bloque **⚠️⚠️** explicando el vector de bypass de RLS sobre datos financieros.
      Ojo con el precedente engañoso del mismo schema: `facturacion.validar_autorizacion_monto()`
      **sí** es `DEFINER` (correcto, es un trigger de validación que no escribe).
- [ ] 1B.3 En `actualizar_factura_completa`, usar el operador `?` de `jsonb`
      (`p_cambios ? 'asistencias'`) para distinguir *clave ausente* de *clave presente con null*.
      **Es la trampa central del change**: confundirlas borra las asistencias en cada cambio de
      estado, que es la operación más frecuente del circuito.
- [ ] 1B.4 Implementar los códigos de error `45201`/`45202`/`45203`/`45204` de D4 (rango `452xx`, para
      no colisionar con el `451xx` de `integracion-obra-social`).
- [ ] 1B.5 **RED** — test que lee los `.sql` con `node:fs` (**no** `?raw` de Vite: no funciona para
      rutas fuera de `frontend/`, ya comprobado empíricamente) y verifica que declaran
      `SECURITY INVOKER` y **no** contienen `SECURITY DEFINER` fuera de comentarios y literales.
      Es la única barrera automatizada contra la regresión de seguridad más grave del change.
- [ ] 1B.6 Correr `supabase db advisors --linked --type security` **antes** de aplicar (para tener la
      línea base de hallazgos preexistentes) y **después**. Comparar y reportar el delta.
- [ ] 1B.7 **Aplicar las dos migraciones** — **la usuaria / Enzo**. Bloquea la §5.
- [ ] 1B.8 Verificación manual con la cuenta **Facturación** (`facturacion: write`): alta completa de
      una factura con 3 asistencias vía `POST /rpc/crear_factura_completa` → 1 fila en `facturas` y 3
      en `asistencia_prestacion`, con sus filas de auditoría.
- [ ] 1B.9 Verificación manual con una cuenta con `facturacion: read` **sin** `write`: la misma
      llamada → `42501` y **cero** filas escritas en ambas tablas. Es la prueba de que `INVOKER` está
      haciendo su trabajo.
- [ ] 1B.10 Verificación manual del caso que borra datos: `actualizar_factura_completa` con
      `{"estado":"facturado"}` (**sin** la clave `asistencias`) → las 3 asistencias **siguen ahí**.
      Repetir con `{"asistencias":[…2 filas…]}` → quedan exactamente 2.
- [ ] 1B.11 Verificación manual de la declaración de seguridad en la base:
      `select proname, prosecdef from pg_proc where proname in ('crear_factura_completa',
      'actualizar_factura_completa')` → `false` en ambas.
- [ ] 1B.12 Verificación manual de la trampa del embed (D5): con la cuenta Facturación, leer una
      factura con el embed de asistencias y confirmar que **no** vuelve con `asistencia_prestacion: []`
      cuando sí hay filas. (Hoy no puede fallar —las dos policies usan el mismo predicado— pero es el
      modo de falla "0 filas en silencio" que hay que dejar verificado.)

## 2. Mapeo puro — `facturaMapping.ts` (TDD estricto, nadie lo importa todavía)

> Fase enteramente aditiva: la app sigue andando con mocks al terminarla.

- [ ] 2.1 **RED** — `parseFacturaRow`: los 11 renombres de columna de D1 (`fecha_init`→`fechaInicial`,
      `fecha_tope`→`fechaTope`, `tipo`→`tipoComprobante`, `valor_km`, `cantidad_km`, `mes_facturado`,
      `anio_facturado`, `dependencia_y_retorno`, `fecha_estimada_cobro`, `fecha_factura`,
      `domicilio_id`). **GREEN → TRIANGULATE** (≥2 casos por comportamiento) **→ REFACTOR**.
- [ ] 2.2 **RED** — `estadoDesdeBase`: los **cinco** literales reales (`'a facturar'`, `'pendiente'`,
      `'facturado'`, `'cobrado'`, `'pagado parcialmente'`) + un literal desconocido → `'a-facturar'`.
      La función es **total**: nunca lanza. **GREEN → TRIANGULATE → REFACTOR**.
- [ ] 2.3 **RED** — `estadoHaciaBase`: los 4 estados del dominio → los 4 literales con espacio.
      **Test explícito de que nunca emite `'pendiente'`.**
- [ ] 2.4 **RED** — colapso de `identificador_origen` + `identificador_valor` en
      `identificadorFactura?: { origen, valor }`; con cualquiera de las dos en `NULL`, el campo queda
      **ausente** (no un objeto con string vacío).
- [ ] 2.5 **RED** — `parseAsistenciaRow` + ordenamiento client-side por `fecha` asc con desempate por
      `id`; `factura_sabados` → `facturaSabados`. Casos: colección vacía, fila malformada descartada
      sin romper la factura, dos asistencias con la misma fecha (orden estable entre lecturas).
- [ ] 2.6 **RED** — **nullability (D11)**: fila con `monto`, `dias`, `valor_km`, `cantidad_km`,
      `prestacion`, `dependencia_y_retorno`, `mes_facturado`, `anio_facturado`, `domicilio_id`,
      `fecha_init`, `fecha_tope`, `tipo` y `estado` en `NULL` → factura coherente con el tipo
      (`''` para textuales, `0` para numéricos, `'a-facturar'` para estado), **cero `undefined`
      filtrándose**. Ídem `asistencia_prestacion.dependencia` / `.retorno`.
- [ ] 2.7 **RED** — `parseCobroRow`: `facturas_id` (**plural**) → `facturaId`, `monto_pagado` →
      `montoPagado`.
- [ ] 2.8 **RED** — `toCrearFacturaPayload`: `NuevaFactura` → `jsonb`, con las asistencias anidadas y
      el estado convertido por `estadoHaciaBase`.
- [ ] 2.9 **RED** — `toActualizarFacturaPayload`: **semántica parcial**. Clave ausente en el `Partial`
      → clave ausente en el `jsonb`. Clave presente con `undefined` → ausente. Clave presente con un
      array vacío → presente (significa "borrar todas las asistencias", y es intencional).
      **Es la trampa que borra datos: test dedicado, no un caso más.**
- [ ] 2.10 **RED** — `toCrearCobroPayload`.
- [ ] 2.11 `npx tsc -b --noEmit` limpio + `oxlint` limpio. **Cero `any`, cero `as` sobre datos externos.**

## 3. `SupabaseFacturaRepository.ts` (TDD estricto, nadie lo importa todavía)

- [ ] 3.1 Construir el fake tipado del cliente de supabase-js (interfaces propias, **cero `any`, cero
      `as`**) que **registra** cada llamada. Reusar el criterio de
      `SupabaseObraSocialRepository.test.ts`, sin copiar de más: mantenerlo en el subconjunto mínimo
      usado (`schema`, `from`, `select`, `eq`, `maybeSingle`, `rpc`, `insert`, `delete`).
- [ ] 3.2 **RED** — `list()`: **una sola** consulta a `facturacion.facturas` con el embed de
      asistencias (anti N+1). Aserción sobre el número de llamadas registradas, no solo sobre el
      resultado.
- [ ] 3.3 **RED** — `getById()`: fila → `Factura`; sin fila → **`null`, no lanza**; RLS que filtra →
      también `null` (mismo camino de código, test separado porque es contrato).
- [ ] 3.4 **RED** — `listByPaciente()`: el filtro por `paciente_id` se aplica **en la consulta**, no
      filtrando el resultado de `list()` en memoria.
- [ ] 3.5 **RED** — `create()`: **exactamente una** `.rpc()` y **ningún** `.insert()` sobre
      `asistencia_prestacion`; relee por id y devuelve esa lectura.
- [ ] 3.6 **RED** — `update()`: ídem, con `p_id` y `p_cambios`; y el caso "solo estado" que **no**
      manda la clave `asistencias`.
- [ ] 3.7 **RED** — traducción de errores (D7), **un test por código**: `42501`/`PGRST301`, `23503`
      sobre `paciente_id`, `23503` sobre `domicilio_id`, `23514`, `22P02`, `45201`, `45202`, `45203`,
      `45204`, `PGRST202`, `PGRST204`, `PGRST106`, y el fallback genérico distinguiendo carga de
      guardado. **TRIANGULATE**: verificar además que ningún mensaje contiene nombres de tabla,
      nombres de columna ni texto en inglés.
- [ ] 3.8 **RED** — aserción de código fuente (`?raw`): el archivo no contiene `service_role`, no
      contiene `any`, no crea su propio cliente y no consulta `modulos.permisos` ni `modulos.modulos`.
- [ ] 3.9 `npx tsc -b --noEmit` + `oxlint` limpios.

## 4. `SupabaseCobroRepository.ts` (TDD estricto — bloqueada por 0.3)

- [ ] 4.1 **RED** — `list()`: una sola consulta sin filtro (la necesita `C-11`).
- [ ] 4.2 **RED** — `listByFactura(facturaId)`: filtro sobre la columna **`facturas_id`** (plural).
      Test explícito del nombre de columna: es el error más fácil de cometer y el más silencioso.
- [ ] 4.3 **RED** — `create()`: `.insert()` + `.select().single()`, devuelve el `Cobro` mapeado.
- [ ] 4.4 **RED** — `remove(id)`: `.delete().eq('id', id)`; una lectura posterior no lo incluye.
- [ ] 4.5 **RED** — traducción de errores: `42501`/`PGRST301` → mensaje de permiso; `23503` sobre
      `facturas_id` → `La factura de ese cobro ya no existe.`
- [ ] 4.6 **RED** — coherencia `list()` / `listByFactura()`: los cobros que devuelve el segundo son
      exactamente los del primero cuyo `facturaId` coincide (requisito vigente de `factura-contract`).
- [ ] 4.7 Aserción de código fuente (`?raw`) equivalente a 3.8.
- [ ] 4.8 `npx tsc -b --noEmit` + `oxlint` limpios.

## 5. El swap (⚠️ el corte real — bloqueada por 1B.7)

> Un solo commit. A partir de acá la pantalla usa datos reales.

- [ ] 5.1 **RED** — actualizar `FacturacionRoute.test.tsx` para inyectar dobles en lugar de los mocks
      concretos, si hoy los acopla.
- [ ] 5.2 Cambiar `FacturacionRoute.tsx`: `mockFacturaRepository` → `supabaseFacturaRepository` y
      `mockCobroRepository` → `supabaseCobroRepository`. **Dos imports y dos props. Nada más.**
      Los otros cinco repositories (Paciente, ObraSocial, Presupuesto, Autorizacion, Documento) y el
      fixture de feriados **no se tocan** en este change.
- [ ] 5.3 Verificar que **ningún** otro archivo de `features/facturacion/` cambió: los 26
      componentes, los 3 hooks, los 2 contexts y los 2 validadores quedan idénticos.
- [ ] 5.4 Verificar que **ninguna** de las 9 funciones puras de reglas de negocio de
      `shared/lib/facturacion/` cambió, y que **ninguna regla de negocio se reimplementó en SQL**
      (`calcularFechaEstimadaCobro` sigue siendo la única implementación de la precedencia
      amparo > obra social > default).
- [ ] 5.5 Correr la suite completa y comparar contra el baseline de 0.8. **Cero regresiones.**
- [ ] 5.6 Los mocks **no se borran**: verificar que `mockFacturaRepository` y `mockCobroRepository`
      siguen exportándose y siendo usables como dobles de test.

## 6. Carteles de discrepancia y de fuente mixta

- [ ] 6.1 **RED** — actualizar `FacturaAvisoDiscrepancias.tsx`: **retirar** las 4 discrepancias que el
      schema real ya cerró (no existe `asistencia_prestacion`, no existe `documento_factura`, no
      existe `fecha_estimada_cobro`, no existe `cantidad_km`). Dejar de afirmar como faltante algo que
      existe es tan importante como señalar lo que falta.
- [ ] 6.2 **RED** — **sumar** las discrepancias vigentes: el enum real tiene un estado que la app no
      modela (N2), la fecha de emisión es un agregado sobre el docx (N1), y la factura **no congela**
      la obra social con la que se emitió (§Open Questions).
- [ ] 6.3 **RED** — `AvisoModeloDatos` en `FacturaDocumentos.tsx` (D8): los adjuntos de la factura
      todavía no se persisten junto con la factura; remite al change de documentos/storage (fila 8 del
      plan de integración).
- [ ] 6.4 **RED** — `AvisoModeloDatos` en `AlertaCupo.tsx` (D9, **solo si la usuaria eligió la opción
      A** en 0.4): la validación de cupo opera sobre fuente mixta hasta que Presupuestos se integre.
- [ ] 6.5 Verificar que ningún cartel usa `style={{}}` y que todos reusan `AvisoModeloDatos` del
      design system en vez de markup propio.

## 7. Documentación (obligatoria, no opcional)

- [ ] 7.1 `knowledge-base/04_modelo_de_datos.md` §Discrepancias — bloque nuevo *"Facturación vs.
      esquema real de `C-07`"*: las 4 discrepancias **cerradas** (con la evidencia de qué existe hoy),
      la parcial (enum), y las 6 nuevas (N1-N6 de `design.md` D12).
- [ ] 7.2 `knowledge-base/10_preguntas_abiertas.md`:
      - **Actualizar el conteo acumulado de la pregunta de pgTAP** a **4 changes / 5 funciones**
        (`crear_paciente_completo`, `crear_obra_social_completa`, `actualizar_obra_social_completa`,
        `crear_factura_completa`, `actualizar_factura_completa`), con **cinco** changes de integración
        por delante. **No resolver la pregunta** — solo aportar el dato.
      - Sumar las preguntas nuevas: snapshot de obra social en la factura, `WITH CHECK` explícito en
        las policies de `facturacion`, `NOT NULL` de las columnas de `facturas`, reconciliación del
        schema real con las migraciones del repo, y el gateo de `presupuesto`/`autorizacion` por el
        módulo `presupuestos`.
      - **Dejar explícitamente sin cerrar las 4 preguntas de negocio de prioridad Alta** que este
        change hereda (D13): identificador DNI/afiliado, formato del período, plazos 90/60/45 y su
        precedencia, e integración ARCA. Anotar que el swap de backend **hereda el default, no lo
        convierte en definitivo**.
- [ ] 7.3 `CHANGES.md` §`C-07`: reescribir el bloque ⚠️ de 5 puntos contra la realidad verificada.
- [ ] 7.4 `CHANGES.md` §`C-11`: la discrepancia 3/4 (período estructurado) queda **cerrada**; la 2/4
      queda **a mitad** (el estado `facturado` existe; `fecha_factura` se agrega en este change).
- [ ] 7.5 `CHANGES.md` §`C-06`: registrar la trampa de RLS de D9 —`presupuesto` y `autorizacion` están
      gateadas por el módulo **`presupuestos`**, no por `facturacion` como dice la migración
      commiteada— como **bloqueante a resolver antes de `integracion-presupuestos`**.
- [ ] 7.6 `CHANGES.md` §Plan de integración, fila 4 (Facturación) → estado real.
- [ ] 7.7 `ROADMAP-FRONTEND.md`.

## 8. Verificación final

- [ ] 8.1 Suite completa en verde contra el baseline de 0.8, sin regresiones.
- [ ] 8.2 `cd frontend && npx tsc -b --noEmit` (**con `-b`**) y `oxlint` limpios.
- [ ] 8.3 Verificación manual en navegador con las **tres** cuentas de `VITE_TEST_ACCOUNTS`:
      - **Admin**: alta de factura con asistencias, emisión, registro de dos cobros parciales, baja de
        un cobro, vista imprimible.
      - **Facturación**: lo mismo (es el perfil real de uso). Confirmar además qué pasa con la alerta
        de cupo — es el perfil que expone la trampa de D9.
      - **Operación**: sin permiso de escritura sobre facturación → los formularios quedan en solo
        lectura y cualquier intento de escritura produce el mensaje en castellano de D7, no un error
        críptico ni un fallo silencioso.
- [ ] 8.4 Verificar en el navegador que **la fecha de emisión sobrevive a un recargar**: emitir una
      factura, recargar, confirmar que la alerta de vencimiento se sigue calculando. Es la prueba
      funcional de que D3 hacía falta.
- [ ] 8.5 Verificar en el navegador que **editar el estado de una factura no borra sus asistencias**
      (el modo de falla de 1B.3, visto desde la UI).
- [ ] 8.6 Guardar en engram (`project: "traslados-app"`, `topic_key:
      "opsx/integracion-facturacion/apply"`) las discrepancias reales encontradas en 1.3 respecto de
      lo que este `design.md` asume — cuarta vez consecutiva que conviene dejarlo escrito.
