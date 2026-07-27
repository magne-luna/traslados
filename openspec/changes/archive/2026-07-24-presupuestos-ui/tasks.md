## 1. Contrato de datos (tipos)

- [x] 1.1 Crear `frontend/src/shared/types/presupuesto.ts` con `EstadoAutorizacion` (unión de literales `'pendiente' | 'autorizada' | 'judicializada' | 'rechazada'`) y `ArchivoAdjunto` (`{ nombre: string; cargadoEn: string }`). Sin `any`.
- [x] 1.2 Definir la interfaz `Presupuesto` (`id`, `pacienteId`, `obraSocialId`, `monto: number`, `fechaEmision: string`, `archivo?: ArchivoAdjunto`), referenciando paciente y obra social por id (no embeber los objetos) — cruce docx §Presupuesto + `04_modelo_de_datos.md`.
- [x] 1.3 Definir la interfaz `Autorizacion` (`id`, `presupuestoId`, `estado: EstadoAutorizacion`, `fechaRespuesta?`, `montoAutorizado?: number`, `vigenciaDesde?: string`, `cupoMensualDias?: number`, `cupoMensualKm?: number`, `archivo?: ArchivoAdjunto`). `montoAutorizado` y `vigenciaDesde` son campos que el frontend agrega sobre el docx (design.md Discrepancias 2 y 3) — dejarlos opcionales y comentados como tal.
- [x] 1.4 Definir la proyección `CupoAutorizado` (`{ pacienteId; cupoMensualDias?; cupoMensualKm?; vigenciaDesde? }`) para consumo de FE-6.
- [x] 1.5 Definir tipos de entrada `NuevoPresupuesto` / `ActualizacionPresupuesto` y `NuevaAutorizacion` / `ActualizacionAutorizacion` (payloads de create/update sin `id`).

## 2. Función pura de validación RN-PA-01

- [x] 2.1 Implementar la función pura `validarAutorizacion({ montoAutorizado, montoPresupuesto })` → ok/error: error si `montoAutorizado > montoPresupuesto` (RN-PA-01); ok si es igual o menor; sin error de monto cuando `montoAutorizado` está ausente. Sin efectos de red ni `localStorage` (testeable con valores fijos).

## 3. Repositories e implementaciones mock

- [x] 3.1 Crear `frontend/src/shared/lib/presupuestos/PresupuestoRepository.ts` (interfaz: `list()`, `getById(id)` → `null` si no existe, `create(data)`, `update(id, data)`) y `.../AutorizacionRepository.ts` (igual + `getByPresupuestoId(presupuestoId)` → `null` si no existe).
- [x] 3.2 Crear los fixtures (`frontend/src/shared/lib/mocks/presupuestosFixture.ts`, `.../autorizacionesFixture.ts`): presupuestos ligados a `pacienteId`/`obraSocialId` que existan en `pacientesFixture`/`osecacFixture`, y al menos una autorización por cada estado (incluyendo una con `vigenciaDesde` anterior a `fechaRespuesta` y una con `montoAutorizado` = `monto` del presupuesto).
- [x] 3.3 Crear `mockPresupuestoRepository.ts` y `mockAutorizacionRepository.ts` que cumplan las interfaces, persistan en `localStorage` (claves `presupuestos` / `autorizaciones`, con `schemaVersion`), siembren el fixture cuando no hay datos y devuelvan promesas con latencia simulada (patrón `mockVehiculoRepository`/`mockConductorRepository`).
- [x] 3.4 Manejar mismatch de `schemaVersion` / payload corrupto: re-sembrar desde fixture en vez de romper la deserialización, en ambos mocks.

## 4. Hooks y puntos de inyección

- [x] 4.1 Crear hooks `usePresupuestos(repository)` y `useAutorizaciones(repository)` que expongan datos, `loading`, `error`, `crear()`, `actualizar()` y recarguen tras cada mutación (patrón `useVehiculos`).
- [x] 4.2 Crear `PresupuestoRepositoryContext` y `AutorizacionRepositoryContext` (provider + hook de consumo) para inyectar los repositories, de modo que ninguna pantalla importe los mocks directamente (patrón `VehiculoRepositoryContext`).

## 5. Pantalla CRUD de presupuestos

- [x] 5.1 Crear `frontend/src/features/presupuestos/PresupuestosList.tsx`: listado con estados de carga/vacío/error, fila clickeable que abre el detalle y botón "Editar" con `stopPropagation` (patrón Conductores/Vehículos, `08_arquitectura_propuesta.md`).
- [x] 5.2 Crear `PresupuestoForm.tsx` con selector de paciente (poblado desde `PacienteRepository.list()`, inyectado) y de obra social (desde `ObraSocialRepository.list()`, inyectado), monto, fecha de emisión; guardar solo `pacienteId`/`obraSocialId`.
- [x] 5.3 Crear la función pura `validatePresupuestoForm` (exige paciente, obra social y monto) y conectarla al form bloqueando el guardado y señalando faltantes.
- [x] 5.4 Implementar el input de **archivo único** (`archivo?: ArchivoAdjunto`) del presupuesto — NO `DocumentChecklist`. Referencia de archivo (nombre + fecha de carga), sin subida real a storage.
- [x] 5.5 Conectar create/update al hook y manejar el error del repository (mensaje visible, sin loading infinito).
- [x] 5.6 Crear `PresupuestoDetail.tsx` que muestre paciente (resuelto), obra social (resuelta), monto, fecha de emisión, archivo, y la autorización asociada (vía `getByPresupuestoId`).

