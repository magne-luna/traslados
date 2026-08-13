-- Migration: schema_pacientes_prestaciones
-- Change: presupuesto-prestaciones (design.md D1, D7, tasks.md 3.1) -- PR 1 de 3 ("catálogo de
-- prestaciones"). Gate §0 de tasks.md aprobado explícitamente por la usuaria (D1/D2/D3) antes de
-- escribir esta migración.
--
-- ¿Qué agrega? Catálogo de prestaciones PROPIO de cada paciente (D7: `paciente_id NOT NULL`, sin
-- catálogo global -- dos pacientes con la misma prestación tienen dos filas distintas, mismo
-- criterio que `pacientes.personas_a_cargo`). Calco estructural de `pacientes.direcciones`
-- (20260724100004_schema_pacientes.sql:62-68): misma forma de FK `ON DELETE CASCADE`, mismo módulo
-- de RLS (`pacientes`), mismo trigger de auditoría, con UNA columna extra: `activa`.
--
-- `activa BOOLEAN NOT NULL DEFAULT true` -- borrado LÓGICO, no físico (D1, decisión explícita de la
-- usuaria sobre la recomendación original de este documento, que era `ON DELETE RESTRICT`).
-- "Quitar" una prestación desde `PrestacionesEditor` hace `UPDATE ... SET activa = false`, nunca
-- `DELETE`. Los presupuestos ya emitidos (PR 2, `facturacion.presupuesto.prestacion_id`, todavía no
-- existe) siguen apuntando a una fila inactiva sin romper su FK -- una prestación inactiva no
-- desaparece, solo deja de ofrecerse para presupuestos NUEVOS. El `ON DELETE` de esa FK futura
-- queda en el default (`NO ACTION`) como defensa en profundidad: la UI nunca emite un `DELETE` real
-- acá, pero si alguien lo hiciera a mano, la base sigue sin permitir un presupuesto financiero con
-- una FK rota.
--
-- Esta tabla es INERTE en este PR: nadie la consulta todavía. `PrestacionesEditor.tsx` (PR 1,
-- tasks.md Fase 4) es un componente controlado puro (`prestaciones`/`onChange`, sin I/O propia); el
-- wiring de lectura/escritura real contra esta tabla desde `SupabasePacienteRepository.ts` queda
-- para un PR posterior, una vez que esta migración esté aplicada (mismo criterio de "aditivo e
-- inerte hasta que el frontend lo usa" que design.md §Migration Plan documenta para las tres
-- migraciones del change).

CREATE TABLE pacientes.prestaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paciente_id UUID NOT NULL REFERENCES pacientes.paciente(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    activa BOOLEAN NOT NULL DEFAULT true
);

COMMENT ON TABLE pacientes.prestaciones IS
  'Catálogo de prestaciones del paciente (presupuesto-prestaciones, design.md D1/D7). Propio de '
  'cada paciente, sin catálogo global. Borrado LÓGICO vía `activa`, nunca DELETE físico -- una '
  'prestación con presupuestos asociados (facturacion.presupuesto.prestacion_id, PR 2) conserva su '
  'FK válida aunque se desactive.';

COMMENT ON COLUMN pacientes.prestaciones.activa IS
  'Borrado lógico (D1): false = "quitada" desde PrestacionesEditor, deja de ofrecerse para '
  'presupuestos nuevos pero los presupuestos ya emitidos siguen viéndola. Nunca hay DELETE real '
  'sobre esta tabla desde la UI.';

CREATE INDEX idx_prestaciones_paciente_id ON pacientes.prestaciones(paciente_id);

-- RLS
ALTER TABLE pacientes.prestaciones ENABLE ROW LEVEL SECURITY;

-- GRANT explícito por tabla (no `ALL TABLES IN SCHEMA`, que solo cubrió las tablas que existían al
-- momento de 20260724100004 -- mismo criterio que 20260810130000_requisitos_actividad.sql y
-- 20260801110000_prestadores_vinculo_obra_social.sql ya repitieron para sus tablas nuevas).
GRANT ALL ON pacientes.prestaciones TO authenticated;

-- Mismo módulo/gate que el resto de `pacientes.*` (20260724100004_schema_pacientes.sql:123-124,
-- policies "Read/Write direcciones"): FOR ALL con USING y sin WITH CHECK -- PostgreSQL usa USING
-- también como check de INSERT en policies FOR ALL.
CREATE POLICY "Read prestaciones" ON pacientes.prestaciones FOR SELECT TO authenticated USING (modulos.tiene_permiso('pacientes', 'read'));
CREATE POLICY "Write prestaciones" ON pacientes.prestaciones FOR ALL TO authenticated USING (modulos.tiene_permiso('pacientes', 'write'));

-- Auditoría (RN-GL-02, regla dura del proyecto: toda tabla nueva lleva trigger).
CREATE TRIGGER trg_audit_prestaciones AFTER INSERT OR UPDATE OR DELETE ON pacientes.prestaciones FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();

-- Rollback:
-- DROP TRIGGER IF EXISTS trg_audit_prestaciones ON pacientes.prestaciones;
-- DROP POLICY IF EXISTS "Write prestaciones" ON pacientes.prestaciones;
-- DROP POLICY IF EXISTS "Read prestaciones" ON pacientes.prestaciones;
-- DROP INDEX IF EXISTS pacientes.idx_prestaciones_paciente_id;
-- DROP TABLE IF EXISTS pacientes.prestaciones;
-- Aditiva. Sin referencias ENTRANTES en este PR (facturacion.presupuesto.prestacion_id se agrega
-- recién en PR 2) -- el rollback de esta tabla sola no pierde ningún dato de otro dominio. Si PR 2
-- ya está aplicado, hay que hacer `ALTER TABLE facturacion.presupuesto DROP COLUMN prestacion_id`
-- primero (la FK lo exige) -- ver design.md §Rollback.
