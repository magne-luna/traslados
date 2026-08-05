-- Migration: hoja_de_ruta_rpc
-- Change: openspec/changes/integracion-hojas-de-ruta/ (design.md D3/D4, tasks.md sección 1)
--
-- ¿Por qué existe? PostgREST no da transacciones entre requests: guardar una hoja de ruta
-- escribe hasta 3 tablas (`hoja_de_ruta`, `recorrido`, `historial_recorridos` como paradas) y una
-- secuencia de requests cortada a mitad dejaría una hoja sin recorridos, o con paradas del
-- recorrido viejo mezcladas con el nuevo. Mismo patrón exacto que
-- `pacientes.crear_paciente_completo` y `obra_social.crear_obra_social_completa`: PostgREST
-- ejecuta cada `POST /rpc/...` dentro de una transacción, así que el cuerpo entero commitea o hace
-- rollback completo.
--
-- Requiere `20260804100000_schema_hoja_de_ruta.sql` aplicada antes (tablas + RLS).
--
-- ⚠️⚠️ SECURITY INVOKER — NO TOCAR ⚠️⚠️
-- Ambas funciones DEBEN ser `SECURITY INVOKER`. Convertir cualquiera de las dos a
-- `SECURITY DEFINER` sería una REGRESIÓN DE SEGURIDAD grave: el owner es `postgres`
-- (superusuario), que bypassea RLS por completo — cualquier autenticado, incluso sin
-- `modulos.tiene_permiso('hojas_de_ruta', 'write')`, podría dar de alta y editar hojas de ruta
-- completas (con pacientes, direcciones y conductores reales).
--
-- Cómo se hace cumplir el permiso: `pacientes.hoja_de_ruta`/`recorrido` tienen
-- `CREATE POLICY "Write ..." FOR ALL TO authenticated USING (modulos.tiene_permiso('hojas_de_ruta',
-- 'write'))`. En una policy `FOR ALL` sin `WITH CHECK`, Postgres usa la expresión de `USING`
-- también como check de INSERT: un usuario sin `write` recibe `42501` en el primer INSERT y toda
-- la transacción hace rollback. Para `actualizar_hoja_de_ruta_completa`, la semántica de RLS sobre
-- UPDATE es distinta: si el usuario no tiene `write`, el `USING` de la policy filtra la fila ANTES
-- de que el UPDATE la vea — el UPDATE afecta 0 filas sin lanzar `42501` por sí solo, y esta función
-- lo traduce a `45302` (mismo código que "no existe"), consistente con el resto de la serie
-- (`obra_social.actualizar_obra_social_completa`, mismo caso ya documentado ahí). 0 filas por RLS y
-- 0 filas por inexistencia son indistinguibles y es deliberado — verificarlo en vivo es parte del
-- checklist manual de tasks.md 7.2/7.3.
--
-- Semántica de colecciones: reemplazo completo, no diff (D3) — ningún id de `recorrido` ni de
-- `historial_recorridos` (como parada) es referenciado desde afuera del agregado, así que
-- DELETE + INSERT dentro de la transacción es seguro. El DELETE de `recorrido` alcanza para
-- limpiar las paradas asociadas: `historial_recorridos.recorrido_id` es
-- `ON DELETE CASCADE` (ver `20260804100000`), no hace falta un DELETE explícito aparte.
--
-- `historial_recorridos.id_vehiculo` (columna legacy, `id_vehiculo` en el nombre de columna real)
-- se mantiene sincronizado con `recorrido.vehiculo_id` en cada escritura, nunca puede divergir
-- porque la única vía de escritura de paradas es esta RPC (mismo criterio que
-- `toParadaRowInput`/D3 en el frontend).
--
-- `historial_recorridos.fecha` es NOT NULL sin default y no tiene equivalente en el dominio nuevo
-- (`ParadaRecorrido` no modela fecha propia, vive en `HojaDeRuta.fecha`, ver cabecera de
-- `20260804100000`) — se completa acá con la fecha de la hoja de ruta dueña de la parada.
--
-- Códigos de error propios (clase '45', libre en PostgreSQL, D4). El frontend los traduce en
-- `mapearErrorHojaDeRuta` (`SupabaseHojaDeRutaRepository.ts`):
--   45301 — payload de alta/edición malformado (no es un objeto JSON).
--   45302 — `actualizar_...` con un id que no existe (o que RLS oculta, ver nota arriba).
--   45303 — ya existe una hoja de ruta para esa `fecha` (viola el `UNIQUE`).
--   45304 — un `recorrido` llega sin `vehiculo_id` o `conductor_id` resoluble (ausente o que no
--           referencia una fila real — `foreign_key_violation`/`not_null_violation`).
--
-- Rollback: `DROP FUNCTION pacientes.crear_hoja_de_ruta_completa(jsonb);` +
-- `DROP FUNCTION pacientes.actualizar_hoja_de_ruta_completa(uuid, jsonb);` — no crean ni alteran
-- tablas, columnas, policies ni datos: revertirlas no puede perder información.
--
-- ⚠️ Esta migración se redacta como artefacto de diseño del change. NO se aplica desde el agente
-- (el sandbox no tiene Docker ni credenciales de escritura sobre el proyecto real) — la aplica la
-- usuaria/Enzo con `supabase db push`, mismo patrón que el resto de la serie.

