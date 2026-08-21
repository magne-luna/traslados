# Tasks — documentos-vehiculos-conductores-facturacion

> Change chico tras el descope de Facturación: no se escribió `design.md`/`specs/` propios —
> `SupabaseDocumentoRepository.ts`/`documentoMapping.ts` no cambiaron (ya soportaban las 4
> entidades), y las únicas decisiones reales del proposal (Checkpoints B/C) se resuelven acá mismo.
> Ver `proposal.md` para el análisis completo.

## 0. Checkpoint B — re-verificación en vivo (bloqueante, mecánica)

- [x] 0.1 `nombre_archivo`/`created_at` existen en `conductores.documentacion_vehiculo` y
      `conductores.documentacion_conductores` — confirmado contra el proyecto real
      (`supabase db query --linked`, 2026-08-16): las 4 columnas presentes.
- [x] 0.2 Las 4 policies de `documentos-vehiculos` en `storage.objects` gatean por `vehiculos`, no
      `conductores` — confirmado contra `pg_policies` real: las 4 dicen `vehiculos`. El CP3 del
      change archivado sigue cerrado, governance se queda en ALTO (no sube a CRÍTICO).
- [x] 0.3 Encontrado, fuera de alcance de este checkpoint pero registrado: migración
      `20260816110000_presupuesto_lineas` aplicada al remoto sin archivo `.sql` en este repo local —
      es de `presupuesto-prestaciones`, no de este change. No se toca acá.

## 1. Checkpoint C — aceptado implícitamente

- [x] 1.1 Se acepta que `conductores.documentacion_vehiculo`/`documentacion_conductores` persistan
      slugs de código (`tipo_documento TEXT` libre, sin catálogo) — opción A del CP1 archivado, sin
      migración. Documentado en `proposal.md`.

## 2. Swap de Vehículos (TDD)

- [x] 2.1 (RED→GREEN) `VehiculosRoute.test.tsx`: test de fuente (`?raw`) que exige
      `SupabaseDocumentoRepository` importado y `mockDocumentoRepository` ausente.
- [x] 2.2 `VehiculosRoute.tsx`: `documentoRepository={supabaseDocumentoRepository}`.
- [x] 2.3 (RED→GREEN) `VehiculoDocumentos.test.tsx`: retirado el test que esperaba el aviso de
      subida simulada, agregado uno que confirma su ausencia.
- [x] 2.4 `VehiculoDocumentos.tsx`: retirado el `AvisoModeloDatos` de subida simulada.

## 3. Swap de Conductores (TDD)

- [x] 3.1 (RED→GREEN) `ConductoresRoute.test.tsx`: mismo test de fuente que 2.1.
- [x] 3.2 `ConductoresRoute.tsx`: `documentoRepository={supabaseDocumentoRepository}`.
- [x] 3.3 (RED→GREEN) `ConductorDocumentos.test.tsx`: mismo criterio que 2.3 — el cartel de
      "pendiente de confirmar: documentos a precargar" (pendiente #4 de C-09, sin relación) se
      conserva, no se toca.
- [x] 3.4 `ConductorDocumentos.tsx`: retirado el `AvisoModeloDatos` de subida simulada.

## 4. Facturación — DIFERIDO

- [ ] 4.x **No implementado, a pedido explícito de la usuaria (2026-08-16)**: "por ahora solo
      Vehículos + Conductores". `FacturacionRoute.tsx` sigue con `mockDocumentoRepository`;
      `FacturaDocumentos.tsx` conserva su `AvisoModeloDatos`. Bloqueado por el Checkpoint A
      (`itemId` slug vs. UUID de `facturacion.tipos_documento`, ver `proposal.md`) — requiere
      veredicto de la usuaria/Enzo entre A1/A2/A3 antes de poder retomarse.

## 5. Verificación

- [x] 5.1 `cd frontend && npm test` (nunca `npx vitest run` a secas) — **2939/2963 passing**, cero
      regresiones nuevas (las 24 fallas de 6 archivos son las mismas preexistentes de `main`,
      confirmadas en sesiones anteriores).
- [x] 5.2 `npx tsc -b --noEmit` limpio.
- [x] 5.3 `CHANGES.md` fila 8 del §Plan de integración actualizada al alcance real (parcial: 2 de 3
      entidades).
