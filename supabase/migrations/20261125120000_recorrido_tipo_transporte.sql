-- Migration: recorrido_tipo_transporte
-- Change: openspec/changes/viajes-tercerizados-hoja-de-ruta/ (design.md D1/D2, tasks.md sección 1)
--
-- ¿Por qué existe? Cuando la flota propia no llega, Andrea resuelve el viaje con una aplicación
-- (casi siempre Uber) o con una agencia de remis (reunión 2026-10-07). Hasta ahora
-- `pacientes.recorrido.vehiculo_id`/`conductor_id` eran NOT NULL: un viaje tercerizado no se podía
-- cargar sin inventar un vehículo o un conductor.
--
-- ¿Qué hace?
--   1. `pacientes.recorrido` gana `tipo_transporte` ('propio' | 'aplicacion' | 'remis', default
--      'propio') y `agencia_remis` (texto libre, decisión de la usuaria 2026-10-14: sin catálogo).
--   2. `vehiculo_id`/`conductor_id` pasan a nullable, con un CHECK que mantiene la coherencia:
--      propio ⇒ vehículo + conductor y sin agencia; aplicación ⇒ nada; remis ⇒ agencia no vacía.
--   3. Redefine `crear_hoja_de_ruta_completa` / `actualizar_hoja_de_ruta_completa`: copia literal
--      de `20260804110000_hoja_de_ruta_rpc.sql` con diff mínimo (las dos columnas nuevas en el
--      INSERT de recorrido + handler `check_violation` → 45305). Firma sin cambio: CREATE OR REPLACE.
--
-- Compatibilidad: el frontend viejo no manda `tipo_transporte` → la RPC usa 'propio'. Las filas
-- existentes quedan 'propio' por el DEFAULT y todas tienen vehículo + conductor, así que el CHECK
-- valida sin tocar datos. Las paradas (`historial_recorridos.id_vehiculo`) de un tercerizado quedan
-- en NULL: esa columna ya era nullable (`20260724100006`).
--
-- RLS y auditoría: sin cambios. Las policies de `pacientes.recorrido` son por fila y cubren las
-- columnas nuevas; las funciones siguen SECURITY INVOKER (ver cabecera de `20260804110000`).
--
-- Código de error nuevo (lo traduce `mapearErrorHojaDeRuta` en el frontend):
--   45305 — recorrido con tipo de transporte incoherente (viola `recorrido_tipo_transporte_coherente`
--           o el CHECK de valores). 45301-45304 sin cambios.
--
-- ⚠️ Discrepancia con Traslados-Modelo-Datos.docx: el docx no modela tipo de transporte ni agencia
-- en Recorrido. Documentada en knowledge-base/04_modelo_de_datos.md §Discrepancias y en
-- CHANGES.md; pendiente de confirmar con quien mantiene el docx.
--
-- Rollback (solo seguro si NO hay recorridos tercerizados; si los hay, borrarlos o convertirlos a
-- propio antes, perdiendo el dato):
--   ALTER TABLE pacientes.recorrido DROP CONSTRAINT recorrido_tipo_transporte_coherente;
--   ALTER TABLE pacientes.recorrido DROP COLUMN agencia_remis, DROP COLUMN tipo_transporte;
--   ALTER TABLE pacientes.recorrido ALTER COLUMN vehiculo_id SET NOT NULL,
--     ALTER COLUMN conductor_id SET NOT NULL;
--   + re-aplicar las funciones de 20260804110000_hoja_de_ruta_rpc.sql.
--
-- ⚠️ Esta migración NO la aplica el agente. La aplica Enzo con `supabase db push` (ver
-- docs/PENDIENTE-ENZO.md), y SIEMPRE antes de deployar el frontend que lee `tipo_transporte`.

