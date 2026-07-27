## Context

Fase **FE-2 (rama Vehículos y mantenimiento)** del `ROADMAP-FRONTEND.md`, lado UI de `C-08 vehiculos-mantenimiento`. La flota es un maestro operativo que consume FE-5 (Hojas de Ruta): capacidad, accesorios compatibles (RN-VE-01) y estado habilitado/fuera de servicio (RN-VE-02). Se construye frontend + mock: el backend real (`C-08`: tablas `vehiculo`/`gasto_vehiculo`/`mantenimiento_registro`, RLS, cliente Supabase) es otra sesión.

Estado actual del frontend (ya existe, se reutiliza como patrón):
- Stack: React 19 + TypeScript strict + Tailwind v4 (Vite) + React Router. Vitest + React Testing Library para tests.
- FE-1 estableció el patrón **contrato → mock → hook → componente presentacional**. `obras-sociales-ui` lo consolidó con persistencia en `localStorage`: `ObraSocialRepository` (interfaz) + `mockObraSocialRepository` (localStorage + `schemaVersion` + fixture) + `useObrasSociales` (hook de wiring) + `ObraSocialRepositoryContext` (inyección) + componentes presentacionales.
- El tipo `ChecklistItem` (`{ id, nombre, requerido }`) vive en `frontend/src/shared/types/documento.ts`; `EntidadDocumental` ya incluye `'vehiculo'`. El renderer `DocumentChecklist` (`frontend/src/shared/components/DocumentChecklist.tsx`) es reutilizable.
- Utilitarios compartidos: `generateId(prefix)` (`shared/lib/id.ts`), `reorder` (`shared/lib/reorder.ts`). Design system: primitivos en `frontend/src/design-system/components.tsx` (`Section`, `Chip`, `Button`).
- La ruta `/vehiculos` existe hoy como `PlaceholderPage` en `frontend/src/app/router.tsx`; la lista declarativa `frontend/src/app/routes.ts` no se toca (cada FE-N solo reemplaza su `element`).

Restricciones duras del proyecto (CLAUDE.md): TypeScript strict, prohibido `any` (usar `unknown` + narrowing); estilar SOLO con clases utilitarias de Tailwind v4, prohibido `style={{}}` inline (tokens en el bloque `@theme` de `frontend/src/index.css`); prohibido crear cliente Supabase real / RLS / migraciones en este change; Conventional Commits. Governance de este dominio: **ALTO** — propose + revisión humana antes de codear.

## Goals / Non-Goals

**Goals:**
- Contrato de datos `Vehiculo` + `VehiculoRepository` que no haya que reescribir cuando llegue `C-08` backend (los campos salen de `04_modelo_de_datos.md §Vehiculo`).
- Mock con `localStorage` + latencia para loading/error states reales, con 2-3 vehículos de fixture cubriendo casos de alerta (mantenimiento vencido, intermedio, VTV/RTO próximos).
- CRUD con selector de accesorios de movilidad tipado, toggle habilitado/fuera de servicio y actualización de kilometraje.
- Vista de mantenimiento con estado de alerta calculado por **funciones puras** (fácilmente testeables en TDD) sobre km y fechas, con umbrales configurables.
- Registro de gastos (evento fecha+monto) y checklist documental reutilizando FE-1.

**Non-Goals:**
- Cliente Supabase real, migraciones SQL, RLS (es `C-08` backend, FE-8).
- Consumo del dato de flota por Hojas de Ruta: la validación de compatibilidad por accesorio (RN-VE-01) y la exclusión de fuera de servicio (RN-VE-02) se **aplican** en FE-5 (C-10); acá solo se deja el dato consultable.
- Historial de mantenimiento correctivo detallado (alternador, batería, etc., RF-507): se modela el registro de gastos y las habilitaciones; un historial correctivo rico queda para el backend/una iteración posterior si el cliente lo pide.
- Integración con ARCA, geolocalización, o cualquier API externa.
- Notificaciones push/email de vencimientos: las alertas son visuales in-app calculadas al render.

## Decisions