## 6. Gestión de autorización

- [x] 6.1 Crear `AutorizacionForm.tsx` ligado a un `presupuestoId`, con selector de estado (`EstadoAutorizacion`, los 4 valores), `montoAutorizado`, cupo mensual de días/km editables, `fechaRespuesta` y archivo único.
- [x] 6.2 Implementar el campo `vigenciaDesde` independiente de `fechaRespuesta`, permitiendo una fecha anterior a la de carga (carga retroactiva, RN-PA-02) sin bloquear.
- [x] 6.3 Conectar el guardado a `validarAutorizacion` (sección 2): bloquear/alertar si `montoAutorizado > presupuesto.monto` (RN-PA-01) con mensaje visible; persistir vía `AutorizacionRepository`.
- [x] 6.4 Implementar el input de **archivo único** de la autorización (mismo criterio que 5.4).

## 7. Cupo consumible por FE-6

- [x] 7.1 Implementar la derivación `CupoAutorizado` (función pura) a partir de una `Autorizacion` + el `pacienteId` de su `Presupuesto`, dejándola exportada y consultable para FE-6 (sin implementar el control de facturación acá).

## 8. Integración y verificación

- [x] 8.1 Montar la feature reemplazando el `element` de la ruta `/presupuestos` en `frontend/src/app/router.tsx`, inyectando `mockPresupuestoRepository` y `mockAutorizacionRepository` vía sus contexts, más `mockPacienteRepository` y `mockObraSocialRepository` (consumidos para los selectores), sin tocar `routes.ts`.
- [x] 8.2 Verificar `tsc --noEmit` sin errores y `oxlint` limpio (sin `any`, imports usados, sin `style={{}}` inline — solo clases utilitarias de Tailwind v4).
- [x] 8.3 Verificar manualmente el flujo en `npm run dev`: crear presupuesto (paciente + obra social + monto + archivo) → crear autorización pendiente → pasar a autorizada con monto ≤ presupuesto → intentar monto > presupuesto y ver el bloqueo (RN-PA-01) → cargar vigencia retroactiva → cambiar estado a judicializada/rechazada → recargar y confirmar persistencia en localStorage.

## 9. Carteles de discrepancia en UI (design.md Decisión 7)

- [x] 9.1 En `PresupuestoForm.tsx` (input de archivo): `AvisoModeloDatos` indicando "el modelo real (docx) tiene un solo Archivo por presupuesto, no un checklist multi-documento" (Discrepancia 1).
- [x] 9.2 En `AutorizacionForm.tsx` (campo `montoAutorizado`): `AvisoModeloDatos` indicando "monto autorizado no existe en el docx; se agrega para validar RN-PA-01 — pendiente de confirmar con backend" (Discrepancia 2).
- [x] 9.3 En `AutorizacionForm.tsx` (campo `vigenciaDesde`): `AvisoModeloDatos` indicando "fecha de vigencia no existe en el docx (solo hay Fecha de respuesta); se agrega para RN-PA-02 — pendiente de confirmar con backend" (Discrepancia 3).
- [x] 9.4 En `AutorizacionForm.tsx` (input de archivo): `AvisoModeloDatos` de archivo único (mismo criterio que 9.1, para la autorización).

## 10. Documentación de discrepancias (regla dura CLAUDE.md — docx vs. KB en los dos lugares)

- [x] 10.1 Agregar en `knowledge-base/04_modelo_de_datos.md` §"⚠️ Discrepancias con el modelo de datos real" las 3 discrepancias de impacto de este change: (a) documentación adjunta = archivo único, no multi-doc; (b) Autorización sin `monto autorizado` en el docx → RN-PA-01 no validable sin agregarlo; (c) Autorización sin `fecha de vigencia` en el docx → RN-PA-02 sin dónde persistir. Mismo formato que las entradas existentes de esa sección.
- [x] 10.2 Agregar en `CHANGES.md`, dentro del scope de `C-06 presupuestos-autorizaciones`, un bullet `⚠️ Discrepancia con Traslados-Modelo-Datos.docx` resumiendo esas 3 discrepancias + la nota de que `montoAutorizado`/`vigenciaDesde` deben coordinarse con backend antes de cerrar la tabla `autorizacion` (mismo criterio ya aplicado en C-02/04/07/08/09/10).
