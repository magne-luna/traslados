## Why

`GastoVehiculo.categoria` (`frontend/src/shared/types/vehiculo.ts:24-33`) usa los valores **`'mantenimiento' | 'reparacion' | 'service'`**, mapeados en `frontend/src/features/vehiculos/categoriaGastoOptions.ts`. Esos tres valores **no salen de ninguna fuente del proyecto**: no están en `docs/core/Traslados-Modelo-Datos.docx` (fuente de verdad estructural), no están en `knowledge-base/04_modelo_de_datos.md`, y el spec vigente `openspec/specs/vehiculo-gastos/spec.md` ni menciona el campo. Son valores inventados durante `vehiculos-ui`.

El docx tiene **dos entidades separadas**, no una:

| Entidad docx | Tabla (`CHANGES.md` §C-08 L187) | Campos del docx |
|---|---|---|
| Gastos de Vehículo | `gasto_vehiculo` | Vehículo, Monto, Fecha — **sin categoría** ("combustible, peajes, reparaciones menores, entre otros" es texto informal, no un campo) |
| Mantenimiento | `mantenimiento_registro` | Vehículo, **Categoría** ("Tipo de intervención: gasto, mantenimiento preventivo o mantenimiento correctivo"), Fecha, Próximo vencimiento (fecha), Kilometraje actual, Próximo vencimiento (kilometraje) |

La categorización real tiene **dos niveles**, confirmado explícitamente por el dueño del proyecto ("serian dos tipos de categorias y dentro de ellas cada opcion"):
- **Nivel 1 — tipo de intervención** (docx): `gasto` | `mantenimiento preventivo` | `mantenimiento correctivo`.
- **Nivel 2 — sub-tipo** (`knowledge-base/06_funcionalidades.md` L128-134, US-500): preventivo → cambio de aceite/filtros, VTV, RTO. Correctivo → alternador, batería, frenos, embrague, cubiertas, **etc.** (lista abierta).

Esto además cierra el Non-Goal que `vehiculos-ui` dejó abierto ("historial de mantenimiento correctivo detallado… queda para una iteración posterior", RF-507) y su Open Question 3.

## What Changes

- **`GastoVehiculo` pierde `categoria`**: queda `{ id, fecha, monto, descripcion? }`, tal cual el docx. Se elimina `CategoriaGasto` y `categoriaGastoOptions.ts`.
- **Nueva entidad `MantenimientoRegistro`** embebida en `Vehiculo.mantenimientos[]`, con la categoría real de dos niveles como unión discriminada (nivel 1 `TipoIntervencion`, nivel 2 `SubtipoPreventivo` cerrado / `SubtipoCorrectivo` abierto por `'otro' + detalle`). **Sin `monto`** — el dinero vive en `gasto_vehiculo`, igual que en el docx.
- **Nueva sección de UI "Historial de mantenimiento"** (`HistorialMantenimiento.tsx`) con alta validada y selector en cascada nivel 1 → nivel 2; la tabla de gastos pierde la columna Categoría.
- **BREAKING para el mock**: `SCHEMA_VERSION` de `mockVehiculoRepository` sube 2 → 3 (los gastos guardados en `localStorage` tienen una propiedad que ya no existe). Re-seed desde fixture, sin dato de producción que preservar.
- **Documentación de la discrepancia** (regla dura del proyecto): entrada en `knowledge-base/04_modelo_de_datos.md` §Discrepancias, bullet en `CHANGES.md` §C-08, y cartel `AvisoModeloDatos` en la sección de mantenimiento de `VehiculoDetail.tsx`.
- **Frontend + mock únicamente.** No se tocan las tablas reales `gasto_vehiculo`/`mantenimiento_registro` (son del backend `C-08`, todavía inexistente), respetando el contrato "tipos primero" de `vehiculos-ui`.

### Rollback

Change acotado a frontend + mock, sin migración de datos. Revertir = `git revert` del commit y volver `SCHEMA_VERSION` a 2; el próximo `readStore()` re-siembra el fixture viejo desde `localStorage`. No hay estado en servidor que rebobinar. Las funciones puras de alertas (`estadoServicePreventivo`, `estadoHabilitacion`) no se tocan en este change, así que ningún cálculo de RN-VE-03/04 puede regresionar por el rollback.

## Capabilities

### New Capabilities

- `vehiculo-mantenimiento-historial`: registro e historial de intervenciones de mantenimiento del vehículo (RF-507), con la categoría de dos niveles del docx (tipo de intervención + sub-tipo), fecha, kilometraje al momento de la intervención y próximo vencimiento por fecha/km.

### Modified Capabilities

- `vehiculo-contract`: el requisito "Tipos del dominio de flota" enumera hoy los campos de `Vehiculo` sin `mantenimientos` y describe `GastoVehiculo` como sub-estructura sin fijar su forma. Pasa a exigir `mantenimientos: MantenimientoRegistro[]`, a exigir que `GastoVehiculo` **no** tenga campo de categoría, y a exigir la categoría de dos niveles tipada (nivel 2 correctivo extensible sin `string` libre).
- `vehiculo-gastos`: los dos requisitos ("Registro de gastos del vehículo", "Listado de gastos por vehículo") pasan a decir **explícitamente** que un gasto se registra y se lista sin categoría estructurada, para que nadie vuelva a agregar una que el docx no tiene. La clasificación de la intervención se pide contra `vehiculo-mantenimiento-historial`.

`vehiculo-mantenimiento` (alertas de service y VTV/RTO) **no** se modifica: las funciones puras siguen leyendo `Vehiculo.kilometraje`/`fechaUltimoService`/`habilitaciones`, no el historial nuevo.

## Impact

- **Tipos**: `frontend/src/shared/types/vehiculo.ts` (quita `CategoriaGasto`; suma `TipoIntervencion`, `SubtipoPreventivo`, `SubtipoCorrectivo`, `MantenimientoRegistro`, `Vehiculo.mantenimientos`).
- **Catálogos / funciones puras**: se borra `frontend/src/features/vehiculos/categoriaGastoOptions.ts`; se crea `mantenimientoCategoriaOptions.ts` (labels + chip kind + opciones de nivel 2 por nivel 1) y `validateMantenimientoForm.ts`.
- **UI**: `GastosVehiculo.tsx` (quita columna y selector de categoría), nuevo `HistorialMantenimiento.tsx`, `VehiculoDetail.tsx` (wiring de alta + `AvisoModeloDatos` nuevo).
- **Mock**: `frontend/src/shared/lib/mocks/mockVehiculoRepository.ts` (`SCHEMA_VERSION` 3), `vehiculosFixture.ts` (gastos sin `categoria` + `mantenimientos` de ejemplo cubriendo los 3 valores de nivel 1).
- **Tests**: `GastosVehiculo.test.tsx`, `VehiculoDetail.test.tsx`, `validateGastoForm.test.ts` (si asume categoría), nuevos `HistorialMantenimiento.test.tsx`, `validateMantenimientoForm.test.ts`, `mantenimientoCategoriaOptions.test.ts`.
- **Documentación**: `knowledge-base/04_modelo_de_datos.md` §Discrepancias, `CHANGES.md` §C-08.
- **Dependencias**: ninguna sobre changes activos. Reabre el archivado `2026-07-24-vehiculos-ui`. Entrega insumo estructural para el backend `C-08` (nombres de columna de `mantenimiento_registro`).
