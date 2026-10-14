# Pendiente para Enzo (backend / deploy)

Cosas que el front ya tiene subidas pero que necesitan un paso de servidor para funcionar.
Cuando termines una, tachala o borrala de acá y avisale a Delfi.

---

## 1. Valor del km en presupuestos — ⏳ pendiente

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
