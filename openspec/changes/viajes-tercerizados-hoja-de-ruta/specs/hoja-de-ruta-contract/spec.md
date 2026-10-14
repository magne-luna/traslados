## MODIFIED Requirements

### Requirement: Tipos del dominio de Hojas de Ruta y Recorridos
El sistema SHALL definir los tipos TypeScript del dominio en `frontend/src/shared/types/hojaDeRuta.ts`, en modo strict y sin usar `any`. MUST incluir `HojaDeRuta` (`id`, `fecha`, `franjaInicio`, `franjaFin`, `notas?`, `recorridos: Recorrido[]`), `Recorrido` (`id`, `manual: boolean`, `notas?`, `paradas: ParadaRecorrido[]` y su tipo de transporte: `propio` con `vehiculoId` y `conductorId`, `aplicacion` sin vehículo ni conductor, o `remis` con `agenciaRemis` y sin vehículo ni conductor — RN-HR-05), `ParadaRecorrido` (`id`, `pacienteId`, `tramo`, `direccionOrigenId`, `direccionDestinoId`, `orden`, `coordenadaOrigen?`) y `Coordenada` (`{ lat: number; lng: number }`), reutilizando `Tramo`/`Direccion` de `paciente.ts`, `AccesorioMovilidad`/`EstadoVehiculo` de `vehiculo.ts` y `EstadoConductor` de `conductor.ts` (cruce de `04_modelo_de_datos.md §HojaDeRuta/Recorrido` con `docs/core/Traslados-Modelo-Datos.docx §Recorridos/Historial de Recorridos`).

#### Scenario: Recorrido propio referencia vehículo y conductor por id
- **WHEN** se declara un `Recorrido` de tipo `propio`
- **THEN** contiene `vehiculoId: string` y `conductorId: string` (no embebe `Vehiculo` ni `Conductor`), y `conductorId` queda marcado como campo agregado sobre el docx (design.md Discrepancia 2)

#### Scenario: Recorrido tercerizado sin vehículo ni conductor
- **WHEN** se declara un `Recorrido` de tipo `aplicacion` o `remis`
- **THEN** el tipo no permite leer `vehiculoId`/`conductorId` sin antes distinguir el tipo de transporte, y un `remis` exige `agenciaRemis: string`; el tipo de transporte y la agencia quedan marcados como campos agregados sobre el docx

#### Scenario: Direcciones de origen y destino independientes por tramo
- **WHEN** se declara `ParadaRecorrido`
- **THEN** tiene `tramo: Tramo` y referencia `direccionOrigenId` y `direccionDestinoId` de forma independiente, sin ningún campo que derive la vuelta invirtiendo la ida (RN-HR-02)

#### Scenario: Reutilización de tipos de los maestros, no redefinición
- **WHEN** se declaran los tipos de `hojaDeRuta.ts`
- **THEN** `Tramo`/`Direccion` se importan de `paciente.ts`, `AccesorioMovilidad`/`EstadoVehiculo` de `vehiculo.ts` y `EstadoConductor` de `conductor.ts`, sin redefinirlos localmente

#### Scenario: Tipos de entrada sin id
- **WHEN** se declaran los payloads de creación (`NuevaHojaDeRuta`, `NuevoRecorrido`, `NuevaParadaRecorrido`)
- **THEN** ninguno incluye `id`; el `id` lo asigna la implementación del repository, y `NuevoRecorrido` conserva la distinción por tipo de transporte de `Recorrido`
