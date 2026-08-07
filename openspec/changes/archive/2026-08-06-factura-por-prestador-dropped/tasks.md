# Tasks: factura-por-prestador

## Phase 0: Aprobación (bloqueante — nada de código sin esto)

- [x] 0.1 Confirmar con Enzo/Andrea la lectura de `modalidadFacturacion === 'por-prestacion'` como
      "hay que elegir un Prestador" (design.md D1) — confirmado por Enzo, 2026-08-04
- [x] 0.2 Confirmar que dejar "general" sin prestador asignado es aceptable por ahora (design.md D2,
      supuesto #5 de `prestadores-crud` sigue abierto) — confirmado por Enzo, 2026-08-04
- [x] 0.3 Confirmar comportamiento de `tipoComprobante`: fijo/solo-lectura mientras haya un
      `Prestador` elegido, editable en modalidad "general" — confirmado por Enzo, 2026-08-04
      (design.md D3)

## Phase 1: Tipos

- [x] 1.1 `Factura.prestadorId?: string` en `frontend/src/shared/types/factura.ts`

## Phase 2: UI

- [x] 2.1 `PrestadorSelector.tsx` nuevo en `frontend/src/features/facturacion/`: usa
      `usePrestadorRepository()` + `listarPorObraSocial(obraSocial.id)` (mismo patrón que
      `PrestadoresDeObraSocial.tsx`), se dispara solo si `modalidadFacturacion === 'por-prestacion'`.
      ⚠️ Ampliada 2026-08-04 (corrección post-implementación, ver `design.md` D1 y
      `proposal.md` §Impact): también incluye `mockPrestadorRepository.ts` +
      `prestadoresFixture.ts` nuevos (`shared/lib/mocks/`), inyectados en `FacturacionRoute.tsx` —
      la primera pasada había inyectado `supabasePrestadorRepository` (real) contra un
      `obraSocial.id` de mock, dejando el selector siempre vacío en la práctica.
- [x] 2.2 `FacturaFormDatosBasicos.tsx`: nueva prop `obraSocial`, monta `PrestadorSelector`
      condicionado, después del campo "Prestación"
- [x] 2.3 `FacturaForm.tsx`: pasa `obraSocial` a `FacturaFormDatosBasicos`; `onChange` del selector
      setea `prestadorId` y `tipoComprobante` en el mismo evento; calcula
      `tipoComprobanteBloqueado = Boolean(values.prestadorId)` (design.md D3)
- [x] 2.4 `FacturaFormEconomicos.tsx`: nueva prop `tipoComprobanteBloqueado`, `<Select>` de tipo de
      comprobante `disabled` cuando es `true`

## Phase 3: Mocks y tests

- [x] 3.1 `mockFacturaRepository.ts` / `facturasFixture.ts`: `prestadorId` en los datos de ejemplo
      relevantes
- [x] 3.2 Test de `PrestadorSelector.tsx`: no se muestra en modalidad "general"; lista prestadores de
      la obra social en "por-prestacion"; `EmptyState` si no hay ninguno vinculado
- [x] 3.3 Test de `FacturaForm.tsx`: elegir prestador setea `prestadorId`, fija `tipoComprobante` y
      bloquea el `<Select>`; limpiar el prestador lo vuelve a habilitar; en modalidad "general" sigue
      100% editable como hoy
- [x] 3.4 `npx tsc -b --noEmit` (dentro de `frontend/`) limpio
- [ ] 3.5 Suite completa en verde (`NODE_OPTIONS=--no-experimental-webstorage`, ver memoria del flake
      de `localStorage`)

## Phase 4: Documentación

- [x] 4.1 `CHANGES.md` — nueva entrada bajo `C-07`/`prestadores-crud` con el resultado de este change
- [x] 4.2 `knowledge-base/10_preguntas_abiertas.md` — nota de que el supuesto #5 de `prestadores-crud`
      sigue abierto y este change no lo cierra
