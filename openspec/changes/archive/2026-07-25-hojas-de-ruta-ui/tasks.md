> **Governance ALTO (CHANGES.md C-10).** Antes de escribir código en el apply: proponer el plan y **esperar revisión/aprobación humana**. Ser explícito sobre la Decisión 2 (`conductorId` agregado sobre el docx) y confirmarla con el dueño del docx. Strict TDD: las funciones puras (compatibilidad, disponibilidad, capacidad, orden por cercanía) se implementan test-first.

## 1. Contrato de datos (tipos)

- [x] 1.1 Crear `frontend/src/shared/types/hojaDeRuta.ts` con `Coordenada` (`{ lat: number; lng: number }`) y, reutilizando `Tramo`/`Direccion` de `paciente.ts`, `AccesorioMovilidad`/`EstadoVehiculo` de `vehiculo.ts` y `EstadoConductor` de `conductor.ts` (importar, no redefinir). Sin `any`.
- [x] 1.2 Definir `ParadaRecorrido` (`id`, `pacienteId`, `tramo: Tramo`, `direccionOrigenId: string`, `direccionDestinoId: string`, `orden: number`, `coordenadaOrigen?: Coordenada`) — direcciones de origen/destino independientes por tramo (RN-HR-02).
- [x] 1.3 Definir `Recorrido` (`id`, `vehiculoId: string`, `conductorId: string`, `manual: boolean`, `notas?: string`, `paradas: ParadaRecorrido[]`). Comentar `conductorId` como campo agregado sobre el docx (design.md Discrepancia 2, punto de discrepancia central).
- [x] 1.4 Definir `HojaDeRuta` (`id`, `fecha: string`, `franjaInicio: string`, `franjaFin: string`, `notas?: string`, `recorridos: Recorrido[]`).
- [x] 1.5 Definir tipos de entrada `NuevaHojaDeRuta` / `ActualizacionHojaDeRuta`, `NuevoRecorrido`, `NuevaParadaRecorrido` (payloads de create/update sin `id`).

## 2. Funciones puras de reglas de negocio (Strict TDD — test-first)

- [x] 2.1 Implementar `validarCompatibilidadAccesorio({ accesoriosPaciente, accesoriosCompatiblesVehiculo })` → ok/error: error si algún accesorio del paciente no está en los compatibles del vehículo (RN-VE-01); ok si el paciente no tiene accesorios o todos son compatibles. Sin efectos de red/`localStorage`.
- [x] 2.2 Implementar `vehiculosDisponibles(vehiculos)` (filtra `estado === 'habilitado'`) y `conductoresDisponibles(conductores)` (filtra `estado === 'operando'`) — RN-VE-02. Puras y testeables.
- [x] 2.3 Implementar `capacidadDisponible(vehiculo, recorrido)` → boolean: hay lugar si la cantidad de pasajeros del recorrido es menor que `vehiculo.capacidad`.
- [x] 2.4 Implementar `sugerirOrdenPorCercania(paradas, origenReferencia?)` → paradas reordenadas por vecino más cercano (distancia haversine sobre `coordenadaOrigen`). Pura y determinista; dejar el criterio de cercanía como TODO/config no bloqueante (RF-701, `10_preguntas_abiertas.md`). Devuelve una propuesta, no impone la ruta (RN-HR-01).

## 3. Repository e implementación mock

- [x] 3.1 Crear `frontend/src/shared/lib/hojas-de-ruta/HojaDeRutaRepository.ts` (interfaz: `list()`, `getById(id)` → `null` si no existe, `getByFecha(fecha)` → `null` si no existe, `create(data)`, `update(id, data)`). Recorridos embebidos en `HojaDeRuta`, sin repository aparte.
- [x] 3.2 Crear el fixture `frontend/src/shared/lib/mocks/hojasDeRutaFixture.ts`: al menos una hoja de ruta del día con recorridos ligados a `vehiculoId`/`conductorId`/`pacienteId` existentes en `vehiculosFixture`/`conductoresFixture`/`pacientesFixture` (al menos un vehículo habilitado y un conductor operando), paradas de ida y de vuelta como registros independientes, y coordenadas fixture (razonables, no reales) para el mapa.
- [x] 3.3 Crear `mockHojaDeRutaRepository.ts` que cumpla la interfaz, persista en `localStorage` (clave `hojasDeRuta`, con `schemaVersion`), siembre el fixture cuando no hay datos y devuelva promesas con latencia simulada (patrón `mockVehiculoRepository`).
- [x] 3.4 Manejar mismatch de `schemaVersion` / payload corrupto: re-sembrar desde fixture en vez de romper la deserialización.

## 4. Hook y punto de inyección

- [x] 4.1 Crear el hook `useHojasDeRuta(repository)` que exponga datos, `loading`, `error`, `crear()`, `actualizar()` y recargue tras cada mutación (patrón `useVehiculos`).
- [x] 4.2 Crear `HojaDeRutaRepositoryContext` (provider + hook de consumo) para inyectar el repository, de modo que ninguna pantalla importe el mock directamente (patrón `VehiculoRepositoryContext`).

## 5. Pantalla de armado del día

