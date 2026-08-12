## ADDED Requirements

### Requirement: Hook compartido de listado paginado
El sistema SHALL proveer un hook `usePaginaListado` en `frontend/src/shared/lib/paginacion/` que concentre el estado de un listado paginado: página actual, tamaño de página, término de búsqueda crudo, término aplicado (debounceado), total, y los estados de carga y error. Las pantallas de listado MUST consumir este hook en lugar de reimplementar el estado de paginación.

#### Scenario: Carga de una página
- **WHEN** la pantalla se monta o la usuaria cambia de página
- **THEN** el hook invoca `listPage` con la página y el tamaño vigentes, expone `loading` mientras la promesa está pendiente y publica `items` y `total` al resolver

#### Scenario: Error del repository sin carga infinita
- **WHEN** `listPage` rechaza
- **THEN** el hook expone un mensaje de error en castellano y deja `loading` en `false` (nunca una pantalla en carga perpetua)

### Requirement: Reset de página al cambiar el filtro
El sistema SHALL volver a la página 1 cada vez que cambia el término de búsqueda o cualquier filtro del listado.

#### Scenario: Buscar estando en una página alta
- **WHEN** la usuaria está en la página 5 y escribe un término que tiene 3 coincidencias en total
- **THEN** el listado vuelve a la página 1 y muestra las 3 coincidencias, en vez de mostrar una página vacía que parecería un listado sin resultados

#### Scenario: Limpiar la búsqueda
- **WHEN** la usuaria borra el término de búsqueda
- **THEN** el listado vuelve a la página 1 del universo completo

### Requirement: Debounce de la búsqueda server-side
El sistema SHALL aplicar un retardo (debounce) al término de búsqueda antes de emitir la consulta, para no generar un request por cada tecla. El retardo MUST ser un parámetro inyectable, de modo que los tests lo controlen sin depender de esperas reales.

#### Scenario: Tecleo continuo emite una sola consulta
- **WHEN** la usuaria escribe varios caracteres seguidos dentro de la ventana de debounce
- **THEN** se emite una única consulta con el término final, no una por carácter

#### Scenario: El input responde de inmediato
- **WHEN** la usuaria escribe
- **THEN** el valor visible en el campo de búsqueda se actualiza sin retardo, aunque la consulta se difiera (el debounce afecta la consulta, nunca la escritura)

### Requirement: Componente Paginador del design system
El sistema SHALL proveer un componente `Paginador` en `frontend/src/design-system/`, presentacional y sin estado propio, que muestre la página actual sobre el total de páginas, la cantidad total de resultados, y controles de página anterior y siguiente. MUST estar estilado exclusivamente con clases utilitarias de Tailwind v4 (NUNCA `style={{}}` inline) y MUST quedar registrado en el catálogo vivo `DesignSystem.tsx`.

#### Scenario: Indicación de posición y total
- **WHEN** se muestra la página 3 de un conjunto de 137 resultados con tamaño 20
- **THEN** el paginador indica la página actual, la cantidad de páginas y el total de resultados en texto legible

#### Scenario: Extremos deshabilitados, no ocultos
- **WHEN** la usuaria está en la primera o en la última página
- **THEN** el control correspondiente queda deshabilitado y visible (no se oculta), para que el layout no se mueva entre páginas

#### Scenario: Operable por teclado y sin depender del color
- **WHEN** la usuaria navega con teclado
- **THEN** los controles del paginador son alcanzables y accionables, y el estado deshabilitado se comunica además del color (atributo `disabled` y texto), sin usar el color como único canal

#### Scenario: Una sola página
- **WHEN** el total de resultados entra en una sola página
- **THEN** el paginador no ofrece navegación pero sigue informando el total de resultados

### Requirement: Estados de listado paginado explícitos
El sistema SHALL distinguir visualmente tres situaciones que hoy se confunden en un único estado vacío: listado sin datos, búsqueda sin coincidencias, y página vigente sin filas.

#### Scenario: Sin datos cargados
- **WHEN** el total es 0 y no hay término de búsqueda
- **THEN** se muestra el estado vacío con la acción de crear el primer registro

#### Scenario: Búsqueda sin coincidencias
- **WHEN** el total es 0 y hay un término de búsqueda activo
- **THEN** se indica que ningún registro coincide con ese término, y el paginador no ofrece navegación

#### Scenario: El paginador no aparece durante la carga inicial
- **WHEN** la primera consulta todavía está pendiente y el total aún no se conoce
- **THEN** se muestra el estado de carga y no un paginador con totales en cero
</content>