### Decisión 1 — Persistencia del mock en `localStorage`, no in-memory
Se reutiliza el patrón de `mockObraSocialRepository`: `localStorage` con clave `vehiculos`, envoltorio `StoredPayload { schemaVersion, vehiculos }`, `withLatency` para simular red, y re-seed desde fixture ante payload corrupto o `schemaVersion` mismatch. Motivo: la flota es un maestro que la administradora configura una vez y espera reencontrar entre recargas mientras prueba la UI. La (de)serialización queda encapsulada en el mock; el resto de la app solo ve `VehiculoRepository`.
- **Alternativa descartada:** in-memory como FE-1 — se perdería kilometraje/gastos/documentos en cada reload, empobreciendo la prueba de alertas de mantenimiento que dependen de datos acumulados.

### Decisión 2 — Accesorios de movilidad como unión de literales, no `string[]` libre
`AccesorioMovilidad = 'silla-plegable' | 'silla-rigida' | 'silla-postural' | 'andador' | 'tripode'` (RN-VE-01, `04_modelo_de_datos.md §Vehiculo`). `Vehiculo.accesoriosCompatibles: AccesorioMovilidad[]`. Motivo: mantener strict, habilitar el selector como conjunto cerrado de opciones, y dar a FE-5 un dato tipado con el que validar la compatibilidad paciente↔vehículo sin comparar strings arbitrarios.
- **Alternativa descartada:** `string[]` libre — se pierde el chequeo de compatibilidad tipado y se abre la puerta a typos; el catálogo de accesorios es cerrado y conocido.

### Decisión 3 — Estado de mantenimiento derivado por funciones puras, no persistido
El estado de alerta (aceite: `ok` / `alerta-intermedia` / `vencido`; habilitación VTV/RTO: `vigente` / `por-vencer` / `vencida`) NO se guarda: se **calcula al render** con funciones puras en `shared/lib/mantenimiento/` a partir del kilometraje actual, el km del último service, la fecha del último service y las fechas de vencimiento de VTV/RTO. Motivo: el estado depende del "ahora" (fecha actual, km actual) y guardarlo lo dejaría obsoleto; las funciones puras son trivialmente testeables en TDD (input → estado esperado) y son exactamente las que el backend `C-08` re-implementará server-side.
- Reglas codificadas (RN-VE-03/04, US-500): aceite cada **10.000 km** o **~2-3 meses** desde el último service, lo que ocurra primero; **alerta intermedia a los 5.000 km**; VTV cada **6 meses**; RTO con su propio vencimiento independiente.
- **Alternativa descartada:** persistir un flag de estado — se desincroniza del tiempo/km reales; recalcular es barato.

### Decisión 4 — Umbrales de mantenimiento como constantes configurables documentadas
Los umbrales (`KM_SERVICE = 10_000`, `KM_ALERTA_INTERMEDIA = 5_000`, `MESES_SERVICE = 3`, `MESES_VTV = 6`) viven en un único módulo de constantes (`shared/lib/mantenimiento/constantes.ts`) con comentario que cita la regla de negocio, NO como números mágicos dispersos por los componentes. Motivo: son valores que el cliente podría ajustar (mismo criterio que el ROADMAP pide para plazos de cobro/facturación) y así el día que cambien es un solo punto de edición y de re-test.

### Decisión 5 — Documentos del vehículo reutilizan `DocumentChecklist` + `EntidadDocumental = 'vehiculo'`
La sección de documentos (cédula, VTV, RTO, seguro, fotos) reutiliza el renderer `DocumentChecklist` de FE-1 con `entidad = 'vehiculo'` (ya contemplado en `documento.ts`) y un checklist fijo de documentos de vehículo, sin duplicar el modelo documental. La (des)carga real de archivos es del `DocumentoRepository` mock existente; acá solo se define la lista de ítems de vehículo.
- **Alternativa descartada:** un modelo documental propio de vehículos — duplicaría `ChecklistItem`/`DocumentoAdjunto` y rompería la reutilización que FE-1 diseñó explícitamente para Pacientes, Vehículos, Conductores y Facturas.

### Decisión 6 — Gastos embebidos en `Vehiculo`, no repository aparte
`Vehiculo` embebe `gastos: GastoVehiculo[]` (`{ id, fecha, monto, descripcion? }`), y las mutaciones de gasto pasan por `VehiculoRepository.update()`. Motivo: en el mock no hay joins y la relación es 1—N leída siempre junto con el vehículo; el día del backend real la tabla `gasto_vehiculo` puede ser separada y `SupabaseVehiculoRepository` la ensambla, sin cambiar el tipo que ve la UI (mismo criterio que el checklist embebido en `obras-sociales-ui`).
- **Alternativa descartada:** un `GastoVehiculoRepository` separado — sobre-ingeniería para un mock; se puede separar en FE-8 sin tocar componentes.

