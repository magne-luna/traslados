-- Migration: requisitos_actividad
-- Change: documentos-checklist-items-por-actividad (design.md D4, Checkpoint (a) VEREDICTO opción
-- A, tasks.md 1.2/1.5/3.1-3.4)
--
-- ¿Qué agrega? Ítems documentales propios de cada TIPO de actividad (escuela, escuela especial,
-- terapia, CET, otro) -- independientes del checklist por obra social (obra_social.requisitos_os),
-- ADITIVOS sobre él (nunca lo reemplazan; la unión la hace `combinarItemsDeActividad()` en el
-- frontend, `actividadDocumental.ts`). Regla de negocio confirmada por Andrea Pastor (relayado por
-- la usuaria, 2026-08-10, tasks.md 0.1): "sí, cambian -- cada actividad tiene su propia
-- documentación, no son los mismos ítems repetidos". Primera regla de este dominio con esa marca
-- desde `documentos-checklist-por-actividad` (2026-08-07).
--
-- Espejo estructural EXACTO de obra_social.requisitos_os (20260724100003_schema_obra_social.sql):
-- misma forma (id, FK a un catálogo compartido, orden, requerido, UNIQUE de scope), mismo schema,
-- mismo módulo de gateo. Reusa `obra_social.tipos_documento` (veredicto 1.2 opción A) -- nunca un
-- segundo universo de nombres de documento: "Autorización" es el mismo `tipos_documento.id` venga
-- de la obra social o de la escuela, condición necesaria para que el dedup de
-- `combinarItemsDeActividad()` compare por identidad real, no por string.
--
-- Scope: GLOBAL por tipo de actividad (veredicto 1.5, Checkpoint (e)) -- SIN `obra_social_id`.
-- `UNIQUE(tipo_lugar, tipo_documento_id)`: hasta 5 listas en total (`domicilio` queda fuera por
-- definición de actividad -- lo aplica el propio dominio del enum, no un CHECK adicional, mismo
-- criterio que el resto del proyecto: `obtenerActividadesConChecklist()` ya filtra `domicilio` en
-- el frontend).
--
-- Schema/módulo (veredicto 1.2, sub-pregunta -- decidido explícitamente, no por descarte):
-- `obra_social`, mismo módulo que gatea `requisitos_os` hoy
-- (`modulos.tiene_permiso('obra_social', ...)`). Precedente del riesgo de decidir mal:
-- `integracion-documentos` encontró el bucket `documentos-vehiculos` gateado por `conductores` en
-- vez de `vehiculos` -- acá el veredicto quedó registrado en `tasks.md` 1.2 antes de escribir esta
-- migración, no inferido.
--
-- `tipo_lugar pacientes.tipo_direccion`, con CAST EXPLÍCITO en cualquier escritura desde
-- frontend/RPC -- `text` no castea implícitamente a un enum de usuario (bug ya visto y corregido en
-- `20260807000000_crear_paciente_completo_tipo_lugar_cast.sql`).
--
-- ⚠️ SCHEMA DRIFT ENCONTRADO Y VERIFICADO EN VIVO (no corregido acá, fuera de alcance de este
-- change -- documentado en `knowledge-base/04_modelo_de_datos.md` §Discrepancias, tasks.md 8.1): el
-- ARCHIVO `20260729120000_schema_pacientes_gaps.sql` de este repo declara
-- `CREATE TYPE pacientes.tipo_direccion AS ENUM (..., 'ciset', ...)`, pero el enum REAL en
-- `pkryfoljypuzfifofdwp` (verificado con `enum_range(NULL::pacientes.tipo_direccion)` contra el
-- proyecto real, 2026-08-10) ya tiene `'cet'`, no `'ciset'` -- coincide con el frontend
-- (`TipoDireccion`, `shared/types/paciente.ts:20`) y con la KB (`06_funcionalidades.md`,
-- `07_flujos_principales.md`). Alguien corrigió el enum directamente contra la base en algún
-- momento, sin que quedara un archivo de migración que lo documente -- el repo de migraciones
-- **no** refleja el estado real de este enum. Se verificó funcionalmente creando una fila de prueba
-- con `tipo_lugar: 'cet'` contra esta tabla nueva: **funciona sin error**, confirmando que la base
-- real ya tiene `'cet'`. Fila de prueba borrada al terminar la verificación.
--
-- Quitar un ítem de la configuración con documentos ya cargados contra él (design.md §Risks,
-- tasks.md 3.4): NO se bloquea -- mismo precedente ya aceptado en este proyecto para
-- `obra_social.requisitos_os` (`actualizar_obra_social_completa` hace `DELETE` + re-`INSERT`
-- completo del checklist sin verificar si hay documentos cargados contra los ítems que se quitan).
-- El documento ya cargado no se pierde: `pacientes.documentos.id_tipo_documento` sigue apuntando a
-- `tipos_documento` (`ON DELETE RESTRICT` protege ESE catálogo); solo deja de listarse en el
-- checklist de esa actividad si el ítem ya no está configurado para su tipo -- mismo espíritu que
-- la advertencia al quitar una actividad con documentos (`documentos-checklist-por-actividad`,
-- Checkpoint (e)), sin construir acá una advertencia equivalente (no pedida, fuera de alcance).

