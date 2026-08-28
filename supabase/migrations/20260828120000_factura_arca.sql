-- Migration: factura_arca
-- Change: openspec/changes/facturacion-electronica-arca/ (design.md D3, tasks.md 2B.5)
--
-- ¿Qué agrega?
--   (a) 7 columnas nullables en `facturacion.facturas` para el comprobante fiscal electrónico
--       obtenido de ARCA a través del miniserver `arca-miniserver`:
--         cae                  TEXT     -- Código de Autorización Electrónico. Su presencia = factura emitida.
--         cae_vencimiento      DATE     -- vencimiento del CAE
--         cbte_nro             INTEGER  -- número de comprobante asignado por ARCA
--         pto_vta              INTEGER  -- punto de venta usado (snapshot de la config fiscal al emitir)
--         arca_ambiente        TEXT     -- 'production' | 'homologacion' (CHECK) -- separa comprobantes de prueba de los reales
--         comprobante_pdf_url  TEXT     -- ruta del PDF en el bucket privado `facturas-emitidas`
--         arca_respuesta       JSONB    -- snapshot crudo de la respuesta del miniserver (auditoría / reconciliación)
--   (b) `CREATE OR REPLACE FUNCTION facturacion.actualizar_factura_completa(uuid, jsonb)` para que
--       esas 7 claves se puedan persistir vía la misma RPC atómica que ya usa el circuito. La RPC
--       tiene un whitelist fijo de columnas en su `UPDATE ... SET` — sin este replace, un
--       `p_cambios` con `{"cae": ...}` se ignoraría en silencio. Mismo criterio y mismo patrón
--       `p_cambios ? 'clave'` que `20260813090001_factura_rpc_autorizacion.sql` usó para
--       `autorizacion_id`. `crear_factura_completa` NO se toca: el alta de una factura nunca trae
--       campos fiscales (se cargan solo al emitir, desde la Edge Function `facturar`).
--
-- ¿Por qué nullables, sin backfill? Una factura en `a-facturar` legítimamente no tiene ninguno de
-- estos datos — esa ausencia ES su significado, no un dato faltante. Un `NOT NULL` o un `CHECK`
-- correlacionado con `estado` rompería las correcciones manuales de estado que el panel de cobros
-- permite (`facturado ↔ cobrado ↔ pagado parcialmente`). Ninguna columna existente se altera.
--
-- RLS: `facturacion.facturas` tiene policies a nivel tabla (`Read facturacion` FOR SELECT,
-- `Write facturacion` FOR ALL, ambas `modulos.tiene_permiso('facturacion', ...)`), no a nivel
-- columna — las columnas nuevas quedan cubiertas sin policy nueva. El trigger de auditoría
-- `trg_audit_facturas` ya registra el row completo, así que también audita estas columnas.
--
-- ⚠️⚠️ SECURITY INVOKER — NO TOCAR ⚠️⚠️
-- `actualizar_factura_completa` DEBE seguir siendo `SECURITY INVOKER` (se declara explícito). Con
-- `SECURITY DEFINER` el owner es `postgres` (superusuario, bypassa RLS) y cualquier usuario
-- autenticado —incluso sin fila en `modulos.permisos`— podría emitir y editar facturas. Acá el
-- radio de daño es el REGISTRO FINANCIERO de la empresa con su rastro de auditoría. NUNCA
-- convertir a SECURITY DEFINER. Ver openspec/changes/integracion-facturacion/design.md D4.
--
-- Rollback:
--   ALTER TABLE facturacion.facturas
--     DROP COLUMN cae, DROP COLUMN cae_vencimiento, DROP COLUMN cbte_nro, DROP COLUMN pto_vta,
--     DROP COLUMN arca_ambiente, DROP COLUMN comprobante_pdf_url, DROP COLUMN arca_respuesta;
--   + re-aplicar `20260813090001_factura_rpc_autorizacion.sql` (versión previa de la RPC, sin las
--     7 claves fiscales). No crea ni transforma datos: revertir no pierde información (las
--     columnas quedan inertes si no hay escritores).
--
-- ⚠️ Esta migración NO la aplica el agente. La corre la usuaria / Enzo (governance, tasks.md 2B.9).
-- Depende de `20260813090001_factura_rpc_autorizacion.sql` (versión de la RPC que este replace
-- extiende).

-- (a) Columnas del comprobante fiscal ---------------------------------------------------------

ALTER TABLE facturacion.facturas
  ADD COLUMN IF NOT EXISTS cae                 text,
  ADD COLUMN IF NOT EXISTS cae_vencimiento     date,
  ADD COLUMN IF NOT EXISTS cbte_nro            integer,
  ADD COLUMN IF NOT EXISTS pto_vta             integer,
  ADD COLUMN IF NOT EXISTS arca_ambiente       text,
  ADD COLUMN IF NOT EXISTS comprobante_pdf_url text,
  ADD COLUMN IF NOT EXISTS arca_respuesta      jsonb;