### Decisión 7 — Inyección del repository por context, no import directo
Las pantallas reciben `VehiculoRepository` vía un `VehiculoRepositoryContext` (mismo patrón que `ObraSocialRepositoryContext`), nunca importan el mock directamente. Así el swap a `SupabaseVehiculoRepository` en FE-8 es un cambio de un solo punto de composición. La feature se monta reemplazando el `element` de `/vehiculos` en `router.tsx`.

### Decisión 8 — Estructura de carpetas `features/vehiculos/` + contrato en `shared/`
Siguiendo `08_arquitectura_propuesta.md` (estructura por feature) y el patrón de `obras-sociales-ui`: contrato + mock + funciones de mantenimiento en `shared/` (reusables por Hojas de Ruta), pantallas y hooks específicos en `features/vehiculos/`. El mock del repository va en `shared/lib/mocks/`.

## Risks / Trade-offs

- **Divergencia de campos con el backend real (`C-08`)** → El nombre/tipo de campos de `Vehiculo`/`GastoVehiculo`/habilitaciones podría no calzar con las tablas reales. Mitigación: los campos salen directo de `04_modelo_de_datos.md §Vehiculo`; coordinar nombres con quien implemente `C-08` antes de cerrar la interfaz. Como la UI habla con la interfaz, un ajuste queda contenido en el adaptador.
- **Cálculo de alertas dependiente de la fecha "ahora"** → Tests que usen `new Date()` real serían no deterministas. Mitigación: las funciones puras reciben la fecha de referencia (`ahora: Date`) y el km actual como parámetros; los tests inyectan valores fijos.
- **`localStorage` sin versionado robusto** → si cambia la forma de `Vehiculo`, los datos viejos podrían romper la deserialización. Mitigación: `schemaVersion` en el payload y re-seed desde fixture ante mismatch (es solo un mock, no hay dato de producción que preservar).
- **Alertas que dependen solo del color serían inaccesibles** → RN de accesibilidad (WCAG AA, contraste ≥4.5:1, no depender del color). Mitigación: cada estado de alerta lleva **texto + ícono** además del color; el color es refuerzo, no el único canal.
- **Historial correctivo simplificado a gastos + habilitaciones** → podría faltar granularidad que el cliente espera (RF-507). Mitigación: se documenta como Non-Goal de esta iteración; el contrato deja espacio para extender sin romper la interfaz.

## Migration Plan

No aplica migración de datos (frontend + mock, sin backend). Camino de reemplazo futuro (FE-8, cuando `C-08` backend se archive): escribir `SupabaseVehiculoRepository` que cumpla `VehiculoRepository`, inyectarlo en `VehiculoRepositoryContext` en lugar del mock. Las funciones puras de `shared/lib/mantenimiento/` pueden quedar como espejo client-side o delegarse al backend; componentes, hooks y tipos no cambian.

Governance ALTO: este change entrega solo proposal/design/specs/tasks y **se detiene para revisión humana**. La implementación (apply) arranca solo tras aprobación.

## Open Questions

- Coordinar con backend (`C-08`) los nombres exactos de campos de `Vehiculo`, `GastoVehiculo` y los registros de habilitación (VTV/RTO) antes de cerrar la interfaz, para minimizar el trabajo del adaptador en FE-8.
- Confirmar con el cliente el intervalo exacto del service preventivo por antigüedad (la KB dice "2-3 meses"; se toma **3 meses** como default configurable) y si el recordatorio periódico de kilometraje (US-500) debe ser una alerta adicional a la intermedia de 5.000 km.
- ¿El historial de mantenimiento correctivo (RF-507: alternador, batería, frenos, embrague, cubiertas) necesita entidad propia con categorías, o alcanza el registro de gastos genérico para esta fase UI? (No bloquea el contrato; se puede extender.)
- ¿Cuáles vehículos y accesorios reales precargar como fixture? Se sembrarán 2-3 vehículos genéricos (ej. Etios: silla plegable; Kangoo: sillas rígidas/posturales; Partner: capacidad reducida) según los ejemplos de `04_modelo_de_datos.md §Vehiculo`, confirmables con el cliente.
