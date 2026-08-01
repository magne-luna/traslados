-- Migration: obra_social_rpc_formato_afiliado
-- Change: RF-106/RN-ID-02, sigue a 20260731140000_schema_obra_social_formato_afiliado.sql.
--
-- `20260731120001_obra_social_rpc.sql` (ya aplicada) documenta en su cabecera que
-- `formato_identificador_afiliado` "no existe en obra_social.obra_social" y que por eso ninguna
-- de las dos funciones la toca — eso reflejaba la decisión "D12 revertida" de
-- `integracion-obra-social`, que resultó estar basada en una confirmación de la usuaria que nunca
-- pasó (ver `20260731140000_schema_obra_social_formato_afiliado.sql`). Con la columna
-- `obra_social.obra_social.formato_afiliado` ya agregada (con DEFAULT, así que esta migración no
-- es bloqueante para altas/ediciones existentes), esta migración aditiva actualiza ambas
-- funciones para que efectivamente lean y persistan el valor que manda el frontend
-- (`ObraSocialForm`/`toCrearObraSocialPayload`/`toActualizarObraSocialPayload`).
--
-- Mismo patrón exacto que el resto de columnas de `obra_social.obra_social` en estas dos
-- funciones (`COALESCE` con el mismo default que el frontend en el alta; `CASE WHEN p_cambios ?
-- 'formato_afiliado'` en la edición). No cambia firma, `SECURITY INVOKER`, `search_path` ni
-- ningún otro paso de ninguna de las dos funciones.
--
-- ⚠️⚠️ SECURITY INVOKER — NO TOCAR ⚠️⚠️ (idéntico razonamiento que 20260731120001: con DEFINER,
-- el owner `postgres` bypassearía RLS y cualquier autenticado podría dar de alta/editar obras
-- sociales sin `modulos.tiene_permiso('obra_social','write')`).
--
-- Rollback: no hay rollback "bueno" sin reintroducir el bug de que el formato elegido en el form
-- se descarte en silencio — si hace falta deshacer, reaplicar `20260731120001_obra_social_rpc.sql`
-- tal cual (a propósito) o restaurar desde backup.
--
-- ⚠️ Esta migración se redacta como artefacto de diseño. NO se aplica desde el agente (el sandbox
-- no tiene Docker ni credenciales de escritura sobre el proyecto real) — la aplica la
-- usuaria/Enzo con `supabase db push`.

CREATE OR REPLACE FUNCTION obra_social.crear_obra_social_completa(p_os jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER  -- ⚠️ NUNCA SECURITY DEFINER: bypassearía RLS y el gateo por módulo. Ver cabecera.
SET search_path = ''
AS $$
DECLARE
  v_obra_social_id   uuid;
  v_checklist        jsonb;
  v_plantilla        jsonb;
  v_campos           jsonb;
  v_item             jsonb;
  v_nombre           text;
  v_tipo_documento_id uuid;
BEGIN
  IF p_os IS NULL OR jsonb_typeof(p_os) <> 'object' THEN
    RAISE EXCEPTION 'El alta de obra social recibió un payload inválido.'
      USING ERRCODE = '45102';
  END IF;

  INSERT INTO obra_social.obra_social (
    razon_social, cuit, codigo, direccion, telefono, condicion_iva, tipo_comprobante,
    plazo_cobro_dias, modalidad_facturacion, admite_pagos_parciales, identificador_origen,
    formato_afiliado
  ) VALUES (
    p_os ->> 'razon_social',
    p_os ->> 'cuit',
    NULLIF(p_os ->> 'codigo', ''),
    NULLIF(p_os ->> 'direccion', ''),
    NULLIF(p_os ->> 'telefono', ''),
    NULLIF(p_os ->> 'condicion_iva', ''),
    NULLIF(p_os ->> 'tipo_comprobante', '')::facturacion.tipo_factura,
    COALESCE((p_os ->> 'plazo_cobro_dias')::integer, 90),
    COALESCE(NULLIF(p_os ->> 'modalidad_facturacion', '')::obra_social.modalidad_facturacion, 'por-prestacion'),
    COALESCE((p_os ->> 'admite_pagos_parciales')::boolean, false),
    COALESCE(
      NULLIF(p_os -> 'plantilla_factura' ->> 'identificador_origen', '')::obra_social.identificador_origen_factura,
      'paciente.numeroAfiliado'
    ),
    COALESCE(NULLIF(p_os ->> 'formato_afiliado', '')::obra_social.formato_afiliado, 'numero-documento')
  )
  RETURNING id INTO v_obra_social_id;

  v_checklist := COALESCE(p_os -> 'checklist', '[]'::jsonb);
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_checklist)
  LOOP
    v_nombre := trim(v_item ->> 'nombre');
    IF v_nombre IS NULL OR v_nombre = '' THEN
      RAISE EXCEPTION 'Todos los ítems del checklist necesitan un nombre.'
        USING ERRCODE = '45101';
    END IF;

    SELECT td.id INTO v_tipo_documento_id
    FROM obra_social.tipos_documento td
    WHERE lower(td.tipo) = lower(v_nombre)
    LIMIT 1;

    IF v_tipo_documento_id IS NULL THEN
      INSERT INTO obra_social.tipos_documento (tipo) VALUES (v_nombre)
      RETURNING id INTO v_tipo_documento_id;
    END IF;

    INSERT INTO obra_social.requisitos_os (obra_social_id, tipo_documento_id, orden, requerido)
    VALUES (
      v_obra_social_id,
      v_tipo_documento_id,
      COALESCE((v_item ->> 'orden')::integer, 0),
      COALESCE((v_item ->> 'requerido')::boolean, true)
    )
    ON CONFLICT (obra_social_id, tipo_documento_id) DO UPDATE
      SET orden = EXCLUDED.orden, requerido = EXCLUDED.requerido;
  END LOOP;

  v_plantilla := p_os -> 'plantilla_factura';
  IF jsonb_typeof(v_plantilla) = 'object' THEN
    v_campos := COALESCE(v_plantilla -> 'campos', '[]'::jsonb);
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_campos)
    LOOP
      INSERT INTO obra_social.plantilla_campo (obra_social_id, etiqueta, origen, orden)
      VALUES (
        v_obra_social_id,
        v_item ->> 'etiqueta',
        (v_item ->> 'origen')::obra_social.origen_campo_plantilla,
        COALESCE((v_item ->> 'orden')::integer, 0)
      );
    END LOOP;
  END IF;

  RETURN v_obra_social_id;
