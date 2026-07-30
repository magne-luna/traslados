-- Migration: split_modulos_permisos
-- Description: separa el catálogo de módulos de permisos de 4 a 7, alineado 1:1 con las 7
-- pantallas del sidebar que hoy requieren permiso (openspec/changes/permisos-modulos-granulares/).
--
-- ⚠️ NO es un pedido del cliente (docs/core/Traslados-Modelo-Datos.docx nombra explícitamente 4
-- módulos de ejemplo, uno por cada entidad del docx) — es una decisión de UX/administración
-- confirmada con la usuaria, documentada como discrepancia intencional en
-- knowledge-base/04_modelo_de_datos.md §Discrepancias y CHANGES.md, señalizada en la UI con
-- AvisoModeloDatos en CuentaDetail.tsx. No se resuelve acá, solo se implementa.
--
-- Pares módulo padre → módulo hijo nuevo (design.md D1):
--   pacientes    → hojas_de_ruta  (pacientes.recorridos, pacientes.historial_recorridos)
--   facturacion  → presupuestos   (facturacion.presupuesto, facturacion.autorizacion)
--   conductores  → vehiculos      (conductores.vehiculo, conductores.accesorios_vehiculo,
--                                  conductores.documentacion_vehiculo, conductores.mantenimiento,
--                                  conductores.conductores_vehiculos)
--
-- facturacion.gastos_vehiculos permanece bajo 'facturacion' (confirmado con la usuaria: es un
-- gasto, no una operación sobre el vehículo en sí) — NO se toca acá.
-- conductores.conductores y conductores.documentacion_conductores permanecen bajo 'conductores'
-- — NO se tocan acá.
--
-- D1 (design.md): la migración de datos es SIEMPRE aditiva (INSERT ... SELECT desde el módulo
-- padre), nunca UPDATE. Las filas originales del módulo padre no se tocan ni se borran: una
-- cuenta que hoy tiene `pacientes: write` termina con esa fila intacta MÁS una fila nueva
-- `hojas_de_ruta: write`, para que ninguna cuenta pierda acceso a una pantalla que ya tenía.
--
-- D2 (design.md): Postgres no tiene `CREATE OR REPLACE POLICY` — cada policy se reemplaza con
-- `DROP POLICY IF EXISTS` + `CREATE POLICY`, usando los nombres literales tal como están en
-- 20260724100004_schema_pacientes.sql, 20260724100005_schema_facturacion.sql y
-- 20260724100006_schema_conductores.sql. No se edita ninguna migración ya aplicada.
--
-- Rollback: ver proposal.md — DELETE selectivo de las 3 filas nuevas de modulos.modulos (cascade
-- borra los modulos.permisos copiados vía ON DELETE CASCADE de modulo_id), y volver a aplicar
-- DROP/CREATE POLICY apuntando al módulo padre (definiciones originales en las 3 migraciones
-- citadas arriba).

-- 1. Catálogo: 3 módulos nuevos (mismo patrón que 20260728120000_seed_modulos.sql).
INSERT INTO modulos.modulos (tipo_modulo) VALUES
  ('hojas_de_ruta'),
  ('vehiculos'),
  ('presupuestos')
ON CONFLICT (tipo_modulo) DO NOTHING;

-- 2. Copia aditiva de modulos.permisos (D1): toda fila del módulo padre se duplica con el
-- modulo_id del hijo, mismo nivel_acceso. ON CONFLICT DO NOTHING por el UNIQUE(usuario_id,
-- modulo_id) — hace que esta migración sea segura de re-ejecutar (idempotente) sin duplicar ni
-- pisar una asignación manual que la administradora ya haya hecho sobre el módulo hijo.
INSERT INTO modulos.permisos (usuario_id, modulo_id, nivel_acceso)
SELECT p.usuario_id, hijo.id, p.nivel_acceso
FROM modulos.permisos p
JOIN modulos.modulos padre ON p.modulo_id = padre.id AND padre.tipo_modulo = 'pacientes'
JOIN modulos.modulos hijo ON hijo.tipo_modulo = 'hojas_de_ruta'
ON CONFLICT (usuario_id, modulo_id) DO NOTHING;

INSERT INTO modulos.permisos (usuario_id, modulo_id, nivel_acceso)
SELECT p.usuario_id, hijo.id, p.nivel_acceso
FROM modulos.permisos p
JOIN modulos.modulos padre ON p.modulo_id = padre.id AND padre.tipo_modulo = 'facturacion'
JOIN modulos.modulos hijo ON hijo.tipo_modulo = 'presupuestos'
ON CONFLICT (usuario_id, modulo_id) DO NOTHING;

INSERT INTO modulos.permisos (usuario_id, modulo_id, nivel_acceso)
SELECT p.usuario_id, hijo.id, p.nivel_acceso
FROM modulos.permisos p
JOIN modulos.modulos padre ON p.modulo_id = padre.id AND padre.tipo_modulo = 'conductores'
JOIN modulos.modulos hijo ON hijo.tipo_modulo = 'vehiculos'
ON CONFLICT (usuario_id, modulo_id) DO NOTHING;

