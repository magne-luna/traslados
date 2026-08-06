# Autorización Repository Supabase

## Purpose
Defines the real `AutorizacionRepository` implementation backed by the `autorizaciones` Edge Function, sharing its error-translation module with `presupuesto-repository-supabase`.

## Requirements

### Requirement: Implementación real SupabaseAutorizacionRepository

El sistema SHALL proveer una implementación de `AutorizacionRepository` en
`frontend/src/shared/lib/presupuestos/SupabaseAutorizacionRepository.ts` que lea y escriba contra la
Edge Function `autorizaciones` usando el cliente compartido
`frontend/src/shared/lib/supabaseClient.ts` (`anon key` + sesión del usuario) vía
`supabase.functions.invoke`. La implementación MUST cumplir las cinco firmas de la interfaz (`list`,
`getById`, `getByPresupuestoId`, `create`, `update`) sin modificarlas, sin agregar métodos y sin
cambiar la forma de `AutorizacionRepository.ts`. La implementación MUST NOT usar `any`, `as` sobre
datos externos, ni la `SUPABASE_SERVICE_ROLE_KEY`.

#### Scenario: Las firmas de la interfaz no cambian

- **GIVEN** la interfaz `AutorizacionRepository` existente
- **WHEN** se compila con `npx tsc -b --noEmit` en `frontend/`
- **THEN** el objeto exportado tipa como `AutorizacionRepository` sin casts ni `any`
- **AND** `AutorizacionRepository.ts` no fue modificado

#### Scenario: Nunca se usa una clave privilegiada en el frontend

- **GIVEN** el código fuente de `SupabaseAutorizacionRepository.ts`
- **WHEN** se inspecciona su texto
- **THEN** no contiene `service_role` ni ninguna creación de cliente propia
- **AND** importa el singleton `supabase` de `shared/lib/supabaseClient.ts`

### Requirement: getByPresupuestoId trata la ausencia de autorización como caso normal

El sistema SHALL resolver `getByPresupuestoId(presupuestoId)` invocando la Edge Function
`autorizaciones` con el filtro `?presupuestoId=`, con el id **percent-encoded**. Cuando la función
responde `404` —porque el presupuesto todavía no tiene autorización asociada, que es el estado inicial
esperado de todo presupuesto recién creado— el sistema MUST resolver a `null` y MUST NOT lanzar.

#### Scenario: Un presupuesto sin autorización resuelve a null

- **GIVEN** un presupuesto recién creado, sin autorización cargada
- **WHEN** se invoca `getByPresupuestoId(presupuestoId)`
- **THEN** la Edge Function responde `404`
- **AND** la promesa resuelve a `null` sin lanzar
- **AND** el detalle del presupuesto muestra el formulario de alta de autorización, no un error

#### Scenario: Un presupuesto con autorización devuelve la autorización

- **GIVEN** un presupuesto que ya tiene una autorización asociada
- **WHEN** se invoca `getByPresupuestoId(presupuestoId)`
- **THEN** se emite una sola invocación con el filtro `presupuestoId`
- **AND** se devuelve la `Autorizacion` mapeada

#### Scenario: Falta de permiso no se confunde con ausencia de autorización

- **GIVEN** un usuario sin permiso `presupuestos: read`
- **WHEN** se invoca `getByPresupuestoId(presupuestoId)`
- **THEN** la Edge Function responde `403`
- **AND** la promesa rechaza con un error de falta de permiso
- **AND** NO resuelve a `null`

### Requirement: Lectura del listado en una sola invocación

El sistema SHALL resolver `list()` con una **única** invocación `GET` a la Edge Function
`autorizaciones`, y MUST NOT emitir una invocación por autorización ni por presupuesto. Las filas que
no cumplen la forma esperada MUST descartarse individualmente.

#### Scenario: El listado de autorizaciones no dispara una invocación por presupuesto

- **GIVEN** una pantalla que resuelve el chip de estado de cada presupuesto del listado
- **WHEN** se invoca `list()` una vez
- **THEN** se emite una sola invocación a la función `autorizaciones`
- **AND** los estados de todos los presupuestos se resuelven contra esa única respuesta

