## MODIFIED Requirements

### Requirement: Pantalla de alta, edición y listado de conductores
El sistema SHALL proveer una pantalla en `frontend/src/features/conductores/` que liste los conductores **de a página** y permita darlos de alta y editarlos, consumiendo `ConductorRepository` vía context (nunca el mock directamente), con estados de carga, vacío, error y "sin coincidencias". El listado SHALL seguir el patrón de fila clickeable + detalle ya usado en Vehículos / Obras Sociales (`08_arquitectura_propuesta.md`).

El listado MUST resolverse contra `ConductorRepository.listPage()` con orden determinista (apellido, nombre y `id` como desempate) y MUST mostrar el `Paginador` con el total real de coincidencias. La búsqueda MUST resolverse en la consulta (server-side), NUNCA con un filtro en memoria sobre la página ya traída.

`ConductorRepository.list()` SHALL permanecer disponible y sin cambios para el dashboard, que agrega sobre el universo completo de conductores.

#### Scenario: Listado con estado vacío
- **WHEN** el repository resuelve un total de 0 conductores y no hay búsqueda activa
- **THEN** la pantalla muestra un estado vacío explícito, no una tabla en blanco ni un loading infinito

#### Scenario: Fila de listado clickeable
- **WHEN** la administradora hace click sobre la fila de un conductor
- **THEN** se abre/expande su detalle; el botón "Editar" dentro de la fila usa `stopPropagation` para no colisionar con el click de la fila

#### Scenario: Alta de conductor con datos personales
- **WHEN** la administradora completa apellido, nombre y documento y guarda
- **THEN** el conductor se crea vía `ConductorRepository.create` y el listado se recarga sobre la página vigente

#### Scenario: Error del repository visible
- **WHEN** una operación de create, update o `listPage` falla en el repository
- **THEN** la pantalla muestra un mensaje de error visible y no queda en estado de carga infinito

#### Scenario: Navegación entre páginas
- **WHEN** hay más conductores que el tamaño de página y la administradora avanza a la página siguiente
- **THEN** se emite una nueva consulta acotada al rango correspondiente y se muestran conductores distintos, sin repeticiones respecto de la página anterior

#### Scenario: Búsqueda resuelta en el servidor
- **WHEN** la administradora escribe un término de búsqueda
- **THEN** la consulta se re-emite con el término aplicado, el total refleja solo las coincidencias, el listado vuelve a la página 1, y aparecen también los conductores que estaban fuera de la primera página sin filtrar

#### Scenario: El dashboard sigue viendo todos los conductores
- **WHEN** el dashboard calcula sus datos de conductores
- **THEN** lo hace vía `list()` sobre el universo completo, sin recorte por página
</content>
