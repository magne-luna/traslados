# Tasks — facturacion-aviso-tipo-comprobante

> Dos cambios chicos sobre facturación (dominio de governance crítica), los dos **no bloqueantes**:
> un `console.error` de diagnóstico en la EF `facturar` y un aviso informativo en el form. Pedido
> explícito de la usuaria (Enzo) el 2026-08-31 tras el primer rechazo de ARCA en homologación.
>
> **⚠️ STRICT TDD** para el código de frontend. Test runner:
> `cd frontend && NODE_OPTIONS="--no-experimental-webstorage" npx vitest run`
> Type-check: `cd frontend && npx tsc -b --noEmit` · EF: `deno check supabase/functions/facturar/index.ts`
>
> **Reglas duras** (`CLAUDE.md`): nunca `any`; nunca `style={{}}` (Tailwind v4); reusar
> `design-system/` (`Alert`); Conventional Commits. El redeploy de la EF lo hace Enzo.

## 1. `advertenciaTipoComprobante.ts` (pura)

- [x] 1.1 (RED) test: `tipoComprobante: 'A'` + `condicionIvaObraSocial: 'IVA_SUJETO_EXENTO'` → `{ condicion: 'IVA_SUJETO_EXENTO' }`.
- [x] 1.2 (RED) test: `'A'` + `'IVA_RESPONSABLE_INSCRIPTO'` → `null`.
- [x] 1.3 (RED) test: `'A'` + `undefined` → `null` (lo cubre el 422).
- [x] 1.4 (RED) test: `'B'` / `'C'` + cualquier condición → `null` (triangulación).
- [x] 1.5 (RED) test: `'A'` + `'MONOTRIBUTO'` / `'CONSUMIDOR_FINAL'` → devuelve la condición (triangulación).
- [x] 1.6 (GREEN) implementar.

## 2. `AlertaTipoComprobante.tsx`

- [x] 2.1 (RED) test: renderiza `Alert` (`role="note"`/warning) con la etiqueta legible de la condición y el texto de la consecuencia.
- [x] 2.2 (GREEN) implementar reusando `etiquetaCondicionIva` + `Alert`.

## 3. `FacturaForm.tsx` — wiring

- [x] 3.1 (RED) test: Paso 3 con paciente cuya obra social es exenta y `tipoComprobante` A → aparece el aviso.
- [x] 3.2 (RED) test: obra social Responsable Inscripto → no aparece (triangulación).
- [x] 3.3 (GREEN) calcular `advertenciaTipoComprobante` y renderizar junto a `AlertaCupo`.
- [x] 3.4 (REFACTOR) no bloquea guardado ni emisión — solo aviso.

## 0. `_shared/arca.ts` — bugs del payload/respuesta (deno test)

- [x] 0.1 `aaaammdd()` en `construirPayloadArca` para `servicio.{desde,hasta,vtoPago}` + tests (ISO → `20260831`).
- [x] 0.2 `formatObservaciones()` en `parseRespuestaMiniserver` — string / arreglo `{code,msg}` / `{Code,Msg}` / `[]` → texto o `undefined` + tests.
- [x] 0.3 `deno test _shared/arca.test.ts` verde (19 tests).

## 0b. `facturaPdf.ts` — carácter no-WinAnsi rompía el PDF (deno test)

- [x] 0b.1 `winAnsi()` en el helper `texto()` — flechas/comillas/`…`/`\u00a0` a ASCII, resto a `?`, conserva € – — • ™ y Latin-1.
- [x] 0b.2 Literales `→` del código a `->`.
- [x] 0b.3 `facturaPdf.test.ts` nuevo: `winAnsi()` + smoke de `construirFacturaPdf` con flechas → `%PDF-`, sin throw. `deno test` verde (24 tests entre arca + pdf).

## 4. EF `facturar` — log del rechazo

- [x] 4.1 `console.error('facturar: ARCA no aprobó el comprobante', { facturaId, tipoComprobante, miniserverStatus, codigo, detalle, observaciones, cbteNro })` antes del `return` de `!resArca.ok`.
- [x] 4.2 `deno check supabase/functions/facturar/index.ts` limpio.
- [x] 4.3 Redeploy `facturar` → **v7 ACTIVE** (2026-08-31, lo corrió Enzo).

## 5b. FacturaDetail — factura emitida no editable (RN-FA-06)

- [x] 5b.1 (RED) test: estado 'facturado' (con y sin CAE) / 'cobrado' → sin botón "Editar"; 'a-facturar' → con botón.
- [x] 5b.2 (RED) test: factura emitida sigue mostrando el resumen de solo lectura, sin campos de formulario.
- [x] 5b.3 (GREEN) `puedeEditar` + reemplazo del botón por la nota + guard en `handleSubmitForm`.

## 5. Cierre

- [x] 5.1 `npx tsc -b --noEmit` limpio.
- [x] 5.2 `npx vitest run src/features/facturacion src/shared/lib/facturacion` verde.
- [x] 5.3 Sincronizar `openspec/specs/factura-emision-electronica/spec.md`.
- [ ] 5.4 Commit (lo hace Enzo): `fix(facturacion): fechas de servicio en aaaammdd + observaciones de ARCA legibles + factura emitida no editable + aviso de tipo de comprobante`.
