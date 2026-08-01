-- Migration: schema_obra_social_facturacion_config
-- Description: C-04 obras-sociales-prestadores, completando lo que el docx no tiene.
-- knowledge-base/04_modelo_de_datos.md §Discrepancias ya documenta que plazoCobroDias,
-- modalidadFacturacion, admitePagosParciales y plantillaFactura son reglas de negocio reales
-- (RN-FA-07/08, "condiciones por prestador") ausentes del docx -- el docx no manda acá porque
-- simplemente no las tiene, no porque no correspondan. Nombres de campo y defaults tomados
-- 1:1 del contrato ya construido/testeado en el frontend
-- (frontend/src/shared/types/obraSocial.ts, ObraSocialForm.tsx) para no tener que renegociar
-- shapes despues.

-- tipo_factura era TEXT libre; reusa el mismo enum ya definido para facturas (A/B/C) en vez de
-- duplicar el catalogo de valores validos. Renombrado a tipo_comprobante (el nombre real del
-- concepto -- "tipo de comprobante fiscal", no el de la factura en si).
ALTER TABLE obra_social.obra_social RENAME COLUMN tipo_factura TO tipo_comprobante;
ALTER TABLE obra_social.obra_social
  ALTER COLUMN tipo_comprobante TYPE facturacion.tipo_factura USING tipo_comprobante::facturacion.tipo_factura;

CREATE TYPE obra_social.modalidad_facturacion AS ENUM ('por-prestacion', 'general');
CREATE TYPE obra_social.identificador_origen_factura AS ENUM ('paciente.dni', 'paciente.numeroAfiliado');

ALTER TABLE obra_social.obra_social
  ADD COLUMN plazo_cobro_dias INT NOT NULL DEFAULT 90,
  ADD COLUMN modalidad_facturacion obra_social.modalidad_facturacion NOT NULL DEFAULT 'por-prestacion',
  ADD COLUMN admite_pagos_parciales BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN identificador_origen obra_social.identificador_origen_factura NOT NULL DEFAULT 'paciente.numeroAfiliado';

-- RN-FA-08: el checklist es configurable por obra social y el orden de sus items debe
-- respetarse -- requisitos_os no tenia ni orden ni si el item es obligatorio.
ALTER TABLE obra_social.requisitos_os
  ADD COLUMN orden INT NOT NULL DEFAULT 0,
  ADD COLUMN requerido BOOLEAN NOT NULL DEFAULT true;

-- Plantilla de descripcion de factura (RF-302/RF-400): PlantillaCampo[] del frontend, cada
-- campo con una etiqueta libre y un origen de un conjunto cerrado de literales.
CREATE TYPE obra_social.origen_campo_plantilla AS ENUM (
  'paciente.nombre', 'paciente.dni', 'paciente.numeroAfiliado', 'paciente.domicilio',
  'traslado.prestacion', 'traslado.mesYAnio', 'traslado.cantidadDias',
  'traslado.dependenciaYRetorno', 'traslado.valorKm', 'traslado.cantidadKm',
  'traslado.total', 'valor-manual'
);

CREATE TABLE obra_social.plantilla_campo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_social_id UUID NOT NULL REFERENCES obra_social.obra_social(id) ON DELETE CASCADE,
    etiqueta TEXT NOT NULL,
    origen obra_social.origen_campo_plantilla NOT NULL,
    orden INT NOT NULL DEFAULT 0
);

ALTER TABLE obra_social.plantilla_campo ENABLE ROW LEVEL SECURITY;
GRANT ALL ON obra_social.plantilla_campo TO authenticated;

CREATE POLICY "Read plantilla_campo" ON obra_social.plantilla_campo FOR SELECT TO authenticated USING (modulos.tiene_permiso('obra_social', 'read'));
CREATE POLICY "Write plantilla_campo" ON obra_social.plantilla_campo FOR ALL TO authenticated USING (modulos.tiene_permiso('obra_social', 'write'));

CREATE TRIGGER trg_audit_plantilla_campo AFTER INSERT OR UPDATE OR DELETE ON obra_social.plantilla_campo FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
