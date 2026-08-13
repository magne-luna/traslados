# listado-paginado-contract Specification

## Purpose
TBD - created by archiving change paginacion-listados. Update Purpose after archive.
## Requirements
### Requirement: Tipos del contrato de paginación
El sistema SHALL definir en `frontend/src/shared/types/paginacion.ts`, en modo strict y sin usar `any`, los tipos `RangoPagina` (`pagina: number` **1-based**, `tamanio: number`) y `Pagina<T>` (`items: T[]`, `total: number`, `pagina: number`, `tamanio: number`). El campo `total` MUST representar la cantidad de filas que satisfacen el filtro aplicado, NUNCA la cantidad de filas devueltas en `items`.

#### Scenario: Página numerada desde 1
- **WHEN** se declara `RangoPagina`
- **THEN** `pagina` se documenta como 1-based (la primera página es `1`, nunca `0`), de modo que el valor coincida con lo que la UI le muestra a la usuaria

#### Scenario: El total describe el universo filtrado, no la página
- **WHEN** una consulta con filtro devuelve 20 items de 137 coincidencias
- **THEN** `total` vale `137` y `items.length` vale `20`

### Requirement: Método `listPage` aditivo, sin modificar `list()`
El sistema SHALL agregar `listPage(query)` a los repositories alcanzados por este change, MANTENIENDO intacta la firma de `list(): Promise<T[]>`. Los consumidores que necesitan el universo completo (selectores/combos de formularios y agregaciones del dashboard) MUST seguir usando `list()` sin cambio alguno.

#### Scenario: Los selectores siguen recibiendo todas las filas
- **WHEN** un formulario puebla un combo de pacientes vía `PacienteRepository.list()`
- **THEN** recibe todas las filas visibles por RLS, sin recorte por página, aunque la pantalla de listado de pacientes esté paginada

#### Scenario: Las agregaciones del dashboard no se ven afectadas
- **WHEN** el dashboard calcula alertas de CUD o de mantenimiento sobre `list()`
- **THEN** la agregación se hace sobre el universo completo y su resultado no cambia por la introducción de `listPage`

#### Scenario: Firma explícita en el sitio de llamada
- **WHEN** un consumidor necesita una página
- **THEN** invoca `listPage(...)` por nombre; NO existe un parámetro opcional en `list()` que altere silenciosamente cuántas filas devuelve

### Requirement: Paginación resuelta en el servidor
El sistema SHALL resolver la paginación en la consulta a la base de datos, usando `.range(desde, hasta)` de supabase-js. Una implementación de `listPage` NEVER debe traer el conjunto completo de filas y recortarlo en memoria del cliente cuando el transporte permite acotarlo en el servidor.

#### Scenario: La consulta acota el rango
- **WHEN** se invoca `listPage({ pagina: 3, tamanio: 20, filtros })` sobre un repository de PostgREST directo
- **THEN** la consulta emitida incluye `.range(40, 59)` y el servidor devuelve como máximo 20 filas

#### Scenario: Función pura de conversión página → rango
- **WHEN** se convierte `{ pagina, tamanio }` al par `{ desde, hasta }` que espera `.range()`
- **THEN** la conversión la resuelve una función pura testeable sin red (`rangoSupabase`), donde `desde = (pagina - 1) * tamanio` y `hasta = desde + tamanio - 1`

#### Scenario: Página fuera de rango
- **WHEN** se pide una página posterior a la última existente
- **THEN** `listPage` resuelve con `items` vacío y el `total` real (no lanza excepción ni deja la pantalla en carga infinita)

### Requirement: Orden total determinista en toda consulta paginada
El sistema SHALL aplicar en cada consulta paginada un `ORDER BY` explícito que incluya SIEMPRE `id` como criterio final de desempate. Sin orden total, la paginación por offset devuelve filas repetidas entre páginas y filas que nunca se muestran.

#### Scenario: Desempate por id
- **WHEN** dos filas comparten el valor de todas las columnas de orden de negocio (por ejemplo, mismo apellido y mismo nombre)
- **THEN** el orden entre ellas queda determinado por `id`, y es el mismo en cualquier consulta posterior

#### Scenario: Páginas consecutivas sin solapamiento ni huecos
- **WHEN** se piden dos páginas consecutivas del mismo conjunto sin que los datos cambien
- **THEN** ningún `id` aparece en ambas páginas, y la unión de todas las páginas reconstruye exactamente el conjunto de tamaño `total`

#### Scenario: El mismo orden en la implementación real y en el mock
- **WHEN** se compara el orden devuelto por la implementación Supabase con el del mock para el mismo conjunto de datos
- **THEN** ambos ordenan por los mismos criterios y en la misma dirección, de modo que un test en verde contra el mock no oculte un comportamiento distinto en producción

### Requirement: Total de resultados en la misma consulta
El sistema SHALL obtener el total de filas coincidentes en la MISMA consulta que trae la página, usando `{ count: 'exact' }`, sin emitir un segundo request de conteo.

#### Scenario: Total y página en un solo viaje
- **WHEN** se invoca `listPage`
- **THEN** se emite una única consulta de lectura del listado que devuelve tanto las filas de la página como el total, y el `Pagina<T>` resultante los expone juntos

#### Scenario: El total refleja el filtro aplicado
- **WHEN** hay un término de búsqueda activo
- **THEN** el `total` cuenta solo las filas que coinciden con ese término, no todas las filas de la tabla

### Requirement: Filtro de búsqueda compartido entre implementaciones
El sistema SHALL implementar la semántica de búsqueda por término en una función pura compartida, consumida tanto por la implementación Supabase como por la mock, de modo que exista una única definición de "qué matchea" y no dos que puedan desincronizarse.

#### Scenario: Término tokenizado
- **WHEN** el término de búsqueda contiene varias palabras separadas por espacios
- **THEN** cada token debe coincidir con alguna de las columnas buscables (conjunción de disyunciones), de modo que el orden en que se escriben nombre y apellido no altere el resultado

#### Scenario: Término vacío
- **WHEN** el término de búsqueda está vacío o es solo espacios
- **THEN** no se aplica ningún filtro y el `total` es el universo completo visible por RLS

#### Scenario: Una sola definición de la semántica
- **WHEN** se cambia la semántica de matcheo
- **THEN** el cambio ocurre en un único módulo puro y ambas implementaciones (Supabase y mock) lo heredan sin edición duplicada
</content>

