# Supabase Project Setup — Specification

## Purpose

Establecer la configuración base del proyecto Supabase: variables de entorno para conectar al proyecto existente, estructura de migraciones versionadas, y el mecanismo de bootstrap para crear los buckets de storage que todo el sistema consume.

## Requirements

### Requirement: Variables de entorno

El sistema MUST definir `SUPABASE_URL` y `SUPABASE_ANON_KEY` en `frontend/.env` para que el cliente de Supabase pueda conectarse al proyecto existente.

#### Scenario: Env vars presentes en archivo .env

- GIVEN un archivo `frontend/.env` en el proyecto
- WHEN se inspecciona su contenido
- THEN `SUPABASE_URL` está definido con la URL del proyecto Supabase
- AND `SUPABASE_ANON_KEY` está definido con la anon key del proyecto

#### Scenario: Frontend compila sin env vars

- GIVEN que `SUPABASE_URL` y `SUPABASE_ANON_KEY` no están definidos en el entorno
- WHEN se ejecuta `tsc -b --noEmit` en `frontend/`
- THEN la compilación no falla
- AND el build de producción no se interrumpe

### Requirement: Migraciones versionadas

El sistema MUST proveer una carpeta `supabase/migrations/` con archivos SQL nombrados según el formato `YYYYMMDDHHMMSS_description.sql` para versionar todos los cambios de base de datos y storage.

#### Scenario: Migración inicial ejecutable

- GIVEN la carpeta `supabase/migrations/` existe
- WHEN se ejecuta el primer archivo SQL contra la base de datos Supabase
- THEN la migración se aplica sin errores
- AND la tabla `_supabase_migrations` registra el nombre del archivo aplicado

#### Scenario: Migraciones ordenadas por timestamp

- GIVEN múltiples archivos SQL en `supabase/migrations/`
- WHEN se listan ordenados alfabéticamente
- THEN el orden coincide con la secuencia de creación (timestamp ascendente)

### Requirement: Tabla de control de migraciones

El sistema MUST crear y mantener la tabla `_supabase_migrations` que registra qué migraciones se han aplicado, para evitar aplicar dos veces el mismo cambio.

#### Scenario: Migración no duplicada

- GIVEN una migración ya registrada en `_supabase_migrations`
- WHEN se intenta aplicar la misma migración nuevamente
- THEN el sistema salta la migración sin errores