ALTER TABLE pacientes.recorrido
  ADD COLUMN tipo_transporte TEXT NOT NULL DEFAULT 'propio'
    CHECK (tipo_transporte IN ('propio', 'aplicacion', 'remis')),
  ADD COLUMN agencia_remis TEXT,
  ALTER COLUMN vehiculo_id DROP NOT NULL,
  ALTER COLUMN conductor_id DROP NOT NULL,
  ADD CONSTRAINT recorrido_tipo_transporte_coherente CHECK (
    (tipo_transporte = 'propio'
       AND vehiculo_id IS NOT NULL AND conductor_id IS NOT NULL AND agencia_remis IS NULL)
    OR (tipo_transporte = 'aplicacion'
       AND vehiculo_id IS NULL AND conductor_id IS NULL AND agencia_remis IS NULL)
    OR (tipo_transporte = 'remis'
       AND vehiculo_id IS NULL AND conductor_id IS NULL AND btrim(agencia_remis) <> '')
  );

COMMENT ON COLUMN pacientes.recorrido.tipo_transporte IS
  'propio (flota propia, exige vehículo y conductor) | aplicacion (Uber u otra) | remis (exige agencia_remis). RN-HR-05.';
COMMENT ON COLUMN pacientes.recorrido.agencia_remis IS
  'Nombre de la agencia de remis, texto libre. Solo para tipo_transporte = remis.';

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
      INSERT INTO pacientes.recorrido (
        hoja_de_ruta_id, vehiculo_id, conductor_id, tipo_transporte, agencia_remis, manual, notas
      )
      VALUES (
        v_hoja_id,
        v_vehiculo_id,
        NULLIF(v_recorrido ->> 'conductor_id', '')::uuid,
        -- Cliente viejo sin la clave → 'propio' (mismo default que la columna).
        COALESCE(NULLIF(v_recorrido ->> 'tipo_transporte', ''), 'propio'),
        NULLIF(btrim(v_recorrido ->> 'agencia_remis'), ''),
        COALESCE((v_recorrido ->> 'manual')::boolean, false),
        NULLIF(v_recorrido ->> 'notas', '')
      )
      RETURNING id INTO v_recorrido_id;
    EXCEPTION WHEN foreign_key_violation OR not_null_violation THEN
      RAISE EXCEPTION 'Revisá el vehículo y el conductor del recorrido.'
        USING ERRCODE = '45304';
    WHEN check_violation THEN
      RAISE EXCEPTION 'Revisá el tipo de transporte del recorrido.'
        USING ERRCODE = '45305';
    END;

    v_paradas := COALESCE(v_recorrido -> 'paradas', '[]'::jsonb);
    FOR v_parada IN SELECT value FROM jsonb_array_elements(v_paradas)
    LOOP
      -- Tercerizado: v_vehiculo_id es NULL y la parada queda sin vehículo (columna ya nullable).
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
        INSERT INTO pacientes.recorrido (
          hoja_de_ruta_id, vehiculo_id, conductor_id, tipo_transporte, agencia_remis, manual, notas
        )
        VALUES (
          p_id,
          v_vehiculo_id,
          NULLIF(v_recorrido ->> 'conductor_id', '')::uuid,
          -- Cliente viejo sin la clave → 'propio' (mismo default que la columna).
          COALESCE(NULLIF(v_recorrido ->> 'tipo_transporte', ''), 'propio'),
          NULLIF(btrim(v_recorrido ->> 'agencia_remis'), ''),
          COALESCE((v_recorrido ->> 'manual')::boolean, false),
          NULLIF(v_recorrido ->> 'notas', '')
        )
        RETURNING id INTO v_recorrido_id;
      EXCEPTION WHEN foreign_key_violation OR not_null_violation THEN
        RAISE EXCEPTION 'Revisá el vehículo y el conductor del recorrido.'
          USING ERRCODE = '45304';
      WHEN check_violation THEN
        RAISE EXCEPTION 'Revisá el tipo de transporte del recorrido.'
          USING ERRCODE = '45305';
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
  'NO convertir a SECURITY DEFINER. Ver openspec/changes/integracion-hojas-de-ruta/design.md D3 y '
  'openspec/changes/viajes-tercerizados-hoja-de-ruta/design.md D2 (tipo de transporte).';

COMMENT ON FUNCTION pacientes.actualizar_hoja_de_ruta_completa(uuid, jsonb) IS
  'Edición atómica de una hoja de ruta: reemplazo completo de recorridos/paradas cuando esa clave '
  'está presente en p_cambios (jsonb ? distingue ausente de []). SECURITY INVOKER a propósito. '
  'NO convertir a SECURITY DEFINER. Ver design.md D3.';
