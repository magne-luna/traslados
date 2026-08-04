## Why

El frontend de **Hojas de Ruta y Recorridos** está completo y archivado en mock (`hojas-de-ruta-ui`,
`openspec/changes/archive/2026-07-25-hojas-de-ruta-ui/`, FE-5, 2026-07-25; el gateo de permisos se
resolvió después y por separado en `archive/2026-07-30-gateo-hojas-de-ruta/`), pero la pantalla habla
con **cuatro repositorios mock a la vez** (`HojaDeRutaRoute.tsx`): `mockHojaDeRutaRepository`,
`mockPacienteRepository`, `mockVehiculoRepository` y `mockConductorRepository`. Es el módulo **6 del
plan de integración** de `CHANGES.md` (`C-10`), sin propose todavía — la fila 6 dice literalmente
"⏳ pendiente — —".

**Esto es distinto de los cinco changes anteriores de la serie, y hay que decirlo antes de la primera
línea de "What Changes":** en `integracion-pacientes` e `integracion-obra-social` el schema real ya
existía completo y el trabajo era "expand aditivo". Acá **no existe ninguna tabla `hoja_de_ruta`**, y
`pacientes.recorridos` / `pacientes.historial_recorridos` — las dos únicas tablas del dominio que sí
existen — son **placeholders vacíos, sin una sola lectura ni escritura desde el frontend hoy**
(verificado: cero referencias en `frontend/src/shared/lib/pacientes/` salvo un mensaje de error de
`ON DELETE RESTRICT`). El comentario de `C-05` en `CHANGES.md` ya lo anticipaba: *"`historial_recorridos`
sigue como placeholder hasta que exista `C-10`"*. Este change, entonces, no es un swap de mock→real
sobre una tabla que ya guarda datos: es el que **le da su primer uso real** a ese placeholder, además
de crear lo que falta.

**Segundo hallazgo, y es el que más cambia el alcance:** las dependencias de `CHANGES.md`
(`C-10` necesita `C-05 ✓`, `C-08 ✓`, `C-09 ✓`) están escritas a nivel de **schema de base**, no de
**cableado de frontend**, y hoy son ciertas solo a medias:

| Dominio | Schema real (migración) | Repository Supabase en el frontend | Composition root |
|---|---|---|---|
| Pacientes (`C-05`) | ✅ aplicado | ✅ `SupabasePacienteRepository.ts` existe | ✅ `PacientesRoute.tsx` lo inyecta |
| Obra Social (`C-04`) | ✅ aplicado | ✅ `SupabaseObraSocialRepository.ts` existe | ✅ inyectado (lo reusa incluso `PacientesRoute.tsx`) |
| Vehículos (`C-08`) | ✅ aplicado (`schema_conductores.sql` + el propio backend de Enzo, `20260730110000_schema_vehiculo_gaps.sql`, `supabase/functions/vehiculos/index.ts`) | ❌ **no existe** `SupabaseVehiculoRepository.ts` en el árbol del repo | ❌ `VehiculosRoute.tsx` sigue inyectando `mockVehiculoRepository` |
| Conductores (`C-09`) | ✅ aplicado (schema) | ❌ **no existe** `SupabaseConductorRepository.ts` | ❌ `ConductoresRoute.tsx` sigue inyectando `mockConductorRepository` |

Verificado por los tres lados: `find` no encuentra los dos archivos `Supabase*Repository.ts` de
Vehículos/Conductores en ningún lado del repo (solo sus specs en
`openspec/changes/integracion-conductores-vehiculos/specs/` y módulos de mapeo preparatorios,
`vehiculoMapping.ts`/`conductorMapping.ts`, todavía sin repository que los llame); el `grep` de las
dos `*Route.tsx` confirma el mock inyectado; y `CHANGES.md` fila 3 del plan de integración lo dice en
castellano: *"Conductores + Vehículos (C-08/C-09): 🔶 reconciliado (2026-08-01), **bloqueado en 1
gap**"* — Vehículos bloqueado por falta de fuente de datos para `mantenimientos` (decisión de Enzo
pendiente), Conductores bloqueado porque la migración `conductores_vehiculos_campos.sql`/`_rpc.sql`
que su propio `design.md` planeaba **nunca se escribió**: el timestamp que iba a usar
(`20260801120000`) lo ocupó una migración no relacionada (`seed_obras_sociales_prestadores.sql`,
confirmado leyendo `supabase/migrations/`).

**Consecuencia concreta para este proposal:** `integracion-hojas-de-ruta` puede volver **real** el
repositorio de Hoja de Ruta y, de yapa, el de Paciente (ya está disponible, es cuestión de reusar el
singleton existente). **No puede** volver reales Vehículo y Conductor — esa implementación
simplemente no existe todavía en ningún lado del repo, y escribirla es el alcance de
`integracion-conductores-vehiculos`, no de este change. Ver `design.md` Checkpoint 0 para la decisión
formal (bloquear este change hasta que aterrice esa integración, vs. avanzar con un swap parcial).

