-- Migration: presupuesto_rpc_campos_nuevos
-- Change: presupuestos-vigencia-datos-traslado-vista-previa (design.md D1-D4, D7; Migration Plan
-- paso 6, "requiere (4)": esta migración depende de
-- 20260821170000_presupuesto_vigencia_dependencia_traslado.sql ya aplicada, porque el INSERT de
-- abajo referencia las 13 columnas que esa migración crea).
--
-- Qué hace: `CREATE OR REPLACE FUNCTION` de las dos RPC de alta de presupuesto
-- (`facturacion.crear_presupuesto_completo`, `facturacion.crear_presupuestos_lote`), agregando
-- las 13 columnas nuevas de `facturacion.presupuesto` (vigencia, dependencia pedida y datos de
-- traslado) al INSERT. Las dos funciones enumeran columnas una por una en su INSERT — no hay
-- forma de evitarlo sin reescribir el patrón del resto del dominio (ver
-- 20260816110000_presupuesto_lineas.sql:164-172 y :223-231, que es el que se reemplaza acá).
--
-- Las FIRMAS no cambian (`crear_presupuesto_completo(p_presupuesto jsonb, p_lineas jsonb DEFAULT
-- NULL)`, `crear_presupuestos_lote(p_presupuestos jsonb)`), así que esta migración usa `CREATE OR
-- REPLACE` directo, SIN `DROP FUNCTION` previo (a diferencia de 20260816110000, que sí necesitó
-- el DROP porque cambiaba la firma de la alta simple). `CREATE OR REPLACE` con la misma firma
-- conserva los `GRANT`/`REVOKE` ya existentes, pero esta migración los reemite igual, en el mismo
-- patrón que las migraciones anteriores de este dominio, para que quede explícito y no dependa de
-- ese comportamiento implícito de Postgres.
--
-- Las 13 claves nuevas son TODAS OPCIONALES en el jsonb de entrada, con el mismo patrón
-- `NULLIF(p_presupuesto ->> 'clave', '')` que ya usan `archivo_url`/`prestacion_id`: una clave
-- ausente o con string vacío inserta NULL, nunca falla la validación de campos obligatorios
-- (45402), que sigue exigiendo solo los 4 campos de siempre (paciente_id, obra_social_id, monto,
-- fecha_emision). `dias_semana` es la única columna NOT NULL de las 13 (default `'{}'`, ver
-- migración de columnas): se arma con `jsonb_array_elements_text` sobre `COALESCE(... , '[]'::jsonb)`,
-- así que una clave ausente produce un `ARRAY[]::text[]` vacío, nunca un NULL que violaría la
-- columna.
--
-- SECURITY INVOKER explícito en las dos funciones (⚠️ NUNCA SECURITY DEFINER, mismo criterio que
-- toda esta familia de RPC): bypassearía RLS y el gateo por módulo `presupuestos`. El INSERT en
-- facturacion.presupuesto corre con la sesión real del usuario, así que las policies "Write
-- presupuesto" (20260730140000_split_modulos_permisos.sql) siguen aplicando exactamente igual que
-- antes de esta migración — agregar columnas nullable a un INSERT ya gateado no cambia quién
-- puede ejecutar la función, solo qué datos opcionales puede mandar.
--
-- Códigos de error 45401-45404 SIN CAMBIOS: esta migración no agrega validación de negocio nueva
-- (las 13 columnas son todas opcionales, no hay un "campo obligatorio nuevo" que rechazar). Si un
-- valor llega con un tipo que no castea (ej. con_dependencia con un string que no es "true"/"false"),
-- el cast de Postgres lo rechaza con su propio código (22P02), igual que ya pasa hoy con `monto`
-- o `fecha_emision` mal formados — no es un caso nuevo, es el mismo comportamiento que el resto
-- del payload.
--
-- ⚠️ Esta migración se redacta como artefacto de diseño del change. NO se aplica desde el agente
-- (governance ALTO): la aplica la usuaria o Enzo con `supabase db push`, DESPUÉS de las dos
-- migraciones de columnas de este mismo change. Ver tasks.md 3.5.
--
-- Rollback: el `CREATE OR REPLACE` anterior de las dos funciones (la versión de
-- 20260816110000_presupuesto_lineas.sql, sin estas 13 claves) queda guardado aparte, NO como
-- migración aplicable, en
-- openspec/changes/presupuestos-vigencia-datos-traslado-vista-previa/rollback-rpc-presupuesto.sql
-- — es el primer paso del rollback de base de este change, antes de los DROP COLUMN de las dos
-- migraciones de columnas (design.md §Rollback).

