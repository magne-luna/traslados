## Context

El catálogo de módulos vive en `modulos.modulos` (Postgres, `tipo_modulo TEXT UNIQUE` — no un `ENUM`), y cada permiso de cuenta es una fila en `modulos.permisos (usuario_id, modulo_id, nivel_acceso)`. La función `modulos.tiene_permiso(modulo_req, nivel_req)` es lo único que las policies RLS de cada tabla de dominio consultan. El frontend espeja ese catálogo con el tipo `Modulo` (unión de 4 strings) en `frontend/src/shared/types/usuario.ts`, y `features/cuentas/modulos.ts` centraliza el orden, las etiquetas y los colores usados por la matriz de permisos (`MatrizPermisos.tsx`) y por `CuentaForm.tsx`.

Los 4 módulos actuales (`pacientes`, `obra_social`, `facturacion`, `conductores`) fueron una decisión explícita y ya revertida una vez desde 9 módulos — ver `supabase/migrations/20260728120000_seed_modulos.sql`. Este change vuelve a separar 3 de los 4 en sub-módulos (7 en total), esta vez por pedido directo del usuario (no del cliente), documentado como discrepancia contra el docx (`knowledge-base/04_modelo_de_datos.md` §Discrepancias).

Dato relevante encontrado al inspeccionar la Edge Function `update-permisos`: **no tiene ningún módulo hardcodeado** — lee el catálogo dinámicamente de `modulos.modulos` (`select id, tipo_modulo ... in tipo_modulo body.permisos.map(modulo)`) y rechaza cualquier `modulo` que no encuentre ahí. Esto significa que la Edge Function no requiere ningún cambio de código para este change; basta con que el catálogo tenga las filas nuevas.

## Goals / Non-Goals

**Goals:**
- Separar `pacientes` → `pacientes` + `hojas_de_ruta`, `facturacion` → `facturacion` + `presupuestos`, `conductores` → `conductores` + `vehiculos`. `obra_social` queda igual.
- Ninguna cuenta existente pierde acceso a una pantalla que ya tenía, el día que se aplique la migración.
- El tipo `Modulo` y `MODULOS` (frontend) quedan como único punto de verdad, igual que hoy — solo cambia su contenido, no su forma.

**Non-Goals:**
- No se toca la jerarquía de niveles (`read < write < admin`) ni la Edge Function `update-permisos` (no lo necesita, ver Context).
- No se agregan roles nuevos ni se cambia el modelo `rol admin bypassa todo` de `modulos.tiene_permiso()`.
- No se resuelve la discrepancia con el docx "borrándola" — se documenta, per regla dura del proyecto; no es este change quien decide si el docx se actualiza.
- No se reubica `facturacion.gastos_vehiculos` — queda en `facturacion` (confirmado con el usuario).

## Decisions

### D1 — Migración de datos por copia aditiva, nunca por UPDATE
Para no perder el estado actual de ninguna cuenta, la migración SQL nueva usa `INSERT INTO modulos.permisos (usuario_id, modulo_id, nivel_acceso) SELECT usuario_id, <id del módulo hijo>, nivel_acceso FROM modulos.permisos WHERE modulo_id = <id del módulo padre>` para cada uno de los 3 pares padre→hijo. Las filas originales del módulo padre **no se tocan ni se borran** — la cuenta sigue teniendo, por ejemplo, `pacientes: write` Y ahora también `hojas_de_ruta: write`, como fila independiente. Alternativa descartada: `UPDATE` in-place cambiando el `modulo_id` de algunas filas — se descartó porque no hay forma de saber, a nivel SQL, qué mitad de los usos históricos de "pacientes" correspondía conceptualmente a "hojas_de_ruta"; la copia aditiva es la única opción segura porque replica el nivel de acceso completo a ambos módulos nuevos, dejando que el administrador los desacople manualmente después si quiere niveles distintos.

### D2 — Reescritura de RLS vía DROP POLICY + CREATE POLICY, en una migración nueva
Postgres no tiene `CREATE OR REPLACE POLICY`. La migración nueva hace `DROP POLICY IF EXISTS "<nombre exacto>" ON <tabla>` seguido de `CREATE POLICY` con el `tiene_permiso('<módulo hijo>', ...)` nuevo, tabla por tabla, usando los nombres de policy tal como están hoy en `20260724100004_schema_pacientes.sql`, `20260724100005_schema_facturacion.sql` y `20260724100006_schema_conductores.sql` (ej: `"Read recorridos"`, `"Write recorridos"`, `"Read presupuesto"`, `"Write presupuesto"`, `"Read vehiculo"`, `"Write vehiculo"`, etc.). No se edita ninguna migración ya aplicada — este proyecto no re-escribe historial de migraciones.

