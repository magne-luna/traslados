-- Migration: crear_paciente_completo_localidad_direccion
-- Change: integracion-pacientes (bugfix, 2026-08-04)
--
-- ⚠️ BUG BLOQUEANTE, no una migración de mejora. `20260729120000_schema_pacientes_gaps.sql` agregó
-- `pacientes.direcciones.localidad TEXT NOT NULL` (sin default) para cerrar la discrepancia #3 de
-- `knowledge-base/04_modelo_de_datos.md`, pero el paso 4 de esta función (heredado sin cambios
-- desde `20260730180000_crear_paciente_completo.sql`) nunca la insertaba. Consecuencia: **cualquier
-- alta de paciente con al menos una dirección falla hoy con `23502`** — mismo bug que ya rompía la
-- edición de direcciones de un paciente existente (corregido del lado del frontend en
-- `pacienteMapping.ts`/`SupabasePacienteRepository.ts`, tasks.md 8.2), acá vive en esta función.
--
-- Esta migración es ADITIVA y NO cambia la firma ni el resto del cuerpo de la función: mismo
-- `CREATE OR REPLACE FUNCTION pacientes.crear_paciente_completo(p_paciente jsonb) RETURNS uuid`,
-- mismo `SECURITY INVOKER`/`search_path = ''`, mismos pasos 1-7 letra por letra respecto de
-- `20260731130000_crear_paciente_completo_formato_afiliado.sql`. El único cambio real es el paso 4
-- (direcciones): ahora también persiste `localidad`, leída de `v_item ->> 'localidad'` igual que
-- `calle` (sin `NULLIF`/`COALESCE`: el frontend ya la manda siempre no vacía, mismo criterio que
-- `calle`/`nombre_a`). `dias` y `horario` siguen sin columna y sin persistirse (discrepancia #4,
-- sigue vigente).
--
-- ⚠️⚠️ SECURITY INVOKER — NO TOCAR ⚠️⚠️ (idéntico razonamiento que las migraciones previas de esta
-- función: con DEFINER, el owner `postgres` bypassearía RLS y cualquier autenticado podría dar de
-- alta pacientes sin `modulos.tiene_permiso('pacientes','write')`). `CREATE OR REPLACE` sobre la
-- misma firma no cambia el owner ni los grants ya otorgados, pero se reafirman abajo por las dudas.
--
-- Rollback: no hay `DROP FUNCTION` que revertir sin dejar la función inoperante de nuevo (volvería
-- a romper con `23502` en cualquier alta con dirección). Si hace falta deshacer este cambio
-- puntual, aplicar de nuevo `20260731130000_crear_paciente_completo_formato_afiliado.sql` tal cual
-- (reintroduce el bug a propósito) o restaurar desde backup.
--
-- ⚠️ Esta migración se redacta como artefacto de diseño del change. NO se aplica desde el agente
-- (el sandbox no tiene Docker ni credenciales de escritura sobre el proyecto real) — la aplica la
-- usuaria/Enzo con `supabase db push`, mismo patrón que las migraciones previas de esta función.

CREATE OR REPLACE FUNCTION pacientes.crear_paciente_completo(p_paciente jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER  -- ⚠️ NUNCA SECURITY DEFINER: bypassearía RLS y el gateo por módulo. Ver cabecera.
SET search_path = ''
AS $$
DECLARE
  v_paciente_id      uuid;
  v_obra_social_id   uuid;
  v_num_afiliado     text;
  v_formato_afiliado obra_social.formato_afiliado;
  v_clinicos         jsonb;
  v_cud              jsonb;
  v_item             jsonb;
  v_tipo             text;
  v_accesorio_id     uuid;
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

  -- 4. Direcciones. `numero` va SIEMPRE NULL (discrepancia #5). `localidad` tiene columna propia
  --    NOT NULL (`20260729120000_schema_pacientes_gaps.sql`, discrepancia #3 cerrada) y se inserta
  --    igual que `calle` — el frontend nunca manda una dirección sin localidad cargada
  --    (`DireccionesEditor.tsx` bloquea el alta hasta completarla). `dias` y `horario` siguen sin
  --    columna y no se persisten (discrepancia #4, sigue vigente): la UI lo señala con
  --    AvisoModeloDatos.
  --
  --    ⚠️ FIX de esta migración: `localidad` faltaba en este INSERT — cualquier alta con al menos
  --    una dirección fallaba con `23502` desde que la columna se volvió NOT NULL.
  FOR v_item IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_paciente -> 'direcciones', '[]'::jsonb))
  LOOP
    INSERT INTO pacientes.direcciones (paciente_id, calle, numero, tipo_lugar, localidad)
    VALUES (
      v_paciente_id,
      v_item ->> 'calle',
      NULL,
      NULLIF(v_item ->> 'tipo_lugar', ''),
      v_item ->> 'localidad'
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

  -- 7. Cobertura (número de afiliado + formato, tasks.md 8.0). Vive en el schema `obra_social` y
  --    está gateada por el módulo `obra_social`, NO por `pacientes` (D3). Por eso el INSERT sigue
  --    siendo condicional: solo se intenta si realmente hay un número de afiliado que guardar. Un
  --    usuario con `pacientes:write` y sin `obra_social:write` puede dar de alta pacientes con
  --    normalidad mientras deje ese campo vacío; si lo completa, la transacción entera hace
  --    rollback con 42501 y el frontend traduce eso a un mensaje que nombra Obras Sociales. Nunca
  --    queda un paciente a medias.
  v_num_afiliado := NULLIF(p_paciente ->> 'num_afiliado', '');
  v_formato_afiliado := COALESCE(
    NULLIF(p_paciente ->> 'formato_afiliado', ''),
    'numero-documento'
  )::obra_social.formato_afiliado;

  IF v_num_afiliado IS NOT NULL AND v_obra_social_id IS NOT NULL THEN
    INSERT INTO obra_social.coberturas_paciente (
      paciente_id, obra_social_id, num_afiliado, formato_afiliado, fecha_desde
    ) VALUES (
      v_paciente_id, v_obra_social_id, v_num_afiliado, v_formato_afiliado, CURRENT_DATE
    );
  END IF;

  RETURN v_paciente_id;
END;
$$;

-- Superficie de ejecución mínima. `CREATE OR REPLACE` sobre la misma firma no cambia el owner ni
-- revoca los grants ya otorgados por migraciones previas, pero se reafirman igual: afirmación
-- explícita en el diff, no un supuesto sobre lo que ya había.
REVOKE ALL ON FUNCTION pacientes.crear_paciente_completo(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION pacientes.crear_paciente_completo(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION pacientes.crear_paciente_completo(jsonb) TO authenticated;

COMMENT ON FUNCTION pacientes.crear_paciente_completo(jsonb) IS
  'Alta atómica de un paciente y sus filas hijas. SECURITY INVOKER a propósito: RLS '
  '(modulos.tiene_permiso(''pacientes'',''write'')) sigue aplicando sobre cada tabla. '
  'NO convertir a SECURITY DEFINER. Persiste formato_afiliado en coberturas_paciente desde '
  '20260731130000 (bugfix 23502) y localidad en direcciones desde 20260804120000 (bugfix 23502). '
  'Ver openspec/changes/integracion-pacientes/design.md D4 y D9 addendum.';