**Tercer hallazgo — corrige un hecho que se había dado por asentado.** El contexto de arranque de
este propose citaba `20260724100004_schema_pacientes.sql:144-148` para afirmar que
`pacientes.recorridos`/`pacientes.historial_recorridos` gatean bajo el módulo `pacientes`. Eso fue
cierto **hasta el 2026-07-30**: `supabase/migrations/20260730140000_split_modulos_permisos.sql`
reescribió esas cuatro policies para exigir `modulos.tiene_permiso('hojas_de_ruta', …)`, con su propio
módulo dedicado (`modulos.modulos` ya tiene la fila `hojas_de_ruta`, verificado en vivo). Es,
literalmente, el trabajo que hizo `gateo-hojas-de-ruta` — su propio `proposal.md` documenta el
hallazgo original y `frontend/src/app/routes.ts:83-93` ya quedó corregido con el módulo actual
(`modulo: 'hojas_de_ruta'`) y un comentario que cita la migración del split. **Verificado contra la
base real, no contra la migración vieja**: las cuatro policies vigentes (`pg_policies.qual`) usan
`'hojas_de_ruta'::text`. Este change hereda ese módulo — no hay nada que corregir, pero convenía dejar
constancia de por qué el dato de arranque estaba desactualizado.

## What Changes

- **Dos tablas nuevas** en el schema `pacientes` (co-ubicadas con sus dos vecinas ya existentes,
  mismo criterio de RLS bajo el módulo `hojas_de_ruta`, mismas FK hacia `pacientes.paciente` /
  `pacientes.direcciones` / `conductores.vehiculo` / `conductores.conductores`):
  - `pacientes.hoja_de_ruta` (agregado del día: `fecha` única, franja horaria, notas al pie).
  - `pacientes.recorrido` (un vehículo + un conductor dentro de una hoja de ruta). **Contiene
    `conductor_id`** — el punto de discrepancia central del docx que `CHANGES.md` §C-10 dejó anotado
    como pendiente de coordinar antes de cerrar el esquema. Ver Checkpoint 1 de `design.md`.
- **Una tabla existente se repropone** (expand aditivo, sin tocar ninguna fila ni columna existente):
  `pacientes.historial_recorridos` — hoy un placeholder sin uso — gana `recorrido_id`, `tramo`,
  `orden` y `hora_estimada`, y pasa a ser la persistencia de `ParadaRecorrido`. Es la lectura más
  económica de un hecho ya verificado: la tabla ya tiene `paciente_id`, `id_dir_inicial`,
  `id_dir_final` e `id_vehiculo` — exactamente la forma de una parada, a la que le faltaba agruparse
  bajo un recorrido y ordenarse. Alternativa (tablas 100% nuevas, sin tocar `historial_recorridos`)
  evaluada y descartada en `design.md` Checkpoint 1.
- **Una implementación nueva**: `frontend/src/shared/lib/hojas-de-ruta/SupabaseHojaDeRutaRepository.ts`,
  cumpliendo `HojaDeRutaRepository` **sin cambiar una firma** (`list`, `getById`, `getByFecha`,
  `create`, `update`) — mismo criterio de las cuatro implementaciones reales anteriores de la serie.
- **Un módulo de mapeo puro nuevo**: `hojaDeRutaMapping.ts` — reconstruye el agregado
  `HojaDeRuta → Recorrido[] → ParadaRecorrido[]` desde tres tablas con un solo embed de PostgREST,
  con type guards explícitos (nunca `any`, nunca `as`).
- **El swap en sí cambia un archivo de producto**: `HojaDeRutaRoute.tsx` (composition root) pasa a
  inyectar `supabaseHojaDeRutaRepository` y reusa el singleton ya real `supabasePacienteRepository`
  (`frontend/src/shared/lib/pacientes/SupabasePacienteRepository.ts`, ya exportado e inyectado en
  `PacientesRoute.tsx` desde `integracion-pacientes`). **Vehículo y Conductor se quedan en
  `mockVehiculoRepository`/`mockConductorRepository`** — no hay repository real que inyectar todavía
  (ver Why). Cuando `integracion-conductores-vehiculos` aterrice sus dos implementaciones, el mismo
  archivo vuelve a cambiar una línea cada uno — exactamente el comentario que
  `HojaDeRutaRoute.tsx` viene anunciando desde `hojas-de-ruta-ui`.
