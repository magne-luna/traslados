## Context

**Estado actual de la emisión.** `frontend/src/features/facturacion/useEmisionFactura.ts` implementa
"Emitir factura" como una edición local: congela `identificadorFactura`, `fechaFactura` (= hoy),
`fechaEstimadaCobro` (`calcularFechaEstimadaCobro`) y `descripcion` (`renderDescripcionFactura`), y
llama `actualizar(id, { estado: 'facturado', … })` → `SupabaseFacturaRepository.update` → RPC
`facturacion.actualizar_factura_completa`. No hay ningún componente fiscal: ni CAE, ni número de
comprobante, ni punto de venta, ni PDF. El "Comprobante ARCA" es un ítem manual del checklist
documental (`shared/lib/facturacion/checklistDocumentosFactura.ts`, `{ id: 'comprobante-arca',
requerido: true }`).

**El miniserver.** `facturas/README.md` — `arca-miniserver`, proxy Node.js de facturación
electrónica (WSAA + WSFE, firma CMS con `node-forge`). Contrato relevante:

```
POST /facturar
  headers: X-Api-Key: <key>, Content-Type: application/json
  body (identidad fiscal):  cuit:number, certB64:string, keyB64:string, environment?:"production"|"homologacion"
  body (comprobante):       ptoVta:number, cbteTipo:"FACTURA_A"|"FACTURA_B", items:[{neto:number, iva:"IVA_21"|"IVA_10_5"|"IVA_0"|"IVA_27", exento?:boolean}]
                            docTipo?:"CUIT"|"DNI"|"CUIL", docNro?:number, condicionIva?:string|number   (obligatorios en FACTURA_A)
                            servicio?:{ desde, hasta, vtoPago }
  200 -> { aprobada:true, cae:string, caeVencimiento:string(YYYY-MM-DD), cbteNro:number, importes:{neto,iva,total} }
  400 -> { error }                                    faltan campos / identidad inválida
  401 -> { error:"Unauthorized" } | { aprobada:false, error:"ARCA_AUTH_ERROR", detalles }
  422 -> { aprobada:false, error:"ARCA_RECHAZO", cbteNro, observaciones } | { error:"ARCA_REJECTION", detalles }
```

Multi-titular: la identidad viaja en cada request; el servidor no se configura con un CUIT. Cold
start ~10 s. No loguea cuerpos. Cachea el TA por titular.

**Estado del backend del proyecto.** Schema `facturacion` real (verificado en changes anteriores):
`facturas` con 20 columnas (incluida `fecha_factura` de `integracion-facturacion` y `autorizacion_id`
de `autorizacion-mensual`), `asistencia_prestacion`, `cobros`, `documento_factura`, todas con RLS
`tiene_permiso('facturacion', …)`, GRANT a `authenticated`, triggers de auditoría. RPC
`crear_factura_completa` / `actualizar_factura_completa` (`SECURITY INVOKER`) aplicadas. Enum
`facturacion.tipo_factura = 'A' | 'B' | 'C'`. `obra_social` tiene `cuit TEXT` (decisión usuaria
2026-08-28: es el CUIT de la obra social pagadora), `condicion_iva TEXT` (este change lo convierte en
enum tipado, D4-bis), `plazo_cobro_dias`, `plantilla_factura`, `identificador_origen`.

**Edge Functions.** Patrón fijado por `pacientes` / `obra-social` / `presupuestos`:
`_shared/auth.ts` → `requirePermiso(req, modulo, nivel)` devuelve `{ userId, admin, userClient }`.
`admin` = service-role (bypassa RLS); `userClient` = scoped al JWT del caller. Las escrituras
"finales" usan `userClient` cuando la RLS ya cubre lo mismo que `requirePermiso`. `CORS_HEADERS`
compartido. `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` vía `Deno.env.get`.

**Frontend ↔ EF.** `SupabasePresupuestoRepository` / `SupabaseAutorizacionRepository` /
`SupabaseVehiculoRepository` / `SupabaseCuentaRepository` usan `supabase.functions.invoke('<fn>', {
method, body })` y traducen el error con un helper (`edgeFunctionErrors.ts`).

**Storage.** Buckets privados creados en `20260727000001_create_buckets.sql` +
`20260729100001_storage_objects_rls.sql`; el quinto (`bucket_documentos_autorizaciones`) fijó el
patrón: `INSERT INTO storage.buckets … public=false` + 4 policies (`SELECT`/`INSERT`/`UPDATE`/`DELETE`)
`ON storage.objects … USING (bucket_id = '…' AND modulos.tiene_permiso('<modulo>', '<nivel>'))`.

**Restricciones duras** (`CLAUDE.md`): nada de `any` (`unknown` + narrowing); solo utilidades
Tailwind v4, nunca `style={{}}`; reusar `design-system/components.tsx`; nunca
`SUPABASE_SERVICE_ROLE_KEY` en frontend; toda tabla/bucket nuevo define su RLS en el mismo change;
`npx tsc -b --noEmit` como único type-check válido; Strict TDD (RED→GREEN→TRIANGULATE→REFACTOR);
Conventional Commits; el docx manda en estructura, la KB en reglas de negocio, y toda discrepancia
se documenta en KB + `CHANGES.md` + `AvisoModeloDatos`, nunca se resuelve adivinando.

---

