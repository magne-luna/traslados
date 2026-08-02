-- Migration: prestadores_vinculo_obra_social
-- Change: prestadores-crud (rama de demo). Supuesto provisorio #1 del proposal: relación N:N entre
-- ObraSocial y Prestador, SIN confirmar con Andrea.
--
-- ⚠️ ALCANCE: work unit 4 (vínculo N:N) de la cadena de PRs de prestadores-crud (chain strategy:
-- feature-branch-chain sobre feature/prestadores-crud). Completa el par que
-- 20260801100000_prestadores_condiciones.sql había dejado explícitamente diferido (ver el
-- comentario "⚠️ ALCANCE DE ESTA MIGRACIÓN" de ese archivo): acá va exclusivamente la tabla de
-- vínculo `obra_social.obra_social_prestador`, su índice, su RLS y su trigger de auditoría — nada
-- de esto toca `obra_social.prestadores` ni `obra_social.obra_social` (esas dos ya existen y no se
-- alteran acá). Ninguna sentencia SQL cambia respecto al bloque conceptual único que describe
-- design.md D2/D3 de `prestadores-crud`, solo el corte de archivo entre PRs de esta rama de demo.
--
-- ⚠️ Se redacta como artefacto de diseño. NO se aplica desde el agente: `supabase db push` es
-- siempre acción explícita de Enzo (ver tasks.md 7.4 — bloqueado, requiere a Enzo).

-- Sin `id` surrogate (D2 de design.md): la fila es identidad-libre, no guarda ningún dato propio
-- además del par — la PK compuesta da la unicidad gratis y evita el daño que causaría apoyarse en
-- el id de una fila de vínculo (desvincular y volver a vincular generaría un id nuevo).
CREATE TABLE obra_social.obra_social_prestador (
    obra_social_id UUID NOT NULL REFERENCES obra_social.obra_social(id) ON DELETE CASCADE,
    prestador_id   UUID NOT NULL REFERENCES obra_social.prestadores(id)  ON DELETE CASCADE,
    PRIMARY KEY (obra_social_id, prestador_id)
);

-- Índice explícito sobre prestador_id (D2): la PK compuesta ya indexa (obra_social_id,
-- prestador_id), que sirve para "prestadores de esta obra social" pero no para el sentido
-- inverso, que es justamente el que consulta PrestadoresDeObraSocial.tsx.
CREATE INDEX idx_obra_social_prestador_prestador ON obra_social.obra_social_prestador(prestador_id);

ALTER TABLE obra_social.obra_social_prestador ENABLE ROW LEVEL SECURITY;
-- GRANT explícito por tabla (no ALL TABLES IN SCHEMA, que ya se usó una sola vez en
-- 20260724100003:42 y no alcanza a tablas futuras — mismo criterio que
-- 20260729110000_schema_obra_social_facturacion_config.sql tuvo que repetir para plantilla_campo).
GRANT ALL ON obra_social.obra_social_prestador TO authenticated;

-- Mismo gate de módulo que obra_social.prestadores (D2): FOR ALL con USING y sin WITH CHECK, igual
-- que las policies ya vigentes del schema — PostgreSQL usa USING también como check de INSERT.
CREATE POLICY "Read obra_social_prestador" ON obra_social.obra_social_prestador FOR SELECT TO authenticated USING (modulos.tiene_permiso('obra_social', 'read'));
CREATE POLICY "Write obra_social_prestador" ON obra_social.obra_social_prestador FOR ALL TO authenticated USING (modulos.tiene_permiso('obra_social', 'write'));

-- RN-GL-02 exige rastro de toda escritura; quién vinculó a quién es del tipo de dato que Andrea va
-- a querer auditar. auditoria.log_action() usa row_to_json(NEW)/TG_TABLE_NAME sin tocar NEW.id, así
-- que la PK compuesta no lo rompe (verificado en 20260724100001:27-44).
CREATE TRIGGER trg_audit_obra_social_prestador AFTER INSERT OR UPDATE OR DELETE ON obra_social.obra_social_prestador FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
