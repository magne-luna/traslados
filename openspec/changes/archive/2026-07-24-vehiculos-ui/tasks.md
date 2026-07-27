## 1. Contrato de datos (tipos)

- [x] 1.1 Crear `frontend/src/shared/types/vehiculo.ts` con `AccesorioMovilidad` (`'silla-plegable' | 'silla-rigida' | 'silla-postural' | 'andador' | 'tripode'`) y `EstadoVehiculo` (`'habilitado' | 'fuera-de-servicio'`). Sin `any`.
- [x] 1.2 Definir `RegistroHabilitacion` (`{ tipo: 'vtv' | 'rto'; fechaEmision: string; fechaVencimiento: string }`) y `GastoVehiculo` (`{ id, fecha, monto, descripcion? }`), fechas como ISO string.
- [x] 1.3 Definir la interfaz `Vehiculo` (id, patente, modelo, tipo, capacidad, `accesoriosCompatibles: AccesorioMovilidad[]`, estado, kilometraje, kilometrajeUltimoService, fechaUltimoService, habilitaciones `RegistroHabilitacion[]`, `gastos: GastoVehiculo[]`), reutilizando conceptos del ERD (`04_modelo_de_datos.md §Vehiculo`).
- [x] 1.4 Definir tipos de entrada `NuevoVehiculo` / `ActualizacionVehiculo` (payloads de create/update sin `id`).

## 2. Constantes y funciones puras de mantenimiento

- [x] 2.1 Crear `frontend/src/shared/lib/mantenimiento/constantes.ts` con `KM_SERVICE = 10_000`, `KM_ALERTA_INTERMEDIA = 5_000`, `MESES_SERVICE = 3`, `MESES_VTV = 6` y ventana de aviso de habilitación, cada una comentada con su regla (RN-VE-03/04). Sin números mágicos fuera de acá.
- [x] 2.2 Implementar función pura `estadoServicePreventivo({ kilometraje, kilometrajeUltimoService, fechaUltimoService, ahora })` → `'ok' | 'alerta-intermedia' | 'vencido'`, aplicando "lo que ocurra primero" entre km y meses (RN-VE-03).
- [x] 2.3 Implementar función pura `estadoHabilitacion({ fechaVencimiento, ahora })` → `'vigente' | 'por-vencer' | 'vencida'`, reutilizable para VTV y RTO de forma independiente (RN-VE-04).

## 3. Repository e implementación mock

- [x] 3.1 Crear `frontend/src/shared/lib/vehiculos/VehiculoRepository.ts` con la interfaz: `list()`, `getById(id)` (resuelve `null` si no existe), `create(data)`, `update(id, data)`.
- [x] 3.2 Crear el fixture inicial de flota (`frontend/src/shared/lib/mocks/vehiculosFixture.ts`) con 2-3 vehículos que cubran casos de alerta (service vencido, intermedio, VTV/RTO próximos), según ejemplos de `04_modelo_de_datos.md §Vehiculo`.
- [x] 3.3 Crear `frontend/src/shared/lib/mocks/mockVehiculoRepository.ts` que cumpla la interfaz, persista en `localStorage` (con `schemaVersion`), siembre el fixture cuando no hay datos y devuelva promesas con latencia simulada (patrón `mockObraSocialRepository`).
- [x] 3.4 Manejar mismatch de `schemaVersion` / payload corrupto: re-sembrar desde fixture en vez de romper la deserialización.

## 4. Hook y punto de inyección

- [x] 4.1 Crear un hook `useVehiculos(repository)` que exponga `vehiculos`, `loading`, `error`, `crear()`, `actualizar()` y recargue tras cada mutación (patrón `useObrasSociales`).
- [x] 4.2 Crear `VehiculoRepositoryContext` (provider + hook de consumo) para inyectar el repository, de modo que ninguna pantalla importe el mock directamente (patrón `ObraSocialRepositoryContext`).

## 5. Pantalla CRUD

- [x] 5.1 Crear `frontend/src/features/vehiculos/VehiculosList.tsx`: listado con estados de carga/vacío/error, mostrando patente, modelo, capacidad y estado (fuera de servicio con texto + ícono, no solo color).
- [x] 5.2 Crear el formulario de alta/edición (`VehiculoForm.tsx`) con patente, modelo, tipo, capacidad (1 a 6) y kilometraje.
- [x] 5.3 Crear la función pura de validación (`validateVehiculoForm`) que exija patente y capacidad en rango 1-6, y conectarla al form bloqueando el guardado y señalando faltantes.
- [x] 5.4 Implementar el selector de accesorios de movilidad compatibles (multi-selección sobre el conjunto cerrado `AccesorioMovilidad`) integrado al form.
- [x] 5.5 Implementar el toggle habilitado / fuera de servicio, persistiendo el cambio vía `update()`.
- [x] 5.6 Implementar la actualización manual de kilometraje (>= al registrado) vía `update()`, recalculando las alertas al aplicarse.
- [x] 5.7 Conectar create/update al hook y manejar el error del repository (mensaje visible, sin loading infinito).

## 6. Vista de mantenimiento

- [x] 6.1 Crear `VehiculoMantenimiento.tsx` que consuma las funciones puras de la sección 2 para derivar el estado de service y de habilitaciones del vehículo.
- [x] 6.2 Renderizar la alerta de service preventivo (`ok` / `alerta-intermedia` / `vencido`) con texto + ícono (no solo color) y contraste WCAG AA.
- [x] 6.3 Renderizar las alertas de VTV y RTO por separado (`vigente` / `por-vencer` / `vencida`), identificando cuál habilitación y su estado, con texto + ícono.

## 7. Registro de gastos

- [x] 7.1 Crear `GastosVehiculo.tsx`: tabla de gastos (fecha + monto) con estado vacío cuando no hay gastos.
- [x] 7.2 Implementar el alta de gasto (validando monto positivo y fecha), agregándolo a `gastos` y persistiendo vía `update()`.

## 8. Documentos del vehículo

- [x] 8.1 Definir la lista fija de ítems documentales del vehículo (cédula, VTV, RTO, seguro, fotos) como `ChecklistItem[]`, reutilizando el tipo de `shared/types/documento.ts` (sin modelo paralelo).
- [x] 8.2 Crear `VehiculoDocumentos.tsx` reutilizando el renderer `DocumentChecklist` de FE-1 con `EntidadDocumental = 'vehiculo'` y el `DocumentoRepository` mock existente.

## 9. Integración y verificación

- [x] 9.1 Montar la feature de vehículos reemplazando el `element` de la ruta `/vehiculos` en `frontend/src/app/router.tsx`, inyectando `mockVehiculoRepository` vía el context (sin tocar `routes.ts`).
- [x] 9.2 Verificar `tsc --noEmit` sin errores y `oxlint` limpio (sin `any`, imports usados, sin `style={{}}` inline).
- [x] 9.3 Verificar manualmente el flujo en `npm run dev`: crear vehículo → seleccionar accesorios → togglear fuera de servicio → actualizar kilometraje y ver alertas de mantenimiento → registrar gasto → ver checklist documental → recargar y confirmar persistencia en localStorage. Verificado por el usuario en el navegador.
