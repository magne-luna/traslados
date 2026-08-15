-- Migration: catalogo_accesorios_icono_activa
-- Description: Hace gestionable al catalogo global de accesorios de movilidad
-- (pacientes.accesorios): agrega icono (string, clave del mapeo del design system) y activa
-- (baja logica, mismo criterio que pacientes.prestaciones). Ajusta la policy de LECTURA para que
-- los selectores de Vehiculo/Conductor (modulos vehiculos/conductores) puedan leer el catalogo
-- activo sin RPC ni Edge Function intermediaria; la escritura sigue siendo SOLO para pacientes.
--
-- Aditiva e inerte: las columnas nuevas no tienen lectores hasta que el frontend las consume.
-- SIN CREATE FUNCTION (sin RPC ni SECURITY DEFINER). La escribe el agente; la aplica la usuaria/Enzo.

ALTER TABLE pacientes.accesorios ADD COLUMN icono TEXT;

-- Backfill: la clave de icono es el propio tipo (los 5 valores del seed son claves del design system).
UPDATE pacientes.accesorios SET icono = tipo WHERE icono IS NULL;

ALTER TABLE pacientes.accesorios ALTER COLUMN icono SET NOT NULL;

ALTER TABLE pacientes.accesorios ADD COLUMN activa BOOLEAN NOT NULL DEFAULT true;

-- Policy de LECTURA: el catalogo es compartido por Pacientes, Vehiculos y Conductores (docx
-- "Este mismo catalogo de Accesorios es reutilizado por el Area de Conductores"). El selector de
-- Vehiculo esta en el modulo vehiculos pero lee pacientes.accesorios; con la policy vieja (solo
-- pacientes) un usuario vehiculos-only recibiria 42501. Se amplia el SELECT a los modulos
-- consumidores; la WRITE ("Write accesorios") queda intacta, SOLO pacientes.
DROP POLICY IF EXISTS "Read accesorios" ON pacientes.accesorios;
CREATE POLICY "Read accesorios" ON pacientes.accesorios FOR SELECT TO authenticated
  USING (
    modulos.tiene_permiso('pacientes', 'read')
    OR modulos.tiene_permiso('vehiculos', 'read')
    OR modulos.tiene_permiso('conductores', 'read')
  );