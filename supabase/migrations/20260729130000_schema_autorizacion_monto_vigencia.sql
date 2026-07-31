-- Migration: schema_autorizacion_monto_vigencia
-- Description: C-06 presupuestos-autorizaciones, cerrando los 2 puntos que CHANGES.md marcaba
-- como bloqueantes: sin monto comparable no se puede validar RN-PA-01 (autorizacion nunca mayor
-- al presupuesto), y sin vigencia_desde no hay donde persistir la carga retroactiva (RN-PA-02).
-- Campos nullable -- el docx no los tiene, son agregados reales de negocio, igual que ya los
-- tiene el contrato del frontend (shared/types/presupuesto.ts: montoAutorizado?, vigenciaDesde?).

ALTER TABLE facturacion.autorizacion
  ADD COLUMN monto_autorizado NUMERIC(10, 2),
  ADD COLUMN vigencia_desde DATE;

CREATE OR REPLACE FUNCTION facturacion.validar_autorizacion_monto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  monto_presupuesto NUMERIC(10, 2);
BEGIN
  IF NEW.monto_autorizado IS NOT NULL THEN
    SELECT monto INTO monto_presupuesto FROM facturacion.presupuesto WHERE id = NEW.presupuesto_id;
    IF monto_presupuesto IS NOT NULL AND NEW.monto_autorizado > monto_presupuesto THEN
      RAISE EXCEPTION 'RN-PA-01: monto_autorizado (%) no puede superar el presupuesto (%)', NEW.monto_autorizado, monto_presupuesto;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validar_autorizacion_monto
  BEFORE INSERT OR UPDATE ON facturacion.autorizacion
  FOR EACH ROW EXECUTE FUNCTION facturacion.validar_autorizacion_monto();
