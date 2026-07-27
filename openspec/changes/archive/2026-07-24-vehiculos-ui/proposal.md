## Why

La flota es un maestro operativo del que dependen las Hojas de Ruta (FE-5): cada recorrido se arma sobre vehículos habilitados, con capacidad y accesorios de movilidad compatibles con cada paciente (RN-VE-01). Además, la administradora necesita controlar el mantenimiento preventivo (cambio de aceite cada 10.000 km o 2-3 meses) y las habilitaciones VTV/RTO para que un vehículo vencido no siga apareciendo como disponible (RN-VE-02/03/04). Este change entrega la fase **FE-2 (rama Vehículos y mantenimiento)** del `ROADMAP-FRONTEND.md` — el lado UI de `C-08 vehiculos-mantenimiento` — construida como **frontend + mock**, siguiendo el contrato "tipos primero, mock después, Supabase al final" (patrón ya establecido y archivado en `obras-sociales-ui`) para no reescribir componentes cuando el backend real (`C-08`) se archive.

## What Changes

- Se definen los **tipos TypeScript** del dominio de flota en `frontend/src/shared/types/`: `Vehiculo` (patente, modelo, tipo, capacidad hasta 6, accesorios de movilidad compatibles, estado habilitado/fuera de servicio, kilometraje), `AccesorioMovilidad` (unión de literales: silla plegable / silla rígida / silla postural / andador / trípode — RN-VE-01), `GastoVehiculo` (evento fecha + monto, sin frecuencia fija) y `RegistroHabilitacion` (VTV / RTO con fecha de emisión y vencimiento, registrables de forma independiente — RN-VE-04).
- Se define la interfaz **`VehiculoRepository`** (`list`, `getById`, `create`, `update`) — la UI nunca habla con Supabase directamente.
- Se agrega una **implementación mock** de `VehiculoRepository` en `frontend/src/shared/lib/mocks/` con fixtures persistidos en `localStorage` (con `schemaVersion`) y latencia simulada, para ejercitar loading/error states reales — mismo patrón que `mockObraSocialRepository`.
- Se construye la **pantalla CRUD** de vehículos (alta / edición / listado) con **selector de accesorios de movilidad compatibles** (multi-selección tipada) y **toggle habilitado / fuera de servicio**, además de la actualización manual del **kilometraje**.
- Se construye la **vista de mantenimiento** con **alertas visuales calculadas client-side sobre el mock**: próximo cambio de aceite (vencido / alerta intermedia a los 5.000 km / OK, por km desde el último service y por antigüedad 2-3 meses, lo que ocurra primero — RN-VE-03), y vencimiento de **VTV (6 meses)** y **RTO** (RN-VE-04). Las alertas NO se codifican solo por color: llevan texto e ícono (WCAG — no depender del color).
- Se construye el **registro de gastos del vehículo**: tabla de eventos (fecha + monto), sin frecuencia fija (RF-508).
- Se construyen los **documentos del vehículo** (cédula, VTV, RTO, seguro, fotos) **reutilizando el componente de checklist documental de FE-1** (`DocumentChecklist`), con `EntidadDocumental = 'vehiculo'` (ya contemplada en `documento.ts`) — mismo patrón que `obras-sociales-ui` aplicó a sus documentos.
- Los umbrales de mantenimiento (10.000 km, 5.000 km de alerta intermedia, ~2-3 meses, 6 meses de VTV) se modelan como **constantes configurables documentadas**, no como números mágicos dispersos en la UI.
- **Fuera de alcance (NO se toca):** cliente Supabase real, migraciones SQL (`vehiculo`, `gasto_vehiculo`, `mantenimiento_registro`), RLS. Eso corresponde al change backend `C-08` real, en otra sesión. La exclusión de vehículos fuera de servicio de las hojas de ruta (RN-VE-02) y la validación de asignación por accesorio (RN-VE-01) se **consumen** en FE-5 (C-10); acá solo se deja el dato listo y consultable.

## Capabilities

### New Capabilities
- `vehiculo-contract`: contrato de datos del maestro Flota — tipos TypeScript de `Vehiculo` y sus sub-estructuras (`AccesorioMovilidad`, `GastoVehiculo`, `RegistroHabilitacion`, estado habilitado/fuera de servicio), tipos de entrada `NuevoVehiculo`/`ActualizacionVehiculo`, interfaz `VehiculoRepository` e implementación mock con persistencia en `localStorage` y latencia simulada.
- `vehiculo-crud`: pantalla de alta / edición / listado de vehículos, con selector de accesorios de movilidad compatibles, toggle habilitado/fuera de servicio, actualización manual de kilometraje, y estados de carga/vacío/error contra el repository.
- `vehiculo-mantenimiento`: vista de mantenimiento con alertas visuales (texto + ícono, no solo color) de próximo cambio de aceite (vencido / intermedia a 5.000 km / OK, por km y por antigüedad) y de vencimiento de VTV (6 meses) y RTO, calculadas client-side sobre el mock, con umbrales configurables.
- `vehiculo-gastos`: registro de gastos del vehículo como tabla de eventos (fecha + monto) sin frecuencia fija, con alta y listado por vehículo.
- `vehiculo-documentos`: checklist documental del vehículo (cédula, VTV, RTO, seguro, fotos) reutilizando el renderer `DocumentChecklist` de FE-1 y `EntidadDocumental = 'vehiculo'`, sin duplicar el modelo documental.

### Modified Capabilities
<!-- Ninguna: no existen specs previas de flota en openspec/specs/. Es un maestro nuevo. -->

## Impact

- **Código nuevo (frontend):**
  - `frontend/src/shared/types/vehiculo.ts` (tipos del dominio de flota).
  - `frontend/src/shared/lib/vehiculos/VehiculoRepository.ts` (interfaz).
  - `frontend/src/shared/lib/mocks/mockVehiculoRepository.ts` (mock localStorage + fixture).
  - `frontend/src/shared/lib/mantenimiento/` (funciones puras de cálculo de estado de mantenimiento/habilitaciones + constantes configurables).
  - `frontend/src/features/vehiculos/*` (pantallas CRUD, selector de accesorios, vista de mantenimiento, registro de gastos, documentos, hook y context de inyección).
- **Reutiliza:** `ChecklistItem` y `DocumentChecklist` (`frontend/src/shared/{types,components}`), `EntidadDocumental = 'vehiculo'` (`documento.ts`), `generateId` (`shared/lib/id.ts`), helper `reorder` (`shared/lib/reorder.ts`), primitivos del design-system (`Section`, `Chip`, `Button`), y el patrón repository → mock → hook → context establecido en FE-1 y `obras-sociales-ui`.
- **Monta la feature** reemplazando el `element` de la ruta `/vehiculos` en `frontend/src/app/router.tsx` (hoy `PlaceholderPage`); la lista declarativa `routes.ts` no cambia.
- **Habilita (aguas abajo):** FE-5 Hojas de Ruta (C-10) consume la lista de vehículos habilitados, su capacidad y sus accesorios compatibles para validar asignaciones (RN-VE-01) y excluir los fuera de servicio (RN-VE-02).
- **Sin impacto backend:** no crea tablas, RLS ni cliente Supabase. Cuando `C-08` backend se archive, se escribe `SupabaseVehiculoRepository` cumpliendo la misma interfaz y se inyecta en el punto de composición sin tocar componentes (FE-8).
- **Governance ALTO (CHANGES.md C-08):** este paso produce solo los artefactos (proposal, design, specs, tasks) y **se detiene para revisión humana** antes de implementar. No se escribe código de implementación en este change de propose.