#### Scenario: Una fila sin presupuesto asociado se descarta

- **GIVEN** una respuesta donde una autorización llega sin `presupuestoId`
- **WHEN** se mapea el listado
- **THEN** esa autorización se descarta
- **AND** el resto del listado se devuelve normalmente

### Requirement: El estado ausente adopta el default del servidor, no un valor inventado

El sistema SHALL mapear `estado` a `'pendiente'` cuando la respuesta lo trae nulo, ausente o con un
valor que no pertenece a la unión cerrada `EstadoAutorizacion`. El valor `'pendiente'` MUST elegirse
por ser el `DEFAULT` declarado de la columna `facturacion.autorizacion.estado`, y NO como una
convención propia del frontend.

#### Scenario: Estado nulo se lee como pendiente

- **GIVEN** una autorización cuya columna `estado` está en `NULL`
- **WHEN** se mapea
- **THEN** `estado` es `'pendiente'`

#### Scenario: Un estado desconocido no se propaga como string libre

- **GIVEN** una respuesta cuyo `estado` no pertenece a `EstadoAutorizacion`
- **WHEN** se mapea
- **THEN** `estado` es `'pendiente'`
- **AND** el tipo del campo sigue siendo la unión cerrada, nunca `string`

### Requirement: update propaga el 404 en lugar de absorberlo

El sistema SHALL lanzar un `Error` cuando `update(id, data)` recibe un `404`, con el **mismo** mensaje
que la implementación mock (`No existe una autorización con id "…".`). El sistema MUST NOT resolver
`update()` a `null` ni reportar un guardado exitoso ante un `404`.

#### Scenario: Editar una autorización inexistente lanza el mismo error que el mock

- **GIVEN** un id que no corresponde a ninguna autorización accesible
- **WHEN** se invoca `update(id, data)`
- **THEN** la promesa rechaza con un `Error` cuyo `message` nombra el id inexistente
- **AND** el mensaje es idéntico al que lanza la implementación mock

### Requirement: Actualización parcial que no pisa campos no tocados

El sistema SHALL construir el body del `PATCH` incluyendo **únicamente** las claves presentes en el
`ActualizacionAutorizacion` recibido. Una clave ausente MUST significar "no tocar" y MUST NOT viajar
en el body.

#### Scenario: Cambiar solo el estado no manda los cupos

- **GIVEN** un `update(id, { estado: 'autorizada' })`
- **WHEN** se construye el body de la invocación
- **THEN** el body contiene `estado` y ninguna otra clave
- **AND** `cupoMensualDias`, `cupoMensualKm`, `montoAutorizado`, `vigenciaDesde` y `archivoUrl` no
  aparecen

#### Scenario: Cargar la vigencia retroactiva no toca la fecha de respuesta

- **GIVEN** un `update(id, { vigenciaDesde: '2026-01-15' })`
- **WHEN** se construye el body
- **THEN** `fechaRespuesta` no viaja en el body
- **AND** el valor ya persistido de `fechaRespuesta` queda intacto

### Requirement: El rechazo de RN-PA-01 por el servidor se traduce a lenguaje de dominio

El sistema SHALL detectar el rechazo del trigger `facturacion.validar_autorizacion_monto` —que llega
como una respuesta `400` cuyo cuerpo contiene el texto crudo del `RAISE EXCEPTION` de Postgres— y
SHALL traducirlo a un mensaje en castellano que explique la regla en términos de negocio. El sistema
MUST NOT mostrar el texto original, que incluye el nombre de la columna y el código interno de la
regla.

#### Scenario: Una autorización mayor al presupuesto se rechaza con un mensaje entendible

- **GIVEN** un presupuesto de un monto dado
- **WHEN** se crea o edita una autorización con un `montoAutorizado` mayor
- **THEN** el trigger del servidor rechaza la escritura
- **AND** la promesa rechaza con un `Error` que indica que la autorización no puede superar el monto
  del presupuesto
- **AND** el mensaje NO contiene el nombre de la columna ni el prefijo interno de la regla

#### Scenario: La regla se aplica aunque se saltee la validación de la interfaz

