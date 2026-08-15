-- Migration: presupuesto_lineas
-- REAPERTURA #13 de knowledge-base/04_modelo_de_datos.md §Discrepancias (decisión explícita de
-- la usuaria, 2026-08-16 — brief `facturacion-cambios-ui` WU1, ⚠️ documentado en la KB y en
-- CHANGES.md): la modalidad `general` SÍ persiste su desglose por prestación. Hasta esta
-- migración el desglose vivía solo en el estado del formulario (`PresupuestoLineasEditor.tsx` —
-- las líneas sumaban su monto al campo único `monto` y se descartaban; design.md D9 de
-- `presupuesto-prestaciones`). A partir de acá, una tabla hija `facturacion.presupuesto_linea`
-- guarda el desglose por prestación en la MISMA transacción que el alta del presupuesto.
--
-- Contracto de la RPC (todo en el mismo change, WU1 — Edge Function `presupuestos` y
-- `SupabasePresupuestoRepository` se actualizan atómicamente):
--   * `crear_presupuesto_completo(p_presupuesto jsonb, p_lineas jsonb DEFAULT NULL)` — alta
--     simple (modalidad `general`): las líneas viajan como parámetro `p_lineas`, un arreglo de
--     `{ prestacion_id, monto, orden }`.
--   * `crear_presupuestos_lote(p_presupuestos jsonb)` — firma SIN cambios (el lote es alta de
--     modalidad `por-prestacion`, donde cada presupuesto ES una prestación: no le aplica un
--     desglose). Por completitud del contrato, cada ítem del lote puede llevar un arreglo
--     `lineas` opcional con la MISMA forma que `p_lineas`; la validación es la misma.
--   * Las dos se apoyan en el helper `facturacion.insertar_lineas_presupuesto(p_presupuesto_id
--     uuid, p_lineas jsonb)`, que valida la forma y hace el INSERT — siempre dentro de la misma
--     transacción implícita de la función que la llama (misma atomicidad que el INSERT de la
--     autorización pendiente de `20260815090000_presupuesto_autoriza_pendiente.sql`: si una
--     línea falla, hace ROLLBACK también del presupuesto recién insertado).
--
-- Código de error nuevo en la familia 45401-45403 de esta RPC (misma clase '45', libre):
--   45404 -- `p_lineas` (o el `lineas` de un ítem del lote) no es un arreglo de
--           `{ prestacion_id, monto, orden }` válidos (línea malformada, prestación sin id,
--           monto ausente o <= 0). 45401-45403 se mantienen intactos en semántica y código.
--   Un cast que falle con otro código (22P02 cast, 22P03 overflow, 23505 UNIQUE, 23503 FK) sigue
--   rechazando la operación — 45404 cubre la validación explícita de FORMA, el resto es
--   defensa de integridad de Postgres. Se agrega un chequeo de forma que evita el cast fallido
--   para los casos comunes (monto no numérico).
--
-- ⚠️⚠️ SECURITY INVOKER -- NO TOCAR ⚠️⚠️ Mismo criterio que las migraciones base: las dos RPC y
-- el helper son `SECURITY INVOKER` (nunca DEFINER) con `SET search_path = ''` explícito. El
-- INSERT en `facturacion.presupuesto_linea` corre con los privilegios de la sesión real del
-- usuario, así que la policy "Write presupuesto_linea" (`modulos.tiene_permiso('presupuestos',
-- 'write')`) nomás aplica igual que sobre `facturacion.presupuesto` — mismo permiso de módulo
-- (`presupuestos: write`) gatea ambas tablas, sin permisos adicionales. Si el usuario no tuviera
-- el permiso, el primer INSERT (el del presupuesto) ya falla con 42501 y toda la transacción
-- hace rollback.
--
-- Trigger de auditoría `trg_audit_presupuesto_linea` (auditoria.log_action()): la tabla hija se
-- audita como sus hermanas (RN-GL-02) — todas las escrituras de este dominio pasan por la RPC
-- con la sesión real del usuario vía la Edge Function (userClient), así que `auth.uid()` sí
-- resuelve el `usuario_id` (el residual #14 de la KB aplica solo a escrituras vía service_role,
-- no a este camino).
--
-- Rollback de esta migración, en orden:
--   1. DROP TRIGGER trg_audit_presupuesto_linea ON facturacion.presupuesto_linea;
--   2. DROP FUNCTION × 2 (las RPC con su firma nueva, una por una);
--   3. DROP FUNCTION facturacion.insertar_lineas_presupuesto(uuid, jsonb);
--   4. DROP TABLE facturacion.presupuesto_linea;
--   Para volver a las RPC de antes hay que restaurar las firmas y cuerpos de
--   `20260815090000_presupuesto_autoriza_pendiente.sql` (que a su vez cita las de
--   `20260812140000_presupuesto_rpc.sql`). Con filas reales en presupuesto_linea, un rollback
--   necesita borrarlas antes del paso 4 (no hay pérdida de datos si se conservan aparte).
--
-- ⚠️ Esta migración se redacta como artefacto de diseño del change. NO se aplica desde el agente
-- (governance, no límite técnico) — la aplica la usuaria con `supabase db push`.