END;
$$;

CREATE OR REPLACE FUNCTION obra_social.actualizar_obra_social_completa(p_id uuid, p_cambios jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER  -- ⚠️ NUNCA SECURITY DEFINER: bypassearía RLS y el gateo por módulo. Ver cabecera.
SET search_path = ''
AS $$
DECLARE
  v_checklist        jsonb;
  v_plantilla        jsonb;
  v_campos           jsonb;
  v_item             jsonb;
  v_nombre           text;
  v_tipo_documento_id uuid;
  v_filas_afectadas  integer;
BEGIN
  IF p_cambios IS NULL OR jsonb_typeof(p_cambios) <> 'object' THEN
    RAISE EXCEPTION 'La edición de obra social recibió un payload inválido.'
      USING ERRCODE = '45102';
  END IF;

  UPDATE obra_social.obra_social SET
    razon_social = CASE WHEN p_cambios ? 'razon_social' THEN p_cambios ->> 'razon_social' ELSE razon_social END,
    cuit = CASE WHEN p_cambios ? 'cuit' THEN p_cambios ->> 'cuit' ELSE cuit END,
    codigo = CASE WHEN p_cambios ? 'codigo' THEN NULLIF(p_cambios ->> 'codigo', '') ELSE codigo END,
    direccion = CASE WHEN p_cambios ? 'direccion' THEN NULLIF(p_cambios ->> 'direccion', '') ELSE direccion END,
    telefono = CASE WHEN p_cambios ? 'telefono' THEN NULLIF(p_cambios ->> 'telefono', '') ELSE telefono END,
    condicion_iva = CASE WHEN p_cambios ? 'condicion_iva' THEN NULLIF(p_cambios ->> 'condicion_iva', '') ELSE condicion_iva END,
    tipo_comprobante = CASE WHEN p_cambios ? 'tipo_comprobante'
      THEN NULLIF(p_cambios ->> 'tipo_comprobante', '')::facturacion.tipo_factura ELSE tipo_comprobante END,
    plazo_cobro_dias = CASE WHEN p_cambios ? 'plazo_cobro_dias'
      THEN (p_cambios ->> 'plazo_cobro_dias')::integer ELSE plazo_cobro_dias END,
    modalidad_facturacion = CASE WHEN p_cambios ? 'modalidad_facturacion'
      THEN (p_cambios ->> 'modalidad_facturacion')::obra_social.modalidad_facturacion ELSE modalidad_facturacion END,
    admite_pagos_parciales = CASE WHEN p_cambios ? 'admite_pagos_parciales'
      THEN (p_cambios ->> 'admite_pagos_parciales')::boolean ELSE admite_pagos_parciales END,
    identificador_origen = CASE WHEN (p_cambios -> 'plantilla_factura') ? 'identificador_origen'
      THEN (p_cambios -> 'plantilla_factura' ->> 'identificador_origen')::obra_social.identificador_origen_factura
      ELSE identificador_origen END,
    formato_afiliado = CASE WHEN p_cambios ? 'formato_afiliado'
      THEN (p_cambios ->> 'formato_afiliado')::obra_social.formato_afiliado ELSE formato_afiliado END
  WHERE id = p_id;

  GET DIAGNOSTICS v_filas_afectadas = ROW_COUNT;
  IF v_filas_afectadas = 0 THEN
    RAISE EXCEPTION 'No existe una obra social con id "%".', p_id
      USING ERRCODE = '45103';
  END IF;

  IF p_cambios ? 'checklist' THEN
    DELETE FROM obra_social.requisitos_os WHERE obra_social_id = p_id;

    v_checklist := p_cambios -> 'checklist';
    FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(v_checklist, '[]'::jsonb))
    LOOP
      v_nombre := trim(v_item ->> 'nombre');
      IF v_nombre IS NULL OR v_nombre = '' THEN
        RAISE EXCEPTION 'Todos los ítems del checklist necesitan un nombre.'
          USING ERRCODE = '45101';
      END IF;

      SELECT td.id INTO v_tipo_documento_id
      FROM obra_social.tipos_documento td
      WHERE lower(td.tipo) = lower(v_nombre)
      LIMIT 1;

      IF v_tipo_documento_id IS NULL THEN
        INSERT INTO obra_social.tipos_documento (tipo) VALUES (v_nombre)
        RETURNING id INTO v_tipo_documento_id;
      END IF;

      INSERT INTO obra_social.requisitos_os (obra_social_id, tipo_documento_id, orden, requerido)
      VALUES (
        p_id,
        v_tipo_documento_id,
        COALESCE((v_item ->> 'orden')::integer, 0),
        COALESCE((v_item ->> 'requerido')::boolean, true)
      )
      ON CONFLICT (obra_social_id, tipo_documento_id) DO UPDATE
        SET orden = EXCLUDED.orden, requerido = EXCLUDED.requerido;
    END LOOP;
  END IF;

  IF p_cambios ? 'plantilla_factura' THEN
    DELETE FROM obra_social.plantilla_campo WHERE obra_social_id = p_id;

    v_plantilla := p_cambios -> 'plantilla_factura';
    v_campos := COALESCE(v_plantilla -> 'campos', '[]'::jsonb);
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_campos)
    LOOP
      INSERT INTO obra_social.plantilla_campo (obra_social_id, etiqueta, origen, orden)
      VALUES (
        p_id,
        v_item ->> 'etiqueta',
        (v_item ->> 'origen')::obra_social.origen_campo_plantilla,
        COALESCE((v_item ->> 'orden')::integer, 0)
      );
    END LOOP;
  END IF;

  RETURN p_id;