## ⚠️ Governance: CRÍTICO — Aprobaciones requeridas antes del apply

Facturación es dominio **CRÍTICO** (equivalente a *Billing*): **análisis solamente; ningún código de
aplicación sin aprobación humana explícita**. Este `design.md` no autoriza el apply. Replicadas como
portón en `tasks.md` §0:

| # | Decisión | Por qué necesita aprobación |
|---|---|---|
| **D1** | Identidad fiscal 100% por secrets de EF, cero tabla | Define dónde vive el certificado/clave de la empresa. Alternativa (tabla cifrada) descartada, pero la decisión es de la usuaria |
| **D3** | 7 columnas nuevas en `facturacion.facturas` | Modificación de schema sobre un dominio financiero, tabla que backend viene modificando fuera del historial de migraciones (patrón N6). Coordinar con Enzo |
| **D4** | Mapeo factura → payload ARCA. Decisiones de la usuaria (2026-08-28): IVA 21 % (por dentro), `obra_social.cuit` = CUIT de la obra social, `condicion_iva` = enum tipado. Queda abierta solo la sub-pregunta por-dentro/por-fuera (secret, sin deploy) | Cada default mal elegido produce un comprobante fiscal incorrecto. Ahora resueltas por la usuaria; se aprueba el mapeo resultante |
| **D4-bis** | `obra_social.condicion_iva` `TEXT` libre → enum tipado (migración + tipo + form) | Cambio de schema sobre `obra_social`, dominio ajeno a este change; coordinar backfill con Enzo |
| **D6** | Nueva dependencia para generar el PDF (`pdf-lib`) + generación del documento fiscal del lado del servidor | Suma una dependencia al frontend/EF y define quién compone el documento fiscal |
| **D7** | Bucket `facturas-emitidas` + generar el PDF en la EF con `service_role` | Almacenamiento de documentos fiscales; radio de acceso |
| **D8** | Mover los 4 snapshots de emisión (`identificadorFactura`, `fechaFactura`, `fechaEstimadaCobro`, `descripcion`) del cliente a la EF | Cambia dónde se calcula el contenido congelado del documento fiscal |

Además: **el agente no aplica migraciones ni carga secrets**. Los aplica la usuaria / Enzo.

---

## Goals / Non-Goals

**Goals**

- Que "Emitir factura" obtenga un CAE real de ARCA a través del miniserver, persista el comprobante
  fiscal (CAE, vencimiento, número, punto de venta) y genere+archive su PDF, todo en una operación.
- Config **íntegra por secrets**: el repo queda listo y lo único que falta para producción es la
  URL del miniserver y los 5 datos de ARCA (CUIT, cert, key, punto de venta, ambiente).
- Que la identidad fiscal **nunca** toque el repo, la base leída por RLS, ni el frontend.
- Que un rechazo de ARCA sea un resultado esperado y legible, no un crash ni un estado inconsistente.
- No tocar el alta/edición de facturas en `a-facturar`, ni la validación de cupo, ni las 9 funciones
  puras de reglas de negocio.
- Un modelo de PDF de comprobante propio, con los campos fiscales que exige un comprobante AFIP.

**Non-Goals**

- Desplegar u operar el miniserver (repo `facturas/`, responsabilidad de Enzo).
- Guardar cert/clave en base o frontend.
- Numeración local de comprobantes (la asigna ARCA), notas de crédito/débito, anulaciones, consulta
  de padrón, cálculo automático del valor del km (RN-FA-05: manual).
- Cachear el TA (lo hace el miniserver).
- Soportar Factura C (el miniserver no la acepta).
- Reemplazar `FacturaImprimible.tsx`.

---

## Decisions

### D1 — Identidad fiscal: secrets de Edge Function, cero tabla ⚠️ REQUIERE APROBACIÓN

**La decisión.** Los 7 valores de config (§2 del proposal) viven **solo** como secrets de la Edge
Function `facturar` (`supabase secrets set`). El código los lee con `Deno.env.get('ARCA_*')`. No hay
ninguna tabla `facturacion.identidad_fiscal`, ningún campo en `cuentas`, ningún `.env` del frontend.

**Por qué.**

1. El certificado y la clave privada son el equivalente a la firma de la empresa ante AFIP. Una
   tabla —aun con RLS estricta— los expone a cualquier bug de policy, a un `service_role` mal usado,
   y al backup de la base. Un secret de EF no se lee desde SQL ni viaja en ningún dump.
2. El frontend **nunca** necesita esos datos: sólo dispara "emitir factura N". Todo el armado del
   payload fiscal ocurre en la EF.
3. Es exactamente el modelo que el propio miniserver recomienda para su despliegue
   (`ARCA_MINISERVER_KEY` como env, HTTPS obligatorio).
4. "Lo único que falta para producción" queda reducido a un comando: `supabase secrets set ARCA_… `.
   El código se mergea completo y probado contra homologación.

**Estado sin config.** Si falta cualquiera de `ARCA_MINISERVER_URL` / `ARCA_MINISERVER_API_KEY` /
`ARCA_CUIT` / `ARCA_CERT_B64` / `ARCA_KEY_B64` / `ARCA_PTO_VTA`, la EF responde
`503 { error: 'La emisión electrónica no está configurada.', codigo: 'EMISION_NO_CONFIGURADA' }`.
`ARCA_AMBIENTE` ausente ⇒ `homologacion`. El frontend muestra el mensaje tal cual y deja la factura
en `a-facturar`.

