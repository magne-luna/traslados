CREATE SCHEMA IF NOT EXISTS usuarios;

-- Grant USAGE to anon for registration, and authenticated
GRANT USAGE ON SCHEMA usuarios TO authenticated;

CREATE TYPE usuarios.rol_enum AS ENUM ('admin', 'empleado');

CREATE TABLE usuarios.usuarios (
    id UUID PRIMARY KEY, -- Maps to auth.users
    email TEXT UNIQUE NOT NULL,
    nombre TEXT NOT NULL,
    apellido TEXT NOT NULL,
    rol usuarios.rol_enum NOT NULL DEFAULT 'empleado',
    ingreso_at TIMESTAMPTZ,
    egreso_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE usuarios.usuarios ADD CONSTRAINT fk_auth_users FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE usuarios.usuarios ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE ON ALL TABLES IN SCHEMA usuarios TO authenticated;


-- Policies
CREATE POLICY "Users can read all profiles" ON usuarios.usuarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON usuarios.usuarios FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Security Trigger: Prevent Privilege Escalation
CREATE OR REPLACE FUNCTION usuarios.prevent_rol_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Gotcha de Postgres: al ser SECURITY DEFINER, current_role pasa a ser 'postgres' aquí adentro.
  -- Usamos request.jwt.claims para saber si la query viene de la API de Supabase o es un insert local/seed.
  IF current_setting('request.jwt.claims', true) IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Si es admin global el que inserta, lo dejamos. Si no, forzamos empleado.
    IF (SELECT rol FROM usuarios.usuarios WHERE id = auth.uid()) = 'admin' THEN
      RETURN NEW;
    ELSE
      NEW.rol = 'empleado';
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.rol IS DISTINCT FROM OLD.rol THEN
      IF (SELECT rol FROM usuarios.usuarios WHERE id = auth.uid()) = 'admin' THEN
        RETURN NEW;
      ELSE
        RAISE EXCEPTION 'Privilege escalation: no puedes cambiar tu propio rol';
      END IF;
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER trg_prevent_rol_tampering
  BEFORE INSERT OR UPDATE ON usuarios.usuarios
  FOR EACH ROW EXECUTE FUNCTION usuarios.prevent_rol_tampering();

-- Audit Trigger
CREATE TRIGGER trg_audit_usuarios AFTER INSERT OR UPDATE OR DELETE ON usuarios.usuarios
FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();

-- ==========================================
-- AUTHENTICATION TRIGGER (Supabase Sync)
-- ==========================================
CREATE OR REPLACE FUNCTION usuarios.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO usuarios.usuarios (id, email, nombre, apellido, rol)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
    COALESCE(NEW.raw_user_meta_data->>'apellido', ''),
    'empleado' -- Siempre forzamos empleado de base, ignorando intentos de inyección
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION usuarios.handle_new_user();

-- ==========================================
-- ADMIN OVERRIDES
-- ==========================================
-- Admins can manage modulos and permisos
CREATE POLICY "Admins manage modulos" ON modulos.modulos FOR ALL TO authenticated USING ( (SELECT rol FROM usuarios.usuarios WHERE id = auth.uid()) = 'admin' );
CREATE POLICY "Admins manage permisos" ON modulos.permisos FOR ALL TO authenticated USING ( (SELECT rol FROM usuarios.usuarios WHERE id = auth.uid()) = 'admin' );

-- Redefine tiene_permiso to short-circuit for admins
CREATE OR REPLACE FUNCTION modulos.tiene_permiso(modulo_req text, nivel_req modulos.nivel_acceso)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM usuarios.usuarios u WHERE u.id = auth.uid() AND u.rol = 'admin'
  ) OR EXISTS (
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

-- ==========================================
-- FIXES (C-02 review): FK integrity + audit log read policy
-- ==========================================

-- modulos.permisos.usuario_id was only a "logical" reference to auth.users, no real FK —
-- a deleted account would leave orphaned permission rows.
ALTER TABLE modulos.permisos
  ADD CONSTRAINT fk_permisos_usuario FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- auditoria.logs had RLS enabled with zero policies — with RLS on and no policy, Postgres
-- denies all rows regardless of the GRANT SELECT from the other migration, so the audit
-- trail was completely unreadable via the API.
-- Corrected against the docx (Registro de Auditoría, ¿Quién puede ver/editar esto?): "Es de
-- solo lectura para los usuarios autenticados (nadie puede alterar el historial), y no es
-- accesible en absoluto para usuarios no autenticados." -- any authenticated user can read,
-- not admin-only (my first pass here wrongly restricted it to admin).
CREATE POLICY "Authenticated users can read audit logs" ON auditoria.logs
  FOR SELECT TO authenticated
  USING (true);
