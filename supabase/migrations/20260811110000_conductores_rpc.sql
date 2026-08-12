-- Migration: conductores_rpc
-- Change: openspec/changes/integracion-conductores-vehiculos/ (design.md D9/D11/D12, tasks.md §7,
-- §1B.8 reconciliado)
--
-- ¿Por qué existe? Dar de alta o editar un conductor escribe en 2 tablas
-- (`conductores.conductores`, `conductores.conductores_vehiculos`). PostgREST no da transacciones
-- entre requests: cada `insert()`/`update()` de supabase-js es un request HTTP que commitea por su
-- cuenta. Una secuencia cortada a mitad dejaría un conductor con asignaciones que no le
-- corresponden, o sin ninguna.
--
-- ⚠️ Reconciliación con §1B.8 (histórico): la versión original de este documento planeaba UNA sola
-- migración con 4 funciones (2 de vehículo + 2 de conductor). Las 2 de **vehículo** quedaron SIN
-- OBJETO — Enzo resolvió la atomicidad de Vehículos con la Edge Function
-- `supabase/functions/vehiculos/index.ts` (service-role), no con RPC (ver §5 de tasks.md). Esta
-- migración escribe **solo** las 2 de **conductor**, que sí siguen el plan original: no existe
-- ninguna Edge Function `conductores` en `supabase/functions/` (verificado, tasks.md §7).
--
-- ⚠️⚠️ SECURITY INVOKER — NO TOCAR ⚠️⚠️
-- Las dos funciones DEBEN ser `SECURITY INVOKER`. Convertir cualquiera de las dos a
-- `SECURITY DEFINER` sería una REGRESIÓN DE SEGURIDAD grave: el owner es `postgres`
-- (superusuario), que bypassea RLS por completo — cualquier autenticado, incluso sin
-- `modulos.tiene_permiso('conductores', 'write')`, podría dar de alta y editar conductores
-- completos (datos personales) y, peor, escribir en `conductores.conductores_vehiculos`, que está
-- gateada por el módulo **`vehiculos`**, no `conductores` (design.md D9/D10 — el caso
-- contra-intuitivo del change: la pantalla de Conductores necesita el permiso de Vehículos para su
-- grilla de asignación semanal).
--
-- Cómo se hace cumplir el permiso, verificado contra las policies vigentes
-- (`20260730140000_split_modulos_permisos.sql`, tasks.md 1.5):
--   conductores.conductores          -> USING (modulos.tiene_permiso('conductores', 'write'))
--   conductores.conductores_vehiculos -> USING (modulos.tiene_permiso('vehiculos', 'write'))
-- Las policies son `FOR ALL` con `USING` y sin `WITH CHECK`: Postgres usa la expresión de `USING`
-- también como check de INSERT (mismo detalle que el resto de la serie de RPC del proyecto). Un
-- usuario con `conductores: write` pero sin `vehiculos: write` puede guardar los datos personales
-- del conductor; guardar una asignación sin ese permiso falla con `42501` y hace rollback total de
-- la transacción (nunca deja un conductor con asignaciones a medio guardar).
--
-- `SET search_path = ''` en las dos, `REVOKE ALL … FROM PUBLIC` y `FROM anon`,
-- `GRANT EXECUTE … TO authenticated`, y `COMMENT ON FUNCTION` con la prohibición de `DEFINER`
-- escrita para quien lea la base sin abrir este documento.
--
-- Semántica de colecciones: reemplazo completo, no diff (D9) — ningún id de
-- `conductores_vehiculos` es referenciado desde afuera del agregado (D9 §Semántica de
-- colecciones), así que `DELETE` + `INSERT` dentro de la transacción es seguro. La columna `id` de
-- cada asignación no se lee del payload: la tabla la genera con su propio `DEFAULT
-- gen_random_uuid()`, igual que ya hacen `replaceGastos()`/`replaceMantenimientos()` del lado de la
-- Edge Function de Vehículos con sus propias colecciones hijas identidad-libre.
--
-- Semántica parcial de `p_cambios` (solo en `actualizar_conductor_completo`): la ausencia de una
-- clave significa "no tocar". Se distingue con el operador `?` de `jsonb` (`p_cambios ?
-- 'asignaciones'`), que diferencia *clave ausente* de *clave presente con valor `[]`* — editar solo
-- el teléfono no debe vaciar las asignaciones del conductor. Mismo patrón que
-- `pacientes.actualizar_hoja_de_ruta_completa` (`20260804110000_hoja_de_ruta_rpc.sql`).
--
-- RN-GL-03: los conductores no acceden al sistema. Estas dos funciones tocan únicamente
-- `conductores.conductores` y `conductores.conductores_vehiculos` — nunca `auth.users` ni
-- `public.usuarios`. No hay ninguna vía, en este archivo, para que dar de alta un conductor cree
-- una cuenta de acceso.
--
-- No hay validación de colisión de asignación semanal acá (design.md D9 §Colisión, 1B.9): la
-- barrera es el constraint `uq_conductor_semana UNIQUE (conductor_id, fecha_init)`
-- (`20260811100000_conductores_vehiculos_colision_semanal.sql`, ya aplicada). Una colisión llega
-- como `23505` nativo de Postgres, sin envolver — se distingue por el **nombre** del constraint
-- (D12, `mapearErrorConductor`), no por un código propio. Por eso no existe un `45205`.
--
-- Códigos de error propios (clase '45', libre en PostgreSQL, D9). El frontend los traduce en
-- `mapearErrorConductor` (`SupabaseConductorRepository.ts`, tasks.md 7.6):
--   45201 — `p_conductor`/`p_cambios` malformado (no es un objeto JSON).
--   45202 — `actualizar_conductor_completo` con un id que no existe (o que RLS oculta: el `UPDATE`
--           afecta 0 filas sin lanzar `42501` por sí solo si el usuario no tiene `write` — mismo
--           caso ya documentado en `pacientes.actualizar_hoja_de_ruta_completa`, indistinguible a
--           propósito de "no existe").
-- No hay `45203`/`45204`: esos códigos son específicos de Vehículo (catálogo de accesorios /
-- coherencia de mantenimiento), sin equivalente en el dominio de Conductor.
--
-- Auditoría y rollback: los triggers `auditoria.log_action()` de las 2 tablas disparan fila por
-- fila dentro de la misma transacción (RN-GL-02) — un alta deja su rastro completo o no deja
-- ninguno. Rollback de esta migración: `DROP FUNCTION` × 2 — no crea ni altera tablas, columnas,
-- policies ni datos.
--
-- ⚠️ Esta migración se redacta como artefacto de diseño del change. NO se aplica desde el agente
-- (el sandbox no tiene Docker ni credenciales de escritura sobre el proyecto real, salvo excepción
-- puntual ya usada en 1B.11) — la aplica la usuaria/Enzo con `supabase db push`.

