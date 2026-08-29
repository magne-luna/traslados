## MODIFIED Requirements

### Requirement: Tipos del dominio de Facturación

El sistema SHALL definir los tipos TypeScript del dominio en
`frontend/src/shared/types/factura.ts`, en modo strict y sin usar `any`. MUST incluir `Factura`,
`AsistenciaPrestacion`, `Cobro`, `EstadoFactura` e `IdentificadorFactura`, cruzando
`knowledge-base/04_modelo_de_datos.md §Factura` (+ US-400, RN-FA-01 a RN-FA-08) con
`docs/core/Traslados-Modelo-Datos.docx §5 Facturación`. Los tipos ya definidos por otros dominios
MUST importarse, nunca redefinirse.

`Factura` SHALL incluir además los campos del **comprobante fiscal electrónico** emitido contra
ARCA, todos opcionales y ausentes mientras la factura está en `a-facturar`: `cae?: string`,
`caeVencimiento?: string` (ISO date), `cbteNro?: number`, `ptoVta?: number`,
`arcaAmbiente?: 'production' | 'homologacion'` y `comprobantePdfUrl?: string`. Estos campos MUST
comentarse como **agregados sobre el docx** (el docx no modela facturación electrónica) y MUST
poblarse únicamente por la Edge Function de emisión, nunca desde el alta o la edición manual —
`NuevaFactura` y `ActualizacionFactura` los heredan como opcionales pero el formulario de factura
no los edita.

#### Scenario: Campos de Factura provenientes del docx

- **WHEN** se declara `Factura`
- **THEN** contiene los campos que el docx modela (`id`, `pacienteId`, `descripcion`, `dias`,
  `valorKm`, `monto`, `estado`, `fechaInicial`, `fechaTope`, `tipoComprobante`), referenciando el
  paciente por id y sin embeber el `Paciente`

#### Scenario: Campos agregados sobre el docx para soportar las reglas de negocio

- **WHEN** se declara `Factura`
- **THEN** contiene además `cantidadKm: number`, `fechaEstimadaCobro?: string`, `fechaFactura?`,
  `autorizacionId?`, los campos estructurados de la descripción (`prestacion`, `mesFacturado`,
  `anioFacturado`, `dependenciaYRetorno`, `domicilioId`, `identificadorFactura`), y los campos del
  comprobante fiscal (`cae?`, `caeVencimiento?`, `cbteNro?`, `ptoVta?`, `arcaAmbiente?`,
  `comprobantePdfUrl?`), todos comentados como agregados sobre el docx

#### Scenario: Los campos fiscales solo los escribe la emisión

- **WHEN** se declara `ActualizacionFactura` y se implementa el formulario de edición de factura
- **THEN** `cae`, `caeVencimiento`, `cbteNro`, `ptoVta`, `arcaAmbiente` y `comprobantePdfUrl` no se
  editan desde el formulario
- **AND** solo la Edge Function `facturar` los persiste, junto con el cambio de estado a `facturado`

#### Scenario: Período estructurado, no texto libre

- **WHEN** se declara el período que cubre la factura
- **THEN** se modela como `mesFacturado: number` (1-12) y `anioFacturado: number`, no como un
  string libre

#### Scenario: Identificador del paciente congelado en la factura

- **WHEN** se declara `IdentificadorFactura`
- **THEN** contiene `{ origen: IdentificadorOrigenFactura; valor: string }`, importando
  `IdentificadorOrigenFactura` de `obraSocial.ts`, de modo que la factura conserve el identificador
  resuelto al emitirla (IN-01, RN-FA-06)

#### Scenario: Estado como unión cerrada de literales

- **WHEN** se declara `EstadoFactura`
- **THEN** es la unión cerrada `'a-facturar' | 'facturado' | 'cobrado' | 'pagado-parcialmente'`
  (nunca `string` libre), tratando el `pendiente` del docx como sinónimo de `a-facturar`

#### Scenario: AsistenciaPrestacion sin ninguna referencia al recorrido (RN-FA-01)

- **WHEN** se declara `AsistenciaPrestacion` (`id`, `fecha`, `prestacion`, `dependencia`,
  `retorno`, `facturaSabados`)
- **THEN** no contiene ningún campo que referencie `Recorrido`, `HojaDeRuta` o `ParadaRecorrido`, y
  `factura.ts` no importa nada de `hojaDeRuta.ts`

#### Scenario: Cobro con id propio

- **WHEN** se declara `Cobro`
- **THEN** contiene `id: string`, `facturaId: string`, `fecha: string` (ISO) y `montoPagado: number`

#### Scenario: Reutilización de tipos de otros dominios, no redefinición

- **WHEN** se declaran los tipos de `factura.ts`
- **THEN** `TipoComprobante`, `PlantillaFactura`, `PlantillaCampo`, `OrigenCampoPlantilla` e
  `IdentificadorOrigenFactura` se importan de `obraSocial.ts`, `CupoAutorizado` de `presupuesto.ts`,
  y `ChecklistItem`/`DocumentoAdjunto`/`EntidadDocumental` de `documento.ts`, sin redefinirlos

#### Scenario: Tipos de entrada sin id

- **WHEN** se declaran los payloads de creación y edición (`NuevaFactura`, `ActualizacionFactura`,
  `NuevoCobro`, `ActualizacionCobro`)
- **THEN** ninguno incluye `id`; el `id` lo asigna la implementación del repository
