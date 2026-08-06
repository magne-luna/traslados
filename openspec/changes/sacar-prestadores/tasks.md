# Tasks — sacar-prestadores

> Decisión del cliente ya dada (Andrea, reunión 2026-08-04, `TODO-video-revision.txt`) y confirmada
> por Enzo (backend, 2026-08-06): no hace falta aprobación de Phase 0 previa, a diferencia de
> `factura-por-prestador` (dominio CRÍTICO, requería 3 confirmaciones antes de codear). Acá el
> "confirmar antes de codear" ya pasó fuera de este documento.

## 1. Documentación (primero, según flujo del proyecto)

- [x] 1.1 `openspec/changes/sacar-prestadores/proposal.md`
- [x] 1.2 `openspec/changes/sacar-prestadores/design.md` (D1 checkpoint de datos huérfanos, D2
      interpretación tipoComprobanteBloqueado/faltaElegirPrestador, D3 hallazgo de drift, D4/D5)
- [x] 1.3 `openspec/changes/sacar-prestadores/tasks.md` (este archivo)

## 2. Borrado de frontend

- [x] 2.1 `frontend/src/features/prestadores/` completo (10 archivos)
- [x] 2.2 `frontend/src/shared/types/prestador.ts`
- [x] 2.3 `frontend/src/shared/lib/prestadores/` completo (5 archivos)
- [x] 2.4 `frontend/src/shared/lib/mocks/mockPrestadorRepository.ts` + `.test.ts`
- [x] 2.5 `frontend/src/shared/lib/mocks/prestadoresFixture.ts`
- [x] 2.6 `frontend/src/features/facturacion/PrestadorSelector.tsx` + `.test.tsx`
- [x] 2.7 `supabase/functions/prestadores/` completo (local — el deploy real requiere acción
      separada de Enzo, ver `proposal.md` §Impact)

## 3. Edición de frontend — Facturación

- [x] 3.1 `frontend/src/shared/types/factura.ts`: `prestadorId?: string` → `prestadorNombre?:
      string` / `prestadorDomicilio?: string` (flat, D4 de `design.md`)
- [x] 3.2 `frontend/src/features/facturacion/FacturaForm.tsx`: quita imports de Prestador,
      `prestadorSeleccionado`/su `useEffect`, `tipoComprobanteBloqueado` (D2), reemplaza
      `faltaElegirPrestador` por `faltaCompletarPrestador` (D2), reemplaza el mount de
      `PrestadorSelector` en el Paso 2 por dos `<Field>`/`<Input>` de texto libre (D4)
- [x] 3.3 `frontend/src/features/facturacion/FacturaFormEconomicos.tsx`: quita la prop
      `tipoComprobanteBloqueado`, el `<Select>` de tipo de comprobante vuelve a ser siempre
      editable
- [x] 3.4 `frontend/src/features/facturacion/ResumenPasoWizard.tsx`: quita la prop `prestador:
      Prestador | undefined` y su panel; agrega el panel de `prestadorNombre`/`prestadorDomicilio`
      (solo cuando modalidad es `'por-prestacion'` y hay algo cargado)
- [x] 3.5 `frontend/src/features/facturacion/useEmisionFactura.ts`: limpia el comentario que
      mencionaba "`ObraSocial.plazoCobroDias` se mudó a `Prestador`" (D1 de `design.md`) — sigue
      pasando `plazoObraSocial: undefined`, sin cambio funcional
- [x] 3.6 `frontend/src/features/facturacion/FacturaFormDatosBasicos.tsx`,
      `FacturaResumen.tsx`, `frontend/src/shared/lib/facturacion/constantes.ts`: limpia comentarios
      que quedaron desactualizados por la remoción (referencias a `PrestadorSelector`/`Prestador`
      movido/`prestadores-crud` como premisa sin resolver)
- [x] 3.7 `frontend/src/features/facturacion/FacturacionRoute.tsx`: quita
      `PrestadorRepositoryProvider`/`supabasePrestadorRepository`
- [x] 3.8 `frontend/src/features/facturacion/FacturacionRoute.test.tsx`: limpia el comentario sobre
      el swap de `supabasePrestadorRepository`

## 4. Edición de frontend — Obras Sociales