*Alternativa descartada:* tabla `facturacion.identidad_fiscal` con la clave cifrada (pgsodium /
Vault). Más superficie, más partes móviles, y no habilita nada que los secrets no habiliten —
sólo tendría sentido con **varios** emisores, que este proyecto no tiene (una empresa, un CUIT).
Si algún día hay multi-emisor, el miniserver ya lo soporta y se agrega la tabla entonces.

### D2 — La emisión pasa por una Edge Function nueva `facturar`

**Flujo (secuencia):**

```
UI (FacturaAccionesEmision → useEmisionFactura → SupabaseEmisionRepository)
  └─> supabase.functions.invoke('facturar', { method:'POST', body:{ facturaId } })
        └─> Edge Function `facturar`
              1. requirePermiso(req, 'facturacion', 'write')                  -> 401/403 si no
              2. leer config ARCA_* de Deno.env                              -> 503 si falta
              3. userClient: SELECT factura + asistencias + paciente + obra_social  (RLS del caller)
                   - factura inexistente / oculta por RLS -> 404
                   - factura.cae ya presente             -> 409 (idempotencia)
                   - factura.estado != 'a-facturar'      -> 409
              4. construirPayloadArca(factura, paciente, obraSocial, config)  (puro, _shared/arca.ts)
              5. fetch(ARCA_MINISERVER_URL + '/facturar', { headers:{'X-Api-Key':…}, body })
                   - 200 aprobada:true  -> sigue
                   - 401 identidad      -> 502 { codigo:'ARCA_IDENTIDAD', detalle }   (no persiste)
                   - 422 rechazo        -> 422 { codigo:'ARCA_RECHAZO', observaciones } (no persiste)
                   - 400 / otro / timeout -> 502 { codigo:'ARCA_ERROR', detalle }      (no persiste)
              6. userClient.rpc('actualizar_factura_completa', { p_id, p_cambios:{
                   estado:'facturado', cae, caeVencimiento, cbteNro, ptoVta, arcaAmbiente,
                   fechaFactura, fechaEstimadaCobro, identificadorFactura, descripcion, arcaRespuesta }})
              7. generar PDF (facturaPdf.ts, puro: datos -> Uint8Array)
              8. admin.storage.from('facturas-emitidas').upload(clave, pdf)
              9. userClient.rpc('actualizar_factura_completa', { p_id, p_cambios:{ comprobantePdfUrl }})
             10. devolver la factura releída (200)
```

**Por qué EF y no PostgREST/navegador.**

- El `fetch` al miniserver transporta —indirectamente— la identidad fiscal (via los secrets que solo
  la EF ve). El navegador no puede tocar eso.
- El armado del payload fiscal, el CAE y los 4 snapshots congelados son **contenido de un documento
  fiscal**: se calculan del lado del servidor, no en un cliente bypassable.
- El PDF se compone con datos que incluyen el CAE recién obtenido y se sube con `service_role` a un
  bucket privado.

**Por qué un repository nuevo (`SupabaseEmisionRepository`) y no un método más en `FacturaRepository`.**
`FacturaRepository` es CRUD puro (`list`/`getById`/`listByPaciente`/`create`/`update`) con dos
implementaciones (mock + Supabase). Emitir no es CRUD: es una acción con efectos fiscales externos.
Un repository aparte (`emitir(facturaId): Promise<Factura>`) mantiene esa interfaz intacta y sigue el
precedente de mantener las acciones no-CRUD separadas.

**`userClient` vs `admin`.** Pasos 3, 6, 9 usan `userClient` (la RLS de `facturacion` ya verifica
exactamente lo que `requirePermiso` verificó, y así `auth.uid()` resuelve en los triggers de
auditoría). Paso 8 (`storage.upload`) usa `admin` porque el objeto se sube en nombre del sistema, no
del usuario — igual criterio, RLS del bucket como segunda capa.

### D3 — Columnas nuevas en `facturacion.facturas` ⚠️ REQUIERE APROBACIÓN

`ALTER TABLE facturacion.facturas ADD COLUMN …` (todas nullable, sin default salvo donde se indica):

| Columna | Tipo | Contenido |
|---|---|---|
| `cae` | `TEXT` | CAE devuelto por ARCA. Su presencia = "factura emitida electrónicamente" |
| `cae_vencimiento` | `DATE` | vencimiento del CAE (`caeVencimiento` del miniserver) |
| `cbte_nro` | `INTEGER` | número de comprobante asignado por ARCA |
| `pto_vta` | `INTEGER` | punto de venta usado (snapshot de `ARCA_PTO_VTA` al emitir) |
| `arca_ambiente` | `TEXT` | `CHECK (arca_ambiente IN ('production','homologacion'))` — para no confundir facturas de prueba con reales |
| `comprobante_pdf_url` | `TEXT` | ruta del PDF en el bucket `facturas-emitidas` |
| `arca_respuesta` | `JSONB` | snapshot crudo de la respuesta del miniserver (auditoría / reconciliación) |

- **Nullable, sin `NOT NULL`.** Una factura en `a-facturar` no tiene ninguna. Un `CHECK`
  correlacionado con `estado` rompería correcciones manuales de estado (que el panel de cobros
  permite).
