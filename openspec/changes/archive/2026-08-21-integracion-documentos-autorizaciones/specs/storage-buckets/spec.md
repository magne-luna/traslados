# Delta for Storage Buckets

## MODIFIED Requirements

### Requirement: Creación de los 5 buckets

El sistema MUST crear 5 buckets con los nombres exactos `documentos-pacientes`,
`documentos-vehiculos`, `documentos-conductores`, `documentos-facturas` y `documentos-autorizaciones`
mediante migraciones de Supabase. El nuevo bucket `documentos-autorizaciones` SHALL gatearse por el
módulo `presupuestos` ya existente, no por un módulo nuevo.

(Previously: 4 buckets — `documentos-pacientes`, `documentos-vehiculos`, `documentos-conductores`,
`documentos-facturas`.)

#### Scenario: Buckets creados exitosamente

- GIVEN las migraciones se han aplicado contra el proyecto Supabase
- WHEN se consulta la lista de buckets desde el dashboard o API
- THEN los 5 buckets existen con los nombres especificados
- AND cada bucket corresponde a su entidad (pacientes, vehículos, conductores, facturas,
  autorizaciones)

#### Scenario: El bucket de autorizaciones se gatea por el módulo `presupuestos`

- GIVEN el bucket `documentos-autorizaciones`
- WHEN se inspeccionan sus policies de `storage.objects`
- THEN todas usan `modulos.tiene_permiso('presupuestos', 'read'|'write')`
- AND no existe ningún módulo `autorizaciones` ni `documentos-autorizaciones` nuevo
