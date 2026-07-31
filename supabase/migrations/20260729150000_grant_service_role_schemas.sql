-- Migration: grant_service_role_schemas
-- Description: Bug real encontrado probando login end-to-end: cada schema custom solo le
-- otorgaba USAGE a 'authenticated', nunca a 'service_role'. Aunque service_role bypasea RLS,
-- sigue necesitando el GRANT de schema/tabla como cualquier otro rol -- BYPASSRLS no reemplaza
-- los permisos de objeto. Sin esto, toda Edge Function que usa el cliente service-role fallaba
-- con "permission denied for schema X" al primer intento real.

GRANT USAGE ON SCHEMA usuarios TO service_role;
GRANT USAGE ON SCHEMA modulos TO service_role;
GRANT USAGE ON SCHEMA auditoria TO service_role;
GRANT USAGE ON SCHEMA obra_social TO service_role;
GRANT USAGE ON SCHEMA pacientes TO service_role;
GRANT USAGE ON SCHEMA facturacion TO service_role;
GRANT USAGE ON SCHEMA conductores TO service_role;

GRANT ALL ON ALL TABLES IN SCHEMA usuarios TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA modulos TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA auditoria TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA obra_social TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA pacientes TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA facturacion TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA conductores TO service_role;

-- Para que las futuras tablas de cada schema hereden el mismo grant sin tener que acordarse
-- de repetirlo migracion por migracion.
ALTER DEFAULT PRIVILEGES IN SCHEMA usuarios GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA modulos GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA auditoria GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA obra_social GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA pacientes GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA facturacion GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA conductores GRANT ALL ON TABLES TO service_role;
