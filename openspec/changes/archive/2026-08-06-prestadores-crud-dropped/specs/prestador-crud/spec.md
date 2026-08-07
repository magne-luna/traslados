## ADDED Requirements

### Requirement: Listado de Prestadores

El sistema SHALL mostrar un listado de los Prestadores existentes obtenido a través de
`PrestadorRepository.list()`, con estados de carga y error visibles. Cada fila MUST mostrar al menos
razón social, CUIT y tipo de comprobante.

#### Scenario: Carga inicial del listado

- **WHEN** el usuario abre la pantalla de Prestadores
- **THEN** se muestra un indicador de carga mientras `list()` está pendiente y luego la lista de
  Prestadores

#### Scenario: Listado vacío

- **WHEN** no hay Prestadores cargados
- **THEN** se muestra un estado vacío con la acción de crear el primer Prestador

### Requirement: Alta de Prestador

El sistema SHALL permitir crear un Prestador capturando razón social, CUIT, dirección (opcional),
teléfono (opcional), plazo de cobro (días) y tipo de comprobante A/B/C. La creación MUST usar
`PrestadorRepository.create()` mediante un formulario de estado controlado plano, sin librería de
formularios (mismo criterio YAGNI que `ObraSocialForm.tsx` — 6 campos no justifican React Hook
Form/Zod).

#### Scenario: Alta exitosa

- **WHEN** el usuario completa los campos requeridos y confirma
- **THEN** el Prestador se persiste vía `create()` y aparece en el listado

#### Scenario: Validación de campos requeridos

- **WHEN** el usuario intenta guardar sin razón social o sin CUIT
- **THEN** el formulario bloquea el guardado y señala los campos faltantes

### Requirement: Edición de Prestador

El sistema SHALL permitir editar un Prestador existente vía `PrestadorRepository.update()`.

#### Scenario: Edición exitosa

- **WHEN** el usuario modifica un campo de un Prestador existente y confirma
- **THEN** el cambio se persiste vía `update()` y se refleja en el listado

#### Scenario: Manejo de error del repository

- **WHEN** una operación de create/update falla en el repository
- **THEN** la UI muestra un mensaje de error y no deja la pantalla en un estado de carga infinito

### Requirement: Gateo por el módulo de permisos obra_social

La pantalla de Prestadores SHALL gatearse con `modulo: 'obra_social'` (ya existente) — NUNCA con un
módulo `prestadores` nuevo, porque la RLS real de `obra_social.prestadores`
(`supabase/migrations/20260724100003_schema_obra_social.sql:40,55-56`) ya está fija a ese módulo.

#### Scenario: Lectura y escritura resuelven contra el módulo obra_social

- **WHEN** un usuario sin permiso de escritura en `obra_social` abre la pantalla de Prestadores
- **THEN** puede ver el listado, pero las acciones de alta/edición quedan deshabilitadas client-side
  (`requiereEscritura`), reflejando la misma policy RLS real de `obra_social.prestadores`

### Requirement: Señalización de la ambigüedad del CUIT

El sistema SHALL mostrar el componente `AvisoModeloDatos` en la pantalla de Prestador señalando que
`prestadores.cuit` convive con `obra_social.cuit` sin que ninguna fuente aclare la relación entre
ambos (discrepancia #12, supuesto #2 — **SIN confirmar con Andrea**). Construir esta pantalla no
resuelve la ambigüedad, la vuelve más visible.

#### Scenario: Cartel visible en la pantalla de Prestador

- **WHEN** se abre la pantalla de Prestador
- **THEN** se muestra un `AvisoModeloDatos` indicando que existen dos CUITs cargables (el de
  `ObraSocial` y el de `Prestador`) sin que ninguna fuente determine cuál es "la empresa prestadora"
  del docx