END;
$$;

-- Superficie de ejecución: sin cambios respecto de 20260731120001 (CREATE OR REPLACE sobre la
-- misma firma no altera owner ni grants), se reafirma igual por las dudas.
REVOKE ALL ON FUNCTION obra_social.crear_obra_social_completa(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION obra_social.crear_obra_social_completa(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION obra_social.crear_obra_social_completa(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION obra_social.actualizar_obra_social_completa(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION obra_social.actualizar_obra_social_completa(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION obra_social.actualizar_obra_social_completa(uuid, jsonb) TO authenticated;

COMMENT ON FUNCTION obra_social.crear_obra_social_completa(jsonb) IS
  'Alta atómica de una obra social y sus filas hijas (checklist, plantilla de factura). '
  'SECURITY INVOKER a propósito: RLS (modulos.tiene_permiso(''obra_social'',''write'')) sigue '
  'aplicando sobre cada tabla, incluido el catálogo compartido tipos_documento. '
  'NO convertir a SECURITY DEFINER. Persiste formato_afiliado desde 20260731150000 (RF-106, '
  'reabre D12 — la confirmación que lo revertía nunca pasó). '
  'Ver openspec/changes/integracion-obra-social/design.md D6.';

COMMENT ON FUNCTION obra_social.actualizar_obra_social_completa(uuid, jsonb) IS
  'Edición atómica de una obra social: reemplazo completo de checklist/plantilla cuando esas '
  'claves están presentes en p_cambios (jsonb ? distingue ausente de []). '
  'SECURITY INVOKER a propósito. NO convertir a SECURITY DEFINER. Persiste formato_afiliado '
  'desde 20260731150000 (RF-106). Ver design.md D6.';
