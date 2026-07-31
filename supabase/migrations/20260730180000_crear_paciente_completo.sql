-- Migration: crear_paciente_completo
-- Description: función atómica de alta de paciente para el change
-- openspec/changes/integracion-pacientes/ (decisión D4 de design.md, revisada).
--
-- ¿Por qué existe? PostgREST no ofrece transacciones entre requests: `create()` del
-- `PacienteRepository` escribe en hasta 7 tablas y, hecha como N requests independientes, un fallo a
-- mitad deja una ficha parcial (paciente sin direcciones, sin CUD, etc.). La versión original de D4
-- compensaba borrando el padre (`ON DELETE CASCADE`); esta migración reemplaza esa compensación por
-- lo único realmente atómico: **una sola función**. PostgREST ejecuta cada `POST /rpc/...` dentro de
-- una transacción, así que el cuerpo entero commitea o hace rollback completo. No existe estado
-- parcial posible, ni siquiera si el proceso muere a mitad.
--
-- ⚠️⚠️ SECURITY INVOKER — NO TOCAR ⚠️⚠️
-- Esta función DEBE ser `SECURITY INVOKER` (que además es el default de PostgreSQL para funciones,
-- disponible en todas las versiones soportadas; el requisito de PG15 es para *vistas*
-- `security_invoker = true`, no para funciones). Se declara de forma explícita para que quede como
-- afirmación revisable, no como un default silencioso.
--
-- Convertirla a `SECURITY DEFINER` sería una REGRESIÓN DE SEGURIDAD grave: el owner de la función es
-- `postgres` (superusuario), que **bypassea RLS por completo**. Con DEFINER, cualquier usuario
-- autenticado —incluso sin ninguna fila en `modulos.permisos`— podría dar de alta pacientes
-- llamando a `/rpc/crear_paciente_completo`, saltándose por completo
-- `modulos.tiene_permiso('pacientes','write')`. Con INVOKER, cada `INSERT` de acá abajo pasa por la
-- policy de su tabla exactamente igual que si lo hubiera hecho el cliente directamente.
--
-- Cómo se hace cumplir el permiso (verificado contra 20260724100004_schema_pacientes.sql):
--   * `pacientes.paciente`, `clinicos`, `cud`, `direcciones`, `personas_a_cargo` y
--     `accesorios_pacientes` tienen `CREATE POLICY "Write ..." FOR ALL TO authenticated
--     USING (modulos.tiene_permiso('pacientes','write'))`. En una policy `FOR ALL` sin `WITH CHECK`,
--     PostgreSQL usa la expresión de `USING` también como check de INSERT — así que un usuario sin
--     `pacientes:write` recibe `42501` en el primer INSERT y toda la transacción hace rollback.
--   * `obra_social.coberturas_paciente` está gateada por `modulos.tiene_permiso('obra_social', …)`,
--     un módulo DISTINTO. Por eso su INSERT es condicional (ver abajo).
--   * `modulos.tiene_permiso()` sí es `SECURITY DEFINER` (20260724100001), y debe serlo: lee
--     `modulos.permisos` para el `auth.uid()` de la sesión. Eso no debilita nada acá — sigue
--     resolviendo contra el usuario que llama, porque `auth.uid()` lee el claim del JWT de la
--     request, no el owner de la función.
--
-- Los triggers `auditoria.log_action()` de cada tabla siguen disparando fila por fila dentro de la
-- misma transacción (RN-GL-02): un alta deja su rastro completo en `auditoria.logs`, o no deja
-- ninguno.
--
-- Contrato con el frontend (design.md D4):
--   * Un único argumento `jsonb`, para no acoplar la firma PostgREST a la cantidad de campos y para
--     que el armado del payload sea una función pura testeable (`toCrearPacientePayload`, D1).
--   * Devuelve el `uuid` generado. El repository hace `getById(id)` después, igual que `update()`
--     (D5): lo devuelto siempre es lo que quedó realmente en la base.
--   * `paciente.domicilio` NO se escribe (discrepancia #6 de D9: columna suelta que duplica
--     `direcciones`; se lee para no perderla, no se escribe).
--   * `direcciones.numero` se escribe SIEMPRE `NULL` (discrepancia #5: no se inventa un parseo de
--     altura desde `calle`).
--   * `cud.vigente` se deja en su default (discrepancia #9: el frontend no lo modela).
--
-- Códigos de error propios (clase '45', libre en PostgreSQL — no colisiona con ninguna clase del
-- catálogo). El frontend los traduce en `mapearErrorPaciente` (D7):
--   45001 — accesorio de movilidad ausente del maestro `pacientes.accesorios`.
--   45002 — payload de alta malformado.
--
-- Rollback: `DROP FUNCTION IF EXISTS pacientes.crear_paciente_completo(jsonb);`
-- No crea ni altera tablas, columnas, policies ni datos: revertirla no puede perder información.
-- El frontend queda inoperante para el alta hasta que se revierta también el commit de
-- `SupabasePacienteRepository.create()` (o se vuelva a inyectar `mockPacienteRepository`).
--
-- ⚠️ Esta migración se redacta como artefacto de diseño del change. NO se aplica desde el agente
-- (no hay Docker ni credenciales del proyecto real en el sandbox) — la aplica la usuaria con
-- `supabase db push`, mismo patrón que 20260730140000_split_modulos_permisos.sql (tarea 2.7 del
-- change `permisos-modulos-granulares`).

CREATE OR REPLACE FUNCTION pacientes.crear_paciente_completo(p_paciente jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER  -- ⚠️ NUNCA SECURITY DEFINER: bypassearía RLS y el gateo por módulo. Ver cabecera.
SET search_path = ''
AS $$
DECLARE
  v_paciente_id    uuid;
  v_obra_social_id uuid;
  v_num_afiliado   text;
  v_clinicos       jsonb;
  v_cud            jsonb;
  v_item           jsonb;
  v_tipo           text;
  v_accesorio_id   uuid;
BEGIN
  IF p_paciente IS NULL OR jsonb_typeof(p_paciente) <> 'object' THEN
    RAISE EXCEPTION 'El alta de paciente recibió un payload inválido.'
      USING ERRCODE = '45002';
  END IF;

  v_obra_social_id := NULLIF(p_paciente ->> 'obra_social_id', '')::uuid;

  -- 1. Padre. Si RLS deniega la escritura, corta acá con 42501 y nada más se ejecuta.
  --    `domicilio` se omite deliberadamente (discrepancia #6).
  INSERT INTO pacientes.paciente (
    nombre_a, nombre_b, apellido_a, apellido_b,
    fecha_nacimiento, dni, cuil_titular, obra_social_id, amparo_judicial
  ) VALUES (
    p_paciente ->> 'nombre_a',
    NULLIF(p_paciente ->> 'nombre_b', ''),
    p_paciente ->> 'apellido_a',
    NULLIF(p_paciente ->> 'apellido_b', ''),
    NULLIF(p_paciente ->> 'fecha_nacimiento', '')::date,
    p_paciente ->> 'dni',
    NULLIF(p_paciente ->> 'cuil_titular', ''),
    v_obra_social_id,
    COALESCE((p_paciente ->> 'amparo_judicial')::boolean, false)
  )
  RETURNING id INTO v_paciente_id;

  -- 2. Datos clínicos (1:1, UNIQUE(paciente_id)). `diagnostico` viaja como jsonb tal cual lo
  --    serializó el mapeo puro del frontend (discrepancia #7).
  v_clinicos := p_paciente -> 'clinicos';
  IF jsonb_typeof(v_clinicos) = 'object' THEN
    INSERT INTO pacientes.clinicos (paciente_id, diagnostico, condicion)
    VALUES (
      v_paciente_id,
      v_clinicos -> 'diagnostico',
      NULLIF(v_clinicos ->> 'condicion', '')
    );
  END IF;

  -- 3. CUD. El frontend modela `Cud | null`; acá se inserta a lo sumo una fila y `vigente` queda en
  --    su default (discrepancia #9).
  v_cud := p_paciente -> 'cud';
  IF jsonb_typeof(v_cud) = 'object' THEN
    INSERT INTO pacientes.cud (paciente_id, numero_cud, emision, vencimiento)
    VALUES (
      v_paciente_id,
      v_cud ->> 'numero_cud',
      NULLIF(v_cud ->> 'emision', '')::date,
      NULLIF(v_cud ->> 'vencimiento', '')::date
    );
  END IF;

  -- 4. Direcciones. `numero` va SIEMPRE NULL (discrepancia #5). `localidad`, `dias` y `horario` no
  --    tienen columna y no se persisten (discrepancias #3 y #4): la UI ya lo señala con
  --    AvisoModeloDatos.
  FOR v_item IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_paciente -> 'direcciones', '[]'::jsonb))
  LOOP
    INSERT INTO pacientes.direcciones (paciente_id, calle, numero, tipo_lugar)
    VALUES (
      v_paciente_id,
      v_item ->> 'calle',
      NULL,
      NULLIF(v_item ->> 'tipo_lugar', '')
    );
  END LOOP;

  -- 5. Personas a cargo.
  FOR v_item IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_paciente -> 'personas_a_cargo', '[]'::jsonb))
  LOOP
    INSERT INTO pacientes.personas_a_cargo (
      paciente_id, nombre, apellido, dni, telefono, telefono_alternativo
    ) VALUES (
      v_paciente_id,
      v_item ->> 'nombre',
      v_item ->> 'apellido',
      NULLIF(v_item ->> 'dni', ''),
      NULLIF(v_item ->> 'telefono', ''),
      NULLIF(v_item ->> 'telefono_alternativo', '')
    );
  END LOOP;

  -- 6. Accesorios de movilidad (N:N contra el maestro `pacientes.accesorios`). El payload trae los
  --    `tipo` de la unión cerrada `AccesorioMovilidad`; acá se resuelven a `accesorio_id`.
  --    Un `tipo` que no está en el maestro es un dato semilla faltante, no un error del usuario:
  --    se aborta con un código propio para que el frontend dé un mensaje accionable
  --    (discrepancia #11). El SELECT también pasa por RLS, pero `tiene_permiso(_, 'read')` es
  --    verdadero para cualquier nivel `read|write|admin`, así que quien llegó hasta acá (tiene
  --    `write`) siempre puede leer el maestro.
  FOR v_item IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_paciente -> 'accesorios', '[]'::jsonb))
  LOOP
    v_tipo := v_item #>> '{}';

    SELECT a.id INTO v_accesorio_id
    FROM pacientes.accesorios a
    WHERE a.tipo = v_tipo
    LIMIT 1;

    IF v_accesorio_id IS NULL THEN
      RAISE EXCEPTION 'El accesorio de movilidad «%» no está cargado en el maestro de accesorios.', v_tipo
        USING ERRCODE = '45001';
    END IF;

    INSERT INTO pacientes.accesorios_pacientes (paciente_id, accesorio_id)
    VALUES (v_paciente_id, v_accesorio_id)
    ON CONFLICT (paciente_id, accesorio_id) DO NOTHING;
  END LOOP;

  -- 7. Cobertura (número de afiliado). Vive en el schema `obra_social` y está gateada por el módulo
  --    `obra_social`, NO por `pacientes` (D3). Por eso el INSERT es condicional: solo se intenta si
  --    realmente hay un número de afiliado que guardar. Un usuario con `pacientes:write` y sin
  --    `obra_social:write` puede dar de alta pacientes con normalidad mientras deje ese campo
  --    vacío; si lo completa, la transacción entera hace rollback con 42501 y el frontend traduce
  --    eso a un mensaje que nombra Obras Sociales. Nunca queda un paciente a medias.
  v_num_afiliado := NULLIF(p_paciente ->> 'num_afiliado', '');
  IF v_num_afiliado IS NOT NULL AND v_obra_social_id IS NOT NULL THEN
    INSERT INTO obra_social.coberturas_paciente (
      paciente_id, obra_social_id, num_afiliado, fecha_desde
    ) VALUES (
      v_paciente_id, v_obra_social_id, v_num_afiliado, CURRENT_DATE
    );
  END IF;

  RETURN v_paciente_id;
END;
$$;

-- Superficie de ejecución mínima. Aunque con SECURITY INVOKER un `anon` no podría escribir nada
-- (RLS lo rechazaría), no hay razón para dejarle la función expuesta.
REVOKE ALL ON FUNCTION pacientes.crear_paciente_completo(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION pacientes.crear_paciente_completo(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION pacientes.crear_paciente_completo(jsonb) TO authenticated;

COMMENT ON FUNCTION pacientes.crear_paciente_completo(jsonb) IS
  'Alta atómica de un paciente y sus filas hijas. SECURITY INVOKER a propósito: RLS '
  '(modulos.tiene_permiso(''pacientes'',''write'')) sigue aplicando sobre cada tabla. '
  'NO convertir a SECURITY DEFINER. Ver openspec/changes/integracion-pacientes/design.md D4.';
