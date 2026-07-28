-- Migration: create_buckets
-- Description: Create 4 private storage buckets for document attachments.
-- All buckets are private (public: false) — access is controlled via RLS policies
-- defined in later migrations (C-02+).
--
-- Bug fix (deploy attempt, C-02 push): storage.create_bucket() is a Supabase client/REST
-- method, not a callable Postgres SQL function -- it doesn't exist at the SQL level, so this
-- migration failed with "function storage.create_bucket(unknown, jsonb) does not exist" on
-- first real push. The correct SQL-level equivalent is a direct insert into storage.buckets.

INSERT INTO storage.buckets (id, name, public) VALUES
  ('documentos-pacientes', 'documentos-pacientes', false),
  ('documentos-vehiculos', 'documentos-vehiculos', false),
  ('documentos-conductores', 'documentos-conductores', false),
  ('documentos-facturas', 'documentos-facturas', false)
ON CONFLICT (id) DO NOTHING;
