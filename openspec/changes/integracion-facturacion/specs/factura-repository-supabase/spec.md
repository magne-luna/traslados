## ADDED Requirements

### Requirement: Implementación real SupabaseFacturaRepository

El sistema SHALL proveer una implementación de `FacturaRepository` en
`frontend/src/shared/lib/facturacion/SupabaseFacturaRepository.ts` que lea y escriba contra el schema
`facturacion` de Supabase usando el cliente compartido `frontend/src/shared/lib/supabaseClient.ts`
(`anon key` + sesión del usuario). La implementación MUST cumplir las cinco firmas de la interfaz
(`list`, `getById`, `listByPaciente`, `create`, `update`) sin modificarlas, sin agregar métodos y sin
cambiar la forma de `FacturaRepository.ts`. La implementación MUST NOT usar `any`, `as` sobre datos
externos, ni la `SUPABASE_SERVICE_ROLE_KEY`.

#### Scenario: Las firmas de la interfaz no cambian

- **GIVEN** la interfaz `FacturaRepository` existente
- **WHEN** se compila con `npx tsc -b --noEmit` en `frontend/`
- **THEN** el objeto exportado tipa como `FacturaRepository` sin casts ni `any`
- **AND** `FacturaRepository.ts` no fue modificado

#### Scenario: Nunca se usa una clave privilegiada en el frontend

- **GIVEN** el código fuente de `SupabaseFacturaRepository.ts`
- **WHEN** se inspecciona su texto
- **THEN** no contiene `service_role` ni ninguna creación de cliente propia
- **AND** importa el singleton `supabase` de `shared/lib/supabaseClient.ts`

#### Scenario: El repository no reimplementa el control de acceso

- **GIVEN** el código fuente de `SupabaseFacturaRepository.ts` y `SupabaseCobroRepository.ts`
- **WHEN** se inspecciona su texto
- **THEN** no consultan `modulos.permisos` ni `modulos.modulos`
- **AND** el gateo por permiso queda enteramente a cargo de las policies de RLS del servidor

### Requirement: Implementación real SupabaseCobroRepository

El sistema SHALL proveer una implementación de `CobroRepository` en
`frontend/src/shared/lib/facturacion/SupabaseCobroRepository.ts` que persista los cobros en la tabla
`facturacion.cobros`, cumpliendo las cuatro firmas de la interfaz (`list`, `listByFactura`, `create`,
`remove`) sin modificarlas. El sistema MUST mapear la columna `facturas_id` (nombre plural del schema
real) al campo `facturaId` del dominio.

#### Scenario: El listado global de cobros no dispara una consulta por factura

- **GIVEN** un usuario con permiso `facturacion: read` y cobros de varias facturas
- **WHEN** se invoca `list()`
- **THEN** se emite una sola consulta a `facturacion.cobros` sin filtro
- **AND** el resultado incluye los cobros de todas las facturas visibles

#### Scenario: Los cobros de una factura se filtran por la columna plural del schema real

- **WHEN** se invoca `listByFactura(facturaId)`
- **THEN** el filtro se aplica sobre la columna `facturas_id`
- **AND** cada `Cobro` devuelto expone ese valor como `facturaId`

#### Scenario: Borrar un cobro lo elimina de la base

- **GIVEN** un cobro persistido y un usuario con permiso `facturacion: write`
- **WHEN** se invoca `remove(id)`
- **THEN** la fila se borra de `facturacion.cobros`
- **AND** una lectura posterior no la incluye

#### Scenario: Los cobros y las facturas provienen de la misma fuente

- **GIVEN** que la aplicación inyecta `SupabaseFacturaRepository`
- **WHEN** se inyectan los repositories en el punto de composición
- **THEN** también se inyecta `SupabaseCobroRepository`
- **AND** NO queda ninguna combinación de facturas reales con cobros de `localStorage`

### Requirement: Lectura de la factura completa en una sola consulta

El sistema SHALL resolver `list()`, `getById()` y `listByPaciente()` con una única consulta a
`facturacion.facturas` que embeba `asistencia_prestacion`. El sistema MUST NOT emitir una consulta
por factura ni por asistencia (patrón N+1). Dado que ambas tablas viven en el mismo schema, el sistema
MUST NOT necesitar una segunda consulta ni degradar parcialmente la lectura.

#### Scenario: Un listado de N facturas no dispara N consultas

- **GIVEN** un usuario con permiso `facturacion: read` y 3 facturas en la base
- **WHEN** se invoca `list()`
- **THEN** se emite una sola consulta a `facturacion.facturas` con el embed de asistencias
- **AND** las 3 vuelven con sus asistencias resueltas

#### Scenario: getById de un id inexistente resuelve a null

- **GIVEN** un id que no corresponde a ninguna factura
- **WHEN** se invoca `getById(id)`
- **THEN** la promesa resuelve a `null`
- **AND** NO se lanza ninguna excepción (contrato idéntico al del mock)

#### Scenario: RLS que filtra la fila se comporta como "no existe"

