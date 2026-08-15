-- Migration: facturacion_tipos_documento
-- Description: RF-410 (continuación de 20260729100000_schema_documento_factura.sql, ya en main).
-- La documentación de respaldo de una FACTURA (Comprobante ARCA, Asistencia, CODEM) es una lista
-- FIJA propia de Facturación (ver frontend/src/shared/lib/facturacion/checklistDocumentosFactura.ts,
-- fix directo 2026-08-15) — no depende del checklist configurable de la obra social del paciente.
-- Hasta ahora, sin embargo, `facturacion.documento_factura.id_tipo_documento` seguía apuntando al
-- catálogo COMPARTIDO `obra_social.tipos_documento` (mismo catálogo que usa `requisitos_os` para
-- armar el checklist de cada obra social) — dependencia estructural incorrecta, ya señalada por la
-- usuaria: si mañana alguien edita/borra un tipo de `obra_social.tipos_documento` desde la pantalla
-- de Obras Sociales, puede romper en silencio la documentación de Facturación, un dominio que no
-- tiene nada que ver.
--
-- Esta migración le da a Facturación su propio catálogo (`facturacion.tipos_documento`, misma forma
-- que `obra_social.tipos_documento`: id/tipo) y repunta la FK de `documento_factura` hacia él.
--
-- Seguridad verificada antes de escribir esta migración: `facturacion.documento_factura` tiene 0
-- filas en la base real (confirmado por consulta directa), así que repuntar la FK no pierde ni
-- reinterpreta ningún dato existente — no hace falta migrar filas, solo cambiar el catálogo de
-- referencia antes de que exista la primera fila real.
--
-- No es un catálogo gestionable desde UI (a diferencia de `pacientes.accesorios`/
-- `pacientes.prestaciones`, que si tienen alta/edición desde pantallas propias): es chico y fijo,
-- se carga una sola vez por seed. Por eso solo tiene policy de SELECT — nadie debe poder
-- insertar/editar/borrar tipos de documento de factura desde el cliente.
--
-- Sin trigger de auditoría (a diferencia de `obra_social.tipos_documento`, que sí lo tiene): la
-- auditoría de este dominio (`auditoria.log_action()`) existe para registrar CAMBIOS hechos por
-- usuarios de la aplicación; esta tabla no tiene ninguna vía de escritura desde el cliente (ninguna
-- policy INSERT/UPDATE/DELETE, sin RPC), así que jamás va a disparar el trigger — agregarlo sería
-- código muerto. Si en el futuro este catálogo pasa a ser editable desde una pantalla, agregar el
-- trigger en ESE change, junto con la policy de escritura y la RPC correspondiente.
--
-- Rollback: si hace falta revertir, en orden —
--   1. ALTER TABLE facturacion.documento_factura DROP CONSTRAINT documento_factura_id_tipo_documento_fkey;
--   2. ALTER TABLE facturacion.documento_factura
--        ADD CONSTRAINT documento_factura_id_tipo_documento_fkey
--        FOREIGN KEY (id_tipo_documento) REFERENCES obra_social.tipos_documento(id) ON DELETE RESTRICT;
--   3. DROP TABLE facturacion.tipos_documento;
--   Seguro solo mientras `documento_factura` siga en 0 filas (mismo motivo que hace segura esta
--   migración hacia adelante); con filas reales cargadas contra el catálogo nuevo, un rollback
--   necesitaría remapear cada `id_tipo_documento` de vuelta al catálogo viejo antes del paso 1.

CREATE TABLE facturacion.tipos_documento (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo TEXT NOT NULL UNIQUE
);

ALTER TABLE facturacion.tipos_documento ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON facturacion.tipos_documento TO authenticated;

CREATE POLICY "Read tipos_documento facturacion" ON facturacion.tipos_documento
  FOR SELECT TO authenticated USING (modulos.tiene_permiso('facturacion', 'read'));

-- Seed: nombres prolijos para mostrar (catálogo nuevo, no hace falta calcar la capitalización en
-- minúscula del catálogo viejo de obra_social — "comprobante ARCA"/"asistencia"/"CODEM").
INSERT INTO facturacion.tipos_documento (tipo) VALUES
  ('Comprobante ARCA'),
  ('Asistencia'),
  ('CODEM');

-- Repunta la FK de documento_factura del catálogo compartido obra_social.tipos_documento al
-- catálogo propio facturacion.tipos_documento. Seguro: documento_factura tiene 0 filas (ver
-- comentario de cabecera), no hay valores existentes que puedan violar la nueva referencia.
ALTER TABLE facturacion.documento_factura
  DROP CONSTRAINT documento_factura_id_tipo_documento_fkey;

ALTER TABLE facturacion.documento_factura
  ADD CONSTRAINT documento_factura_id_tipo_documento_fkey
  FOREIGN KEY (id_tipo_documento) REFERENCES facturacion.tipos_documento(id) ON DELETE RESTRICT;
