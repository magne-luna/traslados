-- Migration: direcciones_geocoding
-- Change: hojas-de-ruta-geocoding (RF-701), resuelve Checkpoint 2 de
-- openspec/changes/integracion-hojas-de-ruta/design.md ("A. Aceptar la regresión, documentada" —
-- ese veredicto queda superado por este change: ahora sí hay geocoding real).
--
-- Agrega `lat`/`lng` (double precision, NULLable) a `pacientes.direcciones`. Aditiva pura: no
-- toca ninguna fila ni columna existente. Las columnas se pueblan del lado del frontend
-- (`SupabasePacienteRepository.geocodificarDirecciones`, `googleMapsClient.geocodificarDireccion`)
-- al crear o editar una dirección con `calle`/`localidad` cambiada — NUNCA en cada carga de una
-- hoja de ruta ni en cada tecleo del formulario. Filas existentes quedan con `lat`/`lng` NULL
-- hasta que su dirección se vuelva a guardar; no hay backfill retroactivo (no hay forma de
-- geocodificar en batch desde una migración SQL sin golpear una API externa, y este change no lo
-- intenta).
--
-- ⚠️ RLS: NO se agregan policies nuevas. `pacientes.direcciones` ya tiene RLS habilitada con
-- "Read direcciones"/"Write direcciones" (`20260724100004_schema_pacientes.sql`), gateadas por
-- `modulos.tiene_permiso('pacientes', 'read'|'write')`. Esas policies son a nivel de FILA, no de
-- columna — cualquier columna nueva en una tabla con RLS ya habilitada queda cubierta por las
-- policies existentes automáticamente (Postgres no tiene RLS por columna). Confirmado explícito
-- acá en vez de asumido en silencio, tal como pide la gobernanza del proyecto.
--
-- `CREATE OR REPLACE FUNCTION pacientes.crear_paciente_completo` se reemplaza entero (Postgres no
-- soporta un ALTER parcial del cuerpo): mismo `SECURITY INVOKER`/`search_path = ''`, mismos pasos
-- 1-7 letra por letra respecto de `20260805130000_personas_a_cargo_parentesco.sql`, salvo el paso
-- 4 (direcciones), que ahora también inserta `lat`/`lng` si el frontend las mandó geocodificadas.
-- El frontend siempre manda las dos claves para una dirección nueva (alta): éxito de geocoding ->
-- números; fallo/API key ausente -> `null` explícito. Nunca bloquea el alta del paciente.
--
-- ⚠️⚠️ SECURITY INVOKER — NO TOCAR ⚠️⚠️ (con DEFINER, el owner `postgres` bypassearía RLS).
--
-- ⚠️ Esta migración se redacta como artefacto de diseño. NO se aplica desde el agente (sin Docker
-- ni credenciales de escritura sobre el proyecto real) — la aplica la usuaria/Enzo con
-- `supabase db push`, mismo patrón que las migraciones previas de esta función. Antes de que esto
-- tenga efecto real, Enzo también necesita: (a) una API key de Google Maps con la Geocoding API
-- habilitada, (b) cargar `VITE_GOOGLE_MAPS_API_KEY` en su propio `frontend/.env.local` (nunca
-- committeada) — sin eso, `geocodificarDireccion` degrada a `undefined` en cada llamada (por
-- diseño, no rompe nada, pero tampoco geocodifica nada).

ALTER TABLE pacientes.direcciones
  ADD COLUMN lat DOUBLE PRECISION,
  ADD COLUMN lng DOUBLE PRECISION;

COMMENT ON COLUMN pacientes.direcciones.lat IS
  'Latitud geocodificada (change hojas-de-ruta-geocoding, RF-701). NULL hasta que la dirección se '
  'guarde/edite con la Geocoding API real disponible (VITE_GOOGLE_MAPS_API_KEY cargada). Se '
  'recalcula solo cuando calle/localidad cambian, nunca en cada carga de una hoja de ruta.';
COMMENT ON COLUMN pacientes.direcciones.lng IS
  'Longitud geocodificada — ver comentario de la columna lat.';

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
  --    igual que `calle`. `dias` y `horario` siguen sin columna y no se persisten (discrepancia #4,
  --    sigue vigente).
  --    ⚠️ FIX de esta migración: ahora también persiste `lat`/`lng` (RF-701) — `v_item ->> 'lat'`/
  --    `'lng'` son NULL tanto si la clave viene ausente como si viene con JSON null, así que el
  --    `NULLIF(..., '')` es un cinturón extra, no la única defensa. El frontend siempre manda las
  --    dos claves para una dirección de alta (`toDireccionRows`, `SupabasePacienteRepository`).
  FOR v_item IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_paciente -> 'direcciones', '[]'::jsonb))
  LOOP
    INSERT INTO pacientes.direcciones (paciente_id, calle, numero, tipo_lugar, localidad, lat, lng)
    VALUES (
      v_paciente_id,
      v_item ->> 'calle',
      NULL,
      NULLIF(v_item ->> 'tipo_lugar', ''),
      v_item ->> 'localidad',
      NULLIF(v_item ->> 'lat', '')::double precision,
      NULLIF(v_item ->> 'lng', '')::double precision
    );
  END LOOP;

  -- 5. Personas a cargo.
  FOR v_item IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_paciente -> 'personas_a_cargo', '[]'::jsonb))
  LOOP
    INSERT INTO pacientes.personas_a_cargo (
      paciente_id, nombre, apellido, dni, parentesco, telefono, telefono_alternativo
    ) VALUES (
      v_paciente_id,
      v_item ->> 'nombre',
      v_item ->> 'apellido',
      NULLIF(v_item ->> 'dni', ''),
      NULLIF(v_item ->> 'parentesco', ''),
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
  --    siendo condicional: solo se intenta si realmente hay un número de afiliado que guardar.
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
-- revoca los grants ya otorgados por migraciones previas, pero se reafirman igual.
REVOKE ALL ON FUNCTION pacientes.crear_paciente_completo(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION pacientes.crear_paciente_completo(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION pacientes.crear_paciente_completo(jsonb) TO authenticated;

COMMENT ON FUNCTION pacientes.crear_paciente_completo(jsonb) IS
  'Alta atómica de un paciente y sus filas hijas. SECURITY INVOKER a propósito: RLS '
  '(modulos.tiene_permiso(''pacientes'',''write'')) sigue aplicando sobre cada tabla. '
  'NO convertir a SECURITY DEFINER. Persiste lat/lng geocodificados en direcciones desde '
  '20260805140000 (RF-701), parentesco en personas_a_cargo desde 20260805130000, '
  'formato_afiliado en coberturas_paciente desde 20260731130000 y localidad en direcciones desde '
  '20260804120000. Ver openspec/changes/integracion-pacientes/design.md D4 y D9 addendum, y '
  'openspec/changes/hojas-de-ruta-geocoding/design.md.';
