# Prestaciones Paciente Specification

## Purpose

Defines the patient-scoped catalog of prestaciones (`pacientes.prestaciones`): schema, logical
delete semantics, and the `PrestacionesEditor` UI section embedded in the patient record.

## Requirements

### Requirement: Catálogo de prestaciones por paciente

El sistema SHALL modelar una tabla `pacientes.prestaciones` con `id UUID PK`, `paciente_id UUID
NOT NULL REFERENCES pacientes.paciente(id) ON DELETE CASCADE`, `nombre TEXT NOT NULL`,
`descripcion TEXT` (opcional) y `activa BOOLEAN NOT NULL DEFAULT true`. La tabla MUST replicate el
patrón RLS/GRANT/auditoría/índice de `pacientes.direcciones`: policies gateadas por
`modulos.tiene_permiso('pacientes', 'read'|'write')`, `GRANT ALL` a `authenticated`, trigger de
`auditoria.log_action()` en INSERT/UPDATE/DELETE, e índice sobre `paciente_id`. Cada prestación
pertenece a exactamente un paciente; el catálogo MUST NOT ser compartido entre pacientes.

#### Scenario: Alta de una prestación

- GIVEN un paciente existente sin prestaciones
- WHEN se da de alta una prestación con `nombre` no vacío
- THEN queda registrada con `activa = true` y visible en la ficha del paciente

#### Scenario: Prestaciones aisladas por paciente

- GIVEN dos pacientes con una prestación de igual `nombre`
- WHEN se consulta el catálogo de cada uno
- THEN cada paciente ve únicamente sus propias filas, sin cruce entre catálogos

### Requirement: Baja lógica, nunca borrado físico

El sistema SHALL implementar la baja de una prestación como `UPDATE ... SET activa = false`. El
sistema MUST NOT emitir un `DELETE` real sobre `pacientes.prestaciones` desde la UI. Una
prestación inactiva MUST seguir siendo una fila válida y legible, referenciable por presupuestos
ya emitidos.

#### Scenario: Baja de una prestación sin presupuestos asociados

- GIVEN una prestación activa sin presupuestos que la referencien
- WHEN el usuario la da de baja desde `PrestacionesEditor`
- THEN la fila pasa a `activa = false`
- AND no se emite ningún `DELETE`

#### Scenario: Baja de una prestación con presupuestos asociados requiere confirmación

- GIVEN una prestación activa referenciada por al menos un presupuesto existente
- WHEN el usuario intenta darla de baja
- THEN `PrestacionesEditor` muestra una confirmación explícita antes de aplicar `activa = false`
- AND, confirmada, la baja no afecta los presupuestos que ya la referencian

#### Scenario: Prestación inactiva sigue siendo legible donde ya se usó

- GIVEN una prestación con `activa = false` referenciada por un presupuesto existente
- WHEN se abre el detalle de ese presupuesto
- THEN el nombre de la prestación se muestra normalmente, sin error ni FK rota

### Requirement: Edición in-place del catálogo

El sistema SHALL permitir editar `nombre` y `descripcion` de una prestación existente sin afectar
`activa` ni el historial de presupuestos que la referencian.

#### Scenario: Edición de nombre y descripción

- GIVEN una prestación activa
- WHEN el usuario edita su `nombre` y/o `descripcion` desde `PrestacionesEditor`
- THEN los cambios se persisten
- AND `activa` y los presupuestos que la referencian no se ven afectados

### Requirement: Sección de prestaciones en la ficha del paciente

El sistema SHALL exponer el catálogo como una sección nueva embebida en `PacienteDetail.tsx`,
gateada por permisos del módulo `pacientes`, con el mismo patrón de UI (alta/edición/baja
in-place, sin modal) que `DireccionesEditor`.

#### Scenario: Usuario sin permiso de escritura en pacientes

- GIVEN un usuario con `pacientes: read` pero sin `pacientes: write`
- WHEN visita la sección de prestaciones de un paciente
- THEN puede ver el catálogo
- AND no puede dar de alta, editar ni dar de baja ninguna prestación