- **Aditivas, sin backfill.** Ninguna columna existente se altera.
- **Rollback**: `DROP COLUMN` × 7.
- **⚠️ La RPC `facturacion.actualizar_factura_completa` tiene un whitelist fijo de columnas en su
  `UPDATE ... SET`** (verificado en `20260812160000_factura_rpc.sql`): NO acepta claves arbitrarias
  de `p_cambios`. La misma migración de este change DEBE incluir un `CREATE OR REPLACE FUNCTION`
  que agregue las 6 columnas del comprobante (`cae` … `comprobante_pdf_url`) con el patrón
  `CASE WHEN p_cambios ? 'cae' THEN … ELSE cae END`, **exactamente** como
  `20260813090001_factura_rpc_autorizacion.sql` hizo con `autorizacion_id`. `arca_respuesta` también
  se agrega al `SET` (la EF lo persiste; no se expone al frontend). `crear_factura_completa` **no**
  se toca (el alta nunca trae campos fiscales).
- **Coordinar con Enzo** antes de escribir el `.sql`: tercer/cuarto change consecutivo en que el
  schema real va por delante del repo — confirmar que no hay columnas equivalentes ya planeadas.

**Mapeo en `facturaMapping.ts`** (snake → camel, todos opcionales, ausentes si `NULL`):
`cae` → `cae`, `cae_vencimiento` → `caeVencimiento`, `cbte_nro` → `cbteNro`, `pto_vta` → `ptoVta`,
`arca_ambiente` → `arcaAmbiente`, `comprobante_pdf_url` → `comprobantePdfUrl`. `arca_respuesta` **no
se expone** al dominio del frontend (es auditoría de servidor).

### D4 — Mapeo factura → payload del miniserver: defaults documentados ⚠️ REQUIERE APROBACIÓN

`construirPayloadArca()` en `supabase/functions/_shared/arca.ts`, función pura, testeable sin red.

| Campo del payload | Se deriva de | Default / regla | Estado |
|---|---|---|---|
| `cuit` | `Number(ARCA_CUIT)` | — | config |
| `certB64` / `keyB64` | `ARCA_CERT_B64` / `ARCA_KEY_B64` | — | config |
| `environment` | `ARCA_AMBIENTE` | `'homologacion'` | config |
| `ptoVta` | `Number(ARCA_PTO_VTA)` | — | config |
| `cbteTipo` | `factura.tipoComprobante` | `'A'`→`FACTURA_A`, `'B'`→`FACTURA_B`, **`'C'`→error** `EMISION_TIPO_NO_SOPORTADO` | ⚠️ discrepancia |
| `items` | 1 ítem: `{ neto, iva: 'IVA_21' }` | IVA 21 % **por dentro** — ver regla abajo | decidido 2026-08-28 |
| `docTipo` / `docNro` | obra social receptora | `'CUIT'` + `Number(obraSocial.cuit sin guiones)` — **obligatorio en FACTURA_A** | decidido 2026-08-28 |
| `condicionIva` | `obraSocial.condicionIva` (enum tipado) | valor pasado tal cual al miniserver; sin valor → `422 EMISION_SIN_CONDICION_IVA` en FACTURA_A | decidido 2026-08-28 |
| `servicio` | `{ desde: factura.fechaInicial, hasta: factura.fechaTope, vtoPago: factura.fechaEstimadaCobro }` | período de servicio | ok |

**Regla de IVA — decidida por la usuaria (2026-08-28): IVA 21 %.** El tipo `Factura` tiene un único
campo `monto` (total bruto), **no** desglosa neto + IVA. El miniserver quiere `items[].neto` + código
de alícuota y **calcula** el IVA y el total. Como todo el sistema (validación de cupo, `cobros`,
`fechaEstimadaCobro`, reportes facturado-vs-cobrado) trata `monto` como el importe a cobrar, se aplica
**IVA 21 % "por dentro"**: `neto = round(monto / 1.21, 2)`, `iva: 'IVA_21'`, de modo que el total del
comprobante coincida con `monto`. La alícuota y el modo (por dentro / por fuera) quedan **overrideables
por secret** (`ARCA_IVA_CODIGO` default `IVA_21`, `ARCA_IVA_MODO` default `por_dentro`) sin tocar código.

Sub-pregunta abierta menor: confirmar con el contador que es "por dentro" y no "por fuera"
(`neto = monto`, total = `monto * 1.21`). Si es por fuera, se cambia `ARCA_IVA_MODO=por_fuera` — sin
deploy. Ver Open Questions.

**Decisiones de la usuaria (2026-08-28) que cierran discrepancias:**

