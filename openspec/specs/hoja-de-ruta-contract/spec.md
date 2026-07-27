## ADDED Requirements

### Requirement: Tipos del dominio de Hojas de Ruta y Recorridos
El sistema SHALL definir los tipos TypeScript del dominio en `frontend/src/shared/types/hojaDeRuta.ts`, en modo strict y sin usar `any`. MUST incluir `HojaDeRuta` (`id`, `fecha`, `franjaInicio`, `franjaFin`, `notas?`, `recorridos: Recorrido[]`), `Recorrido` (`id`, `vehiculoId`, `conductorId`, `manual: boolean`, `notas?`, `paradas: ParadaRecorrido[]`), `ParadaRecorrido` (`id`, `pacienteId`, `tramo`, `direccionOrigenId`, `direccionDestinoId`, `orden`, `coordenadaOrigen?`) y `Coordenada` (`{ lat: number; lng: number }`), reutilizando `Tramo`/`Direccion` de `paciente.ts`, `AccesorioMovilidad`/`EstadoVehiculo` de `vehiculo.ts` y `EstadoConductor` de `conductor.ts` (cruce de `04_modelo_de_datos.md §HojaDeRuta/Recorrido` con `docs/core/Traslados-Modelo-Datos.docx §Recorridos/Historial de Recorridos`).

#### Scenario: Recorrido referencia vehículo y conductor por id
- **WHEN** se declara `Recorrido`
- **THEN** contiene `vehiculoId: string` y `conductorId: string` (no embebe `Vehiculo` ni `Conductor`), y `conductorId` queda marcado como campo agregado sobre el docx (design.md Discrepancia 2)

#### Scenario: Direcciones de origen y destino independientes por tramo
- **WHEN** se declara `ParadaRecorrido`
- **THEN** tiene `tramo: Tramo` y referencia `direccionOrigenId` y `direccionDestinoId` de forma independiente, sin ningún campo que derive la vuelta invirtiendo la ida (RN-HR-02)

#### Scenario: Reutilización de tipos de los maestros, no redefinición
- **WHEN** se declaran los tipos de `hojaDeRuta.ts`
- **THEN** `Tramo`/`Direccion` se importan de `paciente.ts`, `AccesorioMovilidad`/`EstadoVehiculo` de `vehiculo.ts` y `EstadoConductor` de `conductor.ts`, sin redefinirlos localmente

#### Scenario: Tipos de entrada sin id
- **WHEN** se declaran los payloads de creación (`NuevaHojaDeRuta`, `NuevoRecorrido`, `NuevaParadaRecorrido`)
- **THEN** ninguno incluye `id`; el `id` lo asigna la implementación del repository

### Requirement: Interfaz HojaDeRutaRepository
El sistema SHALL definir la interfaz `HojaDeRutaRepository` (`list()`, `getById(id)`, `getByFecha(fecha)`, `create(data)`, `update(id, data)`) en `frontend/src/shared/lib/hojas-de-ruta/`, de modo que ninguna pantalla hable con la fuente de datos directamente. Los `Recorrido` viven embebidos en la `HojaDeRuta` (agregado del día), no en un repository aparte.

#### Scenario: getById / getByFecha de un registro inexistente
- **WHEN** se invoca `getById(id)` o `getByFecha(fecha)` con un valor que no existe
- **THEN** la promesa resuelve `null` en vez de lanzar un error

#### Scenario: Edición del día como mutación del agregado
- **WHEN** se agrega, quita o reordena una parada dentro de un recorrido
- **THEN** el cambio se persiste vía `update(id, data)` sobre la `HojaDeRuta` completa (agregado), sin requerir un repository de recorridos aparte

### Requirement: Implementación mock con persistencia en localStorage
El sistema SHALL proveer una implementación mock de `HojaDeRutaRepository` en `frontend/src/shared/lib/mocks/mockHojaDeRutaRepository.ts` que cumpla la interfaz al pie de la letra, persista en `localStorage` con un `schemaVersion` y devuelva promesas con latencia simulada, para ejercitar estados de carga y error reales.

#### Scenario: Siembra del fixture inicial
- **WHEN** no hay datos de hojas de ruta en `localStorage`
- **THEN** el mock siembra un fixture coherente: al menos una hoja de ruta del día con recorridos ligados a `vehiculoId`/`conductorId`/`pacienteId` que existen en los fixtures de vehículos/conductores/pacientes, con al menos un vehículo habilitado y un conductor operando, y con coordenadas fixture para el mapa

#### Scenario: Persistencia entre recargas
- **WHEN** se crea o actualiza una hoja de ruta y luego se vuelve a leer tras una recarga simulada
- **THEN** el cambio persiste porque se guardó en `localStorage`

#### Scenario: Mismatch de schemaVersion
- **WHEN** el payload almacenado tiene un `schemaVersion` distinto al esperado o está corrupto
- **THEN** el mock re-siembra desde el fixture en vez de romper la deserialización

### Requirement: Señalización de la discrepancia con el docx
El sistema SHALL mostrar el componente `AvisoModeloDatos` en la pantalla de hoja de ruta, indicando que el modelo real (`docs/core/Traslados-Modelo-Datos.docx`) no tiene entidad "Hoja de Ruta" y que su "Historial de Recorridos" no tiene campo Conductor, por lo que `conductorId` es un campo agregado pendiente de confirmar con el dueño del docx.

#### Scenario: Cartel visible en la pantalla de hoja de ruta
- **WHEN** se abre la pantalla de armado de la hoja de ruta
- **THEN** se muestra `AvisoModeloDatos` con el texto de la discrepancia (no hay entidad "Hoja de Ruta"; falta Conductor en el Historial del docx), coherente con `knowledge-base/04_modelo_de_datos.md §Discrepancias` y `CHANGES.md §C-10`
