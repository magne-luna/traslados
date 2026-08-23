## MODIFIED Requirements

### Requirement: Tipos del dominio de Presupuestos y Autorizaciones

El sistema SHALL definir los tipos TypeScript del dominio en `frontend/src/shared/types/presupuesto.ts`, en modo strict y sin usar `any`. MUST incluir `Presupuesto` (id, `pacienteId`, `obraSocialId`, `monto`, `fechaEmision`, `archivo?`), `Autorizacion` (id, `presupuestoId`, `estado`, `fechaRespuesta?`, `montoAutorizado?`, `vigenciaDesde?`, `cupoMensualDias?`, `cupoMensualKm?`, `periodoMes?`, `archivo?`), la unión `EstadoAutorizacion`, la proyección `CupoAutorizado` y la referencia `ArchivoAdjunto` (cruce de `04_modelo_de_datos.md §Presupuesto/Autorizacion` con `docs/core/Traslados-Modelo-Datos.docx §Facturación`). La forma de los tipos MUST NOT cambiar para acomodar los nombres de la base ni los de la API: toda traducción vive en el mapeo. La relación entre `Presupuesto` y `Autorizacion` MUST documentarse como **1:N** (un presupuesto puede tener múltiples autorizaciones, una por mes calendario), no 1:1.

(Previously: la relación se documentaba como 1:1 —un presupuesto tiene 0 o 1 autorización—, y `Autorizacion` no tenía ningún campo de período.)

#### Scenario: Estado de autorización como conjunto cerrado tipado
- **WHEN** se declara el campo `estado` de una autorización
- **THEN** su tipo es `EstadoAutorizacion`, una unión de literales `'pendiente' | 'autorizada' | 'judicializada' | 'rechazada'`, y no `string` libre

#### Scenario: Presupuesto y Autorización referencian entidades por id — ahora 1:N
- **WHEN** se declara `Presupuesto` y `Autorizacion`
- **THEN** `Presupuesto` contiene `pacienteId: string` y `obraSocialId: string` (no embebe `Paciente` ni `ObraSocial`), y `Autorizacion` contiene `presupuestoId: string` (no embebe el `Presupuesto`)
- **AND** un mismo `presupuestoId` puede repetirse en varias filas de `Autorizacion` (una por mes), a diferencia del modelo anterior donde a lo sumo existía una

#### Scenario: Documentación adjunta como archivo único, no colección
- **WHEN** se declara la documentación adjunta de un presupuesto o de una autorización
- **THEN** es un `archivo?: ArchivoAdjunto` único por entidad (referencia a un solo archivo), y NO una colección multi-documento ni una entrada nueva en `EntidadDocumental` (`documento.ts`), por coincidir con el modelo real del docx (un solo "Archivo" por entidad)

#### Scenario: Campos agregados sobre el docx quedan marcados como opcionales
- **WHEN** se declaran `montoAutorizado` y `vigenciaDesde` en `Autorizacion`
- **THEN** ambos son opcionales (`?`), por ser campos que el contrato del frontend agrega sobre el modelo del docx para soportar RN-PA-01 y RN-PA-02

#### Scenario: Los campos agregados dejaron de estar pendientes de confirmar
- **GIVEN** que `montoAutorizado` y `vigenciaDesde` ya existen como columnas reales (`facturacion.autorizacion.monto_autorizado` y `.vigencia_desde`, backend `C-06`)
- **WHEN** se documentan en el tipo
- **THEN** el comentario NO los describe como "pendientes de confirmar con backend"
- **AND** deja constancia de que el docx sigue sin tenerlos, que es lo que sí sigue siendo cierto

#### Scenario: El adjunto no tiene contraparte completa en la persistencia real
- **GIVEN** que la base modela el adjunto como una sola columna `archivo_url`
- **WHEN** se documenta `ArchivoAdjunto` (`nombre`, `cargadoEn`)
- **THEN** el tipo deja constancia de que `cargadoEn` se deriva de la fecha de la propia entidad y no se persiste por separado
- **AND** deja constancia de que la subida del archivo al servidor todavía no está implementada

#### Scenario: `periodoMes` es opcional y su ausencia significa modelo anterior (nuevo)
- **WHEN** se declara `periodoMes` en `Autorizacion`
- **THEN** es opcional (`periodoMes?: string`, ISO `YYYY-MM-01`)
- **AND** su ausencia (`undefined`) significa "autorización del modelo anterior a este cambio", no un dato faltante por cargar

> Nota: el comentario de `presupuestoId` en el tipo se reescribe de "relación 1---1" a "relación
> 1:N", citando este change. No se agrega ningún campo de ordinal persistido (D2 de `design.md`: el
> ordinal "Mes N" se deriva, nunca se persiste — ver capability `autorizacion-periodo-mensual`).

### Requirement: Interfaces PresupuestoRepository y AutorizacionRepository

El sistema SHALL definir las interfaces `PresupuestoRepository` (`list()`, `getById(id)`, `create(data)`, `update(id, data)`) y `AutorizacionRepository` (`list()`, `getById(id)`, `listByPresupuestoId(presupuestoId, periodoMes?)`, `create(data)`, `update(id, data)`) en `frontend/src/shared/lib/presupuestos/`, de modo que ninguna pantalla hable con la fuente de datos directamente. Las interfaces MUST NOT crecer para exponer capacidades del servidor que ninguna pantalla usa.

(Previously: `AutorizacionRepository` exponía `getByPresupuestoId(presupuestoId): Promise<Autorizacion | null>`, singular, asumiendo el modelo 1:1.)

#### Scenario: getById de un registro inexistente
- **WHEN** se invoca `getById(id)` con un id que no existe
- **THEN** la promesa resuelve `null` en vez de lanzar un error

#### Scenario: listByPresupuestoId siempre resuelve a un arreglo (nuevo, reemplaza el contrato singular)
- **WHEN** se invoca `listByPresupuestoId(presupuestoId)` sobre un presupuesto sin ninguna autorización
- **THEN** la promesa resuelve `[]`, nunca `null` ni un error

#### Scenario: Tipos de entrada sin id
- **WHEN** se invoca `create(data)` en cualquiera de los dos repositories
- **THEN** el tipo del payload (`NuevoPresupuesto` / `NuevaAutorizacion`) no incluye `id`, y el `id` lo asigna la implementación del repository

#### Scenario: Actualización parcial en las dos implementaciones
- **GIVEN** un `update(id, cambios)` donde `cambios` omite varias claves
- **WHEN** lo resuelve cualquiera de las dos implementaciones
- **THEN** las claves omitidas quedan exactamente como estaban
- **AND** las dos implementaciones se comportan igual en este punto

#### Scenario: Las interfaces no exponen borrado
- **GIVEN** que el backend real soporta borrar presupuestos y autorizaciones
- **WHEN** se revisan las interfaces
- **THEN** ninguna declara un método de borrado
- **AND** agregarlo requeriría una decisión de negocio, no solo de implementación

> Nota: se retira el escenario "getById de un registro inexistente" en su variante
> `getByPresupuestoId` (ya no aplica: el método pasó a llamarse `listByPresupuestoId` y a devolver
> lista, nunca `null`); reemplazado por "listByPresupuestoId siempre resuelve a un arreglo" arriba.
> Reason: D5 de `autorizacion-mensual/design.md` — reemplazar en vez de convivir, mismo criterio que
> eliminó la heurística "primera autorización con cupo" en `facturacion-seleccion-autorizacion`.
> Migration: ninguna, es un cambio de tipo/interfaz de frontend, sin persistencia propia.
