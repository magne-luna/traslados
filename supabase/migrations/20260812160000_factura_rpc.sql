-- Migration: factura_rpc
-- Change: openspec/changes/integracion-facturacion/ (design.md D4/D7, tasks.md 1B.2/1B.3/1B.4)
--
-- ¿Por qué existe? Guardar una factura escribe en 2 tablas: `facturacion.facturas` y
-- `facturacion.asistencia_prestacion` (N filas). PostgREST no da transacciones entre requests:
-- cada `insert()` de supabase-js es un request HTTP que commitea por su cuenta. Una secuencia
-- cortada a mitad deja una factura sin sus asistencias — y las asistencias son lo que se factura
-- (RN-FA-01) y lo que se imprime junto a la factura (`factura-exportacion`). Una factura con medio
-- detalle es peor que ninguna: es un documento fiscal incorrecto. Mismo patrón exacto que
-- `obra_social.crear_obra_social_completa`/`actualizar_obra_social_completa`
-- (`20260731120001_obra_social_rpc.sql`) y que `requisitos_actividad_rpc.sql`: PostgREST ejecuta
-- cada `POST /rpc/...` dentro de una transacción, así que el cuerpo entero commitea o hace
-- rollback completo.
--
-- Semántica de las asistencias: REEMPLAZO COMPLETO DEL CONJUNTO (D4). Igual que el checklist de
-- `integracion-obra-social` y a diferencia de las colecciones de Pacientes: las asistencias son
-- identidad-libre (nada las referencia con FK, no hay ON DELETE RESTRICT apuntándoles) y el editor
-- de asistencias trabaja sobre el conjunto entero. DELETE + INSERT dentro de la transacción es más
-- simple que un diff fino y no pierde ningún id que alguien esté mirando.
--
-- ⚠️⚠️ SECURITY INVOKER — NO TOCAR ⚠️⚠️
-- Ambas funciones DEBEN ser `SECURITY INVOKER` (default de PostgreSQL; se declara explícito para
-- que sea una afirmación revisable en el diff, no un default silencioso). Convertir cualquiera de
-- las dos a `SECURITY DEFINER` sería una REGRESIÓN DE SEGURIDAD INACEPTABLE, y acá más que en los
-- changes anteriores: el owner de una función creada por una migración de Supabase es `postgres`,
-- superusuario, que bypassea RLS por completo. Con DEFINER, cualquier usuario autenticado —incluso
-- sin ninguna fila en `modulos.permisos`— podría EMITIR Y EDITAR FACTURAS. En Obras Sociales el
-- radio de daño era config; acá es el registro FINANCIERO de la empresa, con su rastro de
-- auditoría. NUNCA convertir a SECURITY DEFINER. Ver design.md D4.
--
-- Precedente engañoso del mismo schema: `facturacion.validar_autorizacion_monto()` SÍ es
-- SECURITY DEFINER (correcto: es un trigger de validación que no escribe). Es exactamente por eso
-- que estas dos declaran INVOKER de forma explícita — si no, quien lea el schema puede asumir que
-- el "estilo de la casa" es DEFINER.
--
-- Cómo se hace cumplir el permiso (verificado con `pg_policies` contra el proyecto real, tasks.md
-- 1.3): `facturacion.facturas` y `facturacion.asistencia_prestacion` tienen
-- `CREATE POLICY "Write ..." FOR ALL ... USING (modulos.tiene_permiso('facturacion','write'))`. En
-- una policy FOR ALL sin WITH CHECK, Postgres usa la expresión de USING también como check de
-- INSERT: un usuario sin `facturacion:write` recibe 42501 en el primer INSERT y toda la
-- transacción hace rollback (verificación manual dedicada: tasks.md 1B.9). Este change NO
-- reescribe esas policies.
--
-- `modulos.tiene_permiso()` sí es SECURITY DEFINER y DEBE serlo (necesita leer
-- `modulos.permisos` de todos los usuarios); eso no debilita nada porque filtra por `auth.uid()`,
-- que sale del JWT de la request, no del owner de esta función.
--
-- ⚠️ La trampa central del change (1B.3, design.md D4 "Semántica parcial de p_cambios").
-- `ActualizacionFactura` es `Partial<...>`: la AUSENCIA de una clave significa "no tocar". En
-- jsonb eso se distingue con el operador `?` (`p_cambios ? 'asistencias'`), que diferencia CLAVE
-- AUSENTE de CLAVE PRESENTE CON VALOR NULL/VACÍO — `->>` sola no alcanza. Confundir esto BORRARÍA
-- LAS ASISTENCIAS de cualquier factura que se edite solo para cambiar el estado, que es la
-- operación MÁS FRECUENTE del circuito (`factura-estados-circuito`). Es la trampa más fácil de
-- este change y tiene test dedicado (frontend + verificación manual 1B.10). Misma trampa ya
-- documentada y resuelta en `integracion-obra-social` D6.
--
-- Códigos de error propios (clase '45', libre en PostgreSQL). Rango 452xx a propósito: distinto
-- del 451xx de `integracion-obra-social`, para que un código no se confunda entre dominios. El
-- frontend los traduce en `SupabaseFacturaRepository` (D7):
--   45201 — una asistencia llega sin fecha o sin prestación.
--   45202 — p_factura / p_cambios no es un objeto JSON.
--   45203 — actualizar_... con un id que no existe (o que RLS oculta, mismo criterio que 45103 de
--           integracion-obra-social: 0 filas por RLS y 0 filas por inexistencia son
--           indistinguibles, y es deliberado).
--   45204 — mes_facturado fuera de 1-12 (defensa en profundidad sobre el CHECK existente de la
--           tabla; si el CHECK ya lo hubiera atajado con 23514, este código nunca se alcanza, pero
--           deja el mensaje en castellano bajo control de la función en vez de depender del texto
--           genérico de un CHECK violado).
--
-- Auditoría y rollback: los triggers `auditoria.log_action()` de `facturas` y
-- `asistencia_prestacion` (ya aplicados, verificados en `information_schema.triggers`, tasks.md
-- 1.3) disparan fila por fila DENTRO de la misma transacción: una emisión deja su rastro completo
-- o no deja ninguno.
-- Rollback: `DROP FUNCTION facturacion.crear_factura_completa(jsonb);` +
-- `DROP FUNCTION facturacion.actualizar_factura_completa(uuid, jsonb);` — no crean ni alteran
-- tablas, columnas, policies ni datos: revertirlas no puede perder información.
--
-- ⚠️ Esta migración NO la aplica el agente. La corre la usuaria / Enzo (governance, tasks.md 1B.7).
-- Depende de `20260812150000_factura_fecha_emision_indices.sql` (usa `fecha_factura`).