-- CHECK de `arca_ambiente` en un bloque idempotente (ADD CONSTRAINT no tiene IF NOT EXISTS en
-- PG15). Admite NULL (una factura no emitida no tiene ambiente).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'facturas_arca_ambiente_check'
      AND conrelid = 'facturacion.facturas'::regclass
  ) THEN
    ALTER TABLE facturacion.facturas
      ADD CONSTRAINT facturas_arca_ambiente_check
      CHECK (arca_ambiente IS NULL OR arca_ambiente IN ('production', 'homologacion'));
  END IF;
END;
$$;

COMMENT ON COLUMN facturacion.facturas.cae IS
  'Código de Autorización Electrónico devuelto por ARCA al emitir. Su presencia marca la factura '
  'como emitida electrónicamente (RN-FA-06: documento fiscal, no se re-emite). Lo escribe solo la '
  'Edge Function `facturar`.';
COMMENT ON COLUMN facturacion.facturas.arca_respuesta IS
  'Snapshot crudo de la respuesta del miniserver arca-miniserver (auditoría / reconciliación). NO '
  'se expone al dominio del frontend.';

-- (b) RPC: mismo cuerpo que 20260813090001, + 7 claves fiscales en el UPDATE -------------------

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

  -- ⚠️ LA TRAMPA CENTRAL: `p_cambios ? 'col'` distingue CLAVE AUSENTE (no tocar) de CLAVE PRESENTE
  -- (reemplazar, aunque el valor sea null/vacío). Confundirla con `->>` borraría asistencias /
  -- autorizacion_id / campos fiscales en cada cambio de estado. Ver 20260812160000 y 20260813090001.
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
      THEN (p_cambios ->> 'autorizacion_id')::uuid ELSE autorizacion_id END,
    -- facturacion-electronica-arca (D3): 7 claves del comprobante fiscal. Mismo patrón `?`.
    -- Las escribe solo la Edge Function `facturar` al emitir; el formulario de edición no las manda.
    cae = CASE WHEN p_cambios ? 'cae' THEN NULLIF(p_cambios ->> 'cae', '') ELSE cae END,
    cae_vencimiento = CASE WHEN p_cambios ? 'cae_vencimiento'
      THEN (p_cambios ->> 'cae_vencimiento')::date ELSE cae_vencimiento END,
    cbte_nro = CASE WHEN p_cambios ? 'cbte_nro' THEN (p_cambios ->> 'cbte_nro')::integer ELSE cbte_nro END,
    pto_vta = CASE WHEN p_cambios ? 'pto_vta' THEN (p_cambios ->> 'pto_vta')::integer ELSE pto_vta END,
    arca_ambiente = CASE WHEN p_cambios ? 'arca_ambiente'
      THEN NULLIF(p_cambios ->> 'arca_ambiente', '') ELSE arca_ambiente END,
    comprobante_pdf_url = CASE WHEN p_cambios ? 'comprobante_pdf_url'
      THEN NULLIF(p_cambios ->> 'comprobante_pdf_url', '') ELSE comprobante_pdf_url END,
    arca_respuesta = CASE WHEN p_cambios ? 'arca_respuesta'
      THEN p_cambios -> 'arca_respuesta' ELSE arca_respuesta END
  WHERE id = p_id;

  GET DIAGNOSTICS v_filas_afectadas = ROW_COUNT;
  IF v_filas_afectadas = 0 THEN
    RAISE EXCEPTION 'No existe una factura con id "%".', p_id
      USING ERRCODE = '45203';
  END IF;

  -- Asistencias: reemplazo completo SOLO si la clave está presente (ver nota de la trampa arriba).
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

COMMENT ON FUNCTION facturacion.actualizar_factura_completa(uuid, jsonb) IS
  'Edición atómica de una factura: reemplazo completo de asistencias SOLO cuando la clave '
  '"asistencias" está presente en p_cambios; actualización de autorizacion_id y de los 7 campos '
  'del comprobante fiscal (cae, cae_vencimiento, cbte_nro, pto_vta, arca_ambiente, '
  'comprobante_pdf_url, arca_respuesta) SOLO cuando cada clave está presente (jsonb ? distingue '
  'clave ausente de clave presente con valor vacío). Los campos fiscales los escribe la Edge '
  'Function `facturar`. SECURITY INVOKER a propósito. NUNCA convertir a SECURITY DEFINER. Ver '
  'openspec/changes/facturacion-electronica-arca/design.md D3.';
