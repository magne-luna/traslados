-- Migration: autorizacion_vigencia_dependencia_mime
-- Change: presupuestos-vigencia-datos-traslado-vista-previa (design.md D1, D3, D6c).
--
-- Agrega el lado CONCEDIDO del par pedido/concedido que este change introduce, más el dato de
-- MIME que habilita la vista previa del adjunto (D6):
--   * `vigencia_hasta`: completa el par con `vigencia_desde`, que ya existía
--     (20260729130000_schema_autorizacion_monto_vigencia.sql) pero sin su contraparte de cierre.
--   * `con_dependencia`: dependencia CONCEDIDA por la obra social — puede diferir de lo pedido en
--     `facturacion.presupuesto.con_dependencia` (la migración hermana de este mismo change);
--     Andrea fue literal: "lo carga ella, pero la obra social puede denegarlo — tiene que poder
--     desmarcarse". Misma forma que `monto`→`monto_autorizado`.
--   * `archivo_tipo_mime`: el MIME real del adjunto (`File.type` al momento de subir), para que
--     la vista previa (VistaPreviaArchivo, Fase 7 de este change) no tenga que adivinar el tipo de
--     contenido ni pedirlo a Storage en cada render.
--
-- Por qué `vigencia_hasta` completa D1 acá y no solo en `presupuesto` (RESUELTA): la obra social
-- puede autorizar MENOS período del pedido (recorte de vigencia), igual que puede autorizar menos
-- monto. Sin esta columna, ese recorte no tendría dónde vivir — el mismo agujero que
-- `monto_autorizado` vino a tapar para el monto en 20260729130000. `CHECK` idéntico al de la
-- migración hermana, contra la `vigencia_desde` que YA existe en esta tabla:
--   CHECK (vigencia_hasta IS NULL OR vigencia_desde IS NULL OR vigencia_hasta >= vigencia_desde)
-- Es una invariante de FILA (que el propio período autorizado sea coherente), NO la regla cruzada
-- "el período autorizado está contenido en el pedido" (autorizacion.vigencia_desde >=
-- presupuesto.vigencia_desde AND autorizacion.vigencia_hasta <= presupuesto.vigencia_hasta) — esa
-- regla cruzada es una RN candidata (análoga a RN-PA-01) que se valida en la capa de aplicación,
-- ver el punto siguiente.
--
-- Por qué NO se agrega un trigger que valide "autorizada ⊆ presupuestada" (D1, RESUELTA): sería
-- una regla CRUZADA entre dos tablas (compara con facturacion.presupuesto, no es una invariante
-- de la fila de autorizacion), y el Non-Goal explícito de este change es "NO se toca el trigger
-- validar_autorizacion_monto" (RN-PA-01) — agregar un trigger hermano para vigencia iría contra
-- ese mismo criterio de no ampliar la superficie de triggers de este dominio en este change. Es
-- además coherente con presupuesto-prestaciones D6 ("no duplicar reglas de formulario en SQL"):
-- la regla se valida en el formulario de autorización (Fase 8 de este change, `PresupuestoForm`/
-- `AutorizacionForm` bloqueados hasta que presupuesto-prestaciones esté aplicado), con mensajes en
-- castellano, no en un trigger de Postgres que devolvería un error genérico de excepción SQL.
--
-- `archivo_tipo_mime` puede quedar NULL en filas subidas ANTES de este change: el bucket
-- `documentos-autorizaciones` está vivo desde 2026-08-18 (20260818091000_bucket_documentos_autorizaciones.sql),
-- así que puede haber adjuntos reales sin este dato. Esas filas usan el fallback por extensión de
-- `VistaPreviaArchivo` (D6c) — una rama explícitamente marcada como compatibilidad histórica, no
-- el camino normal. El camino normal (Fase 7 de este change) puebla esta columna desde `File.type`
-- en el momento de la subida, dato que ya está en la mano y no hace falta adivinar.
--
-- Sin RLS nueva: mismo motivo que la migración hermana de `facturacion.presupuesto` — no se crea
-- ninguna tabla, `facturacion.autorizacion` ya está cubierta por "Read autorizacion" / "Write
-- autorizacion" (20260730140000_split_modulos_permisos.sql). Dejarlo escrito para que no se lea
-- como un olvido.
--
-- ⚠️ Esta migración se redacta como artefacto de diseño del change. NO se aplica desde el agente
-- (governance ALTO): la aplica la usuaria o Enzo con `supabase db push`. Ver tasks.md 3.5.
-- Requiere la migración hermana `20260821170000_presupuesto_vigencia_dependencia_traslado.sql`
-- aplicada antes (o en la misma corrida) para que la RN candidata de vigencia contenida tenga
-- sentido en la capa de aplicación, aunque no exista una FK ni un trigger que lo exija en SQL.

ALTER TABLE facturacion.autorizacion
  ADD COLUMN vigencia_hasta     DATE,
  ADD COLUMN con_dependencia    BOOLEAN,
  ADD COLUMN archivo_tipo_mime  TEXT;

ALTER TABLE facturacion.autorizacion
  ADD CONSTRAINT autorizacion_vigencia_hasta_desde_check
  CHECK (vigencia_hasta IS NULL OR vigencia_desde IS NULL OR vigencia_hasta >= vigencia_desde);

COMMENT ON COLUMN facturacion.autorizacion.vigencia_hasta IS
  'Hasta cuándo cubre la autorización CONCEDIDA — completa el par pedido/concedido de D1 junto '
  'con presupuesto.vigencia_hasta (la obra social puede recortar el período pedido, igual que '
  'puede recortar el monto). CHECK autorizacion_vigencia_hasta_desde_check exige >= vigencia_desde '
  '(que ya existía) cuando ambas están cargadas — invariante de fila. La regla cruzada "período '
  'autorizado ⊆ período presupuestado" NO tiene trigger: se valida en la capa de aplicación, ver '
  'cabecera de esta migración.';

COMMENT ON COLUMN facturacion.autorizacion.con_dependencia IS
  'Dependencia CONCEDIDA por la obra social — puede diferir de facturacion.presupuesto.con_dependencia '
  '(lo pedido): Andrea puede cargar CD y la obra social conceder SD, o viceversa. NULLABLE por el '
  'mismo motivo que su par en presupuesto: NULL = "no se cargó", false = "SD, decisión tomada". '
  'Debe ser desmarcable en el formulario aunque el presupuesto lo tenga marcado (Fase 8).';

COMMENT ON COLUMN facturacion.autorizacion.archivo_tipo_mime IS
  'MIME real del adjunto (File.type al momento de subir, ver SupabaseAutorizacionRepository.uploadArchivo, '
  'Fase 7 de este change), para que VistaPreviaArchivo no tenga que adivinar el tipo de contenido. '
  'Puede ser NULL en filas subidas antes de este change (bucket documentos-autorizaciones vivo '
  'desde 2026-08-18, 20260818091000_bucket_documentos_autorizaciones.sql): esas filas usan el '
  'fallback por extensión del nombre de archivo (D6c), una rama de compatibilidad histórica '
  'explícitamente marcada como tal, no el camino normal.';