CREATE TABLE obra_social.requisitos_actividad (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo_lugar pacientes.tipo_direccion NOT NULL,
    tipo_documento_id UUID NOT NULL REFERENCES obra_social.tipos_documento(id) ON DELETE RESTRICT,
    requerido BOOLEAN NOT NULL DEFAULT true,
    orden INT NOT NULL DEFAULT 0,
    UNIQUE(tipo_lugar, tipo_documento_id)
);

COMMENT ON TABLE obra_social.requisitos_actividad IS
  'Ítems documentales propios de cada tipo de actividad (escuela, terapia, CET, ...), ADITIVOS '
  'sobre el checklist de la obra social -- combinarItemsDeActividad() en el frontend hace la unión. '
  'Configuración GLOBAL por tipo (sin obra_social_id) -- documentos-checklist-items-por-actividad, '
  'design.md Checkpoint (a)/(e), veredictos 1.2/1.5.';

COMMENT ON COLUMN obra_social.requisitos_actividad.tipo_lugar IS
  'pacientes.tipo_direccion -- ⚠️ el archivo de migración que crea este enum '
  '(20260729120000_schema_pacientes_gaps.sql) quedó desactualizado contra la base real: declara '
  'el literal ''ciset'', pero el enum real ya tiene ''cet'' (schema drift, ver cabecera de esta '
  'migración y knowledge-base/04_modelo_de_datos.md §Discrepancias).';

CREATE INDEX idx_requisitos_actividad_tipo_lugar ON obra_social.requisitos_actividad(tipo_lugar);

-- RLS
ALTER TABLE obra_social.requisitos_actividad ENABLE ROW LEVEL SECURITY;

-- GRANT explícito por tabla (no `ALL TABLES IN SCHEMA`, que solo cubrió las tablas que existían al
-- momento de 20260724100003 -- mismo criterio que 20260801110000_prestadores_vinculo_obra_social.sql
-- ya tuvo que repetir para su propia tabla nueva).
GRANT ALL ON obra_social.requisitos_actividad TO authenticated;

-- Mismo gate de módulo que obra_social.requisitos_os/tipos_documento (veredicto 1.2): FOR ALL con
-- USING y sin WITH CHECK -- PostgreSQL usa USING también como check de INSERT en policies FOR ALL.
CREATE POLICY "Read requisitos_actividad" ON obra_social.requisitos_actividad FOR SELECT TO authenticated USING (modulos.tiene_permiso('obra_social', 'read'));
CREATE POLICY "Write requisitos_actividad" ON obra_social.requisitos_actividad FOR ALL TO authenticated USING (modulos.tiene_permiso('obra_social', 'write'));

-- Auditoría (RN-GL-02, regla dura del proyecto: toda tabla de configuración lleva trigger).
CREATE TRIGGER trg_audit_requisitos_actividad AFTER INSERT OR UPDATE OR DELETE ON obra_social.requisitos_actividad FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();

-- Rollback:
-- DROP TRIGGER IF EXISTS trg_audit_requisitos_actividad ON obra_social.requisitos_actividad;
-- DROP POLICY IF EXISTS "Write requisitos_actividad" ON obra_social.requisitos_actividad;
-- DROP POLICY IF EXISTS "Read requisitos_actividad" ON obra_social.requisitos_actividad;
-- DROP INDEX IF EXISTS obra_social.idx_requisitos_actividad_tipo_lugar;
-- DROP TABLE IF EXISTS obra_social.requisitos_actividad;
-- Aditiva y sin referencias ENTRANTES desde ninguna otra tabla (pacientes.documentos referencia
-- tipos_documento directamente, nunca requisitos_actividad) -- el rollback no pierde ningún
-- documento cargado en ningún escenario.
