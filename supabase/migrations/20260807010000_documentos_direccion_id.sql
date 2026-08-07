-- Migration: documentos_direccion_id
-- Description: documentos-checklist-por-actividad (design.md Checkpoint (b)/(h)) necesita que un
-- documento de pacientes.documentos pueda pertenecer a una actividad puntual (Direccion) en vez de
-- ser siempre "general". El frontend ya mandaba agrupacionId end-to-end (§2 del change, contra el
-- mock), pero SupabaseDocumentoRepository.ts lo ignoraba por completo porque esta columna no
-- existía -- bug real hallado en verificación manual (tasks.md §9, 2026-08-07): todos los
-- documentos de un paciente aparecían en TODOS los bloques de actividad por igual, sin ninguna
-- aislación real, porque no había dónde guardar/filtrar la agrupación.
-- ON DELETE RESTRICT (mismo criterio que pacientes.recorridos.id_dir_inicial/id_dir_final): borrar
-- una Direccion con documentos cargados debe fallar explícitamente, nunca huerfanar ni perder
-- documentación clínica en silencio -- refuerza a nivel de base la advertencia que ya pide
-- confirmación en la UI (Checkpoint (e) de documentos-checklist-por-actividad, tasks.md §6).
-- Migración 100% aditiva: ninguna columna existente se altera ni se borra. NULL = documentación
-- general del paciente, sin actividad puntual (comportamiento actual, sin cambios).

ALTER TABLE pacientes.documentos ADD COLUMN direccion_id UUID REFERENCES pacientes.direcciones(id) ON DELETE RESTRICT;

COMMENT ON COLUMN pacientes.documentos.direccion_id IS
  'Actividad (Direccion) a la que pertenece este documento -- NULL = documentación general del paciente, sin actividad puntual (documentos-checklist-por-actividad, design.md Checkpoint (b)/(h)).';

-- Rollback:
-- ALTER TABLE pacientes.documentos DROP COLUMN direccion_id;