- **GIVEN** un usuario que invoca el repository directamente, salteándose `validarAutorizacion`
- **WHEN** intenta persistir una autorización mayor al presupuesto
- **THEN** la escritura se rechaza igualmente en el servidor
- **AND** no queda ninguna fila creada ni modificada

#### Scenario: Una autorización igual o menor se acepta

- **GIVEN** un `montoAutorizado` igual o menor al monto del presupuesto
- **WHEN** se guarda
- **THEN** la operación se completa con éxito

### Requirement: La vigencia retroactiva persiste en el servidor

El sistema SHALL persistir `vigenciaDesde` en la columna `facturacion.autorizacion.vigencia_desde`,
como campo independiente de `fechaRespuesta`, de modo que la carga retroactiva de RN-PA-02 sobreviva
al viaje de ida y vuelta al servidor.

#### Scenario: Una vigencia anterior a la fecha de respuesta persiste

- **GIVEN** una autorización cargada con `vigenciaDesde` anterior a su `fechaRespuesta`
- **WHEN** se guarda y se vuelve a leer desde el servidor
- **THEN** los dos valores vuelven distintos y con las fechas originales
- **AND** el servidor no rechaza la vigencia retroactiva

### Requirement: El adjunto se mapea sin inventar datos ni perder los existentes

El sistema SHALL mapear `archivoUrl` al `archivo?: ArchivoAdjunto` del dominio derivando `nombre` del
último segmento de la URL y `cargadoEn` de `fechaRespuesta`. El sistema MUST NOT inventar una fecha de
carga tomada del reloj, y MUST NOT enviar un `archivoUrl` para un archivo recién elegido en el
formulario, porque este change no implementa la subida a Storage.

#### Scenario: Un adjunto existente sobrevive el viaje de ida y vuelta

- **GIVEN** una autorización en la base con `archivo_url` informado
- **WHEN** se lee, se cambia el estado y se vuelve a guardar
- **THEN** el `archivo_url` original se conserva

#### Scenario: Un archivo recién elegido no produce una URL falsa

- **GIVEN** un formulario de autorización donde el usuario seleccionó un archivo local
- **WHEN** se guarda
- **THEN** el body de la invocación NO contiene `archivoUrl`
- **AND** la pantalla muestra un `AvisoModeloDatos` indicando que el archivo todavía no se guarda en
  el servidor

### Requirement: Mapeo en funciones puras y aisladas

El sistema SHALL implementar toda la traducción entre la respuesta de la Edge Function y el tipo
`Autorizacion` en funciones puras exportadas desde
`frontend/src/shared/lib/presupuestos/autorizacionMapping.ts`, sin efectos, sin lectura de reloj
global y sin acceso a red. Las funciones de parseo MUST angostar `unknown` con type guards explícitos.

#### Scenario: El mapeo se testea sin mockear la red

- **GIVEN** una respuesta cruda de la Edge Function como objeto literal
- **WHEN** se invoca la función de parseo directamente en un test
- **THEN** devuelve una `Autorizacion` válida sin haber montado ningún fake del cliente Supabase

### Requirement: Contrato de errores compartido con el repository de presupuestos

El sistema SHALL traducir los errores de la Edge Function `autorizaciones` con el **mismo** módulo de
traducción que usa `SupabasePresupuestoRepository`, parametrizado por entidad y operación, de modo que
las dos implementaciones no diverjan. El sistema SHALL lanzar siempre instancias de `Error` con
`message` en castellano apto para mostrarse tal cual, porque `useAutorizaciones` lo pinta
directamente.

#### Scenario: La traducción de errores no está duplicada

- **GIVEN** los dos repositories reales
- **WHEN** se inspecciona su código
- **THEN** ambos delegan la traducción en el mismo módulo compartido
- **AND** no hay dos copias divergentes de la tabla de mensajes

#### Scenario: Los estados de carga y error de la pantalla no se modifican

- **GIVEN** el detalle de un presupuesto con el repository real inyectado
- **WHEN** una operación de autorización falla
- **THEN** `useAutorizaciones` expone `error` con el mensaje y `loading` en `false`
- **AND** ni `useAutorizaciones.ts` ni `AutorizacionRepositoryContext.tsx` fueron modificados
