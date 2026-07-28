-- Migration: track_ingreso_egreso
-- Description: RF-004 (registro de ingreso/egreso, prioridad Media) — mantiene
-- usuarios.usuarios.ingreso_at / egreso_at actualizados automáticamente, sin intervención
-- de la aplicación.
--
-- Ingreso: auth.users.last_sign_in_at ya es la columna estable de Supabase Auth para el
-- último inicio de sesión exitoso — no hace falta inventar nada, solo copiarla.
CREATE OR REPLACE FUNCTION usuarios.track_ingreso()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
    UPDATE usuarios.usuarios SET ingreso_at = NEW.last_sign_in_at WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_track_ingreso
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION usuarios.track_ingreso();

-- Egreso: auth.users no tiene una columna equivalente de "último cierre de sesión" — Supabase
-- Auth sí registra un evento action = 'logout' por cada cierre de sesión en su propio
-- audit log (auth.audit_log_entries), que es de donde lo tomamos.
CREATE OR REPLACE FUNCTION usuarios.track_egreso()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id uuid;
BEGIN
  IF NEW.payload->>'action' = 'logout' THEN
    actor_id := (NEW.payload->>'actor_id')::uuid;
    UPDATE usuarios.usuarios SET egreso_at = NEW.created_at WHERE id = actor_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_track_egreso
  AFTER INSERT ON auth.audit_log_entries
  FOR EACH ROW EXECUTE FUNCTION usuarios.track_egreso();