- **Dos funciones `SECURITY INVOKER`** (`pacientes.crear_hoja_de_ruta_completa`,
  `pacientes.actualizar_hoja_de_ruta_completa`): guardar una hoja de ruta escribe hasta 3 tablas
  (`hoja_de_ruta`, `recorrido`, `historial_recorridos`) y PostgREST no da transacción entre requests.
  **`SECURITY DEFINER` explícitamente prohibido**, mismo criterio que las cuatro funciones de
  `integracion-conductores-vehiculos` y las dos de `integracion-obra-social`.
- **El mock NO se borra**: `mockHojaDeRutaRepository` sigue como doble de test y para desarrollo sin
  las otras dos integraciones encima.
- **Se documentan discrepancias nuevas** (además de la ya conocida de `conductorId`) siguiendo la
  convención del proyecto: nota en `knowledge-base/04_modelo_de_datos.md` §Discrepancias, bullet en
  `CHANGES.md` §C-10, y `AvisoModeloDatos` en pantalla donde aplique. Ninguna se resuelve
  unilateralmente en código.

### Lo que este change explícitamente NO hace

- **No construye la pantalla** — ya existe (`hojas-de-ruta-ui`, `gateo-hojas-de-ruta`, los dos
  archivados).
- **No vuelve reales Vehículo ni Conductor.** Es el alcance de `integracion-conductores-vehiculos`,
  todavía sin repository escrito (ver Why). Este change deja el punto de inyección listo para que ese
  swap sea, otra vez, una línea por archivo.
- **No toca `pacientes.recorridos`** (la tabla del horario habitual recurrente del paciente,
  `dia_semana`/`hora` — es el "Recorridos" del docx, un concepto distinto de la "Hoja de Ruta"
  operativa del día que arma esta pantalla). Sigue como placeholder, sin consumidor.
