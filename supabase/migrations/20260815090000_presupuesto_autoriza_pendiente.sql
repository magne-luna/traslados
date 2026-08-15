-- Migration: presupuesto_autoriza_pendiente
-- ¿Por qué existe? Requerimiento aprobado por la usuaria: al crear un presupuesto (alta simple,
-- modalidad `general`, vía `facturacion.crear_presupuesto_completo`; o alta en lote, modalidad
-- `por-prestacion`, vía `facturacion.crear_presupuestos_lote`) su autorización 1:1 debe crearse
-- automáticamente en estado 'pendiente' -- sin que el usuario tenga que completar
-- `AutorizacionForm.tsx` como paso aparte. Antes de esta migración, `facturacion.autorizacion`
-- quedaba vacía hasta que alguien la cargaba a mano desde `PresupuestoDetail.tsx`.
--
-- `CREATE OR REPLACE FUNCTION` sobre las mismas dos funciones de
-- `20260812140000_presupuesto_rpc.sql` -- NO cambia su firma (siguen recibiendo
-- jsonb/jsonb, devolviendo uuid/uuid[]) ni ningún otro comportamiento ya validado por
-- `presupuestoMigrations.test.ts`: mismos códigos de error (45401-45403), misma validación de
-- payload, mismo INSERT en `facturacion.presupuesto`. Lo único que se agrega es un
-- `INSERT INTO facturacion.autorizacion (presupuesto_id, estado) VALUES (<id nuevo>, 'pendiente')`
-- por cada presupuesto insertado, dentro de la MISMA invocación de función -- ya corre dentro de la
-- transacción implícita que PostgREST abre para el `POST /rpc/...` (mismo razonamiento de
-- atomicidad que la migración base: si el INSERT de autorizacion fallara, hace ROLLBACK también
-- del presupuesto recién insertado en la misma iteración/invocación -- nunca queda un presupuesto
-- sin su autorización, ni una autorización sin presupuesto).
--
-- Columnas de `facturacion.autorizacion` (`20260724100005_schema_facturacion.sql` +
-- `20260729130000_schema_autorizacion_monto_vigencia.sql`): `presupuesto_id` (NOT NULL, FK a
-- `facturacion.presupuesto(id)` ON DELETE CASCADE), `estado` (DEFAULT 'pendiente' -- se pasa
-- explícito igual, por legibilidad del INSERT), y el resto nullable (`fecha_respuesta`,
-- `cupo_mensual_dias`, `cupo_mensual_km`, `archivo_url`, `monto_autorizado`, `vigencia_desde`): no
-- se completan acá, quedan para cuando la obra social responda (AutorizacionForm en modo EDICIÓN).
--
-- Trigger `facturacion.validar_autorizacion_monto` (RN-PA-01, `20260729130000...`): solo valida
-- cuando `NEW.monto_autorizado IS NOT NULL`. Este INSERT no lo setea (queda NULL por default), así
-- que el trigger no bloquea el alta -- no hay nada que romper acá.
--
-- ⚠️⚠️ SECURITY INVOKER -- NO TOCAR ⚠️⚠️ Mismo criterio que la migración base: las dos funciones
-- siguen siendo `SECURITY INVOKER` (nunca DEFINER) con `SET search_path = ''` explícito. El INSERT
-- nuevo en `facturacion.autorizacion` corre con los privilegios de la sesión real del usuario, así
-- que la policy "Write autorizacion" (`FOR ALL ... USING (modulos.tiene_permiso('presupuestos',
-- 'write'))`, `20260730140000_split_modulos_permisos.sql`) sigue aplicando sobre este INSERT igual
-- que sobre el de `facturacion.presupuesto` -- mismo permiso de módulo (`presupuestos: write`) gatea
-- ambas tablas, así que no hace falta ningún permiso adicional para que el flujo completo funcione.
-- Si el usuario no tuviera `presupuestos: write`, el primer INSERT (el de `facturacion.presupuesto`)
-- ya falla con 42501 antes de llegar al de autorizacion, y toda la transacción hace rollback.
--
-- REVOKE/GRANT y COMMENT ON FUNCTION no se tocan (ya están bien en la migración base; `CREATE OR
-- REPLACE FUNCTION` no los resetea).
--
-- Rollback de esta migración: `CREATE OR REPLACE FUNCTION` con el cuerpo anterior (el de
-- `20260812140000_presupuesto_rpc.sql`) -- no crea ni altera tablas, columnas ni policies.
--
-- ⚠️ Esta migración se redacta como artefacto de diseño del change. NO se aplica desde el agente
-- (governance, no límite técnico) -- la aplica la usuaria con `supabase db push`.

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

  -- Autorización 1:1 en 'pendiente' -- misma transacción, no requiere que el usuario complete
  -- AutorizacionForm como paso aparte (requerimiento aprobado por la usuaria, 2026-08-15).
  INSERT INTO facturacion.autorizacion (presupuesto_id, estado) VALUES (v_id, 'pendiente');

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
  -- incluidos los ítems válidos que se procesaron antes del que falló -- presupuestos Y sus
  -- autorizaciones por igual, nunca queda un presupuesto del lote sin su autorización.
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

    v_ids := array_append(v_ids, v_id);
  END LOOP;

  RETURN v_ids;
END;
$$;