- [x] 4.1 `frontend/src/features/obras-sociales/ObraSocialDetail.tsx`: quita el import y la
      `<Section>` de `PrestadoresDeObraSocial`, quita los dos `AvisoModeloDatos` sobre la
      ambigüedad de CUIT prestador/obra social
- [x] 4.2 `frontend/src/features/obras-sociales/ObraSocialesRoute.tsx`: quita
      `PrestadorRepositoryProvider`/`supabasePrestadorRepository`
- [x] 4.3 `frontend/src/features/obras-sociales/ObraSocialDetail.test.tsx`,
      `ObraSocialesPage.test.tsx`: quita el `fakePrestadorRepository`/`PrestadorRepositoryProvider`
      de test y el cartel de ambigüedad de CUIT que se borró de `ObraSocialDetail.tsx`
- [x] 4.4 `frontend/src/features/obras-sociales/ObrasSocialesList.tsx`: limpia comentario
      desactualizado sobre columnas movidas a `Prestador`
- [x] 4.5 `ObraSocialForm.tsx` — verificado sin referencias a Prestador, no requiere cambios (no
      tiene el multi-select que sugería la investigación previa; ese campo vivía en
      `PrestadorForm.tsx`, ya borrado en la tarea 2.1)

## 5. Edición de frontend — tipos y comentarios menores

- [x] 5.1 `frontend/src/shared/types/obraSocial.ts`: limpia el comentario del campo
      `modalidadFacturacion` que documentaba el movimiento a `Prestador` (D1 de `design.md`)
- [x] 5.2 `frontend/src/shared/lib/obrasSociales/obraSocialMapping.ts`: limpia el comentario
      equivalente sobre `tipo_comprobante`/`plazo_cobro_dias` "mudados a Prestador"
- [x] 5.3 `frontend/src/design-system/components.tsx`: quita la referencia a `PrestadorForm.tsx`
      (archivo borrado) del comentario de `FieldGroupHeading`
- [x] 5.4 `frontend/src/shared/lib/mocks/facturasFixture.ts`: quita el import de
      `PRESTADOR_ID_TRASLADOS_ANDREA_PASTOR`, reemplaza `prestadorId` por
      `prestadorNombre`/`prestadorDomicilio` de ejemplo en las 2 facturas que lo tenían

## 6. Edición de frontend — routing/navegación

- [x] 6.1 `frontend/src/app/routes.ts`: quita `'prestadores'` de `IconKey` y la entrada
      `{ path: '/prestadores', ... }` de `APP_ROUTES`
- [x] 6.2 `frontend/src/app/router.tsx`: quita el import de `PrestadoresRoute` y su mapeo en
      `ROUTE_ELEMENTS`
- [x] 6.3 `frontend/src/app/navIcons.tsx`: quita la entrada `prestadores` de `iconPaths`

## 7. Backend

- [x] 7.1 `supabase/migrations/20260806180000_sacar_prestadores.sql`: `DROP TABLE
      obra_social.obra_social_prestador` (primero, tiene los FKs), `DROP TABLE
      obra_social.prestadores`. Header explicando qué revierte y que está redactada, no aplicada.
      **NO se corre `supabase db push`.**

## 8. Documentación (cierre)

- [x] 8.1 `CHANGES.md`: entrada nueva (2026-08-06) para `sacar-prestadores` + nota de corrección
      sobre el estado real de las migraciones de `prestadores-crud` (D3 de `design.md`) — ambas
      como texto agregado, sin borrar lo existente

## 9. Verificación

- [x] 9.1 `npx tsc -b --noEmit` (dentro de `frontend/`) limpio
- [x] 9.2 `NODE_OPTIONS=--no-experimental-webstorage npx vitest run` sin fallas nuevas (fuera de la
      lista de flakes ya conocidos: `ChecklistEditor.test.tsx`, `PermisosMatrizFields.test.tsx`,
      `VehiculosList.test.tsx`, `VehiculosPage.test.tsx`, `PacienteForm.test.tsx`/
      `PersonasACargoEditor.test.tsx` en conjunto)
- [x] 9.3 `grep -rni "prestador" frontend/src supabase/functions --include=*.ts --include=*.tsx`
      sin restos de la entidad `Prestador` (repository, tipos, componentes) — quedan matches
      esperados: los campos `prestadorNombre`/`prestadorDomicilio` (D4 de `design.md`) y comentarios
      que documentan la historia del change
