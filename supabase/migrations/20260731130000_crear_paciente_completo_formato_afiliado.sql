-- Migration: crear_paciente_completo_formato_afiliado
-- Change: openspec/changes/integracion-pacientes/ (design.md D9 addendum 2026-07-31, tasks.md 8.0)
--
-- ⚠️ BUG BLOQUEANTE, no una migración de mejora. `20260730180000_crear_paciente_completo.sql`
-- (ya aplicada) nunca completó `obra_social.coberturas_paciente.formato_afiliado` en su INSERT.
-- Esa columna es `obra_social.formato_afiliado NOT NULL` **sin default**
-- (`20260729120000_schema_pacientes_gaps.sql`, aplicada el mismo desfasaje de historial que ya
-- anota `20260731120000_obra_social_config_facturacion.sql`). Consecuencia: **cualquier alta de
-- paciente con número de afiliado cargado falla hoy con `23502`** — hallazgo del apply de
-- `integracion-obra-social` (2026-07-31), reportado ahí y corregido acá porque el bug vive en esta
-- función, no en esa migración.
--
-- Contexto de por qué la columna ya existe y no hace falta agregar ninguna (D12 revertida): ver
-- `openspec/changes/integracion-pacientes/design.md` D9 addendum y
-- `openspec/changes/integracion-obra-social/design.md` bloque "❌ D12 REVERTIDA". El formato del
-- identificador de afiliado se resuelve por COBERTURA (paciente↔obra social), elegido por el
-- operador al cargarla — nunca derivado de la obra social. `pacienteMapping.ts` /
-- `SupabasePacienteRepository.ts` (tasks.md 8.2) son quienes hacen viajar ese valor elegido en el
-- payload que esta función ahora consume.
--
-- Esta migración es ADITIVA y NO cambia la firma ni el resto del cuerpo de la función: mismo
-- `CREATE OR REPLACE FUNCTION pacientes.crear_paciente_completo(p_paciente jsonb) RETURNS uuid`,
-- mismo `SECURITY INVOKER`/`search_path = ''`, mismos pasos 1-6 (paciente, clínicos, cud,
-- direcciones, personas a cargo, accesorios) letra por letra respecto de `20260730180000`. El
-- único cambio real es el paso 7 (cobertura): ahora también persiste `formato_afiliado`.
--
-- ⚠️⚠️ SECURITY INVOKER — NO TOCAR ⚠️⚠️ (idéntico razonamiento que 20260730180000: con DEFINER,
-- el owner `postgres` bypassearía RLS y cualquier autenticado podría dar de alta pacientes sin
-- `modulos.tiene_permiso('pacientes','write')`). `CREATE OR REPLACE` sobre la misma firma no
-- cambia el owner ni los grants ya otorgados, pero se reafirman abajo por las dudas — que quede
-- como afirmación explícita en el diff, no un supuesto silencioso sobre lo que ya había.
--
-- `formato_afiliado` viaja como texto (`p_paciente ->> 'formato_afiliado'`) y se castea al enum
-- `obra_social.formato_afiliado` (mismos 3 literales que `FormatoAfiliado` del frontend:
-- 'numero-documento' | 'alfanumerico' | 'cuil-con-sufijo'). Si la clave viene ausente o vacía
-- (payload de un cliente viejo que todavía no manda el campo, o un caller que no es el frontend),
-- se usa `COALESCE(..., 'numero-documento')` — el mismo default que ya usa el frontend
-- (`DEFAULT_FORMATO_AFILIADO`, `formatoAfiliadoOptions.ts`) — en vez de dejar pasar un `NULL` que
-- volvería a romper con `23502`. Un valor presente pero fuera del enum sigue lanzando el error de
-- cast estándar de Postgres (`22P02`), igual que ya pasa con `tipo_comprobante` en
-- `obra_social.crear_obra_social_completa` — no se le agrega un código propio nuevo porque no es
-- un caso de negocio (el frontend nunca manda un valor fuera de la unión cerrada).
--
-- Rollback: no hay `DROP FUNCTION` que revertir sin dejar la función inoperante de nuevo (volvería
-- a romper con `23502`). Si hace falta deshacer este cambio puntual, aplicar de nuevo
-- `20260730180000_crear_paciente_completo.sql` tal cual (reintroduce el bug a propósito) o
-- restaurar desde backup — no se documenta un rollback "bueno" porque no lo hay: este archivo
-- corrige un bug bloqueante, no agrega una feature opcional.
--
-- ⚠️ Esta migración se redacta como artefacto de diseño del change. NO se aplica desde el agente
-- (el sandbox no tiene Docker ni credenciales de escritura sobre el proyecto real) — la aplica la
-- usuaria/Enzo con `supabase db push`, mismo patrón que `20260730180000_crear_paciente_completo.sql`.

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

  -- 7. Cobertura (número de afiliado + formato, tasks.md 8.0). Vive en el schema `obra_social` y
  --    está gateada por el módulo `obra_social`, NO por `pacientes` (D3). Por eso el INSERT sigue
  --    siendo condicional: solo se intenta si realmente hay un número de afiliado que guardar. Un
  --    usuario con `pacientes:write` y sin `obra_social:write` puede dar de alta pacientes con
  --    normalidad mientras deje ese campo vacío; si lo completa, la transacción entera hace
  --    rollback con 42501 y el frontend traduce eso a un mensaje que nombra Obras Sociales. Nunca
  --    queda un paciente a medias.
  --
  --    ⚠️ FIX de esta migración: `formato_afiliado` (obra_social.formato_afiliado, NOT NULL SIN
  --    DEFAULT) faltaba en este INSERT — cualquier alta con número de afiliado fallaba con `23502`.
  --    Se persiste el formato que el operador eligió al cargar la cobertura (nunca derivado de la
  --    obra social, D12 revertida). `COALESCE(..., 'numero-documento')` cubre el único caso en que
  --    la clave puede faltar del payload (mismo default que `DEFAULT_FORMATO_AFILIADO` del
  --    frontend) sin reintroducir el `23502`.
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
-- revoca los grants ya otorgados por `20260730180000`, pero se reafirman igual: afirmación
-- explícita en el diff, no un supuesto sobre lo que ya había.
REVOKE ALL ON FUNCTION pacientes.crear_paciente_completo(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION pacientes.crear_paciente_completo(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION pacientes.crear_paciente_completo(jsonb) TO authenticated;

COMMENT ON FUNCTION pacientes.crear_paciente_completo(jsonb) IS
  'Alta atómica de un paciente y sus filas hijas. SECURITY INVOKER a propósito: RLS '
  '(modulos.tiene_permiso(''pacientes'',''write'')) sigue aplicando sobre cada tabla. '
  'NO convertir a SECURITY DEFINER. Persiste formato_afiliado en coberturas_paciente desde '
  '20260731130000 (bugfix 23502, tasks.md 8.0). '
  'Ver openspec/changes/integracion-pacientes/design.md D4 y D9 addendum.';
