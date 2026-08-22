-- Rollback (paso 1 de N) de presupuestos-vigencia-datos-traslado-vista-previa.
--
-- ⚠️ ESTE ARCHIVO NO ES UNA MIGRACIÓN. No vive en supabase/migrations/, no lo va a recoger
-- `supabase db push`/`migration up`, y el agente NO lo aplica. Es el "CREATE OR REPLACE" anterior
-- de las dos RPC de alta de presupuesto, guardado tal cual estaba ANTES de
-- `20260821172000_presupuesto_rpc_campos_nuevos.sql` (idéntico al cuerpo de
-- `supabase/migrations/20260816110000_presupuesto_lineas.sql:142-246`), para que revertir este
-- change no dependa de ir a buscarlo a mano en el historial de git de otra migración.
--
-- Orden de rollback completo del change (design.md §Rollback, Migration Plan):
--   1. Ejecutar este archivo (`.sql` como statement suelto, vía `supabase db query --linked` o el
--      SQL editor de Supabase) para devolver las dos RPC a la firma/cuerpo sin las 13 columnas
--      nuevas. Esto es seguro incluso con filas reales que ya tengan vigencia/datos de traslado
--      cargados: las RPC vuelven a ignorar esas columnas en el INSERT, no las borra.
--   2. Revertir el frontend que llama a las RPC con las 13 claves nuevas (si ya se desplegó).
--   3. Recién ahí, si hace falta borrar el dato de la base (punto de no retorno, ver design.md):
--        ALTER TABLE facturacion.autorizacion
--          DROP COLUMN vigencia_hasta,
--          DROP COLUMN con_dependencia,
--          DROP COLUMN archivo_tipo_mime;
--        ALTER TABLE facturacion.presupuesto
--          DROP CONSTRAINT presupuesto_vigencia_hasta_desde_check,
--          DROP COLUMN vigencia_desde,
--          DROP COLUMN vigencia_hasta,
--          DROP COLUMN con_dependencia,
--          DROP COLUMN origen_ida,
--          DROP COLUMN destino_ida,
--          DROP COLUMN origen_vuelta,
--          DROP COLUMN destino_vuelta,
--          DROP COLUMN horario_entrada,
--          DROP COLUMN horario_salida,
--          DROP COLUMN km_ida,
--          DROP COLUMN km_vuelta,
--          DROP COLUMN dias_semana,
--          DROP COLUMN dias_mensuales;
--        ALTER TABLE facturacion.autorizacion
--          DROP CONSTRAINT autorizacion_vigencia_hasta_desde_check;
--      Con presupuestos reales que ya tengan vigencia y datos de traslado cargados, este DROP
--      COLUMN borra información de negocio que solo existía en papel — el rollback barato es
--      quedarse en el paso 1-2 (frontend + RPC), no llegar al paso 3.