CREATE OR REPLACE FUNCTION pacientes.crear_hoja_de_ruta_completa(p_hoja jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER  -- ⚠️ NUNCA SECURITY DEFINER: bypassearía RLS y el gateo por módulo. Ver cabecera.
SET search_path = ''
AS $$
DECLARE
  v_hoja_id      uuid;
  v_fecha        date;
  v_recorridos   jsonb;
  v_recorrido    jsonb;
  v_recorrido_id uuid;
  v_vehiculo_id  uuid;
  v_paradas      jsonb;
  v_parada       jsonb;
BEGIN
  IF p_hoja IS NULL OR jsonb_typeof(p_hoja) <> 'object' THEN
    RAISE EXCEPTION 'El alta de hoja de ruta recibió un payload inválido.'
      USING ERRCODE = '45301';
  END IF;

  v_fecha := (p_hoja ->> 'fecha')::date;

  BEGIN
    INSERT INTO pacientes.hoja_de_ruta (fecha, franja_inicio, franja_fin, notas)
    VALUES (
      v_fecha,
      (p_hoja ->> 'franja_inicio')::time,
      (p_hoja ->> 'franja_fin')::time,
      NULLIF(p_hoja ->> 'notas', '')
    )
    RETURNING id INTO v_hoja_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Ya existe una hoja de ruta para esa fecha.'
      USING ERRCODE = '45303';
  END;

  -- Recorridos + paradas (reemplazo completo sobre una hoja recién creada: no hay nada previo
  -- que borrar, a diferencia de actualizar_hoja_de_ruta_completa).
  v_recorridos := COALESCE(p_hoja -> 'recorridos', '[]'::jsonb);
  FOR v_recorrido IN SELECT value FROM jsonb_array_elements(v_recorridos)
  LOOP
    v_vehiculo_id := NULLIF(v_recorrido ->> 'vehiculo_id', '')::uuid;

    BEGIN
      INSERT INTO pacientes.recorrido (hoja_de_ruta_id, vehiculo_id, conductor_id, manual, notas)
      VALUES (
        v_hoja_id,
        v_vehiculo_id,
        NULLIF(v_recorrido ->> 'conductor_id', '')::uuid,
        COALESCE((v_recorrido ->> 'manual')::boolean, false),
        NULLIF(v_recorrido ->> 'notas', '')
      )
      RETURNING id INTO v_recorrido_id;
    EXCEPTION WHEN foreign_key_violation OR not_null_violation THEN
      RAISE EXCEPTION 'Revisá el vehículo y el conductor del recorrido.'
        USING ERRCODE = '45304';
    END;

    v_paradas := COALESCE(v_recorrido -> 'paradas', '[]'::jsonb);
    FOR v_parada IN SELECT value FROM jsonb_array_elements(v_paradas)
    LOOP
      -- id_vehiculo SIEMPRE v_vehiculo_id (sincronizado con el recorrido, nunca con la parada —
      -- ver cabecera y toParadaRowInput del frontend). fecha: ver cabecera (columna legacy NOT
      -- NULL sin equivalente en el dominio nuevo).
      INSERT INTO pacientes.historial_recorridos (
        paciente_id, fecha, id_vehiculo, id_dir_inicial, id_dir_final,
        recorrido_id, tramo, orden, hora_estimada
      ) VALUES (
        NULLIF(v_parada ->> 'paciente_id', '')::uuid,
        v_fecha,
        v_vehiculo_id,
        NULLIF(v_parada ->> 'id_dir_inicial', '')::uuid,
        NULLIF(v_parada ->> 'id_dir_final', '')::uuid,
        v_recorrido_id,
        v_parada ->> 'tramo',
        (v_parada ->> 'orden')::integer,
        NULLIF(v_parada ->> 'hora_estimada', '')::time
      );
    END LOOP;
  END LOOP;

  RETURN v_hoja_id;
END;
$$;

CREATE OR REPLACE FUNCTION pacientes.actualizar_hoja_de_ruta_completa(p_id uuid, p_cambios jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER  -- ⚠️ NUNCA SECURITY DEFINER: bypassearía RLS y el gateo por módulo. Ver cabecera.
SET search_path = ''
AS $$
DECLARE
  v_filas_afectadas integer;
  v_fecha           date;
  v_recorridos      jsonb;
  v_recorrido       jsonb;
  v_recorrido_id    uuid;
  v_vehiculo_id     uuid;
  v_paradas         jsonb;
  v_parada          jsonb;
BEGIN
  IF p_cambios IS NULL OR jsonb_typeof(p_cambios) <> 'object' THEN
    RAISE EXCEPTION 'La edición de hoja de ruta recibió un payload inválido.'
      USING ERRCODE = '45301';
  END IF;

  -- Semántica parcial real (D3, misma trampa que integracion-obra-social D6): usa el operador `?`
  -- de jsonb para distinguir clave ausente (no tocar) de clave presente (reemplazar, incluso []).
  BEGIN
    UPDATE pacientes.hoja_de_ruta SET
      fecha = CASE WHEN p_cambios ? 'fecha' THEN (p_cambios ->> 'fecha')::date ELSE fecha END,
      franja_inicio = CASE WHEN p_cambios ? 'franja_inicio'
        THEN (p_cambios ->> 'franja_inicio')::time ELSE franja_inicio END,
      franja_fin = CASE WHEN p_cambios ? 'franja_fin'
        THEN (p_cambios ->> 'franja_fin')::time ELSE franja_fin END,
      notas = CASE WHEN p_cambios ? 'notas' THEN NULLIF(p_cambios ->> 'notas', '') ELSE notas END
    WHERE id = p_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Ya existe una hoja de ruta para esa fecha.'
      USING ERRCODE = '45303';
  END;

  GET DIAGNOSTICS v_filas_afectadas = ROW_COUNT;
  IF v_filas_afectadas = 0 THEN
    -- 0 filas por RLS (sin 'write') y 0 filas por id inexistente son indistinguibles acá, a
    -- propósito — ver cabecera.
    RAISE EXCEPTION 'No existe una hoja de ruta con id "%".', p_id
      USING ERRCODE = '45302';
  END IF;

  SELECT fecha INTO v_fecha FROM pacientes.hoja_de_ruta WHERE id = p_id;

  IF p_cambios ? 'recorridos' THEN
    -- DELETE de recorrido alcanza: historial_recorridos.recorrido_id es ON DELETE CASCADE.
    DELETE FROM pacientes.recorrido WHERE hoja_de_ruta_id = p_id;

    v_recorridos := COALESCE(p_cambios -> 'recorridos', '[]'::jsonb);
    FOR v_recorrido IN SELECT value FROM jsonb_array_elements(v_recorridos)
    LOOP
      v_vehiculo_id := NULLIF(v_recorrido ->> 'vehiculo_id', '')::uuid;

      BEGIN
        INSERT INTO pacientes.recorrido (hoja_de_ruta_id, vehiculo_id, conductor_id, manual, notas)
        VALUES (
          p_id,
          v_vehiculo_id,
          NULLIF(v_recorrido ->> 'conductor_id', '')::uuid,
          COALESCE((v_recorrido ->> 'manual')::boolean, false),
          NULLIF(v_recorrido ->> 'notas', '')
        )
        RETURNING id INTO v_recorrido_id;
      EXCEPTION WHEN foreign_key_violation OR not_null_violation THEN
        RAISE EXCEPTION 'Revisá el vehículo y el conductor del recorrido.'
          USING ERRCODE = '45304';
      END;

      v_paradas := COALESCE(v_recorrido -> 'paradas', '[]'::jsonb);
      FOR v_parada IN SELECT value FROM jsonb_array_elements(v_paradas)
      LOOP
        INSERT INTO pacientes.historial_recorridos (
          paciente_id, fecha, id_vehiculo, id_dir_inicial, id_dir_final,
          recorrido_id, tramo, orden, hora_estimada
        ) VALUES (
          NULLIF(v_parada ->> 'paciente_id', '')::uuid,
          v_fecha,
          v_vehiculo_id,
          NULLIF(v_parada ->> 'id_dir_inicial', '')::uuid,
          NULLIF(v_parada ->> 'id_dir_final', '')::uuid,
          v_recorrido_id,
          v_parada ->> 'tramo',
          (v_parada ->> 'orden')::integer,
          NULLIF(v_parada ->> 'hora_estimada', '')::time
        );
      END LOOP;
    END LOOP;
  END IF;

  RETURN p_id;
END;
$$;

-- Superficie de ejecución mínima. Aunque con SECURITY INVOKER un `anon` no podría escribir nada
-- (RLS lo rechazaría), no hay razón para dejarle las funciones expuestas.
REVOKE ALL ON FUNCTION pacientes.crear_hoja_de_ruta_completa(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION pacientes.crear_hoja_de_ruta_completa(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION pacientes.crear_hoja_de_ruta_completa(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION pacientes.actualizar_hoja_de_ruta_completa(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION pacientes.actualizar_hoja_de_ruta_completa(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION pacientes.actualizar_hoja_de_ruta_completa(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION pacientes.crear_hoja_de_ruta_completa(jsonb) IS
  'Alta atómica de una hoja de ruta con sus recorridos y paradas. SECURITY INVOKER a propósito: '
  'RLS (modulos.tiene_permiso(''hojas_de_ruta'',''write'')) sigue aplicando sobre cada tabla. '
  'NO convertir a SECURITY DEFINER. Ver openspec/changes/integracion-hojas-de-ruta/design.md D3.';

COMMENT ON FUNCTION pacientes.actualizar_hoja_de_ruta_completa(uuid, jsonb) IS
  'Edición atómica de una hoja de ruta: reemplazo completo de recorridos/paradas cuando esa clave '
  'está presente en p_cambios (jsonb ? distingue ausente de []). SECURITY INVOKER a propósito. '
  'NO convertir a SECURITY DEFINER. Ver design.md D3.';