-- 3. RLS (D2): pacientes → hojas_de_ruta.
DROP POLICY IF EXISTS "Read recorridos" ON pacientes.recorridos;
DROP POLICY IF EXISTS "Write recorridos" ON pacientes.recorridos;
CREATE POLICY "Read recorridos" ON pacientes.recorridos FOR SELECT TO authenticated USING (modulos.tiene_permiso('hojas_de_ruta', 'read'));
CREATE POLICY "Write recorridos" ON pacientes.recorridos FOR ALL TO authenticated USING (modulos.tiene_permiso('hojas_de_ruta', 'write'));

DROP POLICY IF EXISTS "Read historial_recorridos" ON pacientes.historial_recorridos;
DROP POLICY IF EXISTS "Write historial_recorridos" ON pacientes.historial_recorridos;
CREATE POLICY "Read historial_recorridos" ON pacientes.historial_recorridos FOR SELECT TO authenticated USING (modulos.tiene_permiso('hojas_de_ruta', 'read'));
CREATE POLICY "Write historial_recorridos" ON pacientes.historial_recorridos FOR ALL TO authenticated USING (modulos.tiene_permiso('hojas_de_ruta', 'write'));

-- 4. RLS (D2): facturacion → presupuestos. facturacion.facturas, facturacion.cobros y
-- facturacion.gastos_vehiculos NO se tocan — quedan gateadas por 'facturacion'.
DROP POLICY IF EXISTS "Read presupuesto" ON facturacion.presupuesto;
DROP POLICY IF EXISTS "Write presupuesto" ON facturacion.presupuesto;
CREATE POLICY "Read presupuesto" ON facturacion.presupuesto FOR SELECT TO authenticated USING (modulos.tiene_permiso('presupuestos', 'read'));
CREATE POLICY "Write presupuesto" ON facturacion.presupuesto FOR ALL TO authenticated USING (modulos.tiene_permiso('presupuestos', 'write'));

DROP POLICY IF EXISTS "Read autorizacion" ON facturacion.autorizacion;
DROP POLICY IF EXISTS "Write autorizacion" ON facturacion.autorizacion;
CREATE POLICY "Read autorizacion" ON facturacion.autorizacion FOR SELECT TO authenticated USING (modulos.tiene_permiso('presupuestos', 'read'));
CREATE POLICY "Write autorizacion" ON facturacion.autorizacion FOR ALL TO authenticated USING (modulos.tiene_permiso('presupuestos', 'write'));

-- 5. RLS (D2): conductores → vehiculos. conductores.conductores y
-- conductores.documentacion_conductores NO se tocan — quedan gateadas por 'conductores'.
DROP POLICY IF EXISTS "Read vehiculo" ON conductores.vehiculo;
DROP POLICY IF EXISTS "Write vehiculo" ON conductores.vehiculo;
CREATE POLICY "Read vehiculo" ON conductores.vehiculo FOR SELECT TO authenticated USING (modulos.tiene_permiso('vehiculos', 'read'));
CREATE POLICY "Write vehiculo" ON conductores.vehiculo FOR ALL TO authenticated USING (modulos.tiene_permiso('vehiculos', 'write'));

DROP POLICY IF EXISTS "Read accesorios_vehiculo" ON conductores.accesorios_vehiculo;
DROP POLICY IF EXISTS "Write accesorios_vehiculo" ON conductores.accesorios_vehiculo;
CREATE POLICY "Read accesorios_vehiculo" ON conductores.accesorios_vehiculo FOR SELECT TO authenticated USING (modulos.tiene_permiso('vehiculos', 'read'));
CREATE POLICY "Write accesorios_vehiculo" ON conductores.accesorios_vehiculo FOR ALL TO authenticated USING (modulos.tiene_permiso('vehiculos', 'write'));

DROP POLICY IF EXISTS "Read documentacion_vehiculo" ON conductores.documentacion_vehiculo;
DROP POLICY IF EXISTS "Write documentacion_vehiculo" ON conductores.documentacion_vehiculo;
CREATE POLICY "Read documentacion_vehiculo" ON conductores.documentacion_vehiculo FOR SELECT TO authenticated USING (modulos.tiene_permiso('vehiculos', 'read'));
CREATE POLICY "Write documentacion_vehiculo" ON conductores.documentacion_vehiculo FOR ALL TO authenticated USING (modulos.tiene_permiso('vehiculos', 'write'));

DROP POLICY IF EXISTS "Read mantenimiento" ON conductores.mantenimiento;
DROP POLICY IF EXISTS "Write mantenimiento" ON conductores.mantenimiento;
CREATE POLICY "Read mantenimiento" ON conductores.mantenimiento FOR SELECT TO authenticated USING (modulos.tiene_permiso('vehiculos', 'read'));
CREATE POLICY "Write mantenimiento" ON conductores.mantenimiento FOR ALL TO authenticated USING (modulos.tiene_permiso('vehiculos', 'write'));

DROP POLICY IF EXISTS "Read conductores_vehiculos" ON conductores.conductores_vehiculos;
DROP POLICY IF EXISTS "Write conductores_vehiculos" ON conductores.conductores_vehiculos;
CREATE POLICY "Read conductores_vehiculos" ON conductores.conductores_vehiculos FOR SELECT TO authenticated USING (modulos.tiene_permiso('vehiculos', 'read'));
CREATE POLICY "Write conductores_vehiculos" ON conductores.conductores_vehiculos FOR ALL TO authenticated USING (modulos.tiene_permiso('vehiculos', 'write'));