### D3 — Orden de aplicación: DB primero, frontend después
La migración de Supabase (catálogo + datos + RLS) se aplica ANTES de deployar el frontend con el `Modulo` de 7 valores. Si se invirtiera el orden, el frontend pediría (via `update-permisos`) un `modulo: 'hojas_de_ruta'` que la Edge Function rechazaría con `modulo(s) inexistente(s)` porque todavía no existe en `modulos.modulos`. En sentido inverso (DB migrada, frontend viejo todavía corriendo) no hay riesgo: el frontend viejo simplemente no ofrece las filas nuevas en la matriz, pero las cuentas ya tienen los permisos copiados por D1 y las policies RLS ya aceptan el módulo nuevo.

### D4 — `SUBMODULOS_MODULO` se elimina, no se vacía
Hoy existe para aclarar "pacientes incluye Hojas de Ruta". Con la separación 1:1, esa aclaración deja de tener sentido — se borra la constante y sus usos en `PermisosMatrizFields.tsx`, no se deja como diccionario vacío.

### D5 — Colores de `MODULO_COLOR`: se reutiliza el tono del módulo padre en el hijo
`SemanticStatus` solo tiene 5 tonos (`success`, `warning`, `danger`, `info`, `secondary`) para 7 módulos. Se decide que cada módulo hijo reutilice el tono de su padre (`hojas_de_ruta` = `success` como `pacientes`; `presupuestos` = `warning` como `facturacion`; `vehiculos` = `info` como `conductores`), en vez de introducir colores nuevos al design system. Esto mantiene visualmente agrupados los módulos relacionados en la matriz, a costa de que el color deje de ser 100% unívoco por módulo (ya lo dice el comentario original: "identifica qué módulo es cada fila", ahora dos filas comparten tono y se distinguen por ícono/etiqueta). Alternativa descartada: pedir 2 tonos nuevos al design system — se descarta por alcance, queda como pregunta abierta si el usuario lo prefiere.

## Risks / Trade-offs

- **[Riesgo] Nombres de policy no coinciden exactamente al hacer `DROP POLICY IF EXISTS`** → si el nombre no matchea, el `DROP` no hace nada (con `IF EXISTS` no falla) pero el `CREATE POLICY` subsiguiente sí falla por policy duplicada si el nombre viejo seguía activo. Mitigación: la task de implementación copia los nombres literales desde las migraciones fuente, no los reescribe de memoria.
- **[Riesgo] Migración de datos corre en producción con cuentas reales ya operando** → una cuenta podría loguearse a mitad de la migración y ver un estado intermedio de permisos. Mitigación: la migración entera (INSERT de módulos + copia de permisos + DROP/CREATE de policies) va en una sola transacción SQL (`BEGIN`/`COMMIT` implícito de una migración de Supabase), así que desde afuera es atómica.
- **[Riesgo] Colores repetidos (D5) generan confusión visual en la matriz de 7 filas** → mitigación parcial: el ícono y la etiqueta de texto siguen siendo únicos por fila; el color pasa a ser un refuerzo visual de "familia de módulo", no el único diferenciador.
- **[Trade-off] Este change deja una discrepancia documentada contra el docx del cliente, en vez de resolverla** → es intencional: la regla dura del proyecto exige documentar, no resolver unilateralmente. Si el cliente confirma después que prefiere los 4 módulos originales, este change se revierte con el DELETE selectivo descripto en el rollback de `proposal.md`.

## Migration Plan

1. Migración SQL nueva (`supabase/migrations/<timestamp>_split_modulos_permisos.sql`):
   a. `INSERT` de `hojas_de_ruta`, `vehiculos`, `presupuestos` en `modulos.modulos`.
   b. Copia aditiva de `modulos.permisos` (D1) para los 3 pares padre→hijo.
   c. `DROP POLICY` + `CREATE POLICY` (D2) en las tablas de recorridos, presupuesto/autorización y vehículos.
2. Aplicar la migración al entorno antes de deployar el frontend nuevo (D3).
3. Frontend: `usuario.ts`, `modulos.ts`, `routes.ts`, `MatrizPermisos.tsx`/`PermisosMatrizFields.tsx`/`CuentaForm.tsx` y sus tests, todo en el mismo commit (no tiene sentido partirlo — son cambios acoplados al mismo tipo `Modulo`).
4. Documentación: entrada en `knowledge-base/04_modelo_de_datos.md` §Discrepancias + `AvisoModeloDatos` en la pantalla de Cuentas + bullet en `CHANGES.md`.

**Rollback**: ver `proposal.md` — DELETE selectivo de las 3 filas nuevas de `modulos.modulos` (cascade borra los `modulos.permisos` copiados), DROP/CREATE de las policies para volver a apuntar al módulo padre, revert del commit de frontend.

## Open Questions

- ¿El design system debería sumar 2 tonos nuevos de `SemanticStatus` para que los 7 módulos tengan color unívoco (alternativa a D5), o alcanza con la reutilización por familia?
- ¿Vale la pena, a futuro, que `modulos.modulos` tenga una columna `modulo_padre_id` explícita para que la relación pacientes↔hojas_de_ruta quede modelada en el schema en vez de solo en el nombre y en la documentación? Fuera de alcance de este change.
