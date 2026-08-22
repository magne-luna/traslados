-- Migration: presupuesto_rpc_autorizacion_primer_mes
-- Change: autorizacion-mensual (design.md D4; tasks.md 1.4). Requiere (depende de) que
-- 20260822180000_autorizacion_periodo_mes.sql ya esté aplicada, porque el INSERT de abajo
-- referencia la columna `periodo_mes` que esa migración crea.
--
-- Qué hace: `CREATE OR REPLACE FUNCTION` de las dos RPC de alta de presupuesto
-- (`facturacion.crear_presupuesto_completo`, `facturacion.crear_presupuestos_lote`), última vez
-- reemplazadas por `20260821172000_presupuesto_rpc_campos_nuevos.sql` (change
-- presupuestos-vigencia-datos-traslado-vista-previa, aplicada 2026-08-21 — se parte de ESA
-- versión, no de una anterior). El único cambio es agregar `periodo_mes` al `INSERT` de
-- `facturacion.autorizacion` que cada función ya hace en la misma transacción, derivándolo de
-- `vigencia_desde` del propio payload:
--
--   date_trunc('month', NULLIF(p_presupuesto ->> 'vigencia_desde', '')::date)::date
--
-- `date_trunc` sobre `NULL` da `NULL`: si el presupuesto no trae `vigencia_desde`, el
-- comportamiento es BYTE POR BYTE el de hoy (fila 'pendiente' con `periodo_mes` NULL). No hay
-- rama nueva, no hay `IF` (design.md D4).
--
-- ⚠️ Por qué se auto-crea SOLO el primer mes (D4, RESUELTA) y no N meses ni cero:
--   1. Auto-crear un mes por cada mes del rango de vigencia fabricaría respuestas de la obra
--      social que todavía no llegaron (un presupuesto feb-2026→ene-2027 generaría 12 filas
--      'pendiente' de golpe).
--   2. Auto-crear cero sería una regresión del requerimiento aprobado 2026-08-15
--      ("sin que el usuario tenga que completar AutorizacionForm como paso aparte",
--      20260815090000_presupuesto_autoriza_pendiente.sql).
--   Los meses 2..N se agregan de a uno, explícitamente, desde PresupuestoDetail ("Agregar mes"),
--   cuando la respuesta de ese mes efectivamente llega — Fase 6a de este change.
--
-- ⚠️ El trigger `validar_autorizacion_monto` (RN-PA-01,
-- `20260729130000_schema_autorizacion_monto_vigencia.sql:12-33`) NO se activa con este INSERT
-- (solo valida cuando `monto_autorizado IS NOT NULL`): sigue sin bloquear el alta, igual que hoy.
--
-- Se conserva BYTE POR BYTE de la migración anterior: la firma de las dos funciones
-- (`crear_presupuesto_completo(p_presupuesto jsonb, p_lineas jsonb DEFAULT NULL)`,
-- `crear_presupuestos_lote(p_presupuestos jsonb)`), `SECURITY INVOKER` (⚠️ NUNCA SECURITY
-- DEFINER: bypassearía RLS y el gateo por módulo `presupuestos` —
-- `modulos.tiene_permiso('presupuestos','write')`, mismo criterio que toda esta familia de RPC),
-- `SET search_path = ''`, los 18 campos del INSERT en `facturacion.presupuesto` con sus 13
-- columnas opcionales de vigencia/dependencia/datos de traslado, el helper
-- `insertar_lineas_presupuesto`, y los códigos de error `45401`-`45404` (esta migración no agrega
-- validación de negocio nueva: `periodo_mes` se deriva, nunca se exige, así que no hay un "campo
-- obligatorio nuevo" que rechazar). `CREATE OR REPLACE` directo, SIN `DROP FUNCTION` previo, mismo
-- criterio que `20260821172000` (la firma no cambia).
--
-- ⚠️ Esta migración se redacta como artefacto de diseño del change. NO se aplica desde el agente
-- (governance CRÍTICO — datos de salud + facturación a obra social): la aplica la usuaria o Enzo
-- con `supabase db push`, DESPUÉS de la migración de columna de este mismo change. Ver tasks.md 1.6.
--
-- Rollback: el `CREATE OR REPLACE` anterior de las dos funciones (la versión de
-- `20260821172000_presupuesto_rpc_campos_nuevos.sql`, sin `periodo_mes` en el INSERT) puede
-- reaplicarse tal cual desde ese archivo — no hace falta guardarlo aparte, a diferencia del
-- rollback de `presupuestos-vigencia-datos-traslado-vista-previa` (que sí perdía su versión
-- anterior en el propio historial de `supabase/migrations/`, por eso ese change guardó
-- `rollback-rpc-presupuesto.sql`). Después, `DROP COLUMN periodo_mes` (ver el rollback de
-- `20260822180000_autorizacion_periodo_mes.sql`) para completar la reversión de este change.

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

  -- Autorización del PRIMER mes en 'pendiente' -- misma transacción. Desde autorizacion-mensual
  -- (D4): periodo_mes se deriva de vigencia_desde del propio payload; si no viene, date_trunc
  -- sobre NULL da NULL y este INSERT es byte por byte el de antes (fila 'pendiente' sin período).
  -- Los meses 2..N se agregan de a uno desde PresupuestoDetail ("Agregar mes"), nunca acá.
  INSERT INTO facturacion.autorizacion (presupuesto_id, estado, periodo_mes) VALUES (
    v_id,
    'pendiente',
    date_trunc('month', NULLIF(p_presupuesto ->> 'vigencia_desde', '')::date)::date
  );

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

    -- Autorización del PRIMER mes en 'pendiente' por cada presupuesto del lote -- sin cambios de
    -- este change salvo periodo_mes, derivado de vigencia_desde del ítem (D4, ver cabecera).
    INSERT INTO facturacion.autorizacion (presupuesto_id, estado, periodo_mes) VALUES (
      v_id,
      'pendiente',
      date_trunc('month', NULLIF(v_item ->> 'vigencia_desde', '')::date)::date
    );

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
  'Alta simple de un presupuesto (modalidad general), con su desglose opcional en p_lineas y las '
  '13 columnas opcionales de vigencia/dependencia/datos de traslado. Desde autorizacion-mensual: '
  'la autorización 1:1 en pendiente que ya se creaba pasa a llevar periodo_mes derivado de '
  'vigencia_desde del payload (NULL si no viene, byte por byte el comportamiento anterior). '
  'SECURITY INVOKER a propósito: RLS (modulos.tiene_permiso(''presupuestos'',''write'')) sigue '
  'aplicando. NO convertir a SECURITY DEFINER. Mismos códigos de error 45401-45403 + 45404 para '
  'líneas malformadas.';

COMMENT ON FUNCTION facturacion.crear_presupuestos_lote(jsonb) IS
  'Alta atómica de N presupuestos (modalidad por-prestacion, uno por prestación): o entran todos, '
  'o no entra ninguno. Cada ítem puede llevar `lineas` opcional y las mismas 13 columnas '
  'opcionales de vigencia/dependencia/datos de traslado que la alta simple. Desde '
  'autorizacion-mensual: la autorización 1:1 en pendiente de cada ítem lleva periodo_mes derivado '
  'de la vigencia_desde de ESE ítem. SECURITY INVOKER a propósito. '
  'NO convertir a SECURITY DEFINER. Mismos códigos de error 45401-45403 + 45404 para líneas malformadas.';