CREATE OR REPLACE FUNCTION facturacion.crear_factura_completa(p_factura jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER  -- ⚠️ NUNCA SECURITY DEFINER: bypassearía RLS y el gateo por módulo. Ver cabecera.
SET search_path = ''
AS $$
DECLARE
  v_factura_id     uuid;
  v_asistencias    jsonb;
  v_item           jsonb;
  v_mes_facturado  integer;
BEGIN
  IF p_factura IS NULL OR jsonb_typeof(p_factura) <> 'object' THEN
    RAISE EXCEPTION 'El alta de factura recibió un payload inválido.'
      USING ERRCODE = '45202';
  END IF;

  v_mes_facturado := (p_factura ->> 'mes_facturado')::integer;
  IF v_mes_facturado IS NOT NULL AND (v_mes_facturado < 1 OR v_mes_facturado > 12) THEN
    RAISE EXCEPTION 'El mes facturado debe estar entre 1 y 12.'
      USING ERRCODE = '45204';
  END IF;

  -- 1. Padre. Si RLS deniega la escritura, corta acá con 42501 y nada más se ejecuta.
  INSERT INTO facturacion.facturas (
    paciente_id, descripcion, dias, valor_km, monto, estado, fecha_init, fecha_tope, tipo,
    cantidad_km, fecha_estimada_cobro, fecha_factura, prestacion, mes_facturado, anio_facturado,
    dependencia_y_retorno, domicilio_id, identificador_origen, identificador_valor
  ) VALUES (
    (p_factura ->> 'paciente_id')::uuid,
    NULLIF(p_factura ->> 'descripcion', ''),
    (p_factura ->> 'dias')::integer,
    (p_factura ->> 'valor_km')::numeric,
    (p_factura ->> 'monto')::numeric,
    COALESCE(NULLIF(p_factura ->> 'estado', '')::facturacion.estado_factura, 'a facturar'),
    (p_factura ->> 'fecha_init')::date,
    (p_factura ->> 'fecha_tope')::date,
    NULLIF(p_factura ->> 'tipo', '')::facturacion.tipo_factura,
    (p_factura ->> 'cantidad_km')::numeric,
    (p_factura ->> 'fecha_estimada_cobro')::date,
    (p_factura ->> 'fecha_factura')::date,
    NULLIF(p_factura ->> 'prestacion', ''),
    v_mes_facturado,
    (p_factura ->> 'anio_facturado')::integer,
    NULLIF(p_factura ->> 'dependencia_y_retorno', ''),
    (p_factura ->> 'domicilio_id')::uuid,
    NULLIF(p_factura ->> 'identificador_origen', '')::obra_social.identificador_origen_factura,
    NULLIF(p_factura ->> 'identificador_valor', '')
  )
  RETURNING id INTO v_factura_id;

  -- 2. Asistencias: conjunto completo, sin diff fino (D4).
  v_asistencias := COALESCE(p_factura -> 'asistencias', '[]'::jsonb);
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_asistencias)
  LOOP
    IF (v_item ->> 'fecha') IS NULL OR trim(v_item ->> 'fecha') = ''
       OR (v_item ->> 'prestacion') IS NULL OR trim(v_item ->> 'prestacion') = '' THEN
      RAISE EXCEPTION 'Todas las asistencias necesitan fecha y prestación.'
        USING ERRCODE = '45201';
    END IF;

    INSERT INTO facturacion.asistencia_prestacion (
      factura_id, fecha, prestacion, dependencia, retorno, factura_sabados
    ) VALUES (
      v_factura_id,
      (v_item ->> 'fecha')::date,
      v_item ->> 'prestacion',
      NULLIF(v_item ->> 'dependencia', ''),
      NULLIF(v_item ->> 'retorno', ''),
      COALESCE((v_item ->> 'factura_sabados')::boolean, false)
    );
  END LOOP;

  RETURN v_factura_id;