CREATE TABLE facturacion.presupuesto_linea (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    presupuesto_id UUID NOT NULL REFERENCES facturacion.presupuesto(id) ON DELETE CASCADE,
    prestacion_id UUID NOT NULL REFERENCES pacientes.prestaciones(id) ON DELETE RESTRICT,
    monto NUMERIC(10,2) NOT NULL,
    orden SMALLINT NOT NULL DEFAULT 0,
    UNIQUE (presupuesto_id, prestacion_id, orden)
);

ALTER TABLE facturacion.presupuesto_linea ENABLE ROW LEVEL SECURITY;
GRANT ALL ON facturacion.presupuesto_linea TO authenticated;

-- RLS gateada por el módulo `presupuestos`, espejo exacto de "Read/Write presupuesto"
-- (20260730140000_split_modulos_permisos.sql).
CREATE POLICY "Read presupuesto_linea" ON facturacion.presupuesto_linea FOR SELECT TO authenticated USING (modulos.tiene_permiso('presupuestos', 'read'));
CREATE POLICY "Write presupuesto_linea" ON facturacion.presupuesto_linea FOR ALL TO authenticated USING (modulos.tiene_permiso('presupuestos', 'write'));

CREATE TRIGGER trg_audit_presupuesto_linea AFTER INSERT OR UPDATE OR DELETE ON facturacion.presupuesto_linea FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();

