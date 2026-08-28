# Tasks — facturacion-electronica-arca

> **⛔ GOVERNANCE CRÍTICO — ESTE CHANGE NO ESTÁ APROBADO PARA APPLY.**
> Facturación es el dominio equivalente a *Billing*: **análisis solamente; cero código de aplicación
> sin aprobación humana explícita**. La sección **0** es un portón: ninguna tarea de la §1 en
> adelante se ejecuta hasta que la usuaria responda las seis aprobaciones de `design.md`
> §Aprobaciones requeridas (D1, D3, D4, D6, D7, D8). Si el apply arranca sin esas respuestas, se
> detiene y se pregunta.
>
> **⚠️ Las migraciones, el deploy de la Edge Function y la carga de secrets NO los hace el agente.**
> Los hace la usuaria / Enzo. Son tareas de coordinación explícitas (§2B), no pasos escondidos.
>
> **⚠️ STRICT TDD ACTIVO** (`testing.strict_tdd: true`). Todo código de producción se implementa
> RED → GREEN → TRIANGULATE → REFACTOR. Antes de tocar cualquier archivo existente: correr el safety
> net y registrar el baseline.
> Test runner: `cd frontend && NODE_OPTIONS="--no-experimental-webstorage" npx vitest run`
>
> **Estado del portón (2026-08-28):** la usuaria dio "empezá a aplicar". D4 resuelto de fondo
> (IVA 21 % por dentro, `obra_social.cuit` = CUIT de la OS, `condicion_iva` → enum tipado). El agente
> implementa código + tests + `.sql` + `.ts` de EF; **migraciones, deploy y secrets siguen siendo de
> Enzo** (§2B.9–2B.11).
>
> **Reglas duras** (`CLAUDE.md`): nunca `any` (`unknown` + narrowing); nunca `style={{}}` (solo
> Tailwind v4); reusar `design-system/components.tsx`; nunca `SUPABASE_SERVICE_ROLE_KEY` en frontend;
> toda tabla/bucket nuevo define su RLS en el mismo change; type-check con **`npx tsc -b --noEmit`**;
> Conventional Commits; discrepancias documentadas en KB + `CHANGES.md` + `AvisoModeloDatos`.
>
> **Orden pensado para no dejar el árbol a medias**: §3 y §4 escriben archivos que nadie importa.
> El swap real es un único commit en la §5.

---

## 0. ⛔ Portón de governance

- [ ] 0.1 **Aprobación D1** — identidad fiscal 100% por secrets de Edge Function, sin tabla
      `facturacion.identidad_fiscal` ni campo en `cuentas` ni `.env` de frontend.
- [ ] 0.2 **Aprobación D3** — 7 columnas nuevas en `facturacion.facturas` (`cae`, `cae_vencimiento`,
      `cbte_nro`, `pto_vta`, `arca_ambiente`, `comprobante_pdf_url`, `arca_respuesta`), todas nullable.
