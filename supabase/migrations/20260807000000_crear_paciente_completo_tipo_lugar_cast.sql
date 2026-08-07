-- Migration: crear_paciente_completo_tipo_lugar_cast
-- Change: integracion-pacientes (bugfix, 2026-08-07, encontrado durante la verificación en vivo de
-- la tarea 1B.4)
--
-- ⚠️ BUG BLOQUEANTE, no una migración de mejora. El paso 4 de esta función (direcciones) nunca
-- casteó `tipo_lugar` al enum `pacientes.tipo_direccion` — venía así desde
-- `20260730180000_crear_paciente_completo.sql` (la primera versión) y sobrevivió intacto a las 5
-- reescrituras posteriores (`..._formato_afiliado`, `..._localidad_direccion`,
-- `..._parentesco` vía `20260805130000`, `..._direcciones_descripcion`, `..._reparar_direcciones_lat_lng`)
-- porque ninguna corrió una llamada real end-to-end con `tipo_lugar` poblado. Consecuencia:
-- **cualquier alta de paciente con al menos una dirección que traiga `tipo_lugar` falla hoy con
-- `42804`** ("column ... is of type pacientes.tipo_direccion but expression is of type text").
-- Confirmado en vivo contra `pkryfoljypuzfifofdwp` (tarea 1B.4 de `integracion-pacientes`).
--
-- `NULLIF(text, text)` devuelve `text` (no `unknown`), y Postgres no registra un cast automático de
-- `text` a un enum de usuario en contexto de asignación — el `INSERT ... VALUES` necesita el cast
-- explícito.
--
-- Esta migración es ADITIVA y NO cambia la firma ni el resto del cuerpo de la función: mismo
-- `CREATE OR REPLACE FUNCTION pacientes.crear_paciente_completo(p_paciente jsonb) RETURNS uuid`,
-- mismo `SECURITY INVOKER`/`search_path = ''`, mismos pasos 1-7 letra por letra respecto de
-- `20260806160000_reparar_direcciones_lat_lng.sql`. El único cambio real es un `::pacientes.tipo_direccion`
-- explícito en el paso 4.
--
-- ⚠️⚠️ SECURITY INVOKER — NO TOCAR ⚠️⚠️ (con DEFINER, el owner `postgres` bypassearía RLS y
-- cualquier autenticado podría dar de alta pacientes sin `modulos.tiene_permiso('pacientes','write')`).
--
-- Rollback: no hay `DROP FUNCTION` que revertir sin reintroducir el bug (`crear_paciente_completo`
-- volvería a romper con `42804` en cualquier alta con `tipo_lugar` cargado). Si hace falta deshacer
-- este cambio puntual, restaurar desde backup.
--
-- ⚠️ Esta migración se redacta como artefacto de diseño. La aplica la usuaria/Enzo con
-- `supabase db push`, mismo patrón que todas las migraciones previas de esta función.

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
  --    NOT NULL (discrepancia #3 cerrada). `dias`/`horario` siguen sin columna (discrepancia #4).
  --    Persiste `descripcion` y `lat`/`lng` (geocoding, RF-701), ambos NULLable.
  --
  --    ⚠️ FIX de esta migración: `tipo_lugar` necesita cast explícito a
  --    `pacientes.tipo_direccion` — `NULLIF(text, text)` no es asignable a un enum sin cast.
  FOR v_item IN
    SELECT value FROM jsonb_array_elements(COALESCE(p_paciente -> 'direcciones', '[]'::jsonb))
  LOOP
    INSERT INTO pacientes.direcciones (paciente_id, calle, numero, tipo_lugar, localidad, descripcion, lat, lng)
    VALUES (
      v_paciente_id,
      v_item ->> 'calle',
      NULL,
      NULLIF(v_item ->> 'tipo_lugar', '')::pacientes.tipo_direccion,
      v_item ->> 'localidad',
      NULLIF(v_item ->> 'descripcion', ''),
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
  'NO convertir a SECURITY DEFINER. Persiste parentesco en personas_a_cargo desde 20260805130000, '
  'formato_afiliado en coberturas_paciente desde 20260731130000, localidad en direcciones desde '
  '20260804120000, descripcion en direcciones desde 20260806150000, lat/lng (geocoding, RF-701) '
  'desde 20260806160000 y castea tipo_lugar al enum pacientes.tipo_direccion desde 20260807000000 '
  '(bugfix 42804, encontrado en la verificación 1B.4). Ver openspec/changes/integracion-pacientes/ '
  'design.md D4 y D9 addendum.';
