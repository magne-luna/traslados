## ADDED Requirements

### Requirement: Pantalla de administración de cuentas
El sistema SHALL proveer una pantalla en `/cuentas`, accesible únicamente para cuentas con rol `admin`, que liste todas las cuentas del sistema con su nombre, apellido, email, rol y los módulos a los que tiene acceso con su nivel. La pantalla MUST seguir el patrón list+detail del resto de la aplicación y MUST componerse con los componentes del design system existentes, sin markup ni estilos duplicados y sin estilos en línea.

#### Scenario: Listado visible para la administradora
- **WHEN** una cuenta con rol `admin` navega a `/cuentas`
- **THEN** se muestra el listado de cuentas con nombre, email, rol y los módulos habilitados de cada una

#### Scenario: Acceso denegado para empleados
- **WHEN** una cuenta con rol `empleado` navega a `/cuentas`
- **THEN** el sistema muestra la pantalla de acceso denegado y no realiza ninguna consulta de cuentas

#### Scenario: Selección de una cuenta
- **WHEN** la administradora selecciona una fila del listado
- **THEN** se muestra el detalle de esa cuenta con su perfil y su matriz de permisos

### Requirement: Alta de cuenta mediante la Edge Function create-user
El sistema SHALL crear cuentas exclusivamente a través de la Edge Function `create-user`, enviando `email`, `password`, `nombre`, `apellido` y opcionalmente el conjunto inicial de permisos. El sistema NO MUST usar registro público ni escribir en `auth.users` ni en `usuarios.usuarios` desde el frontend.

#### Scenario: Alta exitosa
- **WHEN** la administradora completa el formulario de alta con datos válidos y confirma
- **THEN** el sistema invoca `create-user` con el token de la sesión activa y, ante una respuesta correcta, la cuenta nueva aparece en el listado

#### Scenario: Contraseña demasiado corta
- **WHEN** la administradora ingresa una contraseña de menos de 8 caracteres
- **THEN** el formulario lo señala antes de enviar la petición, sin invocar la Edge Function

#### Scenario: Campos obligatorios incompletos
- **WHEN** falta el email, el nombre o el apellido
- **THEN** el formulario señala los campos faltantes y no invoca la Edge Function

### Requirement: Matriz de permisos por cuenta
El sistema SHALL presentar, para la cuenta seleccionada, una matriz con los cuatro módulos del sistema y el nivel asignado a cada uno, incluyendo la opción explícita "sin acceso". La edición MUST ser diferida y en línea (nunca en modal), y el guardado MUST enviarse a la Edge Function `update-permisos` como el conjunto completo deseado, respetando su semántica de reemplazo total.

#### Scenario: Otorgar acceso a un módulo
- **WHEN** la administradora asigna nivel `write` sobre `facturacion` a una cuenta y guarda
- **THEN** el sistema invoca `update-permisos` con el conjunto completo de permisos resultante y refleja el nuevo estado al confirmarse

#### Scenario: Revocar acceso a un módulo
- **WHEN** la administradora cambia un módulo a "sin acceso" y guarda
- **THEN** ese módulo no se incluye en el conjunto enviado a `update-permisos`, quedando revocado por la semántica de reemplazo total

#### Scenario: Revocar todos los accesos
- **WHEN** la administradora deja todos los módulos en "sin acceso" y guarda
- **THEN** el sistema envía un conjunto de permisos vacío y la cuenta queda sin acceso a ningún módulo

#### Scenario: Cambios descartados
- **WHEN** la administradora modifica la matriz y cancela sin guardar
- **THEN** no se invoca ninguna Edge Function y la matriz vuelve al estado almacenado

### Requirement: Ninguna escritura directa de permisos desde el frontend
El sistema SHALL canalizar toda alta de cuenta y toda modificación de permisos por las Edge Functions `create-user` y `update-permisos`. El frontend NO MUST ejecutar `insert`, `update` ni `delete` sobre `modulos.permisos` ni sobre `usuarios.usuarios`, aunque la RLS vigente se lo permita a una cuenta `admin`.

#### Scenario: Revisión del código de escritura
- **WHEN** se inspecciona el código de la pantalla de cuentas
- **THEN** las únicas operaciones de escritura son invocaciones a `create-user` y `update-permisos`; las consultas directas a Supabase son de solo lectura

### Requirement: Manejo de errores de las Edge Functions
El sistema SHALL mostrar en la interfaz el mensaje del campo `error` que devuelven las Edge Functions, sin reemplazarlo por texto genérico, y MUST distinguir los casos de sesión expirada (401), falta de privilegios (403), cuenta inexistente (404) y datos inválidos (400).

#### Scenario: Sesión expirada durante la operación
- **WHEN** una invocación responde 401
- **THEN** el sistema informa que la sesión expiró y lleva al usuario a iniciar sesión nuevamente

#### Scenario: Cuenta sin privilegios
- **WHEN** una invocación responde 403
- **THEN** el sistema informa que solo la administradora puede realizar esa acción, sin alterar el estado mostrado

#### Scenario: Cuenta inexistente
- **WHEN** `update-permisos` responde 404
- **THEN** el sistema informa que la cuenta ya no existe y recarga el listado

#### Scenario: Validación rechazada por el backend
- **WHEN** una invocación responde 400
- **THEN** el sistema muestra el mensaje de error devuelto por la Edge Function tal como llega

### Requirement: Estados de carga, error y vacío
El sistema SHALL representar explícitamente los estados de carga, error y listado vacío de la pantalla de cuentas, sin dejar áreas en blanco. Los controles que disparan operaciones de escritura MUST deshabilitarse mientras la operación está en curso, para impedir envíos duplicados.

#### Scenario: Carga del listado en curso
- **WHEN** la consulta de cuentas todavía no resolvió
- **THEN** se muestra un indicador de carga en lugar de un área vacía

#### Scenario: Fallo de la consulta
- **WHEN** la consulta de cuentas falla
- **THEN** se muestra un mensaje de error con la posibilidad de reintentar

#### Scenario: Envío en curso
- **WHEN** una operación de alta o de guardado de permisos está en curso
- **THEN** el control que la disparó queda deshabilitado hasta que la operación termine

### Requirement: Accesibilidad de la pantalla de cuentas
El sistema SHALL cumplir WCAG 2.1 AA en la pantalla de cuentas: HTML semántico antes que ARIA, operación completa por teclado con orden de tabulación lógico, indicadores de foco visibles y contraste mínimo de 4.5:1 para texto normal y 3:1 para componentes de interfaz.

#### Scenario: Operación por teclado
- **WHEN** el usuario recorre la pantalla usando solo el teclado
- **THEN** puede seleccionar una cuenta, modificar cada nivel de la matriz y guardar, con el foco siempre visible

#### Scenario: Etiquetado de los controles de la matriz
- **WHEN** un lector de pantalla recorre la matriz de permisos
- **THEN** cada control anuncia a qué módulo corresponde y qué nivel tiene seleccionado