END;
$$;

CREATE OR REPLACE FUNCTION facturacion.actualizar_factura_completa(p_id uuid, p_cambios jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER  -- ⚠️ NUNCA SECURITY DEFINER: bypassearía RLS y el gateo por módulo. Ver cabecera.
SET search_path = ''
AS $$
DECLARE
  v_asistencias      jsonb;
  v_item             jsonb;
  v_filas_afectadas  integer;
  v_mes_facturado    integer;
BEGIN
  IF p_cambios IS NULL OR jsonb_typeof(p_cambios) <> 'object' THEN
    RAISE EXCEPTION 'La edición de factura recibió un payload inválido.'
      USING ERRCODE = '45202';
  END IF;

  IF p_cambios ? 'mes_facturado' THEN
    v_mes_facturado := (p_cambios ->> 'mes_facturado')::integer;
    IF v_mes_facturado IS NOT NULL AND (v_mes_facturado < 1 OR v_mes_facturado > 12) THEN
      RAISE EXCEPTION 'El mes facturado debe estar entre 1 y 12.'
        USING ERRCODE = '45204';
    END IF;
  END IF;

  -- ⚠️ LA TRAMPA CENTRAL DEL CHANGE (1B.3, design.md D4): `p_cambios ? 'col'` distingue CLAVE
  -- AUSENTE (no tocar) de CLAVE PRESENTE (reemplazar, aunque el valor sea null/[]). Usar `->>`
  -- solo acá confundiría "el cliente no mandó este campo" con "el cliente lo mandó vacío", y en
  -- el caso de `asistencias` eso borraría el detalle de la factura en cada cambio de estado.
  UPDATE facturacion.facturas SET
    paciente_id = CASE WHEN p_cambios ? 'paciente_id' THEN (p_cambios ->> 'paciente_id')::uuid ELSE paciente_id END,
    descripcion = CASE WHEN p_cambios ? 'descripcion' THEN NULLIF(p_cambios ->> 'descripcion', '') ELSE descripcion END,
    dias = CASE WHEN p_cambios ? 'dias' THEN (p_cambios ->> 'dias')::integer ELSE dias END,
    valor_km = CASE WHEN p_cambios ? 'valor_km' THEN (p_cambios ->> 'valor_km')::numeric ELSE valor_km END,
    monto = CASE WHEN p_cambios ? 'monto' THEN (p_cambios ->> 'monto')::numeric ELSE monto END,
    estado = CASE WHEN p_cambios ? 'estado'
      THEN NULLIF(p_cambios ->> 'estado', '')::facturacion.estado_factura ELSE estado END,
    fecha_init = CASE WHEN p_cambios ? 'fecha_init' THEN (p_cambios ->> 'fecha_init')::date ELSE fecha_init END,
    fecha_tope = CASE WHEN p_cambios ? 'fecha_tope' THEN (p_cambios ->> 'fecha_tope')::date ELSE fecha_tope END,
    tipo = CASE WHEN p_cambios ? 'tipo'
      THEN NULLIF(p_cambios ->> 'tipo', '')::facturacion.tipo_factura ELSE tipo END,
    cantidad_km = CASE WHEN p_cambios ? 'cantidad_km' THEN (p_cambios ->> 'cantidad_km')::numeric ELSE cantidad_km END,
    fecha_estimada_cobro = CASE WHEN p_cambios ? 'fecha_estimada_cobro'
      THEN (p_cambios ->> 'fecha_estimada_cobro')::date ELSE fecha_estimada_cobro END,
    fecha_factura = CASE WHEN p_cambios ? 'fecha_factura'
      THEN (p_cambios ->> 'fecha_factura')::date ELSE fecha_factura END,
    prestacion = CASE WHEN p_cambios ? 'prestacion' THEN NULLIF(p_cambios ->> 'prestacion', '') ELSE prestacion END,
    mes_facturado = CASE WHEN p_cambios ? 'mes_facturado' THEN v_mes_facturado ELSE mes_facturado END,
    anio_facturado = CASE WHEN p_cambios ? 'anio_facturado'
      THEN (p_cambios ->> 'anio_facturado')::integer ELSE anio_facturado END,
    dependencia_y_retorno = CASE WHEN p_cambios ? 'dependencia_y_retorno'
      THEN NULLIF(p_cambios ->> 'dependencia_y_retorno', '') ELSE dependencia_y_retorno END,
    domicilio_id = CASE WHEN p_cambios ? 'domicilio_id' THEN (p_cambios ->> 'domicilio_id')::uuid ELSE domicilio_id END,
    identificador_origen = CASE WHEN p_cambios ? 'identificador_origen'
      THEN NULLIF(p_cambios ->> 'identificador_origen', '')::obra_social.identificador_origen_factura
      ELSE identificador_origen END,
    identificador_valor = CASE WHEN p_cambios ? 'identificador_valor'
      THEN NULLIF(p_cambios ->> 'identificador_valor', '') ELSE identificador_valor END
  WHERE id = p_id;

  GET DIAGNOSTICS v_filas_afectadas = ROW_COUNT;
  IF v_filas_afectadas = 0 THEN
    RAISE EXCEPTION 'No existe una factura con id "%".', p_id
      USING ERRCODE = '45203';
  END IF;

  -- Asistencias: reemplazo completo SOLO si la clave está presente (ver nota de la trampa arriba).
  -- Clave ausente (ej. `{"estado":"facturado"}`) => este bloque nunca corre => las asistencias
  -- existentes sobreviven intactas.
  IF p_cambios ? 'asistencias' THEN
    DELETE FROM facturacion.asistencia_prestacion WHERE factura_id = p_id;

    v_asistencias := COALESCE(p_cambios -> 'asistencias', '[]'::jsonb);
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_asistencias)
    LOOP
      IF (v_item ->> 'fecha') IS NULL OR trim(v_item ->> 'fecha') = ''
         OR (v_item ->> 'prestacion') IS NULL OR trim(v_item ->> 'prestacion') = '' THEN
        RAISE EXCEPTION 'Todas las asistencias necesitan fecha y prestación.'
          USING ERRCODE = '45201';
      END IF;

      INSERT INTO facturacion.asistencia_prestacion (
        factura_id, fecha, prestacion, dependencia, retorno, factura_sabados
      ) VALUES (
        p_id,
        (v_item ->> 'fecha')::date,
        v_item ->> 'prestacion',
        NULLIF(v_item ->> 'dependencia', ''),
        NULLIF(v_item ->> 'retorno', ''),
        COALESCE((v_item ->> 'factura_sabados')::boolean, false)
      );
    END LOOP;
  END IF;

  RETURN p_id;