- [x] 5.1 Crear `frontend/src/features/hojas-de-ruta/HojaDeRutaPage.tsx` (o `HojasDeRutaRoute.tsx`) con selector de fecha y franja horaria (default ~8:00-20:00, configurable, no hardcodeado), estados de carga/vacío/error.
- [x] 5.2 Listar los recorridos del día agrupados por vehículo/conductor; keys por id estable (nunca índice de array). Selectores de vehículo y conductor poblados con `vehiculosDisponibles`/`conductoresDisponibles` (RN-VE-02), consumiendo `VehiculoRepository`/`ConductorRepository` inyectados.
- [x] 5.3 Al asignar/agregar un paciente a un recorrido, aplicar `validarCompatibilidadAccesorio` (RN-VE-01) y `capacidadDisponible`, bloqueando/alertando con mensaje visible si falla; consumir `PacienteRepository` inyectado para pacientes y sus accesorios/direcciones.
- [x] 5.4 Extraer subcomponentes (tarjeta de recorrido, lista de paradas, panel de asignación) para mantener componentes < ~200 líneas.

## 6. Mapa y sugerencia de orden

- [x] 6.1 Agregar la dependencia `@vis.gl/react-google-maps` (nunca `@react-google-maps/api`/`google-map-react`) y una env var `VITE_GOOGLE_MAPS_API_KEY` (Maps Demo Key, sin billing; nunca hardcodear la key).
- [x] 6.2 Crear el componente de mapa con `<APIProvider>` + `<Map mapId="DEMO_MAP_ID">` con altura CSS explícita (clase Tailwind), y `AdvancedMarkerElement` para cada parada (prohibido `google.maps.Marker`). Manejar loading/error del mapa (nunca pantalla en blanco).
- [x] 6.3 Conectar `sugerirOrdenPorCercania` (sección 2) a un botón "sugerir orden": aplica la propuesta a `ParadaRecorrido.orden` como lista **editable/reordenable**, nunca imponiendo la ruta (RN-HR-01). El reorden manual prevalece y se persiste.

## 7. Edición manual, recorridos manuales y vista global

- [x] 7.1 Implementar agregar/quitar pasajero con reacomodo consistente del `orden` de las paradas restantes, sin perder los demás recorridos del día (persistir como agregado vía `update`).
- [x] 7.2 Implementar notas al pie (`HojaDeRuta.notas` / `Recorrido.notas`) editables y visibles.
- [x] 7.3 Implementar alta de recorrido manual (`Recorrido.manual = true`) sin frecuencia fija ni turno (RN-HR-03).
- [x] 7.4 Modelar ida y vuelta como paradas independientes por tramo (RN-HR-02) — nunca derivar la vuelta invirtiendo la ida; cada tramo con su origen/destino del catálogo `Paciente.direcciones`.
- [x] 7.5 Crear la vista global del día (todos los recorridos juntos) que señale conflictos (vehículo/conductor fuera de servicio) y permita reasignar pasajeros respetando RN-VE-01/RN-VE-02 y capacidad.

## 8. Exportación / impresión

- [x] 8.1 Crear la vista imprimible (print-friendly, utilidades de print de Tailwind, sin `style={{}}` inline) con recorridos agrupados por vehículo/conductor, orden de recogida, direcciones por tramo y notas al pie; refleja el estado actual tras ediciones manuales.

## 9. Cartel de discrepancia en UI (design.md Decisión 8)

- [x] 9.1 Mostrar `AvisoModeloDatos` en la pantalla de hoja de ruta indicando que el docx no tiene entidad "Hoja de Ruta" y que su "Historial de Recorridos" no tiene Conductor → `conductorId` es campo agregado pendiente de confirmar con el dueño del docx (Discrepancias 1 y 2).

## 10. Documentación de discrepancias (regla dura CLAUDE.md — docx vs. KB en los dos lugares)

- [x] 10.1 Actualizar en `knowledge-base/04_modelo_de_datos.md` §"⚠️ Discrepancias con el modelo de datos real" la entrada "Operación diaria / Recorridos": dejar registrada la decisión de este change (se modela `HojaDeRuta` + `Recorrido` con `vehiculoId` **y `conductorId`** por exigirlo la regla de negocio; `conductorId` y la entidad "Hoja de Ruta" son agregados sobre el docx, pendientes de confirmar). Corregir la referencia a "C-09" por `C-10` si corresponde.
- [x] 10.2 Verificar que `CHANGES.md §C-10` ya tiene el bullet `⚠️ Discrepancia con Traslados-Modelo-Datos.docx` (ya presente) y, si hace falta, agregar la nota de que `conductor` y la tabla `hoja_de_ruta` deben coordinarse con backend antes de cerrar el esquema.

## 11. Integración y verificación

- [x] 11.1 Montar la feature reemplazando el `element` de la ruta `/hojas-de-ruta` en `frontend/src/app/router.tsx`, inyectando `mockHojaDeRutaRepository` vía su context, más `mockPacienteRepository`/`mockVehiculoRepository`/`mockConductorRepository` (consumidos para los selectores), sin tocar `routes.ts`.
- [x] 11.2 Verificar `tsc --noEmit` sin errores y el linter limpio (sin `any`, imports usados, sin `style={{}}` inline — solo clases utilitarias de Tailwind v4).
- [x] 11.3 Verificar manualmente el flujo en `npm run dev`: elegir día → armar recorrido con vehículo habilitado + conductor operando → agregar pacientes respetando capacidad → intentar asignar paciente con accesorio incompatible y ver el bloqueo (RN-VE-01) → sugerir orden por cercanía y reordenar a mano (RN-HR-01) → cargar tramos de ida y vuelta independientes (RN-HR-02) → alta de recorrido manual (RN-HR-03) → vista global y reasignación ante fuera de servicio → exportar/imprimir → recargar y confirmar persistencia en localStorage. **Verificado por el usuario en `npm run dev` a lo largo de varias rondas de feedback** (flujo pacientes-primero, resumen/editar, hora+direcciones, cambio de vehículo/conductor, unificación de formularios, filtro reactivo de vehículo) — ver engram `sdd/hojas-de-ruta-ui/apply-progress`.
