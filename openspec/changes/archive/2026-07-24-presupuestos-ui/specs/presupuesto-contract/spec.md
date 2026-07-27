## ADDED Requirements

### Requirement: Tipos del dominio de Presupuestos y Autorizaciones
El sistema SHALL definir los tipos TypeScript del dominio en `frontend/src/shared/types/presupuesto.ts`, en modo strict y sin usar `any`. MUST incluir `Presupuesto` (id, `pacienteId`, `obraSocialId`, `monto`, `fechaEmision`, `archivo?`), `Autorizacion` (id, `presupuestoId`, `estado`, `fechaRespuesta?`, `montoAutorizado?`, `vigenciaDesde?`, `cupoMensualDias?`, `cupoMensualKm?`, `archivo?`), la unión `EstadoAutorizacion`, la proyección `CupoAutorizado` y la referencia `ArchivoAdjunto` (cruce de `04_modelo_de_datos.md §Presupuesto/Autorizacion` con `docs/core/Traslados-Modelo-Datos.docx §Facturación`).

#### Scenario: Estado de autorización como conjunto cerrado tipado
- **WHEN** se declara el campo `estado` de una autorización
- **THEN** su tipo es `EstadoAutorizacion`, una unión de literales `'pendiente' | 'autorizada' | 'judicializada' | 'rechazada'`, y no `string` libre

#### Scenario: Presupuesto y Autorización referencian entidades por id
- **WHEN** se declara `Presupuesto` y `Autorizacion`
- **THEN** `Presupuesto` contiene `pacienteId: string` y `obraSocialId: string` (no embebe `Paciente` ni `ObraSocial`), y `Autorizacion` contiene `presupuestoId: string` (no embebe el `Presupuesto`)

#### Scenario: Documentación adjunta como archivo único, no colección
- **WHEN** se declara la documentación adjunta de un presupuesto o de una autorización
- **THEN** es un `archivo?: ArchivoAdjunto` único por entidad (referencia a un solo archivo), y NO una colección multi-documento ni una entrada nueva en `EntidadDocumental` (`documento.ts`), por coincidir con el modelo real del docx (un solo "Archivo" por entidad)

#### Scenario: Campos agregados sobre el docx quedan marcados como opcionales
- **WHEN** se declaran `montoAutorizado` y `vigenciaDesde` en `Autorizacion`
- **THEN** ambos son opcionales (`?`), por ser campos que el contrato del frontend agrega sobre el modelo del docx para soportar RN-PA-01 y RN-PA-02 (ver `design.md` Discrepancias 2 y 3)

### Requirement: Interfaces PresupuestoRepository y AutorizacionRepository
El sistema SHALL definir las interfaces `PresupuestoRepository` (`list()`, `getById(id)`, `create(data)`, `update(id, data)`) y `AutorizacionRepository` (`list()`, `getById(id)`, `getByPresupuestoId(presupuestoId)`, `create(data)`, `update(id, data)`) en `frontend/src/shared/lib/presupuestos/`, de modo que ninguna pantalla hable con la fuente de datos directamente.

#### Scenario: getById de un registro inexistente
- **WHEN** se invoca `getById(id)` (o `getByPresupuestoId(id)`) con un id que no existe
- **THEN** la promesa resuelve `null` en vez de lanzar un error

#### Scenario: Tipos de entrada sin id
- **WHEN** se invoca `create(data)` en cualquiera de los dos repositories
- **THEN** el tipo del payload (`NuevoPresupuesto` / `NuevaAutorizacion`) no incluye `id`, y el `id` lo asigna la implementación del repository

### Requirement: Implementaciones mock con persistencia en localStorage
El sistema SHALL proveer implementaciones mock de ambos repositories en `frontend/src/shared/lib/mocks/` que cumplan las interfaces al pie de la letra, persistan en `localStorage` con un `schemaVersion` y devuelvan promesas con latencia simulada, para ejercitar estados de carga y error reales.

#### Scenario: Siembra del fixture inicial
- **WHEN** no hay datos de presupuestos/autorizaciones en `localStorage`
- **THEN** los mocks siembran fixtures coherentes: presupuestos ligados a `pacienteId`/`obraSocialId` que existen en los fixtures de pacientes/obras sociales, y al menos una autorización por cada estado relevante (incluyendo una con `vigenciaDesde` anterior a su `fechaRespuesta`)

#### Scenario: Persistencia entre recargas
- **WHEN** se crea o actualiza un presupuesto o autorización y luego se vuelve a leer tras una recarga simulada
- **THEN** el cambio persiste porque se guardó en `localStorage`

#### Scenario: Mismatch de schemaVersion
- **WHEN** el payload almacenado tiene un `schemaVersion` distinto al esperado o está corrupto
- **THEN** el mock re-siembra desde el fixture en vez de romper la deserialización
