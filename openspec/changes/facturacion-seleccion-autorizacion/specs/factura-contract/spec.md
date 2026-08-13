## MODIFIED Requirements

### Requirement: Tipos del dominio de Facturación
El sistema SHALL definir los tipos TypeScript del dominio en `frontend/src/shared/types/factura.ts`, en modo strict y sin usar `any`. MUST incluir `Factura`, `AsistenciaPrestacion`, `Cobro`, `EstadoFactura` e `IdentificadorFactura`, cruzando `knowledge-base/04_modelo_de_datos.md §Factura` (+ US-400, RN-FA-01 a RN-FA-08) con `docs/core/Traslados-Modelo-Datos.docx §5 Facturación` (entidades **Facturas** y **Cobros**). Los tipos ya definidos por otros dominios MUST importarse, nunca redefinirse. `Factura` MUST incluir `autorizacionId?: string`, el vínculo opcional hacia la autorización que habilitó la factura (N:1: una autorización puede habilitar varias facturas de distintos períodos). `Factura` MUST NOT incluir `prestadorNombre` ni `prestadorDomicilio`, porque el sistema no define ninguna entidad `Prestador`.

(Previously: `Factura` no tenía ningún vínculo con `Autorizacion` y contenía `prestadorNombre?: string`/`prestadorDomicilio?: string` como texto libre, presentes solo cuando `ObraSocial.modalidadFacturacion === 'por-prestacion'`.)

#### Scenario: Campos de Factura provenientes del docx
- **WHEN** se declara `Factura`
- **THEN** contiene los campos que el docx modela (`id`, `pacienteId`, `descripcion`, `dias`, `valorKm`, `monto`, `estado`, `fechaInicial`, `fechaTope`, `tipoComprobante`), referenciando el paciente por id y sin embeber el `Paciente`

#### Scenario: Campos agregados sobre el docx para soportar las reglas de negocio
- **WHEN** se declara `Factura`
- **THEN** contiene además `cantidadKm: number` (necesario para el cupo de km, RN-FA-02), `fechaEstimadaCobro?: string` (RN-FA-04) y `autorizacionId?: string` (vínculo con la autorización que habilitó la factura, agregado sobre el docx, discrepancia N7), todos comentados como campos **agregados sobre el docx**, más los campos estructurados de la descripción (`prestacion`, `mesFacturado`, `anioFacturado`, `dependenciaYRetorno`, `domicilioId`, `identificadorFactura`) y `fechaFactura?`

#### Scenario: `autorizacionId` es una referencia opcional, no una entidad embebida
- **WHEN** se declara `Factura.autorizacionId`
- **THEN** es un `string` opcional que referencia el id de una `Autorizacion` existente, sin embeber el objeto `Autorizacion` completo, y sin ningún tipo `Prestador` en el sistema

#### Scenario: Período estructurado, no texto libre
- **WHEN** se declara el período que cubre la factura
- **THEN** se modela como `mesFacturado: number` (1-12) y `anioFacturado: number`, no como un string libre, para poder validar el cupo mensual (RN-FA-02) y agregar por año (`C-11`)

#### Scenario: Identificador del paciente congelado en la factura
- **WHEN** se declara `IdentificadorFactura`
- **THEN** contiene `{ origen: IdentificadorOrigenFactura; valor: string }`, importando `IdentificadorOrigenFactura` de `obraSocial.ts`, de modo que la factura conserve el identificador resuelto al emitirla (IN-01, RN-FA-06)

#### Scenario: Estado como unión cerrada de literales
- **WHEN** se declara `EstadoFactura`
- **THEN** es la unión cerrada `'a-facturar' | 'facturado' | 'cobrado' | 'pagado-parcialmente'` (nunca `string` libre), tomando la enumeración de la KB/US-400 y tratando el `pendiente` del docx como sinónimo de `a-facturar`

#### Scenario: AsistenciaPrestacion sin ninguna referencia al recorrido (RN-FA-01)
- **WHEN** se declara `AsistenciaPrestacion` (`id`, `fecha`, `prestacion`, `dependencia`, `retorno`, `facturaSabados`)
- **THEN** no contiene ningún campo que referencie `Recorrido`, `HojaDeRuta` o `ParadaRecorrido`, y `factura.ts` no importa nada de `hojaDeRuta.ts`, garantizando estructuralmente que lo facturado no se deriva ni valida contra el recorrido efectivo

#### Scenario: Cobro con id propio
- **WHEN** se declara `Cobro`
- **THEN** contiene `id: string`, `facturaId: string`, `fecha: string` (ISO) y `montoPagado: number`; el `id` es un campo agregado sobre el docx requerido para keys estables

#### Scenario: Reutilización de tipos de otros dominios, no redefinición
- **WHEN** se declaran los tipos de `factura.ts`
- **THEN** `TipoComprobante`, `PlantillaFactura`, `PlantillaCampo`, `OrigenCampoPlantilla` e `IdentificadorOrigenFactura` se importan de `obraSocial.ts`, `CupoAutorizado` y `Autorizacion` de `presupuesto.ts`, y `ChecklistItem`/`DocumentoAdjunto`/`EntidadDocumental` de `documento.ts`, sin redefinirlos localmente

#### Scenario: Tipos de entrada sin id
- **WHEN** se declaran los payloads de creación y edición (`NuevaFactura`, `ActualizacionFactura`, `NuevoCobro`, `ActualizacionCobro`)
- **THEN** ninguno incluye `id`; el `id` lo asigna la implementación del repository