- **GIVEN** un usuario sin permiso `facturacion: read`
- **WHEN** se invoca `getById(id)` sobre una factura que sí existe en la base
- **THEN** la consulta devuelve 0 filas porque la policy de RLS la filtra
- **AND** `getById` resuelve a `null` en lugar de lanzar un error de permisos

#### Scenario: Las facturas de un paciente se filtran en el servidor

- **WHEN** se invoca `listByPaciente(pacienteId)`
- **THEN** el filtro por `paciente_id` se aplica en la consulta, no en memoria sobre `list()`

#### Scenario: Las asistencias vuelven en orden determinista

- **GIVEN** una factura con varias asistencias cargadas en cualquier orden
- **WHEN** se lee la factura
- **THEN** las asistencias quedan ordenadas por fecha ascendente
- **AND** dos asistencias con la misma fecha se desempatan por `id`, de forma estable entre lecturas

### Requirement: Mapeo en funciones puras y aisladas

El sistema SHALL implementar toda la traducción entre filas de Postgres y los tipos `Factura`,
`AsistenciaPrestacion` y `Cobro` en funciones puras exportadas desde
`frontend/src/shared/lib/facturacion/facturaMapping.ts`, sin efectos, sin lectura de reloj global y
sin acceso a red. Las funciones de parseo MUST angostar `unknown` con type guards explícitos, nunca
con `as`. Los repositories MUST quedar como cáscaras de I/O que solo arman la consulta, chequean
`error` y delegan en el mapeo.

#### Scenario: El mapeo se testea sin red ni mocks

- **WHEN** se ejecutan los tests de `facturaMapping.ts`
- **THEN** no se monta ningún fake del cliente de Supabase
- **AND** las funciones se invocan con objetos literales

#### Scenario: Una fila hija malformada no rompe la factura

- **GIVEN** una fila de `asistencia_prestacion` sin `fecha` o con una forma inesperada
- **WHEN** se ensambla la factura
- **THEN** esa asistencia se descarta
- **AND** la factura se devuelve con el resto de sus asistencias, sin lanzar

#### Scenario: Las columnas nullables se resuelven con defaults documentados

- **GIVEN** una fila de `facturas` con columnas nullables en `NULL` (por ejemplo `monto`,
  `prestacion` o `dependencia_y_retorno`)
- **WHEN** se ensambla la factura
- **THEN** los campos textuales quedan como cadena vacía y los numéricos como `0`
- **AND** la factura resultante es coherente con el tipo `Factura`, sin `undefined` filtrándose a la UI

#### Scenario: El identificador congelado se arma desde dos columnas

- **GIVEN** una fila con `identificador_origen` e `identificador_valor` cargados
- **WHEN** se ensambla la factura
- **THEN** `identificadorFactura` es un objeto `{ origen, valor }`
- **AND** si cualquiera de las dos columnas es `NULL`, `identificadorFactura` queda ausente

### Requirement: Mapeo bidireccional del enum de estado de la factura

El sistema SHALL traducir el enum `facturacion.estado_factura` de Postgres (cinco literales separados
por espacios) al tipo `EstadoFactura` del frontend (cuatro literales separados por guiones) mediante
funciones puras y **totales**. La lectura MUST tratar el literal `'pendiente'` como sinónimo de
`'a-facturar'` y MUST tolerar cualquier literal desconocido sin lanzar. La escritura MUST NOT emitir
nunca `'pendiente'`. El sistema MUST NOT modificar el enum de la base de datos.

#### Scenario: Los cinco literales de la base se leen sin romper

- **WHEN** se lee una fila con estado `'a facturar'`, `'pendiente'`, `'facturado'`, `'cobrado'` o
  `'pagado parcialmente'`
- **THEN** la factura resultante tiene, respectivamente, `'a-facturar'`, `'a-facturar'`,
  `'facturado'`, `'cobrado'` y `'pagado-parcialmente'`

#### Scenario: Un literal desconocido no rompe el listado

- **GIVEN** una fila con un valor de estado que el frontend no modela
- **WHEN** se lee la factura
- **THEN** el estado resuelve a `'a-facturar'`
- **AND** el listado se renderiza sin errores

#### Scenario: La escritura nunca produce el literal del docx que la UI no modela

- **WHEN** se persiste cualquiera de los cuatro estados del frontend
- **THEN** el valor enviado a la base es uno de `'a facturar'`, `'facturado'`, `'cobrado'` o
  `'pagado parcialmente'`
- **AND** nunca es `'pendiente'`

### Requirement: Alta y edición atómicas mediante funciones SECURITY INVOKER

El sistema SHALL implementar `create()` y `update()` de `FacturaRepository` como una única llamada
`rpc()` por operación, contra funciones de Postgres que escriban la factura y sus asistencias dentro
de una sola transacción. Las funciones MUST declararse `SECURITY INVOKER` de forma explícita y MUST
NOT usar `SECURITY DEFINER`. El sistema MUST NOT emitir inserciones separadas sobre
`asistencia_prestacion` desde el cliente.

#### Scenario: El alta emite una sola llamada de escritura

