-- El contrato del frontend (`ArchivoAdjunto: { nombre, cargadoEn }`, shared/types/presupuesto.ts)
-- necesita nombre de archivo y fecha de carga para poder mostrar la referencia adjunta -- el
-- docx solo modela un campo "Archivo" (Discrepancia 1 de presupuestos-ui/design.md), sin esos
-- metadatos, y `archivo_url` (ya existente desde C-02) tampoco alcanza para reconstruirlos.
-- Mismo patron que monto_autorizado/vigencia_desde: agregado real de negocio sobre el docx,
-- nullable -- el archivo sigue siendo opcional en ambas entidades.
ALTER TABLE facturacion.presupuesto
  ADD COLUMN archivo_nombre TEXT,
  ADD COLUMN archivo_cargado_en TIMESTAMPTZ;

ALTER TABLE facturacion.autorizacion
  ADD COLUMN archivo_nombre TEXT,
  ADD COLUMN archivo_cargado_en TIMESTAMPTZ;
