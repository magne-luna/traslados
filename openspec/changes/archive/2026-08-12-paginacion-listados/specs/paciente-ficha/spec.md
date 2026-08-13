## MODIFIED Requirements

### Requirement: Listado de pacientes
El sistema SHALL mostrar un listado **paginado** de pacientes resuelto contra `PacienteRepository.listPage()`, con estados de carga, vacío, error y "sin coincidencias" explícitos. Cada tarjeta MUST seguir mostrando al menos apellido y nombre, DNI y la obra social asignada, y MUST conservar la convención de UI del proyecto: la tarjeta completa es clickeable para abrir el detalle y el botón "Editar" usa `stopPropagation` para no disparar la apertura del detalle.

La búsqueda por nombre o DNI MUST resolverse **en la consulta** (server-side), NUNCA con un filtro en memoria sobre las filas ya traídas: filtrar una página en el cliente mostraría solo las coincidencias que por azar cayeron en esa página. El listado MUST ordenarse de forma determinista (apellido, nombre y `id` como desempate) y MUST mostrar el `Paginador` con el total real de coincidencias.

El `PacienteRepository.list()` sin paginar SHALL permanecer disponible y sin cambios para los consumidores que necesitan el padrón completo: los selectores de paciente de Presupuestos, Facturación y Hojas de Ruta, y las alertas de CUD del dashboard.

#### Scenario: Estado de carga y vacío
- **WHEN** el listado está resolviendo `listPage()` o no hay pacientes cargados
- **THEN** se muestra un estado de carga durante la latencia y un estado vacío explícito con la acción de crear el primer paciente cuando el total es 0 (nunca una pantalla en blanco)

#### Scenario: Fila clickeable con Editar independiente
- **WHEN** la usuaria hace click en una tarjeta del listado
- **THEN** se abre el detalle del paciente; y **WHEN** hace click en "Editar" dentro de la tarjeta **THEN** se abre la edición sin togglear el detalle (el click no se propaga)

#### Scenario: Navegación entre páginas
- **WHEN** hay más pacientes que el tamaño de página y la usuaria avanza a la página siguiente
- **THEN** se emite una nueva consulta acotada al rango correspondiente y se muestran pacientes distintos a los de la página anterior, sin repeticiones

#### Scenario: Búsqueda resuelta en el servidor
- **WHEN** la usuaria escribe un término de búsqueda
- **THEN** la consulta se re-emite con el término aplicado, el total pasa a reflejar solo las coincidencias y el listado vuelve a la página 1

#### Scenario: Búsqueda por nombre y apellido combinados
- **WHEN** la usuaria busca un término de varias palabras que abarca nombre y apellido de un mismo paciente
- **THEN** el paciente aparece entre los resultados, independientemente del orden en que se escribieron las palabras

#### Scenario: Búsqueda por DNI
- **WHEN** la usuaria escribe un fragmento de DNI
- **THEN** se muestran los pacientes cuyo DNI contiene ese fragmento, aunque estén fuera de la primera página del listado sin filtrar

#### Scenario: Búsqueda sin coincidencias
- **WHEN** ningún paciente coincide con el término
- **THEN** se indica explícitamente que ningún paciente coincide con la búsqueda, distinguiéndolo del estado "no hay pacientes cargados"

#### Scenario: Los selectores de paciente no se paginan
- **WHEN** una pantalla de Presupuestos, Facturación u Hojas de Ruta puebla su selector de paciente
- **THEN** lo hace vía `list()` y recibe el padrón completo visible por RLS, sin recorte por página
</content>
