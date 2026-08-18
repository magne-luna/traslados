-- Migration: add_autorizacion_archivo_meta
-- Description: integracion-documentos-autorizaciones (D4). Reabre a proposito una decision
-- revertida el 2026-07-30 por 20260730120000_revert_presupuesto_archivo_meta.sql, que hizo
-- DROP COLUMN de archivo_nombre/archivo_cargado_en en facturacion.presupuesto Y
-- facturacion.autorizacion, con el argumento de que el frontend usaba archivo_url
-- directamente (nombre en la URL, fecha via fecha_emision/fecha_respuesta) y las Edge
-- Functions nunca leian esas 2 columnas.
--
-- Por que se reabre ahora, solo para autorizacion (no para presupuesto): la carga real de
-- archivo contra Storage (integracion-documentos-autorizaciones, D3) sube el archivo directo
-- navegador -> bucket y necesita persistir metadata REAL (nombre tal cual lo subio el
-- usuario, fecha real de la subida), no derivarla de fecha_respuesta -- son conceptualmente
-- distintos (una autorizacion puede tener fecha_respuesta sin archivo, o cargar el archivo
-- despues de editarla). Derivar el nombre/fecha de archivo_url + fecha_respuesta fabricaria
-- un dato, el mismo antipatron que el proyecto ya viene corrigiendo en otros dominios
-- documentales. facturacion.presupuesto queda fuera de este change a proposito (D1: este
-- change es solo el archivo de Autorizacion, no el de Presupuesto -- no hay flujo de carga
-- real para presupuesto en este alcance); si se decide extender la carga real a Presupuesto
-- en un change futuro, esa migracion debe agregarse ahi, no reusar esta.
--
-- Confirmado explicitamente con la usuaria antes de escribir esta migracion: reabrir esta
-- decision revertida es aceptable para el alcance de autorizaciones.
--
-- RLS: no hace falta ninguna policy nueva -- las columnas se agregan a una tabla existente
-- (facturacion.autorizacion) ya cubierta por las policies row-level "Read autorizacion" /
-- "Write autorizacion" de 20260730140000_split_modulos_permisos.sql (gateadas por
-- modulos.tiene_permiso('presupuestos', ...)), que aplican a la fila completa, columnas
-- nuevas incluidas.

ALTER TABLE facturacion.autorizacion
  ADD COLUMN archivo_nombre TEXT,
  ADD COLUMN archivo_cargado_en TIMESTAMPTZ;

COMMENT ON COLUMN facturacion.autorizacion.archivo_url IS
  'Guarda la CLAVE del objeto en el bucket documentos-autorizaciones (storage.objects.name),
   no una URL absoluta -- se resuelve a URL firmada/publica en el cliente segun corresponda.
   Mismo criterio que los demas dominios documentales del proyecto (ver storage-buckets spec).';

COMMENT ON COLUMN facturacion.autorizacion.archivo_nombre IS
  'Nombre real del archivo tal como lo subio el usuario (no derivado de archivo_url).
   Reabierto por integracion-documentos-autorizaciones D4 -- ver cabecera de este archivo.';

COMMENT ON COLUMN facturacion.autorizacion.archivo_cargado_en IS
  'Fecha/hora real de la subida del archivo, distinta de fecha_respuesta.
   Reabierto por integracion-documentos-autorizaciones D4 -- ver cabecera de este archivo.';