- **WHEN** se invoca `create(nuevaFactura)` con 5 asistencias
- **THEN** se emite exactamente una llamada `rpc()`
- **AND** no se emite ningún `insert()` sobre `asistencia_prestacion`

#### Scenario: Una escritura interrumpida no deja una factura sin sus asistencias

- **GIVEN** un alta cuyo insert de asistencias falla
- **WHEN** la transacción hace rollback
- **THEN** la factura tampoco queda persistida
- **AND** la base no contiene ninguna factura huérfana del alta fallida

#### Scenario: Editar solo el estado no borra las asistencias

- **GIVEN** una factura persistida con asistencias
- **WHEN** se invoca `update(id, { estado: 'facturado' })` sin la clave `asistencias`
- **THEN** las asistencias de la factura permanecen intactas
- **AND** la ausencia de la clave se distingue de una clave presente con valor nulo

#### Scenario: Enviar la colección de asistencias la reemplaza por completo

- **WHEN** se invoca `update(id, { asistencias: [...] })`
- **THEN** el conjunto anterior se reemplaza íntegramente dentro de la misma transacción

#### Scenario: Sin permiso de escritura la operación falla y no deja rastro parcial

- **GIVEN** un usuario con `facturacion: read` pero sin `facturacion: write`
- **WHEN** invoca `create()`
- **THEN** el servidor rechaza la escritura por RLS
- **AND** ninguna fila queda persistida en `facturas` ni en `asistencia_prestacion`

#### Scenario: La declaración de seguridad de las funciones está verificada automáticamente

- **WHEN** se ejecuta la suite de tests
- **THEN** un test lee el archivo `.sql` de las funciones desde el sistema de archivos
- **AND** verifica que declara `SECURITY INVOKER` y no contiene `SECURITY DEFINER` fuera de
  comentarios y literales

#### Scenario: Lo devuelto es lo que quedó realmente en la base

- **WHEN** `create()` o `update()` completan
- **THEN** el repository relee la factura por id y devuelve esa lectura
- **AND** los valores por defecto, triggers y normalizaciones del servidor quedan reflejados

### Requirement: Traducción de errores del servidor a mensajes de interfaz en castellano

El sistema SHALL traducir todo error de PostgREST o Postgres a un `Error` cuyo `message` esté en
castellano y sea apto para mostrarse directamente al usuario. El sistema MUST NOT propagar el texto
crudo del error del servidor a la interfaz. `getById` MUST NOT lanzar cuando no hay fila: resuelve a
`null`.

#### Scenario: RLS deniega la escritura

- **WHEN** el servidor responde `42501` o `PGRST301` ante una escritura
- **THEN** el error lanzado dice `No tenés permiso para modificar facturas.`

#### Scenario: La migración de las funciones no fue aplicada

- **WHEN** el servidor responde `PGRST202` porque la función no existe
- **THEN** el error lanzado dice que el alta de facturas no está habilitada en el servidor todavía

#### Scenario: La columna de fecha de emisión no fue aplicada

- **WHEN** el servidor responde `PGRST204` por una columna inexistente
- **THEN** el error lanzado dice que la fecha de emisión de factura no está habilitada en el servidor
  todavía

#### Scenario: Una referencia rota se explica en términos del dominio

- **WHEN** el servidor responde `23503` por `paciente_id` o por `domicilio_id`
- **THEN** el mensaje nombra el paciente o el domicilio, no la tabla ni la constraint

#### Scenario: El error de una factura inexistente coincide con el del mock

- **WHEN** se intenta actualizar una factura con un id que no existe
- **THEN** el mensaje es el mismo que produce la implementación mock

#### Scenario: Ningún mensaje expone nombres de tablas o columnas

- **WHEN** se recorren todos los mensajes de error del repository
- **THEN** ninguno contiene identificadores del esquema ni texto en inglés

### Requirement: Inyección de las implementaciones reales en el punto de composición

El sistema SHALL inyectar `SupabaseFacturaRepository` y `SupabaseCobroRepository` desde
`frontend/src/features/facturacion/FacturacionRoute.tsx`, el único archivo de producto que conoce qué
implementación se usa. Ningún componente, hook, context ni función pura de la feature MUST cambiar por
el swap. Las implementaciones mock MUST conservarse como dobles de test y para desarrollo sin backend.

#### Scenario: El swap toca un solo archivo de producto

- **WHEN** se compara el árbol antes y después del cableado
- **THEN** el único archivo de `features/facturacion/` modificado por el swap es `FacturacionRoute.tsx`
- **AND** los 26 componentes, los 3 hooks y los 2 contexts quedan sin cambios

#### Scenario: Las nueve funciones puras de reglas de negocio no se tocan

- **WHEN** se revisa el diff del change
- **THEN** ninguna de las funciones de reglas de negocio de `shared/lib/facturacion/` cambia
- **AND** ninguna regla de negocio se reimplementa en SQL

#### Scenario: Los mocks siguen disponibles

- **WHEN** se ejecutan los tests de la feature
- **THEN** los repositories mock siguen exportándose y siendo inyectables
- **AND** los tests no dependen de la red