CREATE OR REPLACE FUNCTION conductores.crear_conductor_completo(p_conductor jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER  -- ⚠️ NUNCA SECURITY DEFINER: bypassearía RLS y el gateo por módulo. Ver cabecera.
SET search_path = ''
AS $$
DECLARE
  v_conductor_id uuid;
  v_asignaciones jsonb;
  v_asignacion   jsonb;
BEGIN
  IF p_conductor IS NULL OR jsonb_typeof(p_conductor) <> 'object' THEN
    RAISE EXCEPTION 'El alta de conductor recibió un payload inválido.'
      USING ERRCODE = '45201';
  END IF;

  INSERT INTO conductores.conductores (
    nombre, apellido, dni, cuil, telefono, fecha_nacimiento, domicilio, estado, notas
  ) VALUES (
    p_conductor ->> 'nombre',
    p_conductor ->> 'apellido',
    p_conductor ->> 'dni',
    NULLIF(p_conductor ->> 'cuil', ''),
    NULLIF(p_conductor ->> 'telefono', ''),
    NULLIF(p_conductor ->> 'fecha_nacimiento', '')::date,
    NULLIF(p_conductor ->> 'domicilio', ''),
    COALESCE(NULLIF(p_conductor ->> 'estado', ''), 'operando')::conductores.estado_conductor,
    NULLIF(p_conductor ->> 'notas', '')
  )
  RETURNING id INTO v_conductor_id;

  -- Asignaciones (reemplazo completo, D9): sobre un conductor recién creado no hay nada previo que
  -- borrar, a diferencia de `actualizar_conductor_completo`. `id` no se lee del payload (identidad
  -- libre, ver cabecera).
  v_asignaciones := COALESCE(p_conductor -> 'asignaciones', '[]'::jsonb);
  FOR v_asignacion IN SELECT value FROM jsonb_array_elements(v_asignaciones)
  LOOP
    INSERT INTO conductores.conductores_vehiculos (conductor_id, vehiculo_id, fecha_init, fecha_fin_semana)
    VALUES (
      v_conductor_id,
      NULLIF(v_asignacion ->> 'vehiculo_id', '')::uuid,
      (v_asignacion ->> 'fecha_init')::date,
      (v_asignacion ->> 'fecha_fin_semana')::date
    );
  END LOOP;

  RETURN v_conductor_id;
END;
$$;

CREATE OR REPLACE FUNCTION conductores.actualizar_conductor_completo(p_id uuid, p_cambios jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER  -- ⚠️ NUNCA SECURITY DEFINER: bypassearía RLS y el gateo por módulo. Ver cabecera.
SET search_path = ''
AS $$
DECLARE
  v_filas_afectadas integer;
  v_asignaciones    jsonb;
  v_asignacion      jsonb;
BEGIN
  IF p_cambios IS NULL OR jsonb_typeof(p_cambios) <> 'object' THEN
    RAISE EXCEPTION 'La edición de conductor recibió un payload inválido.'
      USING ERRCODE = '45201';
  END IF;

  -- Semántica parcial real (D9, misma trampa que el resto de la serie): usa el operador `?` de
  -- jsonb para distinguir clave ausente (no tocar) de clave presente (reemplazar, incluso '').
  UPDATE conductores.conductores SET
    nombre = CASE WHEN p_cambios ? 'nombre' THEN p_cambios ->> 'nombre' ELSE nombre END,
    apellido = CASE WHEN p_cambios ? 'apellido' THEN p_cambios ->> 'apellido' ELSE apellido END,
    dni = CASE WHEN p_cambios ? 'dni' THEN p_cambios ->> 'dni' ELSE dni END,
    cuil = CASE WHEN p_cambios ? 'cuil' THEN NULLIF(p_cambios ->> 'cuil', '') ELSE cuil END,
    telefono = CASE WHEN p_cambios ? 'telefono' THEN NULLIF(p_cambios ->> 'telefono', '') ELSE telefono END,
    fecha_nacimiento = CASE WHEN p_cambios ? 'fecha_nacimiento'
      THEN NULLIF(p_cambios ->> 'fecha_nacimiento', '')::date ELSE fecha_nacimiento END,
    domicilio = CASE WHEN p_cambios ? 'domicilio' THEN NULLIF(p_cambios ->> 'domicilio', '') ELSE domicilio END,
    estado = CASE WHEN p_cambios ? 'estado'
      THEN (p_cambios ->> 'estado')::conductores.estado_conductor ELSE estado END,
    notas = CASE WHEN p_cambios ? 'notas' THEN NULLIF(p_cambios ->> 'notas', '') ELSE notas END
  WHERE id = p_id;

  GET DIAGNOSTICS v_filas_afectadas = ROW_COUNT;
  IF v_filas_afectadas = 0 THEN
    -- 0 filas por RLS (sin 'write') y 0 filas por id inexistente son indistinguibles acá, a
    -- propósito — mismo criterio que `pacientes.actualizar_hoja_de_ruta_completa`.
    RAISE EXCEPTION 'No existe un conductor con id "%".', p_id
      USING ERRCODE = '45202';
  END IF;

  IF p_cambios ? 'asignaciones' THEN
    DELETE FROM conductores.conductores_vehiculos WHERE conductor_id = p_id;

    v_asignaciones := COALESCE(p_cambios -> 'asignaciones', '[]'::jsonb);
    FOR v_asignacion IN SELECT value FROM jsonb_array_elements(v_asignaciones)
    LOOP
      INSERT INTO conductores.conductores_vehiculos (conductor_id, vehiculo_id, fecha_init, fecha_fin_semana)
      VALUES (
        p_id,
        NULLIF(v_asignacion ->> 'vehiculo_id', '')::uuid,
        (v_asignacion ->> 'fecha_init')::date,
        (v_asignacion ->> 'fecha_fin_semana')::date
      );
    END LOOP;
  END IF;

  RETURN p_id;
END;
$$;

-- Superficie de ejecución mínima. Aunque con SECURITY INVOKER un `anon` no podría escribir nada
-- (RLS lo rechazaría), no hay razón para dejarle las funciones expuestas.
REVOKE ALL ON FUNCTION conductores.crear_conductor_completo(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION conductores.crear_conductor_completo(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION conductores.crear_conductor_completo(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION conductores.actualizar_conductor_completo(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION conductores.actualizar_conductor_completo(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION conductores.actualizar_conductor_completo(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION conductores.crear_conductor_completo(jsonb) IS
  'Alta atómica de un conductor con sus asignaciones semanales. SECURITY INVOKER a propósito: RLS '
  '(modulos.tiene_permiso(''conductores'',''write'') + modulos.tiene_permiso(''vehiculos'',''write'') '
  'para conductores_vehiculos) sigue aplicando sobre cada tabla. NO convertir a SECURITY DEFINER. '
  'Ver openspec/changes/integracion-conductores-vehiculos/design.md D9.';

COMMENT ON FUNCTION conductores.actualizar_conductor_completo(uuid, jsonb) IS
  'Edición atómica de un conductor: reemplazo completo de asignaciones cuando esa clave está '
  'presente en p_cambios (jsonb ? distingue ausente de []). SECURITY INVOKER a propósito. '
  'NO convertir a SECURITY DEFINER. Ver design.md D9.';
