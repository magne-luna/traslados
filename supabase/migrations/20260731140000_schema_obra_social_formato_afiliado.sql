-- Migration: schema_obra_social_formato_afiliado
-- Change: RF-106 / RN-ID-02 — "el identificador de afiliado en la ficha del paciente varía según
-- la obra social (número de documento, alfanumérico, o CUIL del titular con sufijo)". El campo
-- debe adaptarse POR OBRA SOCIAL, no ser una elección libre del operador por paciente/cobertura.
--
-- Contexto: una sesión de agente anterior (2026-07-31, `integracion-obra-social` D12) reportó que
-- este punto ya estaba "confirmado por la usuaria" a favor del modelo por-cobertura
-- (`obra_social.coberturas_paciente.formato_afiliado`, agregada en
-- `20260729120000_schema_pacientes_gaps.sql`) y revirtió la idea de esta columna. Esa
-- confirmación **nunca pasó** — Enzo la desmintió el 2026-07-31 al releer RF-106 literal. Esta
-- migración retoma la decisión original (RF-106 manda): el formato es propiedad de la obra
-- social. `coberturas_paciente.formato_afiliado` (que sí existe de verdad en la base, confirmado
-- por Enzo) queda **sin usar, no se dropea** (mismo patrón no-destructivo que
-- `facturacion.gastos_vehiculos` en C-08) — es una columna `NOT NULL` sin default propio, así que
-- el código que escribe filas nuevas en `coberturas_paciente` sigue mandando un valor fijo
-- (`DEFAULT_FORMATO_AFILIADO`) solo para satisfacer el constraint, nunca leído.
--
-- Reutiliza el enum `obra_social.formato_afiliado` ya creado por
-- `20260729120000_schema_pacientes_gaps.sql` (mismos 3 valores: 'numero-documento' |
-- 'alfanumerico' | 'cuil-con-sufijo') — no se crea un tipo nuevo.
--
-- DEFAULT 'numero-documento' (a diferencia de la columna de coberturas_paciente, que no tenía
-- default): las funciones `obra_social.crear_obra_social_completa`/`actualizar_obra_social_completa`
-- (`20260731120001_obra_social_rpc.sql`) todavía no conocen esta columna — con DEFAULT no rompen
-- hasta que se actualicen para aceptarla explícitamente (tarea de frontend/backend de obras
-- sociales, no de esta migración puntual).

ALTER TABLE obra_social.obra_social
  ADD COLUMN formato_afiliado obra_social.formato_afiliado NOT NULL DEFAULT 'numero-documento';

-- RLS de obra_social.obra_social ya cubre la tabla completa (policies "Read obra_social" /
-- "Write obra_social" de 20260724100003_schema_obra_social.sql) — agregar una columna no
-- requiere policies nuevas.

-- ⚠️ Esta migración se redacta como artefacto de diseño. NO se aplica desde el agente (el sandbox
-- no tiene Docker ni credenciales de escritura sobre el proyecto real) — la aplica la
-- usuaria/Enzo con `supabase db push`.