CREATE OR REPLACE FUNCTION facturacion.crear_presupuesto_completo(p_presupuesto jsonb, p_lineas jsonb DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER  -- ⚠️ NUNCA SECURITY DEFINER: bypassearía RLS y el gateo por módulo.
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_presupuesto IS NULL OR jsonb_typeof(p_presupuesto) <> 'object' THEN
    RAISE EXCEPTION 'El alta de presupuesto recibió un payload inválido.'
      USING ERRCODE = '45401';
  END IF;

  IF NULLIF(p_presupuesto ->> 'paciente_id', '') IS NULL
     OR NULLIF(p_presupuesto ->> 'obra_social_id', '') IS NULL
     OR (p_presupuesto ->> 'monto') IS NULL
     OR NULLIF(p_presupuesto ->> 'fecha_emision', '') IS NULL THEN
    RAISE EXCEPTION 'Faltan datos obligatorios del presupuesto.'
      USING ERRCODE = '45402';
  END IF;

  INSERT INTO facturacion.presupuesto (
    paciente_id, obra_social_id, monto, fecha_emision, archivo_url, prestacion_id
  ) VALUES (
    (p_presupuesto ->> 'paciente_id')::uuid,
    (p_presupuesto ->> 'obra_social_id')::uuid,
    (p_presupuesto ->> 'monto')::numeric,
    (p_presupuesto ->> 'fecha_emision')::date,
    NULLIF(p_presupuesto ->> 'archivo_url', ''),
    NULLIF(p_presupuesto ->> 'prestacion_id', '')::uuid
  )
  RETURNING id INTO v_id;

  -- Autorización 1:1 en 'pendiente' -- misma transacción.
  INSERT INTO facturacion.autorizacion (presupuesto_id, estado) VALUES (v_id, 'pendiente');

  -- REAPERTURA #13 (2026-08-16): desglose de modalidad `general` en la misma transacción.
  PERFORM facturacion.insertar_lineas_presupuesto(v_id, p_lineas);

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION facturacion.crear_presupuestos_lote(p_presupuestos jsonb)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY INVOKER  -- ⚠️ NUNCA SECURITY DEFINER: bypassearía RLS y el gateo por módulo.
SET search_path = ''
AS $$
DECLARE
  v_item jsonb;
  v_id   uuid;
  v_ids  uuid[] := '{}';
BEGIN
  IF p_presupuestos IS NULL OR jsonb_typeof(p_presupuestos) <> 'array' THEN
    RAISE EXCEPTION 'El alta en lote de presupuestos recibió un payload inválido.'
      USING ERRCODE = '45401';
  END IF;

  IF jsonb_array_length(p_presupuestos) = 0 THEN
    RAISE EXCEPTION 'El lote de presupuestos no puede estar vacío.'
      USING ERRCODE = '45403';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_presupuestos)
  LOOP
    IF NULLIF(v_item ->> 'paciente_id', '') IS NULL
       OR NULLIF(v_item ->> 'obra_social_id', '') IS NULL
       OR (v_item ->> 'monto') IS NULL
       OR NULLIF(v_item ->> 'fecha_emision', '') IS NULL THEN
      RAISE EXCEPTION 'Faltan datos obligatorios en un presupuesto del lote.'
        USING ERRCODE = '45402';
    END IF;

    INSERT INTO facturacion.presupuesto (
      paciente_id, obra_social_id, monto, fecha_emision, archivo_url, prestacion_id
    ) VALUES (
      (v_item ->> 'paciente_id')::uuid,
      (v_item ->> 'obra_social_id')::uuid,
      (v_item ->> 'monto')::numeric,
      (v_item ->> 'fecha_emision')::date,
      NULLIF(v_item ->> 'archivo_url', ''),
      NULLIF(v_item ->> 'prestacion_id', '')::uuid
    )
    RETURNING id INTO v_id;

    -- Autorización 1:1 en 'pendiente' por cada presupuesto del lote -- misma iteración/transacción.
    INSERT INTO facturacion.autorizacion (presupuesto_id, estado) VALUES (v_id, 'pendiente');

    -- REAPERTURA #13 (2026-08-16): líneas opcionales por ítem del lote, misma transacción.
    PERFORM facturacion.insertar_lineas_presupuesto(v_id, v_item -> 'lineas');

    v_ids := array_append(v_ids, v_id);
  END LOOP;

  RETURN v_ids;
END;
$$;

REVOKE ALL ON FUNCTION facturacion.crear_presupuesto_completo(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION facturacion.crear_presupuesto_completo(jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION facturacion.crear_presupuesto_completo(jsonb, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION facturacion.crear_presupuestos_lote(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION facturacion.crear_presupuestos_lote(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION facturacion.crear_presupuestos_lote(jsonb) TO authenticated;

COMMENT ON FUNCTION facturacion.crear_presupuesto_completo(jsonb, jsonb) IS
  'Alta simple de un presupuesto (modalidad general), con su desglose opcional en p_lineas '
  '(REAPERTURA #13, 2026-08-16 — facturacion.presupuesto_linea). SECURITY INVOKER a propósito: '
  'RLS (modulos.tiene_permiso(''presupuestos'',''write'')) sigue aplicando. NO convertir a '
  'SECURITY DEFINER. Mismos códigos de error 45401-45403 + 45404 para líneas malformadas.';

COMMENT ON FUNCTION facturacion.crear_presupuestos_lote(jsonb) IS
  'Alta atómica de N presupuestos (modalidad por-prestacion, uno por prestación): o entran todos, '
  'o no entra ninguno. Cada ítem puede llevar `lineas` opcional (misma forma que p_lineas del '
  'alta simple). SECURITY INVOKER a propósito. NO convertir a SECURITY DEFINER. Mismos códigos '
  'de error 45401-45403 + 45404 para líneas malformadas.';
