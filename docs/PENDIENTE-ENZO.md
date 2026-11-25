# Pendiente para Enzo (backend / deploy)

Cosas que el front ya tiene subidas pero que necesitan un paso de servidor para funcionar.
Cuando termines una, tachala o borrala de acá y avisale a Delfi.

---

## 1. Valor del km en presupuestos — ✅ hecho (2026-11-25)

> Migración ya aplicada en remoto y edge function `presupuestos` deployada el 2026-11-25.
> Falta solo el paso 3: sacar el cartel `⚠️ TEMPORAL` de `PresupuestoForm.tsx`.

**Qué es:** Andrea pidió (reunión del 2026-10-07) cargar el precio del km en el presupuesto, como
figura en el formulario de la obra social. El front ya muestra el campo "Valor del km" y calcula el
"Monto mensual estimado" (km mensuales × valor del km, truncado a 2 decimales).

**Qué pasa hoy:** el valor **no se guarda**. La edge function `presupuestos` deployada todavía no
conoce `valorKm` y lo descarta en silencio. En el formulario hay un cartel amarillo avisándolo.

**Qué falta, en este orden:**

1. Aplicar la migración (agrega `valor_km` a `facturacion.presupuesto` y redefine
   `crear_presupuesto_completo` / `crear_presupuestos_lote` para insertarla):
   ```
   supabase db push
   ```
   Archivo: `supabase/migrations/20261014130000_presupuesto_valor_km.sql`

2. Deployar la edge function (ya tiene `valor_km` en lectura y escritura):
   ```
   supabase functions deploy presupuestos
   ```
   ⚠️ Siempre **después** del paso 1: si la función nueva corre sin la columna, guardar un
   presupuesto con valor del km da error.

3. Avisarle a Delfi para que saque el cartel temporal:
   `frontend/src/features/presupuestos/PresupuestoForm.tsx`, bloque marcado `⚠️ TEMPORAL`.

**Cómo probar:** Presupuestos → Nuevo presupuesto → cargar "Valor del km" → Guardar → abrir el
presupuesto: en el resumen tiene que aparecer "Valor del km".

---

## 2. Viajes tercerizados en la hoja de ruta — ⏳ pendiente

**Qué es:** cada recorrido puede ser de flota propia, **Uber / aplicación** o **Remis** (con la
agencia). Pedido de Andrea en la reunión del 2026-10-07. Change
`openspec/changes/viajes-tercerizados-hoja-de-ruta/`.

**Qué falta, en este orden:**

1. Verificar que el schema real coincide con el repo (en el SQL editor de Supabase):
   ```sql
   SELECT column_name, is_nullable FROM information_schema.columns
   WHERE table_schema = 'pacientes' AND table_name = 'recorrido';
   SELECT pg_get_functiondef('pacientes.crear_hoja_de_ruta_completa(jsonb)'::regprocedure);
   ```
   Tiene que coincidir con `20260804100000_schema_hoja_de_ruta.sql` y `20260804110000_hoja_de_ruta_rpc.sql`.
   Si difiere, avisar antes de aplicar.

2. Aplicar la migración (no hay Edge Function que deployar: la hoja de ruta escribe por RPC):
   ```
   supabase db push
   ```
   Archivo: `supabase/migrations/20261125120000_recorrido_tipo_transporte.sql`

3. Verificar:
   ```sql
   SELECT tipo_transporte, count(*) FROM pacientes.recorrido GROUP BY 1;  -- solo 'propio'
   ```
   y que la hoja de ruta actual (frontend viejo) sigue cargando y guardando.

4. **Recién después** deployar el frontend. ⚠️ Si el frontend nuevo sale antes que la migración, la
   hoja de ruta no carga (pide `tipo_transporte`, que todavía no existe).

**Cómo probar:** Hojas de ruta → Nuevo recorrido → tildar "Viaje tercerizado" → Remis, agencia
"París" → Crear recorrido. Recargar: la tarjeta dice "Remis · París", y también aparece así en la
vista imprimible y en el panel del dashboard.
