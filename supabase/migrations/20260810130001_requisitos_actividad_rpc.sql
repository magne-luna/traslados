-- Migration: requisitos_actividad_rpc
-- Change: documentos-checklist-items-por-actividad (design.md D5, tasks.md 3.6)
--
-- ¿Por qué existe? Reemplazar la lista completa de ítems de un tipo de actividad toca hasta dos
-- tablas (`tipos_documento` get-or-create + `requisitos_actividad` replace-all) y PostgREST no da
-- transacciones entre requests -- mismo problema y misma solución que
-- `obra_social.crear_obra_social_completa`/`actualizar_obra_social_completa`
-- (`20260731120001_obra_social_rpc.sql`, D3/D5/D6 de `integracion-obra-social` y de este change).
-- Get-or-create normalizado (trim + lower) sobre el catálogo COMPARTIDO `tipos_documento` (D5): esta
-- función NUNCA hace un `INSERT` paralelo -- reusa exactamente el mismo camino que ya usan las
-- funciones de obra social.
--
-- ⚠️⚠️ SECURITY INVOKER -- NO TOCAR ⚠️⚠️ (mismo criterio que `20260731120001_obra_social_rpc.sql`):
-- el owner de la función es `postgres` (superusuario). Con `SECURITY DEFINER` cualquier autenticado
-- podría escribir configuración de checklist por tipo de actividad sin `obra_social:write`, y de
-- paso escribir en `tipos_documento`, compartido con Pacientes y Facturación (`ON DELETE RESTRICT`
-- en ambos). Con `SECURITY INVOKER`, la policy "Write requisitos_actividad"
-- (`modulos.tiene_permiso('obra_social', 'write')`) sigue aplicando sobre cada INSERT/DELETE.
--
-- Reemplazo completo por tipo (mismo criterio D6 que `actualizar_obra_social_completa`): no hay
-- diff fino fila a fila -- se borra toda la configuración de ese `tipo_lugar` y se reinserta la
-- lista completa que llega, con el orden ya resuelto por el índice del array (mismo criterio que
-- `checklistAPayload` del frontend de obras sociales).
--
-- Códigos de error propios (clase '45', libre en PostgreSQL, mismos números que
-- `obra_social_rpc.sql` porque son el mismo significado):
--   45101 -- un ítem llegó con nombre vacío o solo espacios.
--   45102 -- payload malformado (`p_tipo_lugar` vacío, o `p_items` no es un array).
--
-- ⚠️ Esta migración se aplica en vivo contra el proyecto linkeado (`pkryfoljypuzfifofdwp`) como
-- parte de este batch de apply (tasks.md 3.5) -- a diferencia de migraciones hermanas anteriores de
-- este dominio, redactadas por un agente sin Docker ni credenciales de escritura, este entorno sí
-- tiene el CLI logueado y el proyecto linkeado.

CREATE OR REPLACE FUNCTION obra_social.actualizar_requisitos_actividad(p_tipo_lugar text, p_items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER  -- ⚠️ NUNCA SECURITY DEFINER: bypassearía RLS y el gateo por módulo. Ver cabecera.
SET search_path = ''
AS $$
DECLARE
  v_tipo_lugar        pacientes.tipo_direccion;
  v_item              jsonb;
  v_nombre            text;
  v_tipo_documento_id uuid;
  v_orden             int := 0;
BEGIN
  IF p_tipo_lugar IS NULL OR trim(p_tipo_lugar) = '' THEN
    RAISE EXCEPTION 'La actualización de requisitos por actividad necesita un tipo de actividad.'
      USING ERRCODE = '45102';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'La actualización de requisitos por actividad recibió un payload inválido.'
      USING ERRCODE = '45102';
  END IF;

  -- Cast explícito (bug ya visto en 20260807000000_crear_paciente_completo_tipo_lugar_cast.sql):
  -- `text` no castea implícitamente a un enum de usuario. Si el valor no pertenece al enum, este
  -- cast levanta 22P02 -- el frontend lo traduce a un mensaje accionable (mapearErrorRequisitos, ver
  -- SupabaseRequisitosActividadRepository.ts).
  v_tipo_lugar := p_tipo_lugar::pacientes.tipo_direccion;

  -- Reemplazo completo (D6): se borra toda la configuración vigente de este tipo antes de
  -- reinsertar la lista que llega -- ver cabecera 3.4: esto no bloquea aunque ya haya documentos
  -- cargados contra alguno de los ítems que se quitan (mismo precedente que requisitos_os).
  DELETE FROM obra_social.requisitos_actividad WHERE tipo_lugar = v_tipo_lugar;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_nombre := trim(v_item ->> 'nombre');
    IF v_nombre IS NULL OR v_nombre = '' THEN
      RAISE EXCEPTION 'Todos los ítems necesitan un nombre.'
        USING ERRCODE = '45101';
    END IF;

    -- Get-or-create normalizado (D5) -- exactamente el mismo criterio que
    -- crear_obra_social_completa/actualizar_obra_social_completa: nunca un INSERT paralelo al
    -- catálogo compartido.
    SELECT td.id INTO v_tipo_documento_id
    FROM obra_social.tipos_documento td
    WHERE lower(td.tipo) = lower(v_nombre)
    LIMIT 1;

    IF v_tipo_documento_id IS NULL THEN
      INSERT INTO obra_social.tipos_documento (tipo) VALUES (v_nombre)
      RETURNING id INTO v_tipo_documento_id;
    END IF;

    INSERT INTO obra_social.requisitos_actividad (tipo_lugar, tipo_documento_id, orden, requerido)
    VALUES (
      v_tipo_lugar,
      v_tipo_documento_id,
      v_orden,
      COALESCE((v_item ->> 'requerido')::boolean, true)
    )
    ON CONFLICT (tipo_lugar, tipo_documento_id) DO UPDATE
      SET orden = EXCLUDED.orden, requerido = EXCLUDED.requerido;

    v_orden := v_orden + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION obra_social.actualizar_requisitos_actividad(text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION obra_social.actualizar_requisitos_actividad(text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION obra_social.actualizar_requisitos_actividad(text, jsonb) TO authenticated;

COMMENT ON FUNCTION obra_social.actualizar_requisitos_actividad(text, jsonb) IS
  'Reemplazo atómico de la lista completa de ítems requeridos para un tipo de actividad. '
  'SECURITY INVOKER a propósito: RLS (modulos.tiene_permiso(''obra_social'',''write'')) sigue '
  'aplicando. NO convertir a SECURITY DEFINER. '
  'Ver openspec/changes/documentos-checklist-items-por-actividad/design.md D5.';

-- Rollback: DROP FUNCTION obra_social.actualizar_requisitos_actividad(text, jsonb);
-- No crea ni altera tablas, columnas, policies ni datos por sí sola -- revertirla no puede perder
-- información (la tabla requisitos_actividad y sus filas quedan intactas).
