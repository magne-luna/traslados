-- Migration: realtime_publicacion
-- Change: realtime-sync (design.md D2/D3). Publica en `supabase_realtime` las tablas operativas cuyo
-- cambio debe reflejarse en vivo en otras sesiones. El frontend (shared/lib/realtime/tablas.ts,
-- TABLAS_REALTIME) solo INVALIDA queries al recibir el aviso; los datos se leen por el SELECT normal,
-- sujeto a RLS. Sin REPLICA IDENTITY FULL (los DELETE solo exponen la PK), sin tocar RLS ni grants.
-- Un test de guarda (tablasPublicadas.test.ts) exige que este set sea igual a TABLAS_REALTIME.
-- Tabla operativa nueva => sumarla a TABLAS_REALTIME + una migración nueva (no editar esta si ya se aplicó).

ALTER PUBLICATION supabase_realtime ADD TABLE
  pacientes.hoja_de_ruta,
  pacientes.recorrido,
  pacientes.historial_recorridos,
  pacientes.recorridos,
  pacientes.paciente,
  pacientes.direcciones,
  pacientes.cud,
  pacientes.clinicos,
  pacientes.personas_a_cargo,
  pacientes.prestaciones,
  pacientes.accesorios_pacientes,
  obra_social.coberturas_paciente,
  conductores.vehiculo,
  conductores.mantenimiento,
  conductores.habilitaciones_vehiculo,
  conductores.accesorios_vehiculo,
  conductores.conductores,
  conductores.conductores_vehiculos,
  facturacion.presupuesto,
  facturacion.presupuesto_linea,
  facturacion.autorizacion;

-- Rollback:
-- ALTER PUBLICATION supabase_realtime DROP TABLE
--   pacientes.hoja_de_ruta,
--   pacientes.recorrido,
--   pacientes.historial_recorridos,
--   pacientes.recorridos,
--   pacientes.paciente,
--   pacientes.direcciones,
--   pacientes.cud,
--   pacientes.clinicos,
--   pacientes.personas_a_cargo,
--   pacientes.prestaciones,
--   pacientes.accesorios_pacientes,
--   obra_social.coberturas_paciente,
--   conductores.vehiculo,
--   conductores.mantenimiento,
--   conductores.habilitaciones_vehiculo,
--   conductores.accesorios_vehiculo,
--   conductores.conductores,
--   conductores.conductores_vehiculos,
--   facturacion.presupuesto,
--   facturacion.presupuesto_linea,
--   facturacion.autorizacion;;