END;
$$;

-- Superficie de ejecución mínima. Aunque con SECURITY INVOKER un `anon` no podría escribir nada
-- (RLS lo rechazaría), no hay razón para dejarle las funciones expuestas.
REVOKE ALL ON FUNCTION facturacion.crear_factura_completa(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION facturacion.crear_factura_completa(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION facturacion.crear_factura_completa(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION facturacion.actualizar_factura_completa(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION facturacion.actualizar_factura_completa(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION facturacion.actualizar_factura_completa(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION facturacion.crear_factura_completa(jsonb) IS
  'Alta atómica de una factura y sus asistencias (facturacion.asistencia_prestacion). '
  'SECURITY INVOKER a propósito: RLS (modulos.tiene_permiso(''facturacion'',''write'')) sigue '
  'aplicando sobre cada tabla. NUNCA convertir a SECURITY DEFINER — bypassearía RLS sobre el '
  'registro financiero de la empresa. Ver openspec/changes/integracion-facturacion/design.md D4.';

COMMENT ON FUNCTION facturacion.actualizar_factura_completa(uuid, jsonb) IS
  'Edición atómica de una factura: reemplazo completo de asistencias SOLO cuando la clave '
  '"asistencias" está presente en p_cambios (jsonb ? distingue clave ausente de clave presente '
  'con valor vacío — confundirlas borraría las asistencias en cada cambio de estado). '
  'SECURITY INVOKER a propósito. NUNCA convertir a SECURITY DEFINER. Ver design.md D4.';