- [x] 0.3 **Aprobación D4** — decisiones de la usuaria (2026-08-28): IVA **21 % por dentro**
      (`neto = monto/1.21`, overrideable por `ARCA_IVA_CODIGO` / `ARCA_IVA_MODO`); `obra_social.cuit`
      = CUIT de la **obra social** pagadora (cierra discrepancia #12); `condicion_iva` = **enum
      tipado** (cierra discrepancia #14). Falta solo confirmar por-dentro/por-fuera con el contador
      (secret, sin deploy).
- [ ] 0.3-bis **Aprobación D4-bis** — `obra_social.condicion_iva` `TEXT` → enum tipado: migración
      `ALTER … CHECK`, tipo TS `CondicionIvaArca`, `<select>` en `ObraSocialForm`. Coordinar backfill
      con Enzo (qué valores tiene hoy la columna).
- [ ] 0.4 **Aprobación D6** — agregar `pdf-lib` como dependencia y generar el PDF del comprobante en
      la Edge Function.
- [ ] 0.5 **Aprobación D7** — bucket privado `facturas-emitidas` gateado por el módulo `facturacion`.
- [ ] 0.6 **Aprobación D8** — mover los 4 snapshots de emisión (`identificadorFactura`,
      `fechaFactura`, `fechaEstimadaCobro`, `descripcion`) del cliente a la Edge Function.
- [ ] 0.7 **Coordinación con Enzo** — confirmar que las 7 columnas de D3 no están planeadas con otros
      nombres (patrón N6: el schema real viene por delante del repo hace 3+ changes).
- [ ] 0.8 **Coordinación con Enzo / Andrea** — confirmar disponibilidad de: URL del miniserver
      desplegado (o plan de despliegue), y los documentos de ARCA de **homologación** para probar
      (cert + key de testing, CUIT, punto de venta).
- [ ] 0.9 Revisar `https://supabase.com/changelog.md` por cambios en `functions.invoke`,
      `storage.upload`, `createSignedUrl` o el runtime de Edge Functions (Deno) desde la última
      verificación. Registrar hallazgos o "sin novedades".
- [ ] 0.10 **Safety net / baseline.** Correr la suite completa con el flag `NODE_OPTIONS` y registrar
      el número exacto de archivos y tests. No asumir 0 fallas (`ChecklistEditor.test.tsx` y
      `PermisosMatrizFields.test.tsx` ya entran rojos por otros changes — ver
      `integracion-facturacion` tasks §0.8/5.5).

---

## 1. Precondiciones del backend (verificar, no modificar)

> Solo lectura. Ninguna tarea corre DDL.

- [x] 1.1 **VERIFICADO 2026-08-28**: ninguna de las 7 columnas de D3 existe en `facturacion.facturas`.
      `fecha_factura date NULL` y `autorizacion_id uuid NULL` sí existen. Migración aditiva limpia.
- [x] 1.2 **VERIFICADO 2026-08-28**: `facturacion.tipo_factura` = `A | B | C`;
      `facturacion.estado_factura` = `a facturar | pendiente | facturado | cobrado | pagado parcialmente`.
- [x] 1.3 **VERIFICADO 2026-08-28 (`supabase db query --linked`)**: `obra_social.obra_social` →
      `cuit text NOT NULL`, `condicion_iva text NULL` (sin `CHECK`), `plazo_cobro_dias integer NOT NULL`,
      `identificador_origen` USER-DEFINED NOT NULL, `tipo_comprobante` USER-DEFINED NULL.
      **Valores actuales de `condicion_iva`** (10 OS): 6 `NULL`, 3 `'Exento'`, 1 `'respo'` (dato de
      prueba incompleto). Backfill de 4B.5: `'Exento' → 'IVA_SUJETO_EXENTO'`; `'respo' → NULL` (no se
      adivina: Andrea lo re-carga con el `<select>` nuevo).
- [x] 1.4 **CONFIRMADO (2026-08-28, leyendo `20260812160000_factura_rpc.sql`)**:
      `actualizar_factura_completa` tiene whitelist fijo de columnas — **hay que ampliarla**. La
      migración de este change incluye un `CREATE OR REPLACE FUNCTION` que suma
      `cae`/`cae_vencimiento`/`cbte_nro`/`pto_vta`/`arca_ambiente`/`comprobante_pdf_url`/`arca_respuesta`
      al `UPDATE ... SET` con el patrón `CASE WHEN p_cambios ? 'clave'` (idéntico a
      `20260813090001_factura_rpc_autorizacion.sql`). `crear_factura_completa` no se toca. El agente
      **escribe** el `.sql`; **Enzo lo aplica**.
- [ ] 1.5 Confirmar que `facturacion` está en `modulos.modulos` y qué permisos tiene la cuenta
      *Facturación* de `VITE_TEST_ACCOUNTS` (o del entorno real). Restaurar `VITE_TEST_ACCOUNTS` en
      `frontend/.env.local` si sigue ausente (ver `integracion-facturacion` tasks §1.5).
- [ ] 1.6 Revisar el contrato del miniserver contra `facturas/README.md` una vez más y, si está
      desplegado, un `GET /health` con la `X-Api-Key` de homologación para confirmar disponibilidad.
- [x] 1.7 **RESUELTO 2026-08-28**: NO se importa directo de `frontend/src/shared/lib/` — esos
      archivos usan imports sin extensión (`./constantes`) y tipos cross-file que Deno no resuelve.
      D8 se implementa por **copia**: `supabase/functions/_shared/emisionSnapshots.ts` (Deno-limpio,
      tipos inline). Falta el test de paridad (2.7).

## 2. Funciones puras (TDD estricto, nadie las importa todavía)

> Fase enteramente aditiva. La app sigue emitiendo como hoy al terminarla.
>
> **Estado 2026-08-28**: escritas y `deno check` limpio — `_shared/arca.ts`,
> `facturar/codigoBarrasAfip.ts`, `_shared/emisionSnapshots.ts`, `facturar/facturaPdf.ts`,
> `facturar/index.ts`. **Falta**: los tests `deno test` (2.1–2.7) y el test de paridad D8 (2.7).
> Deno disponible en `~/.local/bin/deno` (ver [[entorno-wsl-sin-node]]).

- [ ] 2.1 **RED** — `supabase/functions/_shared/arca.ts` : `construirPayloadArca(factura, paciente,
      obraSocial, config)`. Casos: `tipoComprobante` `'A'` → `FACTURA_A` con `docTipo/docNro/
      condicionIva`; `'B'` → `FACTURA_B` sin receptor obligatorio; `'C'` → lanza
      `EMISION_TIPO_NO_SOPORTADO`. `servicio` = `{ desde: fechaInicial, hasta: fechaTope, vtoPago:
      fechaEstimadaCobro }`. Regla de IVA según la opción aprobada en 0.3. **GREEN → TRIANGULATE →
      REFACTOR.**
- [ ] 2.2 **RED** — `arca.ts` : `parseRespuestaMiniserver(status, body)` → unión discriminada
      `{ ok: true, cae, caeVencimiento, cbteNro, importes }` | `{ ok: false, codigo, detalle }`.
      Casos: 200 `aprobada:true`; 401 `Unauthorized` / `ARCA_AUTH_ERROR`; 422 `ARCA_RECHAZO` con
      `observaciones`; 422 `ARCA_REJECTION`; 400; body no-JSON; timeout (lo pasa el caller).
- [ ] 2.3 **RED** — `obraSocial.condicionIva` ya es `CondicionIvaArca` (enum tipado, §4B): la EF lo
      pasa **tal cual** al miniserver. Solo se testea: valor ausente + `FACTURA_A` →
      `EMISION_SIN_CONDICION_IVA`; valor presente → viaja sin transformar. (Sin tabla de sinónimos:
      el enum ya son los códigos de ARCA.)
- [ ] 2.4 **RED** — `codigoBarrasAfip.ts` : string AFIP (`CUIT + tipoCbte + ptoVta + CAE + vtoCAE`)
      + dígito verificador módulo 10. Casos contra un ejemplo conocido de AFIP.
- [ ] 2.5 **RED** — `emisionMapping.ts` (frontend) : respuesta de la EF `facturar` → `Factura`
      (releída) ; y el error de la EF → `Error` con el mensaje de `design.md` D9. `it.each` sobre
      los ~12 códigos: ningún mensaje filtra nombres de tabla/columna ni inglés técnico.
- [ ] 2.6 **RED** — `facturaPdf.ts` : `construirFacturaPdf(datos): Promise<Uint8Array>`. No se
      testea el binario pixel a pixel — se testea que: devuelve bytes que empiezan con `%PDF-`,
      incluye el `cae` y el `cbteNro` como texto extraíble, marca "HOMOLOGACIÓN — SIN VALOR FISCAL"
      cuando `arcaAmbiente === 'homologacion'`, y lista N filas de asistencias. `pdf-lib` importado
      con versión pineada.
- [ ] 2.7 **RED** — (D8) paridad de los 4 snapshots: si 1.7 dio "no se puede importar",
      `_shared/emisionSnapshots.ts` reimplementa `resolverIdentificadorFactura`,
      `calcularFechaEstimadaCobro`, `renderDescripcionFactura`, `construirDatosDescripcion` en Deno,
      y un test de paridad corre las mismas entradas contra las dos copias. Si 1.7 dio "sí se
      puede", import directo y esta tarea es solo el test de humo.
- [ ] 2.8 `npx tsc -b --noEmit` + `oxlint` limpios sobre todo lo nuevo. `deno check` sobre los
      `_shared/*.ts` y `functions/facturar/*.ts`. **Cero `any`, cero `as` sobre datos externos.**

## 2B. Edge Function `facturar` + migraciones (coordinación con backend)

> Bloqueada por 0.1–0.7. El agente **escribe**; **la usuaria / Enzo aplica y despliega**.

- [ ] 2B.1 `supabase/functions/facturar/index.ts` — flujo de `design.md` D2 pasos 1–10.
      `requirePermiso(req, 'facturacion', 'write')`. Lee `ARCA_*` de `Deno.env`; si falta alguno →
      `503 EMISION_NO_CONFIGURADA`. Carga factura + asistencias + paciente + obra social con
      `userClient`. Guards: `404` (inexistente/RLS), `409 YA_EMITIDA` (`cae` presente), `409`
      (estado ≠ `a-facturar`). `fetch` al miniserver con timeout 25 s y header `X-Api-Key`.
      Persiste con `userClient.rpc('actualizar_factura_completa', …)` **antes** del PDF.
- [ ] 2B.2 En la misma EF: generar el PDF (`facturaPdf.ts`), subir con
      `admin.storage.from('facturas-emitidas').upload('{facturaId}/{cbteTipo}-{ptoVta}-{cbteNro}.pdf',
      bytes, { contentType: 'application/pdf', upsert: false })`, y un segundo
      `actualizar_factura_completa` con `comprobantePdfUrl`. Si el PDF/upload falla **después** de
      persistir el CAE: `200` igual (la factura está emitida) con un warning en el body
      (`pdfPendiente: true`) + log — no se pierde el CAE.
- [ ] 2B.3 CORS: reusar `CORS_HEADERS` de `_shared/auth.ts` (ya incluye POST/OPTIONS).
- [ ] 2B.4 Test de la EF: `deno test` con un fake de `fetch` (respuestas 200/401/422/timeout) y un
      fake del cliente supabase — verifica que **nada se persiste** en los caminos 401/422/400/timeout,
      que el guard de idempotencia corta antes del `fetch`, y que el orden es persistir-CAE →
      generar-PDF → persistir-URL.
- [ ] 2B.5 `supabase/migrations/2026XXXXXXXXXX_factura_arca.sql` — (a) `ADD COLUMN IF NOT EXISTS` × 7
      (D3), todas nullable, con el `CHECK` de `arca_ambiente`; (b) `CREATE OR REPLACE FUNCTION
      facturacion.actualizar_factura_completa` sumando esas 7 claves al `UPDATE ... SET` con el
      patrón `CASE WHEN p_cambios ? 'clave'` — **SECURITY INVOKER, `SET search_path = ''`**, calcado
      de `20260813090001`. Cabecera (qué, por qué, rollback: `DROP COLUMN` × 7 + `CREATE OR REPLACE`
      a la versión previa). No toca ninguna otra columna/policy/tabla. **NUNCA SECURITY DEFINER.**
- [ ] 2B.6 `supabase/migrations/2026XXXXXXXXXX_bucket_facturas_emitidas.sql` — bucket privado + 4
      policies gateadas por `modulos.tiene_permiso('facturacion', …)` (D7), patrón exacto de
      `bucket_documentos_autorizaciones`. Cabecera + rollback.
- [ ] 2B.7 Test de código fuente del `.sql` (`node:fs`): el bucket es `public=false`; las 4 policies
      nombran `facturacion` y el bucket correcto; ninguna policy es `TO public`/`anon`.
- [ ] 2B.8 `supabase db advisors --linked --type security` — **línea base antes**. Registrar
      hallazgos preexistentes.
- [ ] 2B.9 **Aplicar las dos migraciones** — **la usuaria / Enzo** (`supabase db push --linked`).
      `db advisors` **después**: el delta no debe sumar ningún hallazgo nuevo.
- [ ] 2B.10 **Deploy de la EF** — **la usuaria / Enzo** (`supabase functions deploy facturar`).
- [ ] 2B.11 **Cargar secrets de homologación** — **la usuaria / Enzo**
      (`supabase secrets set ARCA_MINISERVER_URL=… ARCA_MINISERVER_API_KEY=… ARCA_CUIT=… ARCA_CERT_B64=…
      ARCA_KEY_B64=… ARCA_PTO_VTA=… ARCA_AMBIENTE=homologacion` + los `ARCA_EMISOR_*` opcionales).
- [ ] 2B.12 Verificación manual: emisión real contra **homologación** de una factura de prueba →
      `cae` de test persistido, `cbte_nro`/`pto_vta`/`arca_ambiente='homologacion'` en la fila, PDF
      en `facturas-emitidas`, `estado='facturado'`. Repetir el POST → `409 YA_EMITIDA`.
- [ ] 2B.13 Verificación manual: cuenta con `facturacion: read` sin `write` → `403`, nada persiste.
- [ ] 2B.14 Verificación manual: forzar un rechazo de ARCA (dato inválido) → `422`, la factura sigue
      en `a-facturar` y editable, el motivo se ve en la UI.

## 3. `emisionMapping.ts` + `SupabaseEmisionRepository.ts` + `mockEmisionRepository.ts` (TDD estricto)

- [ ] 3.1 Fake tipado de `supabase.functions.invoke` (cero `any`, cero `as`), mismo molde que
      `SupabasePresupuestoRepository.test.ts`.
- [ ] 3.2 `SupabaseEmisionRepository.emitir(facturaId): Promise<Factura>` — una sola
      `functions.invoke('facturar', { method: 'POST', body: { facturaId } })`. Test dedicado del
      payload exacto.
- [ ] 3.3 Un test por código de error de D9 (503/403/404/409×2/422×3/502×2/500/genérico) → el
      mensaje exacto en castellano. Ningún mensaje filtra internals.
- [ ] 3.4 `mockEmisionRepository.ts` — para tests/desarrollo sin backend: simula un CAE y un
      `comprobantePdfUrl` fijos, respeta la idempotencia (segundo `emitir` del mismo id → error).
- [ ] 3.5 Test de código fuente (`node:fs`): sin `service_role`, sin `\bany\b`, importa el singleton
      de `../supabaseClient`, no consulta `modulos.permisos`/`modulos.modulos`.
- [ ] 3.6 `npx tsc -b --noEmit` + `oxlint` limpios. RED real confirmado antes de implementar.

## 4. Tipo `Factura` + `facturaMapping.ts` (TDD estricto, aditivo)

- [ ] 4.1 **RED** — `shared/types/factura.ts`: `cae?`, `caeVencimiento?`, `cbteNro?`, `ptoVta?`,
      `arcaAmbiente?: 'production' | 'homologacion'`, `comprobantePdfUrl?` — todos opcionales.
      Documentar cada uno con su origen (ausente mientras `a-facturar`). `NuevaFactura` /
      `ActualizacionFactura` los heredan (no se cargan desde el alta, los pone la EF).
- [ ] 4.2 **RED** — `facturaMapping.ts` `parseFacturaRow`: los 6 renombres snake→camel; con la
      columna `NULL` el campo queda **ausente** (no `''` ni `0`). `arca_respuesta` **no** se mapea
      al dominio. **GREEN → TRIANGULATE → REFACTOR.**
- [ ] 4.3 **RED** — `SupabaseFacturaRepository.SELECT_FACTURA_COMPLETA` suma las 6 columnas. Test
      de que `list()`/`getById()` las traen.
- [ ] 4.4 `toActualizarFacturaPayload` — los 6 campos siguen la semántica parcial ya existente
      (clave ausente → no toca). No hace falta `toCrear…` (el alta no los trae).
- [ ] 4.5 `npx tsc -b --noEmit` + `oxlint` limpios. Suite de `shared/lib/facturacion/` verde.

## 4B. `obra_social.condicion_iva` → enum tipado `CondicionIvaArca` (D4-bis, TDD estricto)

> Toca el dominio `obra-social`. Aditivo salvo el `<select>` que reemplaza un `<input>` de texto.

- [ ] 4B.1 **RED** — `shared/types/obraSocial.ts`: `CondicionIvaArca` = unión cerrada de los 8
      literales de ARCA (`IVA_RESPONSABLE_INSCRIPTO`, `IVA_SUJETO_EXENTO`, `CONSUMIDOR_FINAL`,
      `IVA_RESPONSABLE_MONOTRIBUTO`, `MONOTRIBUTO`, `PROVEEDOR_DEL_EXTERIOR`, `CLIENTE_DEL_EXTERIOR`,
      `IVA_LIBERADO`) + un `const CONDICIONES_IVA_ARCA` con label legible para el `<select>`.
      `ObraSocial.condicionIva?: CondicionIvaArca`. Sin `any`.
- [ ] 4B.2 **RED** — `validateObraSocialForm.ts`: si `condicionIva` viene, debe estar en la unión;
      mensaje de error si no. Ajustar los tests existentes que hoy pasan texto libre.
- [ ] 4B.3 **GREEN** — `ObraSocialForm.tsx`: el campo de condición IVA pasa de `<Input>` de texto a
      `<Select>` (design system) con las 8 opciones + "(sin especificar)". `ObraSocialDetail.tsx`
      muestra el label legible.
- [ ] 4B.4 Mapeo repo: `obra-social` mapping snake↔camel — `condicion_iva` sigue 1:1, ahora tipado.
      Ajustar `SupabaseObraSocialRepository` / mock si validan el shape.
- [ ] 4B.5 `supabase/migrations/2026XXXXXXXXXX_obra_social_condicion_iva_enum.sql` —
      `ALTER TABLE obra_social.obra_social ADD CONSTRAINT obra_social_condicion_iva_check
      CHECK (condicion_iva IS NULL OR condicion_iva IN (…8 valores…))`. Cabecera: qué agrega, por qué
      (cierra discrepancia #14, la consume la emisión de Factura A), rollback (`DROP CONSTRAINT`).
      **Backfill**: si `information_schema` / `SELECT DISTINCT condicion_iva` muestra valores fuera de
      la lista, un `UPDATE` de normalización **redactado por el agente pero aplicado por Enzo**, o el
      `CHECK` entra `NOT VALID` + `VALIDATE` posterior. Coordinar en 0.3-bis.
- [ ] 4B.6 Test de código fuente del `.sql` (`node:fs`): el `CHECK` nombra los 8 valores y admite
      `NULL`; no hay `DROP COLUMN` ni `TYPE` destructivo.
- [ ] 4B.7 **Aplicar la migración** — **Enzo** (§2B.9 la agrupa). `db advisors` sin hallazgos nuevos.
- [ ] 4B.8 `npx tsc -b --noEmit` + `oxlint` limpios. Suite de `features/obras-sociales/` verde.

## 5. El swap (⚠️ el corte real — bloqueada por 2B.10 y 2B.11)

> Un solo commit. A partir de acá "Emitir" llama a ARCA.

- [ ] 5.1 **RED** — `useEmisionFactura.test.ts`: el test de "emitir" pasa a esperar una invocación
      de `emisionRepository.emitir(facturaId)` en vez de `actualizar(id, { estado: 'facturado' })`.
- [ ] 5.2 **GREEN** — `useEmisionFactura.ts`: `emitirFactura()` llama `emisionRepository.emitir(…)`.
      Se **quitan** de este hook los pasos de congelado (identificador / fechaFactura /
      fechaEstimadaCobro / descripción) — ahora los hace la EF (D8). `handleEmitirClick` sigue
      corriendo `validarCupoFacturacion` **antes** (sin cambios) y `handleConfirmarEmision` llama a
      `emitir` tras la confirmación de cupo.
- [ ] 5.3 `FacturacionRoute.tsx` inyecta `SupabaseEmisionRepository` (nuevo provider/context o prop
      a `FacturaDetail`, el mínimo cableado). `FacturaDetail.tsx` pasa el repo a `useEmisionFactura`.
- [ ] 5.4 `git diff --stat` — verificar que el swap toca solo `useEmisionFactura.ts`,
      `FacturacionRoute.tsx`, `FacturaDetail.tsx` (+ tests). Las 9 funciones puras de reglas de
      negocio no aparecen en el diff.
- [ ] 5.5 Safety net completo — comparar contra el baseline de 0.10. Ninguna falla nueva dentro de
      `features/facturacion/` ni `shared/lib/facturacion/`.
- [ ] 5.6 `mockEmisionRepository` sigue exportado y usable como doble de test.

## 6. Componentes — mostrar el comprobante emitido

- [ ] 6.1 **RED → GREEN** — `FacturaResumen.tsx` / `FacturaAccionesEmision.tsx`: cuando
      `factura.cae` existe, mostrar CAE, `caeVencimiento`, `Comprobante {cbteTipo} {ptoVta}-{cbteNro}`
      y un botón "Ver comprobante (PDF)" (link a la signed URL). El botón "Emitir" se oculta cuando
      `factura.cae` existe (además de cuando `estado !== 'a-facturar'`).
- [ ] 6.2 **RED → GREEN** — cuando la última emisión fue rechazada (error `422` capturado en
      `submitError`), mostrar el motivo con `Alert tone="warning"` y dejar la factura editable.
      Mensaje de homologación si `arcaAmbiente === 'homologacion'` ("Comprobante de PRUEBA, sin
      valor fiscal").
- [ ] 6.3 **RED → GREEN** — `FacturaImprimible.tsx`: sumar CAE / vto CAE / nº de comprobante al
      encabezado (sin reemplazar el componente).
- [ ] 6.4 **RED → GREEN** — `FacturaDocumentos.tsx` / `checklistDocumentosFactura.ts`: el ítem
      "Comprobante ARCA" deja de ser `requerido: true` de carga manual cuando la factura ya tiene
      `cae` (el PDF generado es el respaldo). `AvisoModeloDatos` explicando el cambio.
- [ ] 6.5 **RED → GREEN** — obtención de la signed URL del PDF: helper en `SupabaseFacturaRepository`
      o EF de lectura (según lo resuelto en apply, `design.md` §Open Questions).
- [ ] 6.6 `AvisoModeloDatos` en `FacturaFormEconomicos.tsx` / pantalla de emisión: Factura C no
      soportada electrónicamente; `monto` es total, no neto+IVA (se emite con IVA 21 % por dentro).
      **Quitar** el `AvisoModeloDatos` de ambigüedad de CUIT de `ObraSocialDetail.tsx` (#12 resuelta).
- [ ] 6.7 `rg 'style=\{\{'` sobre los archivos tocados → sin resultados. `npx tsc -b --noEmit` +
      `oxlint` limpios. Suite focalizada de `features/facturacion/` verde.

## 7. Documentación (obligatoria)

- [ ] 7.1 `knowledge-base/10_preguntas_abiertas.md`:
      - La pregunta *"Integración con ARCA"* pasa a **RESUELTA**: integración automática vía
        miniserver `arca-miniserver`, config íntegra por secrets de Edge Function; la única
        dependencia externa es el despliegue del miniserver.
      - **Cerradas por decisión de la usuaria (2026-08-28)**: `obra_social.cuit` = CUIT de la obra
        social pagadora (discrepancia #12); `obra_social.condicion_iva` = enum tipado con los códigos
        de ARCA (discrepancia #14); alícuota de IVA = 21 % (falta solo por-dentro/por-fuera → contador).
      - Sumar: datos del emisor para el PDF (secrets vs. tabla editable), punto de venta único vs.
        múltiple, anulación / nota de crédito, IVA por dentro vs. por fuera.
- [ ] 7.2 `knowledge-base/04_modelo_de_datos.md` §Discrepancias — #12 (`cuit`) → **resuelta**: CUIT
      de la obra social; #14 (`condicion_iva`) → **resuelta**: enum tipado. Sumar: Factura C no
      soportada por el miniserver; `Factura.monto` es total y no desglosa neto+IVA (se asume IVA por
      dentro); 7 columnas nuevas de `facturas` + `CHECK` de `condicion_iva`.
- [ ] 7.3 `knowledge-base/05_reglas_de_negocio.md` — nota en RN-FA-07 (tipo de comprobante) sobre la
      restricción A/B del miniserver, y una RN-FA nueva (o nota) sobre emisión electrónica: una
      factura con `cae` es un documento fiscal, no se re-emite ni se vuelve a `a-facturar` desde la
      app (RN-FA-06).
- [ ] 7.4 `knowledge-base/08_arquitectura_propuesta.md` — sección de integración ARCA: el miniserver
      como servicio externo, la EF `facturar` como proxy, los secrets, el bucket.
- [ ] 7.5 `CHANGES.md` §C-07 y §Plan de integración — emisión electrónica real; checklist manual de
      comprobante ARCA cerrado.
- [ ] 7.6 `ROADMAP-FRONTEND.md` — fila C-07.
- [ ] 7.7 `facturas/README.md` — nota (o issue en ese repo) de que el consumidor de producción es la
      EF `facturar` de este proyecto; documentar los nombres de secret que este proyecto esportará.

## 8. Verificación final

- [ ] 8.1 Safety net completo — comparar contra 0.10 / 5.5. Documentar toda falla nueva.
- [ ] 8.2 `npx tsc -b --noEmit` (con `-b`) exit 0. `oxlint .` sin errores nuevos.
      `deno check` sobre `supabase/functions/facturar/` y `_shared/arca.ts`.
- [ ] 8.3 **Verificación manual E2E en homologación** (la usuaria, en el navegador, con la cuenta
      Facturación): alta de una factura A con 3 asistencias → "Emitir" → CAE de prueba visible,
      número de comprobante, link al PDF que abre y muestra el layout de D6 con la marca de
      HOMOLOGACIÓN → recargar → el CAE y el PDF siguen ahí.
- [ ] 8.4 **Verificación manual**: intentar emitir una Factura C → mensaje claro, sin crash.
- [ ] 8.5 **Verificación manual**: sin `VITE`/secrets configurados (o simulando `503`) → el botón
      "Emitir" muestra "La emisión electrónica todavía no está configurada", la factura no cambia.
- [ ] 8.6 **Producción** (fuera de este change, checklist para la usuaria): `supabase secrets set
      ARCA_AMBIENTE=production` + cert/key/CUIT/puntoVenta reales. Emitir una factura real de bajo
      monto y verificar en el portal de ARCA. **Ningún cambio de código.**
- [ ] 8.7 Guardar en engram (`project: "traslados-app"`, `topic_key:
      "opsx/facturacion-electronica-arca/apply"`) las discrepancias reales encontradas y las
      decisiones de IVA/CUIT que la usuaria haya tomado.
