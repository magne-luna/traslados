## MODIFIED Requirements

### Requirement: Asignación semanal de conductor a vehículo
El sistema SHALL permitir asignar a un conductor un vehículo por semana, representando cada
asignación como `AsignacionSemanal` (`vehiculoId` + `semana` como etiqueta ISO `YYYY-Www`) embebida
en el conductor, y presentando las asignaciones como una tabla por semana. Las mutaciones se
persisten vía `ConductorRepository.update`. El tipo del frontend `AsignacionSemanal` MUST NOT
cambiar: `semana` sigue siendo una etiqueta ISO de string. En la base, cada asignación SHALL
persistirse como dos columnas de fecha —`conductores.conductores_vehiculos.fecha_init` y
`.fecha_fin_semana`, ambas `DATE NOT NULL`—, no como una etiqueta de texto. La conversión entre la
etiqueta ISO del dominio y el par de fechas de la base SHALL vivir enteramente en el módulo puro
`frontend/src/shared/lib/conductores/semanaIso.ts`, nunca inline en el repository ni en la UI.

#### Scenario: Alta de una asignación semanal
- **WHEN** la administradora elige un vehículo y una semana para un conductor y confirma
- **THEN** se agrega una `AsignacionSemanal` al conductor y se persiste vía `update`, apareciendo en
  la tabla de asignaciones por semana

#### Scenario: Semana por defecto derivada del presente
- **WHEN** se abre el alta de asignación sin especificar semana
- **THEN** una función pura deriva la etiqueta ISO de la semana actual a partir de una fecha de
  referencia recibida como parámetro (no un `new Date()` incrustado que impida testear)

#### Scenario: El alta se traduce a un par de fechas antes de persistirse
- **WHEN** se guarda una `AsignacionSemanal` con `semana: '2026-W30'`
- **THEN** el repository convierte esa etiqueta con `semanaIsoADesdeHasta('2026-W30')` antes de
  escribir
- **AND** la fila resultante en `conductores_vehiculos` tiene `fecha_init` en el lunes de esa semana y
  `fecha_fin_semana` en el domingo correspondiente

#### Scenario: La lectura reconstruye la etiqueta ISO desde las dos fechas
- **WHEN** se lee un conductor cuyas filas de `conductores_vehiculos` tienen `fecha_init` y
  `fecha_fin_semana` persistidos
- **THEN** cada `AsignacionSemanal.semana` se reconstruye con `desdeHastaASemanaIso(fecha_init,
  fecha_fin_semana)`
- **AND** el tipo `AsignacionSemanal` expuesto a la UI sigue teniendo solo `id`, `vehiculoId` y
  `semana` (string), sin fechas sueltas

#### Scenario: El tipo del frontend no cambia por el swap
- **WHEN** se revisa `frontend/src/shared/types/conductor.ts` tras completar el swap
- **THEN** la interfaz `AsignacionSemanal` sigue declarando `semana: string` como etiqueta ISO
- **AND** ningún componente de `features/conductores/` pasa a manejar `fecha_init` / `fecha_fin_semana`
  directamente

### Requirement: Selector de vehículo alimentado por VehiculoRepository
El sistema SHALL poblar el selector de vehículo de la asignación con la lista provista por
`VehiculoRepository` (inyectado por su context), guardando únicamente el `vehiculoId`. El contrato de
conductores MUST NOT modificar `VehiculoRepository` ni embeber el objeto `Vehiculo`. Tras el swap, el
selector SHALL leer del `SupabaseVehiculoRepository` real, y su disponibilidad de datos SHALL
depender del permiso `vehiculos: read` —distinto del permiso `conductores: read`/`write` que gatea la
pantalla en la que vive el selector.

#### Scenario: El selector ofrece los vehículos del repository de flota
- **WHEN** se abre el selector de vehículo de una asignación
- **THEN** las opciones provienen de `VehiculoRepository.list()`, y al elegir uno se guarda su
  `vehiculoId` (string), no el objeto completo

#### Scenario: Sin permiso de vehículos, el selector queda vacío y señalizado
- **WHEN** un usuario con `conductores: write` y sin `vehiculos: read` abre el alta de asignación de
  un conductor
- **THEN** el selector de vehículo no ofrece ninguna opción porque `VehiculoRepository.list()` vuelve
  vacío (RLS filtra, no da error)
- **AND** la pantalla distingue ese caso de "no hay vehículos cargados", mostrando que falta el
  permiso del módulo Vehículos

#### Scenario: El permiso del selector es independiente del permiso de la pantalla
- **WHEN** un usuario tiene `conductores: read` y `conductores: write` pero no tiene ningún permiso
  sobre `vehiculos`
- **THEN** puede ver y editar los datos personales del conductor con normalidad
- **AND** el selector de vehículo de la asignación semanal queda vacío, sin que eso bloquee el resto
  de la ficha

