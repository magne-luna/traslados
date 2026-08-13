-- Migration: factura_fecha_emision_indices
-- Change: openspec/changes/integracion-facturacion/ (design.md D3/D10, tasks.md 1B.1)
--
-- ¿Qué agrega?
--   1. `facturacion.facturas.fecha_factura DATE` — la fecha de EMISIÓN de la factura (transición
--      `a-facturar → facturado`), distinta de `fecha_init`/`fecha_tope` (que son el período
--      facturado, no cuándo se emitió). El tipo `Factura.fechaFactura?: string` existe en el
--      frontend desde `facturacion-ui` y hoy no tiene columna — verificado columna por columna
--      contra `information_schema.columns` en tasks.md 1.3 (2026-08-12).
--   2. 6 índices `IF NOT EXISTS` sobre las FK del dominio propio de este change (D10): ninguna de
--      las 9 FK del schema `facturacion` está indexada hoy — verificado contra `pg_indexes` en
--      tasks.md 1.3/1.4 (2026-08-12). El embed de asistencias de D5 filtra por
--      `asistencia_prestacion.factura_id` en CADA lectura de factura, y `listByPaciente` filtra por
--      `facturas.paciente_id`.
--
-- ¿Por qué?
--   `estadoVencimientoFactura` (RF-406, alerta de factura vencida sin cobro a los 60 días) toma la
--   fecha de emisión como punto de partida. Sin persistirla, toda factura releída del servidor
--   pierde su fecha de emisión y la alerta queda muda (`CHANGES.md` §C-11, discrepancia 2/4).
--
-- Decisiones de D3 (por qué `fecha_factura` es nullable, sin default, sin NOT NULL):
--   * Nullable, sin default: una factura en `a-facturar` NO tiene fecha de emisión todavía, y ese
--     es su significado, no un dato faltante. `DEFAULT now()` mentiría sobre facturas no emitidas.
--   * Sin NOT NULL aunque el estado sea `facturado`: expresarlo pediría un CHECK correlacionado
--     entre dos columnas, que rompería cualquier corrección manual de estado hecha desde SQL (el
--     panel de cobros ya permite corrección manual de estado, `factura-estados-circuito`).
--   * Aditiva sobre una tabla en 0 filas: sin backfill, sin ventana de esquema roto, sin bloqueo.
--
-- Aprobaciones (tasks.md §0, todas respondidas 2026-08-12: sí):
--   0.1 (D3 — agregar la columna), 0.5 (D10 — CREATE INDEX sin CONCURRENTLY), 0.6 (coordinación con
--   backend/Enzo: confirmado que `fecha_factura` no está ya planeada con otro nombre).
--
-- ⚠️ Por qué CREATE INDEX sin CONCURRENTLY (D10, aprobado 0.5) — condición de caducidad
--   re-verificada, no asumida: tasks.md 1.4 confirmó el 2026-08-12 que las 4 tablas que este change
--   indexa (`facturas`, `asistencia_prestacion`, `cobros`, `documento_factura`) siguen en 0 FILAS.
--   (`presupuesto`/`autorizacion`, fuera del alcance de esta migración, ya tienen 2 filas cada una
--   por trabajo concurrente de otro change — no cambia la condición para las 4 tablas de acá.) Un
--   `CREATE INDEX` sobre una tabla vacía toma un `SHARE` lock durante microsegundos, y
--   `CREATE INDEX CONCURRENTLY` no puede correr dentro de un bloque de transacción (las migraciones
--   de Supabase sí corren envueltas en una). Si al momento de aplicar esta migración alguna de las
--   4 tablas ya tiene filas en volumen, HAY QUE REHACERLA con `CONCURRENTLY` fuera de transacción y
--   volver a consultar a la usuaria — es la condición de caducidad explícita de D10, a re-verificar
--   inmediatamente antes de `db push`, no un supuesto.
--
-- Rollback:
--   ALTER TABLE facturacion.facturas DROP COLUMN fecha_factura;
--   DROP INDEX IF EXISTS facturacion.idx_facturas_paciente_id;
--   DROP INDEX IF EXISTS facturacion.idx_facturas_domicilio_id;
--   DROP INDEX IF EXISTS facturacion.idx_asistencia_prestacion_factura_id;
--   DROP INDEX IF EXISTS facturacion.idx_cobros_facturas_id;
--   DROP INDEX IF EXISTS facturacion.idx_documento_factura_factura_id;
--   DROP INDEX IF EXISTS facturacion.idx_documento_factura_id_tipo_documento;
--   No hay dato que perder: la columna es nueva y nullable, y los índices no cambian ninguna
--   semántica (solo el plan de consulta).
--
-- ⚠️ Esta migración NO la aplica el agente. La corre la usuaria / Enzo (governance, tasks.md 1B.7).

ALTER TABLE facturacion.facturas ADD COLUMN IF NOT EXISTS fecha_factura DATE;

CREATE INDEX IF NOT EXISTS idx_facturas_paciente_id
  ON facturacion.facturas (paciente_id);

CREATE INDEX IF NOT EXISTS idx_facturas_domicilio_id
  ON facturacion.facturas (domicilio_id);

CREATE INDEX IF NOT EXISTS idx_asistencia_prestacion_factura_id
  ON facturacion.asistencia_prestacion (factura_id);

CREATE INDEX IF NOT EXISTS idx_cobros_facturas_id
  ON facturacion.cobros (facturas_id);

CREATE INDEX IF NOT EXISTS idx_documento_factura_factura_id
  ON facturacion.documento_factura (factura_id);

CREATE INDEX IF NOT EXISTS idx_documento_factura_id_tipo_documento
  ON facturacion.documento_factura (id_tipo_documento);