CREATE OR REPLACE FUNCTION facturacion.crear_presupuesto_completo(p_presupuesto jsonb, p_lineas jsonb DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER  -- ⚠️ NUNCA SECURITY DEFINER: bypassearía RLS y el gateo por módulo. Ver cabecera.
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
    paciente_id, obra_social_id, monto, fecha_emision, archivo_url, prestacion_id,
    vigencia_desde, vigencia_hasta, con_dependencia,
    origen_ida, destino_ida, origen_vuelta, destino_vuelta,
    horario_entrada, horario_salida, km_ida, km_vuelta,
    dias_semana, dias_mensuales
  ) VALUES (
    (p_presupuesto ->> 'paciente_id')::uuid,
    (p_presupuesto ->> 'obra_social_id')::uuid,
    (p_presupuesto ->> 'monto')::numeric,
    (p_presupuesto ->> 'fecha_emision')::date,
    NULLIF(p_presupuesto ->> 'archivo_url', ''),
    NULLIF(p_presupuesto ->> 'prestacion_id', '')::uuid,
    NULLIF(p_presupuesto ->> 'vigencia_desde', '')::date,
    NULLIF(p_presupuesto ->> 'vigencia_hasta', '')::date,
    NULLIF(p_presupuesto ->> 'con_dependencia', '')::boolean,
    NULLIF(p_presupuesto ->> 'origen_ida', ''),
    NULLIF(p_presupuesto ->> 'destino_ida', ''),
    NULLIF(p_presupuesto ->> 'origen_vuelta', ''),
    NULLIF(p_presupuesto ->> 'destino_vuelta', ''),
    NULLIF(p_presupuesto ->> 'horario_entrada', '')::time,
    NULLIF(p_presupuesto ->> 'horario_salida', '')::time,
    NULLIF(p_presupuesto ->> 'km_ida', '')::numeric,
    NULLIF(p_presupuesto ->> 'km_vuelta', '')::numeric,
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_presupuesto -> 'dias_semana', '[]'::jsonb))),
    NULLIF(p_presupuesto ->> 'dias_mensuales', '')::smallint
  )
  RETURNING id INTO v_id;

  -- Autorización 1:1 en 'pendiente' -- misma transacción, sin cambios de este change.
  INSERT INTO facturacion.autorizacion (presupuesto_id, estado) VALUES (v_id, 'pendiente');

  -- REAPERTURA #13 (2026-08-16): desglose de modalidad `general` en la misma transacción. Sin
  -- cambios de este change.
  PERFORM facturacion.insertar_lineas_presupuesto(v_id, p_lineas);

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION facturacion.crear_presupuestos_lote(p_presupuestos jsonb)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY INVOKER  -- ⚠️ NUNCA SECURITY DEFINER: bypassearía RLS y el gateo por módulo. Ver cabecera.
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
      paciente_id, obra_social_id, monto, fecha_emision, archivo_url, prestacion_id,
      vigencia_desde, vigencia_hasta, con_dependencia,
      origen_ida, destino_ida, origen_vuelta, destino_vuelta,
      horario_entrada, horario_salida, km_ida, km_vuelta,
      dias_semana, dias_mensuales
    ) VALUES (
      (v_item ->> 'paciente_id')::uuid,
      (v_item ->> 'obra_social_id')::uuid,
      (v_item ->> 'monto')::numeric,
      (v_item ->> 'fecha_emision')::date,
      NULLIF(v_item ->> 'archivo_url', ''),
      NULLIF(v_item ->> 'prestacion_id', '')::uuid,
      NULLIF(v_item ->> 'vigencia_desde', '')::date,
      NULLIF(v_item ->> 'vigencia_hasta', '')::date,
      NULLIF(v_item ->> 'con_dependencia', '')::boolean,
      NULLIF(v_item ->> 'origen_ida', ''),
      NULLIF(v_item ->> 'destino_ida', ''),
      NULLIF(v_item ->> 'origen_vuelta', ''),
      NULLIF(v_item ->> 'destino_vuelta', ''),
      NULLIF(v_item ->> 'horario_entrada', '')::time,
      NULLIF(v_item ->> 'horario_salida', '')::time,
      NULLIF(v_item ->> 'km_ida', '')::numeric,
      NULLIF(v_item ->> 'km_vuelta', '')::numeric,
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_item -> 'dias_semana', '[]'::jsonb))),
      NULLIF(v_item ->> 'dias_mensuales', '')::smallint
    )
    RETURNING id INTO v_id;

    -- Autorización 1:1 en 'pendiente' por cada presupuesto del lote -- sin cambios de este change.
    INSERT INTO facturacion.autorizacion (presupuesto_id, estado) VALUES (v_id, 'pendiente');

    -- REAPERTURA #13 (2026-08-16): líneas opcionales por ítem del lote -- sin cambios de este change.
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
  'Alta simple de un presupuesto (modalidad general), con su desglose opcional en p_lineas y, '
  'desde presupuestos-vigencia-datos-traslado-vista-previa, 13 columnas opcionales de vigencia, '
  'dependencia pedida y datos de traslado. SECURITY INVOKER a propósito: RLS '
  '(modulos.tiene_permiso(''presupuestos'',''write'')) sigue aplicando. NO convertir a '
  'SECURITY DEFINER. Mismos códigos de error 45401-45403 + 45404 para líneas malformadas.';

COMMENT ON FUNCTION facturacion.crear_presupuestos_lote(jsonb) IS
  'Alta atómica de N presupuestos (modalidad por-prestacion, uno por prestación): o entran todos, '
  'o no entra ninguno. Cada ítem puede llevar `lineas` opcional y, desde '
  'presupuestos-vigencia-datos-traslado-vista-previa, las mismas 13 columnas opcionales de '
  'vigencia, dependencia pedida y datos de traslado que la alta simple. SECURITY INVOKER a '
  'propósito. NO convertir a SECURITY DEFINER. Mismos códigos de error 45401-45403 + 45404 para '
  'líneas malformadas.';