- **No resuelve el geocoding real.** `ParadaRecorrido.coordenadaOrigen` sigue siendo un fixture del
  lado del cliente (`design.md` de `hojas-de-ruta-ui`, Decisión 6, ya lo dejó escrito: *"en este
  prototipo NO proviene de geocoding real"*). El repository real **no persiste coordenadas** — ver
  Checkpoint 2 de `design.md` para el efecto concreto sobre `RecorridoMapa`.
- **No introduce TanStack Query** ni toca `useHojasDeRuta`, `usePacientes`, `useVehiculos` ni
  `useConductores`.
- **No resuelve RN-VE-01/RN-VE-02 de nuevo.** Las funciones puras que validan compatibilidad de
  accesorios y excluyen vehículos fuera de servicio (`shared/lib/hojas-de-ruta/vehiculosCompatibles.ts`)
  ya existen y ya están testeadas — este change no las toca. Lo que sí cambia, y hay que decirlo, es
  que mientras Vehículo siga en mock **esas dos reglas siguen operando sobre datos fixture**, no sobre
  la flota real (ver Riesgos).

## Capabilities

### New Capabilities
- `hoja-de-ruta-repository-supabase`: implementación real de `HojaDeRutaRepository` contra dos tablas
  nuevas (`pacientes.hoja_de_ruta`, `pacientes.recorrido`) y una repropuesta
  (`pacientes.historial_recorridos` → paradas); reconstrucción del agregado
  `HojaDeRuta → Recorrido[] → ParadaRecorrido[]` en un embed de PostgREST; escritura atómica
  multi-tabla vía RPC `SECURITY INVOKER`; traducción de errores de PostgREST a castellano; inyección
  en el composition root junto al `PacienteRepository` real ya existente.

### Modified Capabilities
- `hoja-de-ruta-contract`: el requisito "implementación mock con persistencia en localStorage" cambia
  de estatus — el mock sigue existiendo pero deja de ser la implementación inyectada; el contrato de
  errores del repository pasa a ser **normativo** porque ahora hay dos implementaciones que deben
  coincidir.
- `armado-hoja-de-ruta` / `edicion-manual-recorridos`: los selectores de Vehículo y Conductor
  **siguen leyendo del mock** — se documenta explícitamente como limitación transitoria, no como
  comportamiento final, con `AvisoModeloDatos` en pantalla mientras dure.

## Impact

**Código nuevo**
- `frontend/src/shared/lib/hojas-de-ruta/hojaDeRutaMapping.ts` + `.test.ts`
- `frontend/src/shared/lib/hojas-de-ruta/SupabaseHojaDeRutaRepository.ts` + `.test.ts`

**Código modificado**
- `frontend/src/features/hojas-de-ruta/HojaDeRutaRoute.tsx` (**el swap parcial**: `HojaDeRuta` y
  `Paciente` reales, `Vehiculo`/`Conductor` siguen mock — documentado en el comentario del archivo)
- `frontend/src/features/hojas-de-ruta/HojaDeRutaRoute.test.tsx` (ajuste del doble inyectado)
- `frontend/src/features/hojas-de-ruta/HojaDeRutaPage.tsx` (`AvisoModeloDatos` adicional: selectores
  de vehículo/conductor sobre datos fixture mientras `integracion-conductores-vehiculos` no aterrice)

**Base de datos**
- Migración nueva (**expand aditivo**, nombre a definir por Enzo al aplicar): crea
  `pacientes.hoja_de_ruta` y `pacientes.recorrido` con RLS + policies bajo el módulo `hojas_de_ruta` +
  trigger de auditoría; agrega `recorrido_id`, `tramo`, `orden`, `hora_estimada` a
  `pacientes.historial_recorridos` (columnas nuevas, nada existente se altera ni se borra).
- Migración nueva: dos funciones `pacientes.crear_hoja_de_ruta_completa` /
  `pacientes.actualizar_hoja_de_ruta_completa`, `SECURITY INVOKER`.
- **Ninguna migración existente se edita. Ninguna migración se escribe ni se aplica en este propose**
  — es trabajo de `/opsx:apply`, y `supabase db push` lo corre la usuaria/Enzo, no el agente (mismo
  bloqueo que toda la serie: el sandbox no tiene Docker ni credenciales del proyecto real).

**Sin impacto**
- `HojaDeRutaRepository.ts` (la interfaz), `useHojasDeRuta.ts`, `HojaDeRutaRepositoryContext.tsx`,
  todos los componentes de armado/edición manual/vista global/impresión — sin cambios de forma.
- `pacientes.recorridos` (habitual) — placeholder, sigue sin consumidor.
- `mockVehiculoRepository`, `mockConductorRepository` — siguen siendo la implementación inyectada
  para esos dos dominios en esta pantalla, sin cambios de código.

**Dependencias**
- Requiere (ya cumplido): `C-01`, `C-02` + `auth-frontend-real`, `permisos-modulos-granulares` (creó
  el módulo `hojas_de_ruta`), `20260724100004_schema_pacientes.sql` y
  `20260724100006_schema_conductores.sql` aplicadas, `gateo-hojas-de-ruta` archivado.
- Requiere (ya cumplido): `integracion-pacientes` — reusa su `SupabasePacienteRepository` singleton.
- **No requiere que `integracion-conductores-vehiculos` esté terminado para aplicarse**, pero **sí
  limita lo que este change puede llamar "real"**: sin esa integración, Vehículo/Conductor siguen
  fixture. Es el Checkpoint 0 de `design.md` — la usuaria/Enzo deciden si eso es aceptable como
  primer corte o si prefieren bloquear hasta que aterrice.
- Habilita: `C-11` panel-principal-reportes (necesita `C-05`, `C-07`, `C-08`, `C-10`).

**Riesgo y rollback**
- Riesgo principal: **el schema de `recorrido`/`historial_recorridos` con `conductor_id` es una
  extensión sobre el docx**, no algo que el docx pida. `CHANGES.md` §C-10 ya lo señala como pendiente
  de coordinar con el dueño del docx antes de cerrar el esquema — este propose no lo cierra
  unilateralmente, lo deja como Checkpoint 1 bloqueante de `design.md`.
- Riesgo de negocio parcial: mientras Vehículo/Conductor sigan en mock, RN-VE-01 (compatibilidad de
  accesorios) y RN-VE-02 (exclusión de vehículo fuera de servicio) siguen operando sobre datos
  fixture — un vehículo real "fuera de servicio" no se excluye todavía de la hoja de ruta real.
  Mitigación: `AvisoModeloDatos` explícito en pantalla mientras dure, y no se presenta como
  comportamiento final.
- Riesgo operativo: si las migraciones no se aplican, el alta responde `PGRST202`/`PGRST205` y las
  columnas nuevas `PGRST204`. Mitigado: aplicarlas es tarea bloqueante del cableado, con mensaje
  propio en castellano para cada código.
- Riesgo de seguridad: si alguna de las dos funciones se convirtiera a `SECURITY DEFINER`, el gateo
  por módulo `hojas_de_ruta` quedaría bypasseado. Mitigado en las mismas cuatro capas que el resto de
  la serie (decisión escrita, cabecera de la migración, `COMMENT ON FUNCTION`, test que lee el `.sql`).
- **Rollback**: revertir `HojaDeRutaRoute.tsx` al mock completo (un import y una prop). Los archivos
  nuevos quedan inertes. Las migraciones son aditivas: `DROP FUNCTION` × 2 + `DROP TABLE recorrido,
  hoja_de_ruta` + `ALTER TABLE historial_recorridos DROP COLUMN` × 4 si se quisiera limpiar del todo.
  **Ningún dato existente se transforma ni se borra en ningún paso** (las dos tablas tocadas son
  placeholders sin filas).
