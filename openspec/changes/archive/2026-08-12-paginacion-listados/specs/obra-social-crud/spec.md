## MODIFIED Requirements

### Requirement: Listado de obras sociales
El sistema SHALL mostrar un listado **paginado** de las obras sociales existentes obtenido a través de `ObraSocialRepository.listPage()`, con estados de carga, vacío, error y "sin coincidencias" visibles (US-300, RF-300). Cada fila MUST seguir mostrando al menos nombre, CUIT del prestador y tipo de comprobante.

El listado MUST ordenarse de forma determinista (nombre y `id` como desempate) y MUST mostrar el `Paginador` con el total real de coincidencias. La búsqueda MUST resolverse en la consulta (server-side), NUNCA con un filtro en memoria sobre la página ya traída.

`ObraSocialRepository.list()` SHALL permanecer disponible y sin cambios para los consumidores que necesitan el catálogo completo: los selectores de obra social de Pacientes, Presupuestos y Facturación, y la resolución del nombre de la obra social asignada en el listado de pacientes.

#### Scenario: Carga inicial del listado
- **WHEN** el usuario abre la pantalla de obras sociales
- **THEN** se muestra un indicador de carga mientras `listPage()` está pendiente y luego la primera página de obras sociales junto con el total

#### Scenario: Listado vacío
- **WHEN** el total es 0 y no hay búsqueda activa
- **THEN** se muestra un estado vacío con la acción de crear la primera obra social

#### Scenario: Navegación entre páginas
- **WHEN** hay más obras sociales que el tamaño de página y el usuario avanza a la página siguiente
- **THEN** se emite una nueva consulta acotada al rango correspondiente y se muestran obras sociales distintas, sin repeticiones respecto de la página anterior

#### Scenario: Búsqueda resuelta en el servidor
- **WHEN** el usuario escribe un término de búsqueda
- **THEN** la consulta se re-emite con el término aplicado, el total refleja solo las coincidencias y el listado vuelve a la página 1

#### Scenario: Los selectores de obra social no se paginan
- **WHEN** una pantalla de Pacientes, Presupuestos o Facturación puebla su selector de obra social, o el listado de pacientes resuelve el nombre de la obra social asignada
- **THEN** lo hace vía `list()` y recibe el catálogo completo visible por RLS, sin recorte por página
</content>
