## MODIFIED Requirements

### Requirement: Tipos del dominio de Facturación

El sistema SHALL definir los tipos TypeScript del dominio en `frontend/src/shared/types/factura.ts`, en modo strict y sin usar `any`. MUST incluir `Factura`, `AsistenciaPrestacion`, `Cobro`, `EstadoFactura` e `IdentificadorFactura`, cruzando `knowledge-base/04_modelo_de_datos.md §Factura` (+ US-400, RN-FA-01 a RN-FA-08) con `docs/core/Traslados-Modelo-Datos.docx §5 Facturación` (entidades **Facturas** y **Cobros**). Los tipos ya definidos por otros dominios MUST importarse, nunca redefinirse.
(Previously: no documentaba ningún campo relacionado con el prestador que realizó la prestación —
`prestadorId`/`Prestador` nunca llegaron a mergearse a este spec principal.)

#### Scenario: Campos de Factura provenientes del docx
- **WHEN** se declara `Factura`
- **THEN** contiene los campos que el docx modela (`id`, `pacienteId`, `descripcion`, `dias`, `valorKm`, `monto`, `estado`, `fechaInicial`, `fechaTope`, `tipoComprobante`), referenciando el paciente por id y sin embeber el `Paciente`

#### Scenario: Campos agregados sobre el docx para soportar las reglas de negocio
- **WHEN** se declara `Factura`
- **THEN** contiene además `cantidadKm: number` (necesario para el cupo de km, RN-FA-02), `fechaEstimadaCobro?: string` (RN-FA-04) y `prestadorNombre?: string`/`prestadorDomicilio?: string` (nombre y domicilio del prestador que realizó la prestación, texto libre sin entidad, presentes solo cuando `ObraSocial.modalidadFacturacion === 'por-prestacion'`), todos comentados como campos **agregados sobre el docx** (design.md Discrepancias 3 y 4), más los campos estructurados de la descripción (`prestacion`, `mesFacturado`, `anioFacturado`, `dependenciaYRetorno`, `domicilioId`, `identificadorFactura`) y `fechaFactura?`

#### Scenario: `prestadorNombre`/`prestadorDomicilio` son texto libre, no una referencia
- **WHEN** se declaran `Factura.prestadorNombre` y `Factura.prestadorDomicilio`
- **THEN** ambos son `string` opcionales, flat sobre `Factura` (mismo estilo que el resto del tipo, nunca un objeto anidado), sin ningún `prestadorId` ni referencia a una entidad `Prestador` — el sistema no define ningún tipo `Prestador`

#### Scenario: Período estructurado, no texto libre
- **WHEN** se declara el período que cubre la factura
- **THEN** se modela como `mesFacturado: number` (1-12) y `anioFacturado: number`, no como un string libre, para poder validar el cupo mensual (RN-FA-02) y agregar por año (`C-11`)

#### Scenario: Identificador del paciente congelado en la factura
- **WHEN** se declara `IdentificadorFactura`
- **THEN** contiene `{ origen: IdentificadorOrigenFactura; valor: string }`, importando `IdentificadorOrigenFactura` de `obraSocial.ts`, de modo que la factura conserve el identificador resuelto al emitirla (IN-01, RN-FA-06)

#### Scenario: Estado como unión cerrada de literales
- **WHEN** se declara `EstadoFactura`
- **THEN** es la unión cerrada `'a-facturar' | 'facturado' | 'cobrado' | 'pagado-parcialmente'` (nunca `string` libre), tomando la enumeración de la KB/US-400 y tratando el `pendiente` del docx como sinónimo de `a-facturar` (design.md Discrepancia 5)

#### Scenario: AsistenciaPrestacion sin ninguna referencia al recorrido (RN-FA-01)
- **WHEN** se declara `AsistenciaPrestacion` (`id`, `fecha`, `prestacion`, `dependencia`, `retorno`, `facturaSabados`)
- **THEN** no contiene ningún campo que referencie `Recorrido`, `HojaDeRuta` o `ParadaRecorrido`, y `factura.ts` no importa nada de `hojaDeRuta.ts`, garantizando estructuralmente que lo facturado no se deriva ni valida contra el recorrido efectivo

#### Scenario: Cobro con id propio
- **WHEN** se declara `Cobro`
- **THEN** contiene `id: string`, `facturaId: string`, `fecha: string` (ISO) y `montoPagado: number`; el `id` es un campo agregado sobre el docx (design.md Discrepancia 7) requerido para keys estables

#### Scenario: Reutilización de tipos de otros dominios, no redefinición
- **WHEN** se declaran los tipos de `factura.ts`
- **THEN** `TipoComprobante`, `PlantillaFactura`, `PlantillaCampo`, `OrigenCampoPlantilla` e `IdentificadorOrigenFactura` se importan de `obraSocial.ts`, `CupoAutorizado` de `presupuesto.ts`, y `ChecklistItem`/`DocumentoAdjunto`/`EntidadDocumental` de `documento.ts`, sin redefinirlos localmente

#### Scenario: Tipos de entrada sin id
- **WHEN** se declaran los payloads de creación y edición (`NuevaFactura`, `ActualizacionFactura`, `NuevoCobro`, `ActualizacionCobro`)
- **THEN** ninguno incluye `id`; el `id` lo asigna la implementación del repository
