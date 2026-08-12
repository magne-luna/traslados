## Purpose

Define el contrato de la caché compartida en memoria para las listas de referencia casi estáticas
del sistema (padrón de pacientes, flota de vehículos, nómina de conductores y padrón de obras
sociales): qué lecturas entran, cuánto tiempo se considera fresco un dato, cómo se deduplican las
peticiones concurrentes, y bajo qué condiciones el sistema DEBE volver a consultar el servidor para
no mostrarle a la usuaria un listado desactualizado después de una alta o una edición.

## ADDED Requirements

### Requirement: Alcance de la caché — solo listas de referencia completas

El sistema SHALL cachear únicamente las lecturas del **universo completo** de los cuatro dominios de
referencia: pacientes, vehículos, conductores y obras sociales. Toda otra lectura —resultados
paginados o filtrados, facturas, cobros, presupuestos, autorizaciones, hojas de ruta, documentos y
cuentas— MUST seguir consultando el servidor en cada invocación, sin pasar por la caché.

#### Scenario: Un dominio de referencia entra a la caché

- **WHEN** una pantalla solicita el listado completo de obras sociales para poblar un selector
- **THEN** la lectura se resuelve a través de la caché compartida del dominio `obrasSociales`

#### Scenario: Un listado paginado NO entra a la caché

- **WHEN** la pantalla de listado de Pacientes solicita una página concreta con un filtro de búsqueda
- **THEN** la consulta va al servidor sin consultar ni poblar la caché de referencia, porque su
  resultado depende de la página y del filtro vigentes

#### Scenario: Los datos transaccionales NO entran a la caché

- **WHEN** una pantalla solicita facturas, cobros, presupuestos, autorizaciones, hojas de ruta,
  documentos o cuentas
- **THEN** la lectura va al servidor en cada montaje, sin caché, porque su frescura es parte del
  requisito funcional del módulo

#### Scenario: Cada dominio tiene su propia entrada, independiente

- **WHEN** se invalida la caché del dominio `pacientes`
- **THEN** las entradas de `vehiculos`, `conductores` y `obrasSociales` permanecen intactas y no se
  vuelven a consultar

### Requirement: Deduplicación de peticiones concurrentes

Cuando dos o más consumidores solicitan el mismo dominio de referencia mientras una consulta de ese
dominio está en vuelo, el sistema SHALL emitir **una sola** consulta al servidor y entregarle el
mismo resultado a todos los solicitantes. NEVER debe emitirse una segunda consulta al mismo dominio
mientras la primera no haya resuelto.

#### Scenario: Dos componentes hermanos piden la misma lista en el mismo render

- **WHEN** dos componentes montados simultáneamente en la misma pantalla solicitan el listado
  completo de vehículos y la caché está vacía
- **THEN** se emite exactamente **una** consulta al servidor
- **AND** ambos componentes reciben el mismo listado cuando esa consulta resuelve

#### Scenario: Un montaje durante una consulta en vuelo se engancha a ella

- **WHEN** un tercer consumidor del mismo dominio se monta antes de que la consulta en vuelo resuelva
- **THEN** no se emite ninguna consulta adicional y ese consumidor recibe el resultado de la consulta
  ya en curso

#### Scenario: El fallo de la consulta compartida alcanza a todos los solicitantes

- **WHEN** la única consulta en vuelo falla y había tres consumidores esperándola
- **THEN** los tres reciben el mismo estado de error
- **AND** la petición en vuelo deja de estar registrada, de modo que un intento posterior SÍ emita una
  consulta nueva

### Requirement: Política de frescura — cache-first con vencimiento

El sistema SHALL considerar un dato de referencia **fresco** durante un plazo acotado y explícito
desde el momento en que se cargó. Mientras el dato sea fresco, una nueva solicitud del mismo dominio
MUST resolverse desde memoria **sin emitir ninguna consulta al servidor**. Vencido ese plazo, la
siguiente solicitud MUST volver a consultar el servidor.

El plazo MUST ser un valor único, declarado en un solo lugar y configurable sin tocar los
consumidores.

#### Scenario: Navegar y volver dentro del plazo no vuelve a consultar

- **WHEN** la usuaria abre una pantalla que carga el padrón de pacientes, navega a otra pantalla que
  también lo necesita, y vuelve a la primera, todo dentro del plazo de frescura
- **THEN** el padrón se consulta al servidor **una sola vez** en toda esa secuencia

#### Scenario: Pasado el plazo, se vuelve a consultar

- **WHEN** transcurre más tiempo que el plazo de frescura desde la última carga y un consumidor
  solicita ese dominio
- **THEN** el sistema emite una consulta nueva al servidor

#### Scenario: El plazo se cuenta desde la carga, no desde el último acceso

- **WHEN** un dato se carga y luego se lee repetidamente desde memoria
- **THEN** el vencimiento se calcula desde el instante de la carga; las lecturas desde memoria NEVER
  extienden la vigencia del dato

### Requirement: Revalidación en segundo plano sin estado de carga

Cuando un dato está vencido pero todavía hay una copia en memoria, el sistema SHALL entregar esa
copia **inmediatamente**, con el estado de carga en falso, y revalidar contra el servidor en segundo
plano. Cuando la revalidación resuelve, la pantalla MUST actualizarse con el dato nuevo. Una pantalla
que ya tenía contenido NEVER debe volver a un estado de carga vacío por un simple refresco.

#### Scenario: Dato vencido con copia en memoria — no hay parpadeo

- **WHEN** un consumidor solicita un dominio cuyo dato está vencido pero presente en memoria
- **THEN** recibe de inmediato el dato cacheado con estado de carga en falso
- **AND** la consulta de revalidación se emite en paralelo
- **AND** al resolver, el consumidor recibe el dato actualizado

