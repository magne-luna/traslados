## ADDED Requirements

> **⚠️ GOVERNANCE ALTO — dependencia de CP0 y CP2.** Este spec cubre los avisos visibles en
> pantalla que hacen explícitas decisiones pendientes de la usuaria/Enzo en `tasks.md` §0.1. Si se
> resuelve CP0 opción B (bloquear) o CP2 opción B (geocoding real), los requisitos correspondientes
> pierden vigencia y deben revisarse antes del apply.

### Requirement: Aviso de selectores de vehículo/conductor sobre datos fixture

El sistema SHALL mostrar el componente `AvisoModeloDatos` en `HojaDeRutaPage.tsx` indicando que los
selectores de Vehículo y Conductor siguen leyendo de `mockVehiculoRepository`/`mockConductorRepository`
mientras `integracion-conductores-vehiculos` no aterrice sus repositories reales, de modo que la flota
mostrada es un fixture transitorio y no el comportamiento final. Este aviso SHALL complementar —sin
duplicar— el cartel ya existente de la discrepancia `conductorId`. El requisito aplica si y solo si se
confirma CP0 opción A (swap parcial).

#### Scenario: Cartel visible en la pantalla de armado
- **GIVEN** la pantalla de armado de la hoja de ruta tras el swap parcial (CP0 opción A)
- **WHEN** se abre la pantalla
- **THEN** se muestra `AvisoModeloDatos` explicando que vehículo/conductor son datos fixture hasta que
  aterrice la integración de flota
- **AND** el mensaje es visible sin leer `knowledge-base/04_modelo_de_datos.md` ni `CHANGES.md`

#### Scenario: No se duplica el cartel de conductorId
- **GIVEN** el aviso de discrepancia `conductorId` ya presente en la pantalla
- **WHEN** se agrega el aviso de datos fixture
- **THEN** los dos carteles conviven sin repetir el mismo texto

### Requirement: Aviso de ausencia de coordenadas por diseño en el mapa

El sistema SHALL mostrar en `RecorridoMapa.tsx` (o en su contenedor `RecorridoCard.tsx`) un mensaje
explícito distinto del actual "No hay paradas con coordenadas para mostrar en el mapa todavía" cuando
la ausencia de coordenadas es por diseño — es decir, para toda hoja de ruta que venga del repository
real, cuyo mapeo siempre resuelve `coordenadaOrigen` como `undefined` (CP2 opción A recomendada). El
mensaje SHALL explicar que el mapa queda sin contenido porque las coordenadas no se persisten todavía
(geocoding real fuera de scope de este change), para que no se lea como un bug. Si la usuaria/Enzo
resuelve CP2 opción B (geocoding en este change), este requisito queda sin efecto y se revisa.

#### Scenario: Mapa vacío de una hoja real se explica como decisión, no como bug
- **GIVEN** una hoja de ruta cargada desde `SupabaseHojaDeRutaRepository` (CP2 opción A)
- **WHEN** `RecorridoMapa` filtra las paradas y ninguna tiene `coordenadaOrigen`
- **THEN** se muestra el mensaje de "sin coordenadas por diseño", distinto del estado vacío genérico

#### Scenario: La pantalla sobre fixtures conserva su mapa funcional
- **GIVEN** una hoja de ruta del mock cuyo fixture sí trae coordenadas (CP0 opción A, datos fixture)
- **WHEN** se renderiza `RecorridoMapa`
- **THEN** el mapa muestra sus paradas con coordenadas como hasta ahora
- **AND** el aviso de diseño solo aplica a hojas provenientes del repository real