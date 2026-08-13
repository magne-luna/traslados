-- Migration: factura_rpc_autorizacion
-- Change: openspec/changes/facturacion-seleccion-autorizacion/ (design.md D2, tasks.md 1B.2/1B.3)
--
-- ¿Qué agrega? `CREATE OR REPLACE FUNCTION` sobre las dos RPC vivas de facturación
-- (`facturacion.crear_factura_completa`, `facturacion.actualizar_factura_completa`, definidas en
-- `20260812160000_factura_rpc.sql`) para que también lean/escriban `autorizacion_id` desde el
-- `jsonb` que ya reciben. La FIRMA NO CAMBIA (mismos nombres, mismos tipos de parámetro): basta
-- `CREATE OR REPLACE`, no hace falta `DROP` previo ni re-`GRANT` (los `GRANT`/`REVOKE` ya
-- aplicados en la migración anterior siguen vigentes sobre la función reemplazada).
--
-- ¿Por qué? El wizard deja de resolver la autorización por heurística ("la primera con cupo
-- cargado", `useEmisionFactura.ts`) y pasa a recibir una elección explícita del paso 2 (D3/D4).
-- Ese vínculo tiene que persistirse atómicamente junto con el resto de la factura — la razón por
-- la que estas dos operaciones ya son RPC en primer lugar (ver cabecera de
-- `20260812160000_factura_rpc.sql`).
--
-- ⚠️⚠️ SECURITY INVOKER — NO TOCAR ⚠️⚠️
-- Ambas funciones siguen siendo `SECURITY INVOKER` (default de PostgreSQL, declarado explícito a
-- propósito). Convertir cualquiera de las dos a `SECURITY DEFINER` sería una REGRESIÓN DE
-- SEGURIDAD INACEPTABLE: el owner de una función creada por una migración de Supabase es
-- `postgres`, superusuario, que bypassea RLS por completo. Con DEFINER, cualquier usuario
-- autenticado —incluso sin ninguna fila en `modulos.permisos`— podría EMITIR Y EDITAR FACTURAS.
-- NUNCA convertir a SECURITY DEFINER. Ver design.md D2 de este change y D4 de
-- `integracion-facturacion`.
--
-- Se conservan BYTE POR BYTE respecto de `20260812160000_factura_rpc.sql`: `SECURITY INVOKER`
-- explícito, `SET search_path = ''`, los códigos de error `452xx` existentes (45201-45204), la
-- semántica de reemplazo completo de asistencias (`p_cambios ? 'asistencias'`), y el resto de las
-- columnas del INSERT/UPDATE. El único cambio funcional es la columna/clave `autorizacion_id`.
--
-- `crear_factura_completa`: una columna más en el INSERT, `(p_factura ->> 'autorizacion_id')::uuid`.
-- Es OPCIONAL en el jsonb (no hay `IF ... IS NULL THEN RAISE` para esta clave): una factura puede
-- no tener autorización vinculada, igual que hoy con `facturas.autorizacion_id` nullable (D1).
--
-- `actualizar_factura_completa`: MISMO PATRÓN `p_cambios ? 'clave'` que ya usa el resto de
-- columnas (y en particular `asistencias`) — clave ausente = no tocar el vínculo existente.
-- Confundirlo con `->>` borraría `autorizacion_id` en CADA cambio de estado, que es la operación
-- más frecuente del circuito (`factura-estados-circuito`). Es la misma trampa central ya resuelta
-- para `asistencias` en `20260812160000_factura_rpc.sql`, aplicada acá a una columna nueva.
--
-- Riesgo asumido (D2): `autorizacion_id` es opcional en el jsonb, así que un cliente VIEJO contra
-- esta RPC nueva sigue funcionando sin mandar la clave. Un cliente NUEVO contra la RPC VIEJA
-- (antes de esta migración) escribiría la factura ignorando en silencio el vínculo — por eso esta
-- migración es bloqueante y previa al commit del frontend que empieza a mandar `autorizacion_id`
-- (tasks.md §3, bloqueada por 1B.4).
--
-- Rollback: re-aplicar el cuerpo de las dos funciones tal como está en
-- `20260812160000_factura_rpc.sql` (otro `CREATE OR REPLACE FUNCTION`, sin `autorizacion_id`). No
-- crea ni altera tablas, policies ni datos: revertir esta migración no puede perder información
-- (la columna `facturas.autorizacion_id` queda inerte, sin escritores).
--
-- ⚠️ Esta migración NO la aplica el agente. La corre la usuaria / Enzo (governance, tasks.md
-- 1B.4). Depende de `20260813090000_factura_autorizacion_id.sql` (agrega la columna que esta RPC
-- empieza a escribir).

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
    dependencia_y_retorno, domicilio_id, identificador_origen, identificador_valor, autorizacion_id
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
    NULLIF(p_factura ->> 'identificador_valor', ''),
    (p_factura ->> 'autorizacion_id')::uuid
  )
  RETURNING id INTO v_factura_id;

  -- 2. Asistencias: conjunto completo, sin diff fino (D4 de integracion-facturacion).
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

  -- ⚠️ LA TRAMPA CENTRAL DEL CHANGE (1B.3, design.md D2): `p_cambios ? 'col'` distingue CLAVE
  -- AUSENTE (no tocar) de CLAVE PRESENTE (reemplazar, aunque el valor sea null/vacío). Usar
  -- `->>` solo acá confundiría "el cliente no mandó este campo" con "el cliente lo mandó vacío",
  -- y en el caso de `autorizacion_id` eso borraría el vínculo en cada cambio de estado — igual
  -- que la trampa ya resuelta para `asistencias` en `20260812160000_factura_rpc.sql`.
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
      THEN NULLIF(p_cambios ->> 'identificador_valor', '') ELSE identificador_valor END,
    autorizacion_id = CASE WHEN p_cambios ? 'autorizacion_id'
      THEN (p_cambios ->> 'autorizacion_id')::uuid ELSE autorizacion_id END
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

COMMENT ON FUNCTION facturacion.crear_factura_completa(jsonb) IS
  'Alta atómica de una factura y sus asistencias (facturacion.asistencia_prestacion), y del '
  'vínculo opcional a la autorización elegida (facturas.autorizacion_id). SECURITY INVOKER a '
  'propósito: RLS (modulos.tiene_permiso(''facturacion'',''write'')) sigue aplicando sobre cada '
  'tabla. NUNCA convertir a SECURITY DEFINER — bypassearía RLS sobre el registro financiero de '
  'la empresa. Ver openspec/changes/facturacion-seleccion-autorizacion/design.md D2.';

COMMENT ON FUNCTION facturacion.actualizar_factura_completa(uuid, jsonb) IS
  'Edición atómica de una factura: reemplazo completo de asistencias SOLO cuando la clave '
  '"asistencias" está presente en p_cambios, y actualización de autorizacion_id SOLO cuando esa '
  'clave está presente (jsonb ? distingue clave ausente de clave presente con valor vacío — '
  'confundirlas borraría el vínculo o las asistencias en cada cambio de estado). SECURITY '
  'INVOKER a propósito. NUNCA convertir a SECURITY DEFINER. Ver design.md D2.';
