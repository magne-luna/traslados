-- Migration: obra_social_rpc
-- Change: openspec/changes/integracion-obra-social/ (design.md D2/D3/D6/D7, tasks.md 1B.4)
--
-- ¿Por qué existe? PostgREST no da transacciones entre requests: guardar una obra social escribe
-- en hasta 4 tablas (`obra_social`, `tipos_documento`, `requisitos_os`, `plantilla_campo`) y una
-- secuencia de requests cortada a mitad deja una obra social sin checklist, o con medio checklist
-- en el orden viejo — y como el checklist alimenta la validación documental de las facturas
-- (RN-FA-08), un checklist parcial es peor que ninguno. Estas dos funciones son el mismo patrón
-- exacto que `pacientes.crear_paciente_completo` (`20260730180000`, ya aplicada): PostgREST
-- ejecuta cada `POST /rpc/...` dentro de una transacción, así que el cuerpo entero commitea o hace
-- rollback completo.
--
-- ⚠️ Nombres de tabla/columna literales del schema REAL (verificado con `supabase db query
-- --linked`, 2026-07-31 — ver la cabecera de `20260731120000_obra_social_config_facturacion.sql`
-- para el hallazgo completo): `tipo_comprobante` (no `tipo_factura`), `plantilla_campo` (no
-- `campos_plantilla_factura`). NO se toca `formato_identificador_afiliado` en ninguna de las dos
-- funciones — esa columna no existe en `obra_social.obra_social` (D12 vs. realidad, discrepancia
-- nueva #16, sin resolver, ver la migración 1B.1).
--
-- ⚠️⚠️ SECURITY INVOKER — NO TOCAR ⚠️⚠️
-- Ambas funciones DEBEN ser `SECURITY INVOKER` (default de PostgreSQL; se declara explícito para
-- que sea una afirmación revisable en el diff, no un default silencioso). Convertir cualquiera de
-- las dos a `SECURITY DEFINER` sería una REGRESIÓN DE SEGURIDAD grave: el owner es `postgres`
-- (superusuario), que bypassea RLS por completo. Con DEFINER, cualquier usuario autenticado
-- —incluso sin ninguna fila en `modulos.permisos`— podría dar de alta y editar obras sociales, y
-- de paso ESCRIBIR EN `tipos_documento`, que es un catálogo COMPARTIDO con Pacientes
-- (`pacientes.documentos.id_tipo_documento REFERENCES obra_social.tipos_documento ON DELETE
-- RESTRICT`) y con Facturación (`facturacion.documento_factura.id_tipo_documento`, misma FK
-- RESTRICT — hallazgo adicional de esta verificación, no documentado en ningún lado hasta ahora).
-- Es el vector "broken access control" con el radio de daño más amplio de todo este change.
--
-- Cómo se hace cumplir el permiso (verificado con `pg_policies` contra el proyecto real):
--   * `obra_social.obra_social`, `tipos_documento`, `requisitos_os`, `plantilla_campo` tienen
--     `CREATE POLICY "Write ..." FOR ALL TO authenticated USING (modulos.tiene_permiso('obra_social',
--     'write'))`. En una policy `FOR ALL` sin `WITH CHECK`, Postgres usa la expresión de `USING`
--     también como check de INSERT — un usuario sin `obra_social:write` recibe `42501` en el primer
--     INSERT de `crear_obra_social_completa` y toda la transacción hace rollback.
--   * Para `actualizar_obra_social_completa`, la semántica de RLS sobre UPDATE es distinta de
--     INSERT: si el usuario no tiene `write`, el `USING` de la policy filtra la fila ANTES de que
--     el UPDATE la vea (no hay violación de `WITH CHECK` que reportar, porque la fila nunca entra
--     al conjunto a actualizar) — el UPDATE afecta 0 filas, sin lanzar `42501` por sí solo. Esta
--     función lo traduce a `45103` (mismo código que "no existe"), consistente con el resto del
--     dominio (D3 de `integracion-pacientes`: 0 filas por RLS y 0 filas por inexistencia son
--     indistinguibles y es deliberado). ⚠️ Verificar este comportamiento exacto es parte del
--     checklist manual de la tarea 1B.8 (puntos b/c) — si en la práctica Postgres sí emite `42501`
--     en algún camino, el resultado en filas escritas es igual (cero), pero el código de error que
--     ve el frontend podría no ser el que `design.md` anticipaba. Documentado, no asumido.
--   * `modulos.tiene_permiso()` sí es `SECURITY DEFINER` y debe serlo (lee `modulos.permisos` de
--     todos los usuarios); resuelve contra `auth.uid()` del JWT de la request, no contra el owner
--     de esta función.
--
-- Get-or-create sobre `tipos_documento` (D3, checkpoint confirmado por la usuaria 2026-07-31):
-- normaliza por `trim` + `lower`, dentro de la misma transacción. Semántica parcial de
-- `actualizar_obra_social_completa` (D6, la trampa más fácil del change): usa el operador `?` de
-- jsonb para distinguir *clave ausente* de *clave presente* — `->>` sola no alcanza.
--
-- Códigos de error propios (clase '45', libre en PostgreSQL). El frontend los traduce en
-- `mapearErrorObraSocial` (D7):
--   45101 — un ítem del checklist llegó con nombre vacío o solo espacios.
--   45102 — payload de alta/edición malformado (no es un objeto JSON).
--   45103 — `actualizar_...` con un id que no existe (o que RLS oculta, ver nota arriba).
--
-- Rollback: `DROP FUNCTION obra_social.crear_obra_social_completa(jsonb);` +
-- `DROP FUNCTION obra_social.actualizar_obra_social_completa(uuid, jsonb);` — no crean ni alteran
-- tablas, columnas, policies ni datos: revertirlas no puede perder información.
--
-- ⚠️ Esta migración se redacta como artefacto de diseño del change. NO se aplica desde el agente
-- (el sandbox no tiene Docker ni credenciales de escritura sobre el proyecto real) — la aplica la
-- usuaria/Enzo con `supabase db push`, mismo patrón que `20260730180000_crear_paciente_completo.sql`.

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

  -- 1. Padre. Si RLS deniega la escritura, corta acá con 42501 y nada más se ejecuta.
  INSERT INTO obra_social.obra_social (
    razon_social, cuit, codigo, direccion, telefono, condicion_iva, tipo_comprobante,
    plazo_cobro_dias, modalidad_facturacion, admite_pagos_parciales, identificador_origen
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
    )
  )
  RETURNING id INTO v_obra_social_id;

  -- 2. Checklist: get-or-create sobre tipos_documento (D3), normalizando trim+lower. El orden
  --    viaja ya resuelto por el frontend (índice del array, D6/toCrearObraSocialPayload).
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

  -- 3. Plantilla de factura: identificador_origen ya se escribió en el padre (arriba); acá solo
  --    los campos ordenados.
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

  -- Reemplazo completo, no diff fino (D6 — es lo que significa "reordenar" un conjunto sin id
  -- estable a nivel de fila de vínculo). Clave ausente en p_cambios (`?`, no `->>`) => no tocar
  -- esa parte; clave presente (incluso `[]`) => reemplazar.
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
      ELSE identificador_origen END
  WHERE id = p_id;

  GET DIAGNOSTICS v_filas_afectadas = ROW_COUNT;
  IF v_filas_afectadas = 0 THEN
    RAISE EXCEPTION 'No existe una obra social con id "%".', p_id
      USING ERRCODE = '45103';
  END IF;

  -- Checklist: reemplazo completo cuando la clave está presente (incluso `[]`).
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

  -- Plantilla: reemplazo completo de los campos cuando `plantilla_factura` está presente (el
  -- identificador_origen ya se actualizó arriba, en el mismo UPDATE del padre).
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

-- Superficie de ejecución mínima. Aunque con SECURITY INVOKER un `anon` no podría escribir nada
-- (RLS lo rechazaría), no hay razón para dejarle las funciones expuestas.
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
  'NO convertir a SECURITY DEFINER. Ver openspec/changes/integracion-obra-social/design.md D6.';

COMMENT ON FUNCTION obra_social.actualizar_obra_social_completa(uuid, jsonb) IS
  'Edición atómica de una obra social: reemplazo completo de checklist/plantilla cuando esas '
  'claves están presentes en p_cambios (jsonb ? distingue ausente de []). '
  'SECURITY INVOKER a propósito. NO convertir a SECURITY DEFINER. Ver design.md D6.';
