## ADDED Requirements

### Requirement: Integración de mapa con @vis.gl/react-google-maps
El sistema SHALL integrar un mapa usando `@vis.gl/react-google-maps` (framework obligatorio de la skill `google-maps-platform`), con `AdvancedMarkerElement` para las paradas, `mapId="DEMO_MAP_ID"`, la API key provista por env var (Maps Demo Key en este prototipo, nunca hardcodeada) y una altura CSS explícita para el `<Map>` mediante clases Tailwind v4. MUST NOT usar `google.maps.Marker`, `DirectionsService`, `DistanceMatrixService`, `Autocomplete`/`PlacesService` ni `Geocoder` JS legacy.

#### Scenario: Marcadores de paradas con AdvancedMarkerElement
- **WHEN** se renderiza el mapa de un recorrido con paradas
- **THEN** cada parada se dibuja con `AdvancedMarkerElement` (no `google.maps.Marker`), usando la `coordenadaOrigen` fixture de la parada, y el `<Map>` tiene `mapId="DEMO_MAP_ID"`

#### Scenario: API key por env var, nunca hardcodeada
- **WHEN** se inicializa el proveedor de mapas
- **THEN** la key se lee de una env var (`VITE_GOOGLE_MAPS_API_KEY`, Maps Demo Key en el prototipo) y no aparece hardcodeada en el código

#### Scenario: Mapa con altura visible
- **WHEN** se renderiza el `<Map>`
- **THEN** tiene una altura CSS explícita por clase Tailwind (no renderiza 0×0)

#### Scenario: Coordenadas fixture, no reales
- **WHEN** el mock provee las coordenadas de las paradas
- **THEN** son fixtures razonables (no ubicaciones reales geocodificadas) y esto queda documentado en `design.md`; el mock no llama a Places ni inventa lugares reales de Google

### Requirement: Sugerencia de orden de recogida por cercanía como lista editable (RN-HR-01)
El sistema SHALL ofrecer, mediante una función pura `sugerirOrdenPorCercania`, un orden de recogida sugerido por cercanía (vecino más cercano por distancia haversine sobre las coordenadas fixture) que se presenta como **lista editable** que la operadora puede reordenar libremente; el sistema NUNCA impone la ruta (RN-HR-01).

#### Scenario: Sugerencia como propuesta, no imposición
- **WHEN** la operadora pide sugerir el orden de recogida de un recorrido
- **THEN** el sistema calcula un orden por cercanía y lo aplica como propuesta a `ParadaRecorrido.orden`, dejando la lista completamente reordenable a mano (RN-HR-01)

#### Scenario: El operador reordena manualmente
- **WHEN** la operadora cambia el orden de las paradas a mano después de una sugerencia
- **THEN** el orden manual prevalece y se persiste; ninguna sugerencia posterior se aplica sin acción explícita del operador

#### Scenario: Función de orden pura y determinista
- **WHEN** se invoca `sugerirOrdenPorCercania` con un conjunto de paradas con coordenadas
- **THEN** el resultado depende solo de las coordenadas de entrada (sin red ni `localStorage`), permitiendo tests deterministas

#### Scenario: Alcance del ordenamiento como configuración no bloqueante
- **WHEN** se implementa el criterio de cercanía
- **THEN** el criterio (distancia en línea recta por ahora) queda como TODO/config documentado y no hardcodeado como definitivo, por ser una pregunta abierta de prioridad Media (RF-701, `10_preguntas_abiertas.md`)
