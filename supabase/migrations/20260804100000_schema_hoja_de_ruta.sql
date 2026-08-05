-- Migration: schema_hoja_de_ruta
-- Change: openspec/changes/integracion-hojas-de-ruta/ (design.md Checkpoint 1 opción A, D1/D5,
-- tasks.md sección 1)
--
-- ¿Por qué existe? El docx (Traslados-Modelo-Datos.docx) no tiene entidad "Hoja de Ruta": tiene
-- "Recorridos" (agenda habitual, ya modelada en `pacientes.recorridos`) e "Historial de
-- Recorridos" (viaje realizado, sin agrupar por hoja ni por conductor). El frontend y el
-- repository de este change (`SupabaseHojaDeRutaRepository.ts`, sección 3 del apply) ya están
-- escritos y testeados contra el esquema de abajo — esta migración es la pieza de backend que
-- faltaba, nunca se había escrito (`tasks.md` 7.1 seguía sin aplicar).
--
-- Checkpoint 1 (opción A, veredicto 2026-08-04 usuaria/Enzo): repropuesta de
-- `pacientes.historial_recorridos` como paradas + dos tablas nuevas de agrupación, en vez de tres
-- tablas 100% nuevas. `historial_recorridos` ya tiene exactamente la forma de una parada
-- (`paciente_id`, `id_dir_inicial`, `id_dir_final`) y hoy es un placeholder sin consumidor.
--
-- `recorrido.conductor_id NOT NULL` (Parte B del Checkpoint 1): hereda la decisión ya tomada del
-- lado frontend en `hojas-de-ruta-ui` (RN-VE-01/RN-VE-02, US-700) — sigue siendo, formalmente, una
-- discrepancia contra el docx (no tiene "Conductor" en Historial de Recorridos), documentada en
-- `knowledge-base/04_modelo_de_datos.md` §Discrepancias como resuelta con nota de decisión, no
-- como cerrada por default. Pendiente de coordinar con el dueño del docx (tasks.md 7.4).
--
-- `historial_recorridos.fecha` es NOT NULL sin default y no tiene equivalente en el dominio nuevo
-- (`ParadaRecorrido` no modela fecha propia, vive en `HojaDeRuta.fecha`) — gap no cubierto
-- explícitamente por design.md. Las dos funciones de abajo la completan con la `fecha` de la hoja
-- de ruta dueña de la parada, para no dejar la columna legacy sin valor y sin inventar una
-- semántica nueva para ella.
--
-- Por qué `id_vehiculo`/`estado` (columnas legacy de `historial_recorridos`) no se dropean: regla
-- dura del proyecto, expand SIEMPRE aditivo, nunca se borra una columna existente. `id_vehiculo` se
-- mantiene sincronizado con `recorrido.vehiculo_id` en cada escritura (nunca diverge, ver D3 en la
-- migración de RPC que sigue a esta). `estado` queda NULL — sin consumidor todavía en este change.
--
-- Por qué `vehiculo_id`/`conductor_id` de `pacientes.recorrido` son ON DELETE RESTRICT y no
-- CASCADE: borrar un vehículo o un conductor no debería poder arrastrar el historial de a quién se
-- le asignó — mismo criterio que las FK de `recorridos`/`historial_recorridos` contra
-- `direcciones`.
--
-- ⚠️ Esta migración se redacta como artefacto de diseño del change. NO se aplica desde el agente
-- (el sandbox no tiene Docker ni credenciales de escritura sobre el proyecto real) — la aplica la
-- usuaria/Enzo con `supabase db push`, mismo patrón que el resto de la serie.

CREATE TABLE pacientes.hoja_de_ruta (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha          DATE NOT NULL,
    franja_inicio  TIME NOT NULL,
    franja_fin     TIME NOT NULL,
    notas          TEXT,
    UNIQUE (fecha) -- HojaDeRutaRepository.getByFecha asume una sola hoja por día.
);

CREATE TABLE pacientes.recorrido (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hoja_de_ruta_id UUID NOT NULL REFERENCES pacientes.hoja_de_ruta(id) ON DELETE CASCADE,
    vehiculo_id     UUID NOT NULL REFERENCES conductores.vehiculo(id) ON DELETE RESTRICT,
    conductor_id    UUID NOT NULL REFERENCES conductores.conductores(id) ON DELETE RESTRICT,
    manual          BOOLEAN NOT NULL DEFAULT false,
    notas           TEXT
);

-- Expand aditivo sobre la tabla existente (Checkpoint 1 opción A), ninguna columna se toca.
ALTER TABLE pacientes.historial_recorridos
  ADD COLUMN recorrido_id  UUID REFERENCES pacientes.recorrido(id) ON DELETE CASCADE,
  ADD COLUMN tramo         TEXT CHECK (tramo IN ('ida', 'vuelta')),
  ADD COLUMN orden         INTEGER,
  ADD COLUMN hora_estimada TIME;

COMMENT ON TABLE pacientes.historial_recorridos IS
  'Filas con recorrido_id NOT NULL son paradas de una hoja de ruta armada (integracion-hojas-de-ruta, '
  '20260804100000). El uso original de "historial" (fecha + vehículo + estado, sin agrupar) queda '
  'disponible para quien lo necesite, pero no tiene consumidor hoy.';

-- Índices para las cuatro FK nuevas, para que el embed de un solo `select` (D1/D2 del repository)
-- no dependa de un seq scan.
CREATE INDEX idx_recorrido_hoja_de_ruta_id ON pacientes.recorrido(hoja_de_ruta_id);
CREATE INDEX idx_recorrido_vehiculo_id ON pacientes.recorrido(vehiculo_id);
CREATE INDEX idx_recorrido_conductor_id ON pacientes.recorrido(conductor_id);
CREATE INDEX idx_historial_recorridos_recorrido_id ON pacientes.historial_recorridos(recorrido_id);

-- ---------------------------------------------------------------------------------------------
-- RLS (D5): mismo módulo `hojas_de_ruta` que ya gatea `recorridos`/`historial_recorridos` desde
-- `20260730140000_split_modulos_permisos.sql` — reconfirmado por tasks.md 1.3 antes de escribir
-- esto. `historial_recorridos` ya tiene RLS + trigger de auditoría propios desde
-- `20260724100004_schema_pacientes.sql`; las columnas nuevas quedan cubiertas por esas policies
-- existentes, sin nada que agregar ahí.
-- ---------------------------------------------------------------------------------------------

ALTER TABLE pacientes.hoja_de_ruta ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes.recorrido ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read hoja_de_ruta" ON pacientes.hoja_de_ruta FOR SELECT TO authenticated USING (modulos.tiene_permiso('hojas_de_ruta', 'read'));
CREATE POLICY "Write hoja_de_ruta" ON pacientes.hoja_de_ruta FOR ALL TO authenticated USING (modulos.tiene_permiso('hojas_de_ruta', 'write'));
CREATE POLICY "Read recorrido" ON pacientes.recorrido FOR SELECT TO authenticated USING (modulos.tiene_permiso('hojas_de_ruta', 'read'));
CREATE POLICY "Write recorrido" ON pacientes.recorrido FOR ALL TO authenticated USING (modulos.tiene_permiso('hojas_de_ruta', 'write'));

CREATE TRIGGER trg_audit_hoja_de_ruta AFTER INSERT OR UPDATE OR DELETE ON pacientes.hoja_de_ruta FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_recorrido AFTER INSERT OR UPDATE OR DELETE ON pacientes.recorrido FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();

GRANT ALL ON pacientes.hoja_de_ruta TO authenticated;
GRANT ALL ON pacientes.recorrido TO authenticated;
