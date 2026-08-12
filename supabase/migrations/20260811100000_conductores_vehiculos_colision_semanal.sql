-- Migration: conductores_vehiculos_colision_semanal
-- Change: integracion-conductores-vehiculos (design.md D7 §Colisión, tasks.md 1B.6/1B.7)
--
-- ¿Qué hace? Bloquea a nivel de base la colisión de asignación semanal: un mismo conductor no
-- puede tener dos asignaciones de vehículo con la misma `fecha_init`. Decisión de la usuaria
-- (tasks.md 0.1): se bloquea SIEMPRE, sin excepción y sin override -- no hay flag
-- `permitirMultiple` ni validación en aplicación, la barrera es este constraint.
--
-- Precondición verificada en vivo (tasks.md 1.7, 2026-08-11):
--   select conductor_id, fecha_init, count(*), array_agg(vehiculo_id)
--   from conductores.conductores_vehiculos
--   group by conductor_id, fecha_init
--   having count(*) > 1;
-- Cero filas. La tabla además está vacía (`count(*) = 0`, verificado en la misma sesión), así que
-- no hay ningún escenario en el que este ADD CONSTRAINT pueda fallar por datos existentes.
--
-- `ADD CONSTRAINT ... UNIQUE` no admite `NOT VALID` (a diferencia de un CHECK) -- construye el
-- índice y valida en el mismo paso. Sin problema acá porque la tabla está vacía.
--
-- Constraint CON NOMBRE, no un `CREATE UNIQUE INDEX` suelto: el nombre es lo que Postgres reporta
-- en el error de `23505` y es lo único que permite a `mapearErrorConductor` (tasks.md 7.4b/7.6)
-- distinguir los DOS `23505` posibles sobre esta tabla:
--   - `uq_conductor_semana` (este) -> "Ese conductor ya tiene OTRO vehículo asignado en esa semana."
--   - `conductores_vehiculos_conductor_id_vehiculo_id_fecha_init_key` (ya existe, sin tocar) ->
--     "Ese conductor ya tiene ESE vehículo asignado en esa semana."
--
-- No es un índice parcial: `conductores_vehiculos` no tiene soft-delete ni columna `estado`/
-- `activo` -- todas las filas son asignaciones vigentes, no hay nada que filtrar.
--
-- El UNIQUE(conductor_id, vehiculo_id, fecha_init) existente
-- (`conductores_vehiculos_conductor_id_vehiculo_id_fecha_init_key`) queda como está: este nuevo
-- constraint lo subsume pero no se borra nada que una migración previa haya creado.
--
-- Rollback: ALTER TABLE conductores.conductores_vehiculos DROP CONSTRAINT uq_conductor_semana;
-- No pierde información -- solo vuelve a permitir la colisión que este change decidió bloquear.

ALTER TABLE conductores.conductores_vehiculos
  ADD CONSTRAINT uq_conductor_semana UNIQUE (conductor_id, fecha_init);

COMMENT ON CONSTRAINT uq_conductor_semana ON conductores.conductores_vehiculos IS
  'Bloquea colisión de asignación semanal: un conductor no puede tener dos vehículos asignados con '
  'la misma fecha_init. Sin excepción ni override (integracion-conductores-vehiculos, D7 §Colisión) '
  '-- el nombre del constraint es lo que distingue este 23505 del de '
  'conductores_vehiculos_conductor_id_vehiculo_id_fecha_init_key en mapearErrorConductor.';