### Requirement: Validación de colisión de asignación semanal
> ✅ **Resuelto (2026-07-31, pendiente #2 de `C-09`)**: la colisión **se bloquea siempre, sin
> excepción y sin override**. Ninguna fuente (KB ni docx) confirmaba que la excepción fuera un caso
> real de negocio, y el override `permitirMultiple` del frontend estuvo apagado por defecto desde
> `conductores-ui` (2026-07-24) sin que nadie lo usara. La barrera pasa a ser un constraint de base
> de datos, no lógica de aplicación.

Un conductor MUST NOT quedar asignado a dos vehículos **distintos** en la misma semana. La regla
SHALL garantizarse con un constraint de base de datos sobre `conductores.conductores_vehiculos`:

```sql
ALTER TABLE conductores.conductores_vehiculos
  ADD CONSTRAINT uq_conductor_semana UNIQUE (conductor_id, fecha_init);
```

El sistema MUST NOT ofrecer ninguna vía —flag de payload, parámetro de función, toggle de UI ni
opción de configuración— para habilitar la asignación múltiple. El campo `permitirMultiple` SHALL
eliminarse de `validarAsignacionSemanal` y de `AsignacionSemanalTabla`, y los tipos de payload
(`NuevoConductor`, `ActualizacionConductor`) MUST NOT declararlo. Las funciones RPC MUST NOT validar
esta colisión ni definir un código de error propio para ella: la violación llega como `23505`.

La validación pura client-side SHALL conservarse como **feedback inmediato** —para que el error
aparezca antes de ir al servidor— pero pasa a ser **incondicional**, y MUST NOT ser la única defensa:
por sí sola es evitable con una llamada directa a PostgREST, y el constraint no lo es.

El `UNIQUE(conductor_id, vehiculo_id, fecha_init)` existente MUST conservarse. `uq_conductor_semana`
lo subsume —todo lo que el viejo rechaza también lo rechaza el nuevo—, pero eliminarlo sería borrar
algo que una migración aplicada creó, y no compra nada. Consecuencia: cuando se repite el trío exacto
se violan los dos y Postgres reporta el que chequea primero; los dos mensajes de error son ciertos en
ese caso.

El constraint MUST agregarse sin `NOT VALID` (`ADD CONSTRAINT … UNIQUE` no lo admite), por lo que su
aplicación SHALL estar precedida por una verificación bloqueante de que no existen filas violatorias.

#### Scenario: Colisión bloqueada siempre (client-side, feedback inmediato)
- **WHEN** un conductor ya tiene una asignación a un vehículo en la semana `S` y se intenta asignarle
  un vehículo distinto en la misma semana `S`
- **THEN** la función pura devuelve un error de colisión y la UI bloquea el guardado
- **AND** no existe ningún control en la pantalla que permita continuar de todos modos

#### Scenario: Reasignación al mismo vehículo no es colisión
- **WHEN** se vuelve a asignar el mismo vehículo al conductor en una semana en la que ya lo tenía
- **THEN** no se reporta colisión (es idempotente / edición), no se duplica la asignación

#### Scenario: La validación pura no acepta ningún parámetro de override
- **WHEN** se inspecciona la firma de `validarAsignacionSemanal`
- **THEN** su input declara solo `asignaciones`, `semana` y `vehiculoId`
- **AND** no existe ningún parámetro que relaje el rechazo de la colisión

#### Scenario: El constraint existente no alcanzaba, y por eso se agrega el nuevo
- **WHEN** se intenta, a nivel SQL (fuera de la UI), insertar dos filas de
  `conductores_vehiculos` para el mismo `conductor_id` y la misma `fecha_init` pero con
  `vehiculo_id` distintos
- **THEN** el `UNIQUE(conductor_id, vehiculo_id, fecha_init)` existente NO lo rechazaría, porque el
  par `(conductor_id, vehiculo_id)` es distinto en cada fila
- **AND** `uq_conductor_semana` sí lo rechaza con `23505`, que es lo que vuelve la colisión imposible

#### Scenario: La colisión se bloquea también cuando se evita la UI
- **WHEN** una escritura llega a `crear_conductor_completo` / `actualizar_conductor_completo` con dos
  vehículos distintos en la misma semana, salteando la validación client-side
- **THEN** el `INSERT` viola `uq_conductor_semana` y la transacción hace rollback completo
- **AND** ninguna de las dos asignaciones queda persistida
- **AND** el rechazo no depende de ninguna comprobación escrita dentro de la función

#### Scenario: Filas violatorias preexistentes bloquean la migración en vez de perderse
- **WHEN** antes de aplicar la migración se consulta si algún conductor ya tiene dos `vehiculo_id`
  distintos con la misma `fecha_init`
- **THEN** si aparece alguna fila, la migración no se aplica y el caso se reporta para que la usuaria
  decida la reconciliación
- **AND** ninguna fila se borra ni se reasigna automáticamente
