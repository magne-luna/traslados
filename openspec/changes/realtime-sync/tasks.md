> Strict TDD: cada unidad es RED (test que falla, ejecutado) → GREEN (mínimo para pasar, ejecutado) → TRIANGULATE → REFACTOR.
> Tests SIEMPRE con `cd frontend && npm test` (NUNCA `npx vitest run`: le falta `NODE_OPTIONS=--no-experimental-webstorage`).
> Tipos SIEMPRE con `cd frontend && npx tsc -b --noEmit`. Sin `any`. Ningún test abre un socket real.
> Código nuevo en `frontend/src/shared/lib/realtime/`. No modificar `claves.ts` (solo importarlo).

## 0. Safety net

- [ ] 0.1 Correr `cd frontend && npm test` y `npx tsc -b --noEmit`; anotar baseline (N tests verdes). Si algo falla, frenar y reportar como falla preexistente.

## 1. Mapeo tabla → dominios (función pura)

- [ ] 1.1 RED: `realtime/tablas.test.ts` — `dominiosDeTabla('pacientes', 'direcciones')` devuelve `[claves.pacientes.todos()]`; `('conductores','conductores_vehiculos')` devuelve conductores + vehículos; `('facturacion','autorizacion')` devuelve autorizaciones + presupuestos.
- [ ] 1.2 GREEN: `realtime/tablas.ts` con la constante tipada `TABLAS_REALTIME` (design §D3, clave `"schema.tabla"`) y `dominiosDeTabla`.
- [ ] 1.3 TRIANGULATE: tabla desconocida / excluida (`auditoria.logs`, `facturacion.facturas`) → `[]`; un caso por cada dominio de la tabla de §D3.
- [ ] 1.4 REFACTOR: tipos derivados de la constante (`as const`), sin strings sueltos.

## 2. Hook suscriptor con canal inyectado

- [ ] 2.1 RED: `realtime/useSincronizacionRealtime.test.tsx` con un fake de canal en memoria (puerto §D4: `escuchar`, `suscribir`, `cerrar`) y `crearQueryClientDeTest()` espiando `invalidateQueries`. Caso: habilitado → registra un binding por cada entrada de `TABLAS_REALTIME` y se suscribe una vez.
- [ ] 2.2 GREEN: `realtime/canal.ts` (solo el tipo del puerto) + `useSincronizacionRealtime({ crearCanal, habilitado, usuarioId })` mínimo.
- [ ] 2.3 RED→GREEN: evento en `pacientes.cud` → tras el intervalo (fake timers) se invalida `claves.pacientes.todos()`; el payload no se lee (el fake manda un payload con campos basura y el test verifica que no aparece `setQueryData`).
- [ ] 2.4 RED→GREEN (coalescencia §D5): 5 eventos de tablas de pacientes + 1 de vehículo en el mismo intervalo → exactamente 1 invalidación de pacientes y 1 de vehículos.
- [ ] 2.5 RED→GREEN (reconexión §D6): primer `SUBSCRIBED` no invalida; `CHANNEL_ERROR` → `SUBSCRIBED` invalida todo (`invalidateQueries()` sin filtro). Triangular con `TIMED_OUT` y `CLOSED`.
- [ ] 2.6 RED→GREEN (sesión §D7): `habilitado=false` → nunca llama `crearCanal`; pasar de habilitado a deshabilitado → `cerrar()` y el timer pendiente se cancela (evento justo antes del logout no invalida); cambio de `usuarioId` → cierra y crea canal nuevo; unmount → `cerrar()` (idempotente bajo doble montaje de StrictMode).
- [ ] 2.7 REFACTOR: extraer constante del intervalo (~300 ms); correr suite completa.

## 3. Adaptador Supabase + montaje en la raíz

- [ ] 3.1 RED: `realtime/canalSupabase.test.ts` con un stub tipado de `Pick<SupabaseClient, 'channel' | 'removeChannel'>`: `escuchar` registra `.on('postgres_changes', { event: '*', schema, table }, …)`; `suscribir` reenvía el status; `cerrar` llama `removeChannel`.
- [ ] 3.2 GREEN: `realtime/canalSupabase.ts` usando el cliente de `shared/lib/supabaseClient.ts` (anon key; nunca service role).
- [ ] 3.3 RED: test de `<SincronizacionRealtime />` con `renderConSesion` + fábrica fake: anónimo / `loading` → no crea canal; autenticado → crea canal.
- [ ] 3.4 GREEN: componente `SincronizacionRealtime` (lee `AuthContext`, usa el hook con `canalSupabase`, no renderiza nada) + una línea en `frontend/src/App.tsx` dentro de `AuthProvider`.
- [ ] 3.5 Actualizar el comentario de `frontend/src/app/queryClient.ts` (hoy dice "Tiempo real queda descartado"): ahora Realtime invalida y `refetchOnWindowFocus` queda como respaldo. Sin cambiar la config.

## 4. Migración de publicación

- [ ] 4.1 RED: test de guarda `realtime/tablasPublicadas.test.ts` que lee `supabase/migrations/*_realtime_publicacion.sql` y exige que el set de tablas del `ADD TABLE` sea igual a las claves de `TABLAS_REALTIME` (ni una más, ni una menos).
- [ ] 4.2 GREEN: `supabase/migrations/<timestamp>_realtime_publicacion.sql` — `ALTER PUBLICATION supabase_realtime ADD TABLE <tablas §D3>;` con el rollback (`ALTER PUBLICATION supabase_realtime DROP TABLE …;`) comentado. Sin `REPLICA IDENTITY FULL`, sin tocar RLS ni grants.
- [ ] 4.3 Aplicar la migración en el proyecto Supabase de desarrollo y verificar con `select schemaname, tablename from pg_publication_tables where pubname = 'supabase_realtime';`.

## 5. Verificación y cierre

- [ ] 5.1 `cd frontend && npm test` (suite completa verde vs baseline 0.1) + `npx tsc -b --noEmit` + `npx oxlint`.
- [ ] 5.2 Verificación manual con dos navegadores, misma cuenta: hoja de ruta (agregar parada), ficha de paciente (solo dirección), alta de vehículo, baja de recorrido; cortar la red en uno y restablecer; logout corta la escucha (DevTools › WS cerrado). Probar también un usuario sin permiso de Presupuestos.
- [ ] 5.3 Documentar en `CHANGES.md` (sección de changes transversales) la entrada `realtime-sync` y la regla: "toda tabla operativa nueva → sumarla a `TABLAS_REALTIME` + migración de publicación" (avisa a `viajes-tercerizados-hoja-de-ruta` y `datos-paciente-por-anio`).
