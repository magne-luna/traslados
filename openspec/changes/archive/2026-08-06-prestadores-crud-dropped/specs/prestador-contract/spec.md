## ADDED Requirements

### Requirement: Tipo de dominio Prestador

El sistema SHALL definir un tipo TypeScript `Prestador` en `frontend/src/shared/types/prestador.ts`
que modele: `id`, `razonSocial`, `cuit`, `direccion?`, `telefono?` (los 4 campos ya existentes en
`obra_social.prestadores`), más `plazoCobroDias` (configurable) y `tipoComprobante`
(`'A' | 'B' | 'C'`), movidos desde `ObraSocial` (lectura literal de US-300, supuesto #3 de esta
rama). El tipo MUST estar en modo strict sin uso de `any`.

`modalidadFacturacion` y `admitePagosParciales` MUST NOT modelarse en `Prestador` — son preferencias
de la obra social pagadora, no condiciones fiscales del prestador, y se quedan en `ObraSocial` (ver
`obra-social-contract`).

**⚠️ Supuesto provisorio de la rama `feature/prestadores-crud`, SIN confirmar con Andrea**: mover
`plazoCobroDias`/`tipoComprobante` a `Prestador` es una lectura literal de US-300, no una respuesta
del cliente.

#### Scenario: Los 6 campos del alcance de esta versión

- **WHEN** se declara `Prestador`
- **THEN** contiene `id`, `razonSocial`, `cuit`, `direccion?`, `telefono?`, `plazoCobroDias` y
  `tipoComprobante`, sin campos adicionales no confirmados con el cliente

#### Scenario: modalidadFacturacion y admitePagosParciales no se duplican en Prestador

- **WHEN** se declara `Prestador`
- **THEN** no incluye `modalidadFacturacion` ni `admitePagosParciales` — esos campos siguen siendo
  exclusivos de `ObraSocial`

#### Scenario: El movimiento de campos queda señalizado como provisorio

- **GIVEN** que mover `plazoCobroDias`/`tipoComprobante` desde `ObraSocial` a `Prestador` es una
  lectura literal de US-300 sin confirmar con Andrea
- **WHEN** se documenta el tipo `Prestador`
- **THEN** el comentario del código y `knowledge-base/04_modelo_de_datos.md §Discrepancias` dejan
  explícito que esta ubicación es provisoria de la rama de demo, no un modelo confirmado

### Requirement: Interfaz PrestadorRepository

El sistema SHALL definir una interfaz `PrestadorRepository` con los métodos
`list(): Promise<Prestador[]>`, `getById(id): Promise<Prestador | null>`, `create(data):
Promise<Prestador>` y `update(id, data): Promise<Prestador>`. La UI MUST consumir esta interfaz y
NUNCA acceder a Supabase directamente. Dado que `obra_social.prestadores` no tiene tablas hijas,
`create`/`update` MUST implementarse como operaciones PostgREST directas (`.insert()`/`.update()`),
sin función RPC `SECURITY INVOKER` — mismo criterio que los campos planos de `paciente`
(`SupabasePacienteRepository.ts`).

#### Scenario: La UI depende de la interfaz, no de la implementación

- **WHEN** una pantalla necesita datos de Prestadores
- **THEN** recibe un `PrestadorRepository` por inyección y no importa ningún cliente Supabase
  concreto

#### Scenario: getById de un id inexistente

- **WHEN** se llama `getById` con un id que no existe
- **THEN** la promesa resuelve a `null` (no lanza excepción)

#### Scenario: Alta y edición sin coordinación multi-tabla

- **WHEN** se crea o edita un Prestador
- **THEN** la operación es un único `insert`/`update` sobre `obra_social.prestadores`, sin necesidad
  de una transacción RPC, porque no hay colecciones hijas que coordinar