- **`obra_social.cuit` = CUIT de la obra social** (receptora / pagadora). Cierra la discrepancia #12
  de `integracion-obra-social`. La Factura A sale a nombre de la obra social con ese CUIT. Se retira
  el `AvisoModeloDatos` de ambigüedad de CUIT en `ObraSocialDetail.tsx`; la KB (#12) pasa a
  "resuelta — decisión de la usuaria". La EF igual valida que el CUIT tenga 11 dígitos antes de
  llamar a ARCA.
- **`obra_social.condicion_iva` pasa a ser un tipo cerrado** (enum), no `TEXT` libre. Cierra la
  discrepancia #14. Ver D4-bis abajo.

**Discrepancia que se sigue documentando (no se resuelve):**

- **Factura C no soportada.** El miniserver sólo acepta `FACTURA_A` / `FACTURA_B`. `tipo_factura`
  tiene `'C'`. Si la factura es C, la EF devuelve `422 { codigo: 'EMISION_TIPO_NO_SOPORTADO' }` y el
  frontend lo explica. `AvisoModeloDatos` en `FacturaFormEconomicos.tsx`.
- **`monto` es total, no neto+IVA.** Se asume "IVA por dentro" (arriba). Se documenta en
  `04_modelo_de_datos.md` §Discrepancias.

### D4-bis — `obra_social.condicion_iva` como enum tipado ⚠️ REQUIERE APROBACIÓN (schema)

Decisión de la usuaria (2026-08-28): `condicion_iva` deja de ser texto libre. Valores = los que
acepta el miniserver (README `facturas/`), que son los canónicos de ARCA:

```
IVA_RESPONSABLE_INSCRIPTO | IVA_SUJETO_EXENTO | CONSUMIDOR_FINAL |
IVA_RESPONSABLE_MONOTRIBUTO | MONOTRIBUTO | PROVEEDOR_DEL_EXTERIOR |
CLIENTE_DEL_EXTERIOR | IVA_LIBERADO
```

Impacto (todo en este change):

| Capa | Cambio |
|---|---|
| Migración | `obra_social.obra_social.condicion_iva`: `ALTER … TYPE` con `CHECK (condicion_iva IN (…))` **o** enum PG `obra_social.condicion_iva_arca`. Backfill: los valores actuales (si los hay) se mapean a mano — coordinar con Enzo qué tiene la tabla hoy. Nullable se mantiene (una OS sin condición IVA cargada no bloquea el alta, sí bloquea emitir Factura A). |
| Tipo TS | `frontend/src/shared/types/obraSocial.ts`: `condicionIva?: string` → `condicionIva?: CondicionIvaArca` (unión de literales). Sin `any`. |
| Form | `ObraSocialForm.tsx`: el input de texto de condición IVA pasa a `<select>` con esas 8 opciones (reusar `Select`/`Input` del design system). `validateObraSocialForm.ts` valida contra la unión. |
| Spec | delta `MODIFIED` en `specs/obra-social-contract/` (nuevo archivo en este change). |
| KB | discrepancia #14 → "resuelta"; `10_preguntas_abiertas.md` la baja de abierta. |

Sigue el precedente de `EstadoFactura` / `TipoComprobante`: unión cerrada de literales, nunca
`string` libre. Es la fuente estructural para el campo `condicionIva` del payload de ARCA (D4).

### D5 — Circuito de estados: `a-facturar → facturado` es una operación de servidor que puede fallar

**Hoy** `factura-estados-circuito` modela la transición como un cambio de estado local siempre
exitoso. **Ahora**:

- La transición **sólo** ocurre si ARCA devuelve `aprobada: true`. Rechazo / error de identidad /
  miniserver caído ⇒ la factura **permanece en `a-facturar`**, editable, y el frontend muestra el
  motivo (observaciones de ARCA para `422`, "problema de configuración fiscal, avisá a
  administración" para `401`/`503`, "el servicio de facturación no responde, reintentá" para timeout).
- **Idempotencia**: una factura con `cae` ya presente no se re-emite. La EF lo chequea antes del
  `fetch` (`409 { codigo: 'YA_EMITIDA' }`). El botón "Emitir" se oculta cuando `factura.cae` existe
  (igual que hoy se oculta cuando `estado !== 'a-facturar'`).
- **Corrección manual de estado** (panel de cobros): sin cambios para `facturado ↔ cobrado ↔
  pagado-parcialmente`. **No** se permite volver a `a-facturar` una factura con `cae` desde la UI
  (RN-FA-06: una factura emitida es un documento fiscal; anularla es otro flujo, fuera de alcance).

### D6 — Modelo del PDF del comprobante + librería ⚠️ REQUIERE APROBACIÓN

**Librería: `pdf-lib`** (JS puro, sin binarios nativos, corre en Deno y en el navegador). Se agrega a
`frontend/package.json` y se importa en la EF vía `npm:pdf-lib`. Alternativas descartadas: `jsPDF`
(pensada para browser, API menos apta para layout fijo), `pdfmake` (bundle grande), print-to-PDF del
navegador (no automatizable desde la EF), Gotenberg / servicio externo (otra pieza de infra).

**Generación en la EF** (`supabase/functions/facturar/facturaPdf.ts`), función pura
`construirFacturaPdf(datos): Promise<Uint8Array>`. Datos = factura + asistencias + paciente + obra
social + CAE/nº/ptoVta + datos del emisor (de secrets `ARCA_EMISOR_*`, ver abajo).

**Modelo / layout** (una hoja A4, tipo comprobante AFIP):

```
┌───────────────────────────────────────────────────────────────┐
│  [Razón social emisor]                    ┌───┐  ORIGINAL       │
│  [Domicilio comercial]                    │ A │  FACTURA        │
│  CUIT: [ARCA_CUIT]   IIBB: [..]           └───┘                 │
│  Inicio de actividades: [..]      Punto de venta: 0001          │
│                                   Comp. Nro: 00000045           │
│                                   Fecha de emisión: 2026-08-27  │
├───────────────────────────────────────────────────────────────┤
│  Cliente: [obraSocial.nombre]                                   │
│  CUIT: [obraSocial.cuit]   Cond. IVA: [obraSocial.condicionIva] │
│  Domicilio: [..]           Cond. venta: Cuenta corriente        │
│  Período facturado: [mes]/[anio]   Servicio: [desde] a [hasta]  │
│  Vto. pago: [fechaEstimadaCobro]                                │
├───────────────────────────────────────────────────────────────┤
│  Detalle                                    Cant.   Importe     │
│  [descripcion congelada / renderDescripcionFactura]             │
│  Días facturados: [dias]  ·  Valor km: [valorKm]  ·  Km: [cantKm]│
│  ─────────────────────────────────────────────────────────────  │
│                              Neto:  $ [importes.neto]           │
│                              IVA:   $ [importes.iva]            │
│                              Total: $ [importes.total]          │
├───────────────────────────────────────────────────────────────┤
│  CAE Nº: [cae]        Fecha vto. CAE: [caeVencimiento]          │
│  [código de barras Interleaved 2of5 con el string AFIP]         │
│  [ambiente: HOMOLOGACIÓN — SIN VALOR FISCAL, si arca_ambiente]  │
├───────────────────────────────────────────────────────────────┤
│  Anexo — Asistencias del período                                │
│  [fecha]  [prestación]  [dependencia] → [retorno]   (× N)       │
└───────────────────────────────────────────────────────────────┘
```

**Datos del emisor** (razón social, domicilio, IIBB, inicio de actividades) → secrets
`ARCA_EMISOR_RAZON_SOCIAL`, `ARCA_EMISOR_DOMICILIO`, `ARCA_EMISOR_IIBB`, `ARCA_EMISOR_INICIO_ACT`.
Opcionales: si faltan, el PDF sale con los campos vacíos (no bloquea la emisión — el CAE ya se
obtuvo). Se listan en el proposal §2 como parte de "lo que falta".

**Código de barras.** El string de AFIP (`CUIT + tipoCbte + ptoVta + CAE + vtoCAE + dígito
verificador`) se calcula con una función pura (`codigoBarrasAfip.ts`) y se dibuja como
Interleaved 2 of 5 con rectángulos de `pdf-lib` — sin librería de barcode.

**RN-FA-06 (no retroactivo).** El PDF se genera **una sola vez**, al emitir. Si después se corrige
algo de la factura, el PDF archivado no se regenera (es el documento tal como se emitió).

### D7 — Bucket `facturas-emitidas` ⚠️ REQUIERE APROBACIÓN

`supabase/migrations/2026XXXXXXXXXX_bucket_facturas_emitidas.sql`, mismo patrón que
`bucket_documentos_autorizaciones`:

```sql
INSERT INTO storage.buckets (id, name, public) VALUES
  ('facturas-emitidas', 'facturas-emitidas', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Read facturas-emitidas"  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'facturas-emitidas' AND modulos.tiene_permiso('facturacion', 'read'));
CREATE POLICY "Write facturas-emitidas" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'facturas-emitidas' AND modulos.tiene_permiso('facturacion', 'write'));
CREATE POLICY "Update facturas-emitidas" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'facturas-emitidas' AND modulos.tiene_permiso('facturacion', 'write'));
CREATE POLICY "Delete facturas-emitidas" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'facturas-emitidas' AND modulos.tiene_permiso('facturacion', 'write'));
```

- Clave de objeto: `{facturaId}/{cbteTipo}-{ptoVta}-{cbteNro}.pdf` — determinista, un PDF por factura.
- El `SELECT` gateado por `facturacion: read` alcanza para que el frontend genere una signed URL
  (`admin.storage.createSignedUrl` desde una EF de lectura, o `userClient` si la policy lo permite —
  a definir en apply). La UI **no** recibe una URL pública.
- Rollback: borrar las 4 policies + `DELETE FROM storage.buckets WHERE id = 'facturas-emitidas'`
  (sólo si está vacío).

### D8 — Los 4 snapshots de emisión se calculan en la EF, no en el cliente ⚠️ REQUIERE APROBACIÓN

Hoy `useEmisionFactura` congela en el cliente: `identificadorFactura`
(`resolverIdentificadorFactura`), `fechaFactura`, `fechaEstimadaCobro` (`calcularFechaEstimadaCobro`),
`descripcion` (`renderDescripcionFactura` + `construirDatosDescripcion` +
`prestacionesDePresupuesto`). **Se mueven a la EF `facturar`**, reimplementando la lógica en Deno
(TypeScript compartible) o —mejor— **importando las funciones puras** desde `frontend/src/shared/lib/`
si el bundler de EF lo permite; si no, se copian con un test de paridad.

**Por qué.** El contenido congelado es parte del documento fiscal. Calcularlo en un cliente
bypassable y mandarlo en el body permite manipularlo. La EF ya tiene factura + paciente + obra social
cargados (paso 3) para armar el payload de ARCA — calcular los snapshots ahí es marginal.

**Trade-off.** Duplica ~4 funciones puras en el runtime de EF. Mitigación: test de paridad que corre
las mismas entradas contra ambas copias (patrón ya usado para
`facturaMigrations.test.ts`). Si el bundler de Supabase EF resuelve el import relativo a `frontend/`
(a verificar en apply), no hay duplicación.

**Alternativa descartada:** que el cliente siga congelando y la EF confíe en el body. Rechazada:
rompe la premisa de "el documento fiscal se arma en el servidor".

### D9 — Errores: miniserver / ARCA → mensajes de UI en castellano

`SupabaseEmisionRepository` traduce (helper propio, no reusa `edgeFunctionErrors.ts` de vehículos
porque los códigos son distintos):

| Señal de la EF | Mensaje de UI |
|---|---|
| `503 EMISION_NO_CONFIGURADA` | `La emisión electrónica todavía no está configurada. Avisá a administración.` |
| `403` / `401` (permiso) | `No tenés permiso para emitir facturas.` |
| `404` | `La factura ya no existe.` |
| `409 YA_EMITIDA` | `Esta factura ya fue emitida (CAE {cae}).` |
| `409` (estado ≠ a-facturar) | `Solo se pueden emitir facturas en estado "a facturar".` |
| `422 ARCA_RECHAZO` | `ARCA rechazó el comprobante: {observaciones}` |
| `422 EMISION_TIPO_NO_SOPORTADO` | `La facturación electrónica solo admite comprobantes A y B por ahora.` |
| `422 EMISION_SIN_CONDICION_IVA` | `Falta la condición frente al IVA de la obra social para emitir Factura A.` |
| `502 ARCA_IDENTIDAD` | `Hay un problema con el certificado fiscal. Avisá a administración.` |
| `502 ARCA_ERROR` / timeout | `El servicio de facturación de ARCA no respondió. Probá de nuevo en unos minutos.` |
| `500` (persistió en ARCA, falló local) | `La factura se emitió en ARCA pero no se pudo guardar acá. Avisá a administración con el número {cbteNro}.` |
| otro | `No se pudo emitir la factura.` |

Nunca se propaga el texto crudo del miniserver a la UI salvo `observaciones` de ARCA (que es
información útil para la operadora y no filtra internals).

### D10 — Qué se hereda sin re-decidir

- **Identificador de la factura (IN-01)**: `resolverIdentificadorFactura` +
  `obraSocial.plantillaFactura.identificadorOrigen` — se mueve a la EF (D8), misma lógica.
- **Plazos de cobro (90/60/45)**: `calcularFechaEstimadaCobro` + `obra_social.plazo_cobro_dias` — se
  mueve a la EF (D8), mismas constantes.
- **Descripción / plantilla**: `renderDescripcionFactura` — se mueve a la EF (D8), sin cambios.
- **Validación de cupo (RN-FA-02)**: `validarCupoFacturacion` sigue **en el cliente**, antes de
  llamar a la EF (igual que hoy `handleEmitirClick`). La confirmación explícita ante exceso de cupo
  no cambia. La EF **no** re-valida cupo (fuente mixta, D9 de `integracion-facturacion`, sigue
  abierta).

---

## Risks / Trade-offs

- **[Alícuota de IVA mal elegida]** → el comprobante fiscal sale con un importe incorrecto. Es el
  riesgo #1. Mitigación: D4 opción A es un ⚠️ CHECKPOINT, no una decisión del agente; ambiente
  `homologacion` por default para probar antes de producción.
- **[`obra_social.cuit` tiene el CUIT del prestador]** → Factura A a nombre equivocado. Mitigación:
  discrepancia elevada a bloqueante, `AvisoModeloDatos` en la pantalla de emisión, y la EF valida
  que `obraSocial.cuit` tenga 11 dígitos antes de llamar a ARCA.
- **[Doble emisión]** → dos CAE para la misma prestación. Mitigación: guard de idempotencia en la EF
  (chequeo de `cae` antes del `fetch`) + botón oculto cuando `factura.cae` existe. Ventana de carrera
  mínima (dos requests casi simultáneos): el segundo `UPDATE` no encontraría la factura en
  `a-facturar` si el primero ya la movió — aceptable, el segundo devuelve `409`.
- **[200 de ARCA + fallo de persistencia local]** → CAE emitido sin registro. Mitigación: persistir
  ANTES de generar/subir el PDF; `arca_respuesta` JSONB con la respuesta cruda; `500` con el
  `cbteNro` para reconciliación manual; log del `cbteNro` en la EF.
- **[La identidad fiscal se filtra]** → solo vive como secret de EF, HTTPS obligatorio del
  miniserver, nunca en repo/base/frontend, nunca logueada (el miniserver tampoco loguea cuerpos).
- **[`pdf-lib` como nueva dependencia]** → superficie de supply-chain. Mitigación: JS puro, sin
  binarios, versión pineada, ampliamente usada; se evalúa el árbol de deps antes de aprobar D6.
- **[Duplicar 4 funciones puras en el runtime de EF (D8)]** → dos fuentes de verdad. Mitigación:
  test de paridad; y si el bundler de EF resuelve el import a `frontend/`, no hay duplicación.
- **[Cold start del miniserver ~10 s]** → la primera emisión del día puede tardar. Mitigación:
  timeout de la EF generoso (25 s) y mensaje "puede tardar unos segundos" en el botón; opcional un
  `GET /health` de warm-up (fuera de alcance).
- **[Factura C]** → no se puede emitir electrónicamente. Mitigación: `422` con mensaje claro; la
  operadora la emite por afuera y sube el PDF a mano (flujo actual, que no se rompe).
- **[Regresión en la suite existente]** → correr el safety net antes de tocar archivos existentes
  (`NODE_OPTIONS="--no-experimental-webstorage"`, bug de entorno conocido). Registrar baseline.

---

## Migration Plan

1. **⚠️ Checkpoint de governance CRÍTICO** con la usuaria: aprobar / rechazar **D1, D3, D4, D4-bis,
   D6, D7, D8**. D4 ya tiene las 3 decisiones de fondo (2026-08-28: IVA 21 %, CUIT de la OS,
   condición IVA tipada); falta el OK al mapeo resultante y a D4-bis (schema). **No se escribe una
   línea de código ni de SQL sin ese OK.**
2. **Coordinar D3 + D4-bis con Enzo**: confirmar que las 7 columnas nuevas de `facturas` no están
   planeadas con otros nombres, y qué valores tiene hoy `obra_social.condicion_iva` para el backfill
   al enum.
3. Escribir las funciones puras primero (TDD): `_shared/arca.ts` (`construirPayloadArca`,
   `parseRespuestaMiniserver`), `emisionMapping.ts`, `codigoBarrasAfip.ts`, `facturaPdf.ts`. Nadie
   las importa todavía.
4. Escribir la Edge Function `facturar` contra homologación. `deno check`.
5. Escribir las dos migraciones (columnas + bucket). Revisar contra el checklist de
   `supabase-postgres-best-practices`. `supabase db advisors --linked --type security` antes y
   después.
6. **Aplicar las migraciones** — **la usuaria / Enzo**. Bloquea el paso 9.
7. **Desplegar la EF `facturar`** — `supabase functions deploy facturar`. **La usuaria / Enzo.**
8. **Cargar los secrets de homologación** (`ARCA_*` con un cert de testing de ARCA). **La usuaria /
   Enzo.**
9. `emisionMapping.ts` + `SupabaseEmisionRepository.ts` + `mockEmisionRepository.ts` por TDD.
10. `shared/types/factura.ts` (+6 campos) y `facturaMapping.ts` (+ mapeo) por TDD.
11. **El swap**: `useEmisionFactura.ts` invoca la EF; `FacturacionRoute.tsx` inyecta el repository de
    emisión. Un commit.
12. Componentes: mostrar CAE / nº / vto / link al PDF / motivo de rechazo. Ajustar el checklist
    documental (comprobante ARCA deja de ser obligatorio manual).
13. `AvisoModeloDatos`: Factura C no soportada, CUIT ambiguo, `monto` total vs neto.
14. Documentar: `10_preguntas_abiertas.md` (ARCA resuelta; IVA/CUIT/condicionIva elevadas),
    `04_modelo_de_datos.md` §Discrepancias, `05_reglas_de_negocio.md`, `CHANGES.md`, `ROADMAP-FRONTEND.md`.
15. Verificación manual con las 3 cuentas reales + una emisión real contra homologación end to end
    (CAE de prueba + PDF en el bucket).
16. **Producción**: la usuaria carga los secrets reales (`ARCA_AMBIENTE=production`, cert real, punto
    de venta real). Ningún cambio de código.

**Rollback**: revertir el commit del paso 11 (`useEmisionFactura` vuelve a
`actualizar(id, { estado: 'facturado' })`). Migraciones aditivas: columnas nullables sin lector,
bucket sin uso, EF sin llamador. Ningún dato existente se transforma.

---

## Open Questions

- **IVA "por dentro" vs "por fuera"** (D4). Decidido: IVA 21 %. Falta confirmar con el contador si es
  por dentro (`neto = monto/1.21`, total = `monto`) o por fuera (`neto = monto`, total = `monto*1.21`).
  Default: por dentro. Cambio sin deploy vía `ARCA_IVA_MODO`. **Decisor**: contador.
- ~~`obra_social.condicion_iva`: valores concretos~~ — **RESUELTO 2026-08-28**: enum tipado con los
  códigos de ARCA (D4-bis). Cierra discrepancia #14.
- ~~`obra_social.cuit`: ¿obra social o prestador?~~ — **RESUELTO 2026-08-28**: es el CUIT de la obra
  social pagadora (D4). Cierra discrepancia #12.
- **Datos del emisor para el PDF** (razón social, domicilio, IIBB, inicio de actividades). ¿Se cargan
  como secrets, o merecen una tabla de config editable desde la app? Propuesta: secrets por ahora.
  **Decisor**: usuaria.
- **Factura C**: ¿alguna obra social factura como C? Si sí, ¿queda siempre en carga manual, o el
  miniserver se extiende? **Decisor**: cliente / Enzo.
- **Punto de venta**: ¿uno solo para toda la empresa, o varios (por obra social, por tipo)? Este
  change asume uno (`ARCA_PTO_VTA`). **Decisor**: cliente / contador.
- **Anulación / nota de crédito**: fuera de alcance. ¿Cómo se corrige una factura emitida con error?
  Hoy: no se puede desde la app. **Decisor**: cliente.
- **Signed URL del PDF**: ¿se genera desde una EF de lectura con `admin`, o la policy de `SELECT`
  del bucket alcanza para `userClient.createSignedUrl`? A resolver en apply.
- **Importar funciones puras en la EF (D8)**: ¿el bundler de Supabase Edge Functions resuelve un
  import relativo a `frontend/src/shared/lib/`? Si no, se duplica con test de paridad. A verificar en
  apply.