#### Scenario: Primera carga sin dato en memoria — sí hay estado de carga

- **WHEN** un consumidor solicita un dominio que nunca se cargó en esta sesión
- **THEN** el estado de carga es verdadero hasta que la consulta resuelva, tal como se comportaba el
  sistema antes de existir la caché

#### Scenario: Un fallo de revalidación conserva el dato cacheado

- **WHEN** la revalidación en segundo plano falla y había una copia en memoria
- **THEN** el consumidor SIGUE viendo el dato cacheado
- **AND** además se expone el error, para que la pantalla pueda avisar que el dato puede estar
  desactualizado
- **AND** la pantalla NEVER queda vacía por un fallo de refresco

### Requirement: Toda mutación de un dominio invalida su caché

Toda operación que crea, modifica o elimina un registro de un dominio de referencia SHALL invalidar
la entrada de caché de ese dominio, de modo que la siguiente lectura —**desde cualquier pantalla**—
obtenga datos del servidor. Esto aplica **sin importar por qué camino se ejecute la mutación**,
incluidas las pantallas que operan sobre listados paginados.

#### Scenario: Un alta se ve en el selector de otra pantalla

- **WHEN** la usuaria da de alta una obra social desde la pantalla de Obras Sociales y luego abre la
  ficha de un paciente
- **THEN** la obra social recién creada aparece en el selector de obra social de esa ficha, sin
  recargar el navegador y sin esperar a que venza el plazo de frescura

#### Scenario: Una edición se refleja en las pantallas que ya la habían cacheado

- **WHEN** la usuaria edita el nombre de un vehículo y luego navega a una pantalla distinta que ya
  había cacheado la flota
- **THEN** esa pantalla muestra el nombre actualizado

#### Scenario: Una mutación hecha desde una pantalla paginada también invalida

- **WHEN** la usuaria crea o edita un paciente desde la pantalla de listado paginado de Pacientes
- **THEN** la caché del padrón completo de pacientes queda invalidada
- **AND** los selectores de pacientes de Presupuestos y Facturación reflejan el cambio en su
  siguiente montaje

#### Scenario: La invalidación no arrastra otros dominios

- **WHEN** se crea un conductor
- **THEN** solo la caché de conductores se invalida; pacientes, vehículos y obras sociales conservan
  su dato y su vigencia

### Requirement: Refresco explícito a pedido

El sistema SHALL exponer a cada consumidor una forma de forzar una consulta al servidor ignorando la
vigencia del dato cacheado, para que una pantalla pueda ofrecer un refresco manual o reintentar
después de un error.

#### Scenario: Refresco forzado con dato fresco en memoria

- **WHEN** un consumidor pide un refresco explícito y el dato cacheado todavía es fresco
- **THEN** se emite igualmente una consulta al servidor
- **AND** el resultado reemplaza el dato cacheado y reinicia su plazo de vigencia para todos los
  consumidores del dominio

#### Scenario: Reintento después de un error

- **WHEN** la carga inicial falló y el consumidor pide un refresco explícito
- **THEN** se emite una consulta nueva y el estado de error se limpia si esa consulta tiene éxito

### Requirement: La caché es de sesión y vive solo en memoria

La caché SHALL residir exclusivamente en memoria del proceso de la pestaña. NEVER debe persistirse
en `localStorage`, `sessionStorage`, IndexedDB, cookies ni ningún otro almacenamiento del cliente:
los dominios cacheados incluyen datos de salud y datos de personas menores de edad, y su persistencia
en el dispositivo es una decisión de privacidad que este contrato NO habilita.

#### Scenario: Recargar la pestaña vacía la caché

- **WHEN** la usuaria recarga la página o abre la aplicación en una pestaña nueva
- **THEN** la caché arranca vacía y el primer acceso a cada dominio consulta al servidor

#### Scenario: Cerrar sesión no deja datos de referencia en el dispositivo

- **WHEN** la sesión termina
- **THEN** no queda ningún registro de pacientes, vehículos, conductores ni obras sociales en el
  almacenamiento persistente del navegador atribuible a esta caché

### Requirement: La API pública de los consumidores no cambia

La introducción de la caché SHALL ser transparente para las pantallas: la forma del resultado que
consumen (datos, estado de carga, estado de error, refresco, crear, actualizar) MUST permanecer sin
cambios. Ninguna pantalla, ruta de composición, contexto de repository ni interfaz de repository
puede requerir modificación como consecuencia de este contrato.

#### Scenario: Las pantallas siguen recibiendo el universo completo

- **WHEN** un formulario puebla un combo con el listado completo de un dominio de referencia
- **THEN** recibe todas las filas visibles según RLS, sin recorte ni paginación, igual que antes

#### Scenario: Los estados de carga y error siguen expuestos

- **WHEN** una pantalla mostraba un indicador de carga o un mensaje de error basándose en el
  resultado del hook
- **THEN** sigue recibiendo esos mismos estados y sigue funcionando sin cambios en su código

### Requirement: Aislamiento del estado global entre tests

Al tratarse de estado compartido a nivel de módulo, la caché SHALL exponer una operación de limpieza
total, y la suite de tests MUST ejecutarla antes de cada test. NEVER debe un test observar datos
cacheados por un test anterior; el resultado de la suite NEVER debe depender del orden de ejecución.

#### Scenario: Un test no hereda la caché del anterior

- **WHEN** un test carga el padrón de pacientes y termina, y a continuación otro test monta un
  consumidor del mismo dominio con un repository distinto
- **THEN** el segundo test observa una caché vacía y su repository recibe la consulta

#### Scenario: Los tests que cuentan consultas siguen siendo deterministas

- **WHEN** un test verifica cuántas veces se consultó el repository
- **THEN** el conteo depende únicamente de lo que ocurre dentro de ese test
