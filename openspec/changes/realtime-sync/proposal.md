## Why

Varias personas usan la MISMA cuenta en distintas computadoras (Andrea + equipo). Cuando una modifica un dato, la otra no lo ve hasta apretar F5. El parche del commit `29b45c8` (`refetchOnWindowFocus: true` en `frontend/src/app/queryClient.ts`) cubre el caso "vuelvo a la pestaña", pero no el más común en la operación diaria: dos personas mirando la misma pantalla (la hoja de ruta del día, el listado de pacientes) sin cambiar de ventana. Se decidió sumar sincronización en tiempo real con Supabase Realtime.

## What Changes

- **Nueva migración** que agrega a la publicación `supabase_realtime` las tablas operativas compartidas (hojas de ruta + recorridos + paradas, recorridos habituales, ficha de paciente, vehículos, conductores, presupuestos/autorizaciones). Lista exacta y exclusiones justificadas en `design.md` §D3.
- **Un único suscriptor central en el frontend** (montado una vez en la raíz, dentro de `AuthProvider`): escucha `postgres_changes` de esas tablas y, ante cualquier evento, **invalida** las claves de React Query del dominio afectado (`claves.<dominio>.todos()`). Ninguna pantalla se reescribe: todas ya leen vía React Query.
- **Nunca se usa el payload del evento para pintar datos**: el evento solo dice "cambió algo en la tabla X"; el dato se vuelve a leer con el SELECT normal, así RLS sigue siendo la única fuente de verdad de qué ve cada usuario.
- Coalescencia de ráfagas (guardar una ficha de paciente toca N tablas → una sola invalidación por dominio), invalidación total al reconectar, desuscripción al cerrar sesión / cambiar de usuario.
- `refetchOnWindowFocus: true` **se mantiene** como red de seguridad. Se actualiza el comentario de `queryClient.ts` que hoy dice "Tiempo real queda descartado".

**Fuera de alcance (explícito):**
- **Ediciones concurrentes del mismo registro**: si dos personas editan la misma ficha a la vez, gana la última escritura (comportamiento actual, sin cambios). No hay bloqueo optimista ni aviso de conflicto.
- **No confundir con "tracking de vehículos en tiempo real"** (`knowledge-base/01_vision_y_objetivos.md`, sección "Fuera de alcance"): eso es rastreo GPS de la flota y sigue fuera de alcance. Este change es sincronización de *datos de la app* entre pestañas/computadoras.
- Presencia ("quién está mirando"), notificaciones visuales de "otro usuario cambió esto", y tablas de facturación/cobros (ver Open Questions en `design.md`).

## Capabilities

### New Capabilities
- `sincronizacion-tiempo-real`: los cambios hechos por otra sesión sobre datos operativos compartidos se reflejan en las pantallas abiertas sin recargar, respetando los permisos por módulo (RLS) de quien mira.

### Modified Capabilities
<!-- Ninguna. `cache-datos-cliente` no cambia de requisitos: la invalidación remota es un disparador
     adicional de la misma invalidación por prefijo de dominio que ya usan las mutaciones locales. -->

## Impact

- **Código nuevo**: `frontend/src/shared/lib/realtime/` (mapeo tabla → claves, hook suscriptor, adaptador del canal de Supabase) + un componente montado en `frontend/src/App.tsx`.
- **Código tocado**: `frontend/src/App.tsx` (una línea), comentario de `frontend/src/app/queryClient.ts`.
- **Base de datos**: una migración `ALTER PUBLICATION supabase_realtime ADD TABLE ...` (reversible). Sin cambios de esquema, RLS, ni `REPLICA IDENTITY`.
- **Dependencias**: ninguna nueva (`@supabase/supabase-js` v2 ya trae Realtime). Usa SOLO el cliente con anon key (`frontend/src/shared/lib/supabaseClient.ts`).
- **Gobernanza**: HIGH (datos de salud de menores). La exposición no crece respecto del SELECT actual porque Realtime autoriza cada evento contra RLS de cada suscriptor; ver `design.md` §D2.
- **Cuota Supabase**: 2–3 sesiones simultáneas, muy por debajo de los límites de conexiones/mensajes del plan.
- **Dependencias entre changes**: requiere `migracion-react-query` (ya hecho: `claves.ts`, `queryClient.ts`). Se solapa en tablas con `viajes-tercerizados-hoja-de-ruta` (`pacientes.recorrido`, posible tabla nueva `recorrido_tercerizado`) y `datos-paciente-por-anio` (`pacientes.paciente_anio`, cambios en `prestaciones`/`recorridos`/`coberturas_paciente`): quien archive después debe sumar sus tablas nuevas al mapeo + publicación (ver `design.md` §Risks).

## Rollback

1. **Frontend (inmediato, sin deploy de DB)**: quitar la línea `<SincronizacionRealtime />` de `App.tsx`. La app vuelve al comportamiento de `29b45c8` (refresco al enfocar la pestaña).
2. **Base de datos**: migración inversa `ALTER PUBLICATION supabase_realtime DROP TABLE <las mismas tablas>;` (incluida como comentario en la propia migración). No hay datos que migrar ni perder.
3. Ambos pasos son independientes: dejar la publicación activa sin suscriptores no tiene efecto funcional.

**Estimación:** ~1 día.