-- Helper compartido: valida la forma de `p_lineas` (o del `lineas` de un ítem del lote) e
-- inserta las líneas. SECURITY INVOKER + search_path vacío, mismo criterio que las RPC que lo
-- llaman: el INSERT corre con la sesión real y la policy "Write presupuesto_linea" aplica.
CREATE OR REPLACE FUNCTION facturacion.insertar_lineas_presupuesto(p_presupuesto_id uuid, p_lineas jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER  -- ⚠️ NUNCA SECURITY DEFINER: bypassearía RLS y el gateo por módulo.
SET search_path = ''
AS $$
DECLARE
  v_linea       jsonb;
  v_orden       smallint;
  v_monto_texto text;
BEGIN
  IF p_lineas IS NULL THEN
    RETURN;
  END IF;

  IF jsonb_typeof(p_lineas) <> 'array' THEN
    RAISE EXCEPTION 'Las líneas del presupuesto deben llegar como un arreglo.'
      USING ERRCODE = '45404';
  END IF;

  FOR v_linea IN SELECT value FROM jsonb_array_elements(p_lineas)
  LOOP
    IF jsonb_typeof(v_linea) <> 'object'
       OR NULLIF(v_linea ->> 'prestacion_id', '') IS NULL THEN
      RAISE EXCEPTION 'Una línea del presupuesto llegó sin su prestación.'
        USING ERRCODE = '45404';
    END IF;

    v_monto_texto := NULLIF(v_linea ->> 'monto', '');
    IF v_monto_texto IS NULL OR v_monto_texto !~ '^[0-9]+(\.[0-9]+)?$' OR v_monto_texto::numeric <= 0 THEN
      RAISE EXCEPTION 'Una línea del presupuesto llegó con un monto inválido.'
        USING ERRCODE = '45404';
    END IF;

    -- `orden`: se acepta el valor del payload si es un entero válido de SMALLINT; si llega
    -- ausente/vacío (o un texto no numérico que el cast rechaza con 22P02), cae al default 0.
    IF NULLIF(v_linea ->> 'orden', '') IS NULL THEN
      v_orden := 0;
    ELSE
      v_orden := (v_linea ->> 'orden')::smallint;
    END IF;

    INSERT INTO facturacion.presupuesto_linea (presupuesto_id, prestacion_id, monto, orden)
    VALUES (
      p_presupuesto_id,
      (v_linea ->> 'prestacion_id')::uuid,
      v_monto_texto::numeric,
      v_orden
    );
  END LOOP;
END;
$$;

-- Alta simple (modalidad `general`): firma con el parámetro `p_lineas` (DEFAULT NULL así los
-- llamadores viejos que solo mandan `p_presupuesto` siguen funcionando). Mismo cuerpo que
-- `20260815090000_presupuesto_autoriza_pendiente.sql` más la llamada al helper en la misma
-- transacción.
DROP FUNCTION facturacion.crear_presupuesto_completo(jsonb);
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

  -- REAPERTURA #13 (2026-08-16): desglose de modalidad `general` en la misma transacción.
  PERFORM facturacion.insertar_lineas_presupuesto(v_id, p_lineas);

  RETURN v_id;
END;
$$;

-- Alta en lote (modalidad `por-prestacion`): MISMA firma de siempre (`p_presupuestos jsonb`, las
-- `lineas` viajan opcionalmente DENTRO de cada ítem como `v_item -> 'lineas'`, con la misma
-- forma que `p_lineas` del alta simple — decisión documentada en la cabecera). El FOR corre en la
-- misma transacción implícita (atomicidad D2): si un ítem o sus líneas fallan, rollback completo.
DROP FUNCTION facturacion.crear_presupuestos_lote(jsonb);
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

    -- REAPERTURA #13 (2026-08-16): líneas opcionales por ítem del lote, misma transacción.
    PERFORM facturacion.insertar_lineas_presupuesto(v_id, v_item -> 'lineas');

    v_ids := array_append(v_ids, v_id);
  END LOOP;

  RETURN v_ids;
END;
$$;

REVOKE ALL ON FUNCTION facturacion.insertar_lineas_presupuesto(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION facturacion.insertar_lineas_presupuesto(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION facturacion.insertar_lineas_presupuesto(uuid, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION facturacion.crear_presupuesto_completo(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION facturacion.crear_presupuesto_completo(jsonb, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION facturacion.crear_presupuesto_completo(jsonb, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION facturacion.crear_presupuestos_lote(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION facturacion.crear_presupuestos_lote(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION facturacion.crear_presupuestos_lote(jsonb) TO authenticated;

COMMENT ON FUNCTION facturacion.crear_presupuesto_completo(jsonb, jsonb) IS
  'Alta simple de un presupuesto (modalidad general), con su desglose opcional en p_lineas '
  '(REAPERTURA #13, 2026-08-16 — facturacion.presupuesto_linea). SECURITY INVOKER a propósito: '
  'RLS (modulos.tiene_permiso(''presupuestos'',''write'')) sigue aplicando. NO convertir a '
  'SECURITY DEFINER. Mismos códigos de error 45401-45403 + 45404 para líneas malformadas.';

COMMENT ON FUNCTION facturacion.crear_presupuestos_lote(jsonb) IS
  'Alta atómica de N presupuestos (modalidad por-prestacion, uno por prestación): o entran todos, '
  'o no entra ninguno. Cada ítem puede llevar `lineas` opcional (misma forma que p_lineas del '
  'alta simple). SECURITY INVOKER a propósito. NO convertir a SECURITY DEFINER. Mismos códigos '
  'de error 45401-45403 + 45404 para líneas malformadas.';

COMMENT ON FUNCTION facturacion.insertar_lineas_presupuesto(uuid, jsonb) IS
  'Valida e inserta el desglose de un presupuesto (facturacion.presupuesto_linea) dentro de la '
  'transacción de la RPC que lo llama. Forma exigida: arreglo de { prestacion_id, monto, orden }. '
  'SECURITY INVOKER a propósito — la policy de escritura del módulo presupuestos aplica. '
  'Error 45404 para líneas malformadas.';