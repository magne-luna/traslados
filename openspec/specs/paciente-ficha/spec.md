# Paciente Ficha

## Purpose

Define the requirements for the patient record (ficha) UI, covering patient list, detailed view, and edit form. Includes full patient profile (personal, clinical, mobility, social work, contact), CUD expiration alert, dependent persons, and judicial protection. Ensures sensitive data sections (CUD, dependents) are isolable for future RLS gating. Handles loading, empty, and error states explicitly.

---
## Requirements
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

### Requirement: Ficha completa del paciente
El sistema SHALL permitir crear y editar la ficha de un paciente con datos personales (apellido, nombre, fecha de nacimiento, DNI, CUIL del titular), datos clínicos (diagnóstico/condición), accesorio de movilidad, obra social asignada, teléfono alternativo del responsable y flag de amparo judicial. El formulario MUST validar los campos requeridos en UI (al menos apellido, nombre y DNI), bloqueando el guardado y señalando los faltantes, y MUST manejar el error del repository con un mensaje visible sin loading infinito.

#### Scenario: Validación de requeridos
- **WHEN** el usuario intenta guardar sin apellido, nombre o DNI
- **THEN** el guardado se bloquea y se señalan los campos faltantes

#### Scenario: Selección de obra social e identificador de afiliado adaptable
- **WHEN** el usuario asigna una obra social al paciente
- **THEN** puede cargar el identificador de afiliado eligiendo su formato (número de documento, alfanumérico o CUIL con sufijo), con un formato por defecto editable, sin que el sistema imponga un único formato fijo

#### Scenario: Amparo judicial con aclaración
- **WHEN** el usuario marca el flag de amparo judicial
- **THEN** puede registrar una aclaración asociada, y el flag queda persistido en la ficha

### Requirement: Alerta de vencimiento del CUD
El sistema SHALL mostrar en la ficha el CUD del paciente (número, emisión, vencimiento) y una señal visible de su estado de vigencia derivada de la función pura de estado del CUD, destacando los casos `por-vencer` y `vencido` (RF-104).

#### Scenario: CUD por vencer se destaca
- **WHEN** el CUD del paciente está `por-vencer` o `vencido` según la fecha actual
- **THEN** la ficha muestra una alerta visible (p. ej. un chip de advertencia/peligro) diferenciada del estado `vigente`

### Requirement: Personas a cargo
El sistema SHALL permitir registrar una o más personas a cargo del paciente (nombre, apellido, DNI) como lista dinámica, con alta y baja de entradas. Al renderizar la lista, el sistema MUST usar un identificador estable por entrada como key (nunca el índice del array).

#### Scenario: Alta y baja de personas a cargo
- **WHEN** el usuario agrega o quita una persona a cargo
- **THEN** la lista se actualiza y el cambio se persiste con el paciente vía `update()`

### Requirement: Sensibilidad de datos clínicos y de menores
El sistema SHALL ubicar el CUD y las personas a cargo (datos de salud y potencialmente de menores de edad) en secciones identificables de la ficha, de modo que su visualización o edición pueda quedar gateada por permiso/RLS en FE-8. El diseño de la UI MUST NOT asumir acceso irrestricto a estos datos como premisa estructural.

#### Scenario: Secciones sensibles aisladas
- **WHEN** se compone la ficha del paciente
- **THEN** el CUD y las personas a cargo viven en secciones propias que pueden ocultarse o deshabilitarse por permiso sin reescribir el resto de la ficha

