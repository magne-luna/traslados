-- Migration: presupuesto_rpc
-- Change: presupuesto-prestaciones (design.md D2, tasks.md 5.2) -- PR 2 de 3 ("columna + RPC +
-- Edge Function"). Requiere `20260812130000_presupuesto_prestacion_id.sql` (misma PR) aplicada
-- antes -- ambas funciones escriben `prestacion_id`.
--
-- ¿Por qué existe? En modalidad `por-prestacion` un submit crea N presupuestos (uno por prestación
-- seleccionada). PostgREST no da transacciones entre requests: N `POST` sucesivos al Edge Function
-- dejarían, si el tercero falla, dos presupuestos financieros huérfanos sin forma limpia de
-- compensar. Estas dos funciones son el mismo patrón que `pacientes.crear_paciente_completo`,
-- `obra_social.crear_obra_social_completa`, `pacientes.crear_hoja_de_ruta_completa` y
-- `conductores.crear_conductor_completo` (todas ya aplicadas): PostgREST ejecuta cada `POST
-- /rpc/...` dentro de una transacción, así que el cuerpo entero commitea o hace rollback completo.
-- Presupuestos era el único módulo que todavía hacía `.from(...).insert(...)` directo desde el Edge
-- Function (design.md D2, tensión honesta con `integracion-presupuestos` D3 -- este change NO
-- revierte esa decisión, la refuerza: la autorización pasa a estar una capa más abajo, en RLS de
-- Postgres con la sesión real del usuario).
--
-- ⚠️⚠️ SECURITY INVOKER -- NO TOCAR ⚠️⚠️
-- Las dos funciones DEBEN ser `SECURITY INVOKER` (default de PostgreSQL; se declara explícito para
-- que sea una afirmación revisable en el diff, no un default silencioso). Convertir cualquiera de
-- las dos a `SECURITY DEFINER` sería una REGRESIÓN DE SEGURIDAD grave, y acá más que en los changes
-- anteriores: el owner de una función creada por una migración de Supabase es `postgres`,
-- superusuario, que bypassea RLS por completo. Con DEFINER, cualquier usuario autenticado --incluso
-- sin ninguna fila en `modulos.permisos`-- podría emitir presupuestos financieros arbitrarios, sin
-- ningún gateo. El radio de daño es el registro financiero de la empresa, con su rastro de
-- auditoría (design.md D2, riesgo #3 del change).
--
-- Cómo se hace cumplir el permiso, verificado contra las policies vigentes
-- (`20260730140000_split_modulos_permisos.sql` movió `presupuesto`/`autorizacion` al módulo
-- `presupuestos`, no `facturacion`):
--   facturacion.presupuesto -> USING (modulos.tiene_permiso('presupuestos', 'write'))
-- La policy es `FOR ALL` con `USING` y sin `WITH CHECK`: PostgreSQL usa la expresión de `USING`
-- también como check de INSERT -- un usuario sin `presupuestos: write` recibe `42501` en el primer
-- INSERT y la transacción entera hace rollback (en el lote, ningún presupuesto queda persistido,
-- ni siquiera los que se habrían insertado antes del que falló).
--
-- `modulos.tiene_permiso()` sí es `SECURITY DEFINER` y debe serlo (lee `modulos.permisos` de todos
-- los usuarios); resuelve contra `auth.uid()` del JWT de la request, no contra el owner de esta
-- función.
--
-- `SET search_path = ''` en las dos, `REVOKE ALL ... FROM PUBLIC` y `FROM anon`,
-- `GRANT EXECUTE ... TO authenticated`, y `COMMENT ON FUNCTION` con la prohibición de `DEFINER`
-- escrita para quien lea la base sin abrir este documento.
--
-- Forma del argumento: `p_presupuesto`/cada elemento de `p_presupuestos` espeja el shape de fila
-- (`toDb()` de `supabase/functions/presupuestos/index.ts`, snake_case: paciente_id, obra_social_id,
-- monto, fecha_emision, archivo_url, prestacion_id) -- mismo criterio que
-- `obra_social.crear_obra_social_completa`/`p_os`: el argumento espeja exactamente las columnas que
-- inserta. El Edge Function es el único llamador (design.md D2 opción A): construye este jsonb con
-- `toDb()`, que ya existe y no cambia de forma más allá del campo nuevo.
--
-- Atomicidad de `crear_presupuestos_lote` (design.md D2, RN de negocio "todo o nada"): al ser UNA
-- sola invocación de función `plpgsql`, todo el cuerpo -- incluido el `FOR` que inserta N filas --
-- corre dentro de la transacción implícita que PostgREST abre para el `POST /rpc/...`. Un
-- `RAISE EXCEPTION` en cualquier iteración aborta la función completa y Postgres revierte todas las
-- filas ya insertadas en esa misma invocación, sin necesidad de un `BEGIN/EXCEPTION` explícito.
--
-- Códigos de error propios (clase '45', libre en PostgreSQL). Rango nuevo para este dominio --
-- `45001-2` ya lo usa `crear_paciente_completo`, `45101-3` `crear_obra_social_completa`, `45201-2`
-- `crear_conductor_completo`, `45301-4` `crear_hoja_de_ruta_completa`:
--   45401 -- `p_presupuesto`/`p_presupuestos` no es un objeto/arreglo JSON válido (payload
--           malformado del lado del cliente).
--   45402 -- un presupuesto (simple o un ítem del lote) llega sin paciente_id, obra_social_id, monto
--           o fecha_emision.
--   45403 -- `p_presupuestos` es un arreglo vacío (el lote necesita al menos una prestación
--           seleccionada; el frontend ya bloquea el submit en ese caso, D9/tasks.md 8.5, esto es
--           defensa en profundidad del lado del servidor).
-- El Edge Function sigue validando los campos requeridos ANTES de invocar la RPC (mismo chequeo que
-- ya tenía, tasks.md 6.4) -- estos códigos son defensa en profundidad si algún día hay otro llamador
-- de la RPC que no pase por ese Edge Function.
--
-- Auditoría y rollback: el trigger `auditoria.log_action()` de `facturacion.presupuesto` (ya
-- aplicado, `20260724100005_schema_facturacion.sql`) dispara fila por fila dentro de la misma
-- transacción (RN-GL-02) -- un alta (simple o de lote) deja su rastro completo o no deja ninguno.
-- Rollback de esta migración: `DROP FUNCTION` × 2 -- no crean ni alteran tablas, columnas, policies
-- ni datos.
--
-- ⚠️ Esta migración se redacta como artefacto de diseño del change. NO se aplica desde el agente
-- (governance, no límite técnico) -- la aplica la usuaria/Enzo con `supabase db push`.

CREATE OR REPLACE FUNCTION facturacion.crear_presupuesto_completo(p_presupuesto jsonb)
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

  -- Atomicidad (design.md D2): todo el FOR corre dentro de la misma transacción implícita de esta
  -- invocación de función. Un RAISE EXCEPTION en cualquier iteración aborta la función completa;
  -- Postgres revierte automáticamente todas las filas ya insertadas en esta misma invocación,
  -- incluidos los ítems válidos que se procesaron antes del que falló.
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

    v_ids := array_append(v_ids, v_id);
  END LOOP;

  RETURN v_ids;
END;
$$;

-- Superficie de ejecución mínima. Aunque con SECURITY INVOKER un `anon` no podría escribir nada
-- (RLS lo rechazaría), no hay razón para dejarle las funciones expuestas.
REVOKE ALL ON FUNCTION facturacion.crear_presupuesto_completo(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION facturacion.crear_presupuesto_completo(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION facturacion.crear_presupuesto_completo(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION facturacion.crear_presupuestos_lote(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION facturacion.crear_presupuestos_lote(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION facturacion.crear_presupuestos_lote(jsonb) TO authenticated;

COMMENT ON FUNCTION facturacion.crear_presupuesto_completo(jsonb) IS
  'Alta simple de un presupuesto (modalidad general). SECURITY INVOKER a propósito: RLS '
  '(modulos.tiene_permiso(''presupuestos'',''write'')) sigue aplicando sobre facturacion.presupuesto. '
  'NO convertir a SECURITY DEFINER. Ver openspec/changes/presupuesto-prestaciones/design.md D2.';

COMMENT ON FUNCTION facturacion.crear_presupuestos_lote(jsonb) IS
  'Alta atómica de N presupuestos (modalidad por-prestacion, uno por prestación): o entran todos, o '
  'no entra ninguno. SECURITY INVOKER a propósito. NO convertir a SECURITY DEFINER. Ver '
  'openspec/changes/presupuesto-prestaciones/design.md D2.';
