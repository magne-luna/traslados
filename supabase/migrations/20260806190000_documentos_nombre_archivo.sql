-- Migration: documentos_nombre_archivo
-- Description: Checkpoint 2 de integracion-documentos: las 4 tablas de documentos guardan
-- archivo_url (la clave dentro del bucket de Storage, no una URL real -- discrepancia de nombre
-- documentada en design.md D3, no resuelta) pero no el nombre original del archivo subido por el
-- usuario, dato que la UI necesita mostrar (DocumentChecklist). Se agrega nombre_archivo TEXT
-- nullable a las 4. De paso, documentacion_conductores es la unica de las 4 sin created_at
-- (verificado en tasks.md 1.3) -- se agrega para que las 4 puedan ordenarse/mostrarse igual.
-- Migracion 100% aditiva: ninguna columna existente se altera ni se borra.

ALTER TABLE pacientes.documentos ADD COLUMN nombre_archivo TEXT;
ALTER TABLE conductores.documentacion_vehiculo ADD COLUMN nombre_archivo TEXT;
ALTER TABLE conductores.documentacion_conductores ADD COLUMN nombre_archivo TEXT;
ALTER TABLE facturacion.documento_factura ADD COLUMN nombre_archivo TEXT;
ALTER TABLE conductores.documentacion_conductores ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN pacientes.documentos.archivo_url IS
  'Clave del objeto dentro del bucket de Storage (no una URL real) -- ver design.md D3.';
COMMENT ON COLUMN conductores.documentacion_vehiculo.archivo_url IS
  'Clave del objeto dentro del bucket de Storage (no una URL real) -- ver design.md D3.';
COMMENT ON COLUMN conductores.documentacion_conductores.archivo_url IS
  'Clave del objeto dentro del bucket de Storage (no una URL real) -- ver design.md D3.';
COMMENT ON COLUMN facturacion.documento_factura.archivo_url IS
  'Clave del objeto dentro del bucket de Storage (no una URL real) -- ver design.md D3.';

-- Rollback:
-- ALTER TABLE pacientes.documentos DROP COLUMN nombre_archivo;
-- ALTER TABLE conductores.documentacion_vehiculo DROP COLUMN nombre_archivo;
-- ALTER TABLE conductores.documentacion_conductores DROP COLUMN nombre_archivo;
-- ALTER TABLE facturacion.documento_factura DROP COLUMN nombre_archivo;
-- ALTER TABLE conductores.documentacion_conductores DROP COLUMN created_at;
-- (los 4 COMMENT ON COLUMN no requieren rollback: COMMENT ON COLUMN ... IS NULL los borra si hiciera falta)
