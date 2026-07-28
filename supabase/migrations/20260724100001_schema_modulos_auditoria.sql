-- Schema: auditoria (Triggers and logs)
CREATE SCHEMA IF NOT EXISTS auditoria;

-- Revoke everything from anon to ensure safety
REVOKE ALL ON SCHEMA auditoria FROM anon, authenticated;

CREATE TABLE auditoria.logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tabla_afectada TEXT NOT NULL,
    accion TEXT NOT NULL,
    usuario_id UUID,
    datos_viejos JSONB,
    datos_nuevos JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE auditoria.logs ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA auditoria TO authenticated;
GRANT SELECT ON auditoria.logs TO authenticated;

-- Policy: any authenticated user can read the audit trail (per the docx: "Es de solo lectura
-- para los usuarios autenticados"). Defined in 20260724100002_schema_usuarios.sql instead of
-- here, purely because that file is where the rest of the review/fix commentary lives.

-- Function: Trigger to log CRUD operations
CREATE OR REPLACE FUNCTION auditoria.log_action()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO auditoria.logs (tabla_afectada, accion, usuario_id, datos_viejos, datos_nuevos)
    VALUES (
        TG_TABLE_NAME,
        TG_OP,
        auth.uid(),
        CASE WHEN TG_OP IN ('DELETE', 'UPDATE') THEN row_to_json(OLD)::jsonb ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::jsonb ELSE NULL END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Schema: modulos
CREATE SCHEMA IF NOT EXISTS modulos;
REVOKE ALL ON SCHEMA modulos FROM anon;
GRANT USAGE ON SCHEMA modulos TO authenticated;

CREATE TYPE modulos.nivel_acceso AS ENUM ('read', 'write', 'admin');

CREATE TABLE modulos.modulos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_modulo TEXT NOT NULL UNIQUE
);

CREATE TABLE modulos.permisos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL, -- Logical ref to auth.users
  modulo_id UUID NOT NULL REFERENCES modulos.modulos(id) ON DELETE CASCADE,
  nivel_acceso modulos.nivel_acceso NOT NULL,
  UNIQUE(usuario_id, modulo_id)
);

ALTER TABLE modulos.modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE modulos.permisos ENABLE ROW LEVEL SECURITY;

-- Grants for modulos
GRANT ALL ON modulos.modulos TO authenticated;
GRANT ALL ON modulos.permisos TO authenticated;

-- Base read policies so the function works or people can see their own permissions if needed
CREATE POLICY "Everyone can read modulos" ON modulos.modulos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can read own permissions" ON modulos.permisos FOR SELECT TO authenticated USING (usuario_id = auth.uid());

-- Function: Check permission via SECURITY DEFINER
CREATE OR REPLACE FUNCTION modulos.tiene_permiso(modulo_req text, nivel_req modulos.nivel_acceso)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM modulos.permisos p
    JOIN modulos.modulos m ON p.modulo_id = m.id
    WHERE p.usuario_id = auth.uid() 
      AND m.tipo_modulo = modulo_req
      AND (
        p.nivel_acceso = nivel_req 
        OR p.nivel_acceso = 'admin' 
        OR (nivel_req = 'read' AND p.nivel_acceso IN ('read', 'write', 'admin'))
      )
  );
$$;

-- Add triggers to modulos and permisos
CREATE TRIGGER trg_audit_modulos AFTER INSERT OR UPDATE OR DELETE ON modulos.modulos FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_permisos AFTER INSERT OR UPDATE OR DELETE ON modulos.permisos FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
