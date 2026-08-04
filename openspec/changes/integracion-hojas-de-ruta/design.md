## Context

**Estado actual del frontend.** Una feature completa y archivada en dos changes (`hojas-de-ruta-ui`
2026-07-25, `gateo-hojas-de-ruta` 2026-07-30), corriendo sobre **cuatro** repositorios mock a la vez:

| | Repository inyectado hoy | `SCHEMA_VERSION` | Real en algún lado del repo |
|---|---|---|---|
| Hoja de Ruta | `mockHojaDeRutaRepository` | 1 | ❌ no |
| Paciente (selector, solo lectura) | ~~mock~~ → ya es `supabasePacienteRepository` en `PacientesRoute.tsx`, pero `HojaDeRutaRoute.tsx` sigue inyectando `mockPacienteRepository` | — | ✅ sí, `SupabasePacienteRepository.ts` |
| Vehículo (selector, solo lectura) | `mockVehiculoRepository` | 4 | ❌ no |
| Conductor (selector, solo lectura) | `mockConductorRepository` | 3 | ❌ no |

`HojaDeRutaRepository` (`frontend/src/shared/lib/hojas-de-ruta/HojaDeRutaRepository.ts`) es la única
interfaz de esta feature: `list`/`getById`/`getByFecha`/`create`/`update`. **No hay repository de
Recorrido aparte** — el propio archivo lo dice: *"Los `Recorrido` viven embebidos en la `HojaDeRuta`
(agregado del día) — no hay un repository de recorridos aparte"*. Este change respeta esa forma: el
repository real sigue devolviendo el agregado completo, la persistencia interna en 2-3 tablas es un
detalle del mapeo, invisible para quien consume la interfaz.

**Estado real del backend — verificado contra la base en vivo (`supabase db query --linked`), no
contra las migraciones a ojo.**

```sql
-- Existe hoy, verificado por information_schema.tables:
pacientes.recorridos            (id, paciente_id FK, id_dir_inicial FK, id_dir_final FK,
                                 dia_semana TEXT, hora TIME)
                                 -- "Recorridos" del docx: horario HABITUAL recurrente del
                                 -- paciente. Sin vehículo, sin conductor. Placeholder: cero
                                 -- referencias en frontend/src/shared/lib/pacientes/.

pacientes.historial_recorridos  (id, paciente_id FK, fecha DATE, id_vehiculo UUID NULL FK,
                                 id_dir_inicial FK, id_dir_final FK, estado TEXT)
                                 -- "Historial de Recorridos" del docx: viaje EFECTIVAMENTE
                                 -- realizado. Tiene vehículo, NO tiene conductor. Placeholder
                                 -- también: mismo grep, cero hits salvo el mensaje de error de
                                 -- ON DELETE RESTRICT en SupabasePacienteRepository.ts.

-- NO existe ninguna tabla hoja_de_ruta, en ningún schema (confirmado con
-- information_schema.tables filtrando table_name ilike '%hoja%' — cero filas).
```

Las cuatro policies de las dos tablas (`pg_policies.qual`, leído en vivo) usan
`modulos.tiene_permiso('hojas_de_ruta'::text, …)` — **no** `'pacientes'`. El módulo `hojas_de_ruta`
existe como fila propia en `modulos.modulos` desde `20260730140000_split_modulos_permisos.sql`, que
además dejó comentado en el propio SQL: *"pacientes → hojas_de_ruta (pacientes.recorridos,
pacientes.historial_recorridos)"*. `frontend/src/app/routes.ts:83-93` ya está alineado
(`modulo: 'hojas_de_ruta'`, con un comentario que cita esa misma migración). No hay nada que corregir
acá — este change hereda el módulo `hojas_de_ruta` para las dos tablas nuevas y para las columnas que
suma a `historial_recorridos`, por consistencia con sus dos vecinas.

`supabase migration list --linked` confirma `local == remote` en las 31 migraciones — sin desfasaje de
historial, a diferencia de lo que `integracion-pacientes` tuvo que resolver en su momento.

**Las dos "primas" reales de la serie no están listas — verificado, no asumido.**
`openspec/changes/integracion-conductores-vehiculos/` tiene `proposal.md` + `design.md` (1220 líneas,
9 decisiones) completos, pero:

- `find . -iname "SupabaseVehiculoRepository*" -o -iname "SupabaseConductorRepository*"` no devuelve
  ningún archivo de producción — solo las specs de ese change
  (`openspec/changes/integracion-conductores-vehiculos/specs/{vehiculo,conductor}-repository-supabase/`)
  y dos módulos de mapeo preparatorios (`vehiculoMapping.ts`, `conductorMapping.ts`,
  `semanaIso.ts`) que **nadie importa todavía** (§4 de ese `tasks.md`, sin marcar).
- `VehiculosRoute.tsx` y `ConductoresRoute.tsx` siguen inyectando sus mocks — grep directo, sin
  ambigüedad.
- `CHANGES.md` fila 3 del plan de integración lo confirma en prosa: *"reconciliado (2026-08-01),
  bloqueado en 1 gap"* — Vehículos bloqueado por una decisión de fuente de datos de mantenimientos
  pendiente de Enzo; Conductores bloqueado porque la migración
  `20260801120000_conductores_vehiculos_campos.sql` que ese `design.md` planeaba **nunca se
  escribió** (el timestamp lo ocupó `seed_obras_sociales_prestadores.sql`, una migración no
  relacionada — confirmado leyendo el directorio).

Esto **no es un bloqueo de este change**, pero sí una restricción real sobre qué tan "real" puede
declararse: ver Checkpoint 0.

**Referencia de patrón.** Mismo molde que las cuatro implementaciones reales anteriores
(`integracion-pacientes`, `integracion-obra-social`, y los dos repositories todavía en curso de
`integracion-conductores-vehiculos`): mapeo puro separado del I/O, embeds de PostgREST en una sola
consulta, escritura multi-tabla atómica vía RPC **`SECURITY INVOKER`**, traducción de errores a
castellano, discrepancias documentadas por triplicado en vez de resueltas a dedo.

**Restricciones duras del proyecto** (`CLAUDE.md`): nada de `any` (usar `unknown` + narrowing); solo
utilidades Tailwind v4; reusar `design-system/components.tsx`; `anon key` únicamente, nunca
`service_role`; toda tabla nueva define su RLS en el mismo change; `npx tsc -b --noEmit` como único
type-check válido; Conventional Commits; el docx manda en estructura y la KB en reglas de negocio,
discrepancias documentadas en los dos lugares y con `AvisoModeloDatos`, nunca resueltas adivinando.

**Governance: ALTO** (`CHANGES.md` §C-10). Siguiendo el mismo mecanismo que
`integracion-conductores-vehiculos` (también ALTO): **este propose no escribe código**. Las tres
decisiones de abajo (Checkpoints 0, 1 y 2) quedan a revisión de la usuaria/Enzo **antes** de que
`/opsx:apply` toque un archivo. A diferencia de la ceremonia CRÍTICO de `integracion-facturacion`
(que exige aprobación humana explícita documentada antes de cada tarea de escritura), acá alcanza con
que los tres checkpoints queden resueltos en la tarea `0.1` de `tasks.md` — mismo nivel de rigor que
usó `integracion-conductores-vehiculos` para sus checkpoints D3/D5/D6.

---

## Goals / Non-Goals

**Goals**

- Que `HojaDeRutaRepository` tenga una implementación real contra Postgres, cumpliendo la interfaz
  **al pie de la letra** (mismas firmas, misma semántica de `null` en `getById`/`getByFecha`, misma
  forma de error) — el resto de la feature (hooks, componentes, `HojaDeRutaPage`) no cambia de forma.
- Darle su primer uso real a `pacientes.historial_recorridos`, hoy un placeholder sin ningún
  consumidor.
- Reusar el `PacienteRepository` real ya existente en la misma pantalla, sin reinventar nada.
- Dejar explícito y visible (nunca implícito) que Vehículo y Conductor siguen sobre datos fixture en
  esta pantalla, y por qué.
- Cerrar (o al menos poner fecha a) la discrepancia de `conductorId` que `CHANGES.md` §C-10 viene
  arrastrando desde el 2026-07-25.
- Aislar todo el mapeo en funciones puras testeables sin red; el repository queda como cáscara
  delgada de I/O.

**Non-Goals**

- **No se construye la pantalla** — ya existe.
- **No se integra Vehículo ni Conductor.** Es `integracion-conductores-vehiculos`, con su propio
  propose ya escrito y sin apply. Este change dejar el punto de inyección listo (`HojaDeRutaRoute.tsx`)
  para que ese swap sea mecánico cuando aterrice.
- **No se resuelve el geocoding real** de `ParadaRecorrido.coordenadaOrigen`. Sigue siendo fixture del
  lado del cliente — este change ni lo persiste ni lo deriva del backend (Checkpoint 2).
- **No se toca `pacientes.recorridos`** (horario habitual) — es un concepto distinto (agenda recurrente
  vs. hoja de ruta operativa del día) y no tiene consumidor en ninguna pantalla hoy.
- **No se re-implementan las reglas puras ya testeadas** (`vehiculosCompatibles.ts`,
  `ordenarRecorridosPorHorario.ts`, `pacienteDisponibleEnRecorrido.ts`) — siguen intocadas, y su
  correctness no depende de si sus datos de entrada vienen de mock o de Postgres.
- **No se introduce TanStack Query.**
- **No se decide el geocoding real ni el nivel de integración con Google Maps/Geometry API más allá
  de lo que ya hace `RecorridoMapa`** — está fuera del scope de "conectar el repository", y
  `knowledge-base/10_preguntas_abiertas.md` ya tiene abierta, con prioridad Media, el alcance exacto de
  RF-701 (sugerencia de orden por cercanía).

---

## Checkpoint 0 — ¿Swap parcial ahora, o bloquear hasta que Vehículo/Conductor estén reales?

**El problema.** `CHANGES.md` declara `C-10` dependiente de `C-08 ✓` y `C-09 ✓` a nivel de *schema*
(cumplido) pero la lectura implícita de "dependencia cumplida" en el resto de la serie siempre fue
"repository real disponible" — y eso, para Vehículo y Conductor, **no está cumplido** (ver Context).

| Opción | Qué implica | Riesgo |
|---|---|---|
| **A. Swap parcial** — `HojaDeRuta` y `Paciente` reales, `Vehículo`/`Conductor` siguen mock | Este change avanza ya, sin esperar a `integracion-conductores-vehiculos`. `HojaDeRutaRoute.tsx` queda con tres imports reales y dos mock, documentado en el propio comentario del archivo | RN-VE-01/RN-VE-02 siguen validando contra flota fixture en la pantalla real de armado. Un vehículo real "fuera de servicio" hoy **no** se excluiría de una hoja de ruta ya persistida en Postgres |
| B. Bloquear este change hasta que `integracion-conductores-vehiculos` aterrice sus dos repositories | Ningún riesgo de validar contra datos fixture en una pantalla con datos reales | Encadena `C-10` a un change que hoy está bloqueado por una decisión de Enzo (fuente de mantenimientos) sin fecha. `pacientes.historial_recorridos` sigue de placeholder más tiempo |

**Recomendación de este propose: A.** Es coherente con el patrón ya establecido por **todos** los
`*Route.tsx` de la serie (*"este es el único archivo que cambia"*) — nada impide que ese único archivo
cambie en dos tiempos, una vez por cada repository que se vuelve real. `integracion-obra-social` D3
tiene el mismo patrón de precedente parcial (Obra Social pasó a real antes de que Facturación lo
hiciera, y las dos convivieron con datos mixtos documentados). **No es la decisión final de este
documento** — es la recomendación que la usuaria/Enzo deben confirmar o revertir en la tarea `0.1` de
`tasks.md`, antes de que `/opsx:apply` escriba código.

---

## Checkpoint 1 — Esquema de `hoja_de_ruta` / `recorrido`: tablas nuevas vs. repropuesta de `historial_recorridos`, y el `conductor_id`

**El problema, en dos partes.**

*Parte A — dónde vive el agregado.* El docx no tiene entidad "Hoja de Ruta": tiene "Recorridos"
(agenda habitual) e "Historial de Recorridos" (viaje realizado, sin conductor) — `CHANGES.md` §C-10 ya
lo señala como discrepancia central, pendiente desde el 2026-07-25. Dos caminos:

| Opción | Forma | A favor | En contra |
|---|---|---|---|
| **A. Repropuesta de `historial_recorridos` como paradas + dos tablas nuevas de agrupación** ✅ propuesta de este documento | `pacientes.hoja_de_ruta` (nueva) `1---N` `pacientes.recorrido` (nueva, con `conductor_id`) `1---N` `pacientes.historial_recorridos` (expand: `+recorrido_id, +tramo, +orden, +hora_estimada`) | Le da su primer uso a una tabla que ya tiene exactamente la forma de una parada (`paciente_id`, `id_dir_inicial`, `id_dir_final`, `id_vehiculo`) y que hoy es placeholder puro — cero riesgo de romper un consumidor porque no hay ninguno. Menos tablas nuevas, más alineado al espíritu "expand aditivo" de toda la serie | El nombre `historial_recorridos` deja de describir bien la tabla una vez que pasa a ser "paradas de la hoja de ruta de hoy", no solo historial. Es un costo cosmético, no funcional — se documenta con un comentario `COMMENT ON TABLE` |
| B. Tres tablas 100% nuevas (`hoja_de_ruta`, `recorrido`, `parada_recorrido`), `historial_recorridos` queda intacta y sin tocar | Nombres que describen exactamente lo que son, sin herencia de una tabla pensada para otra cosa | Deja **dos** tablas placeholder sin uso (`historial_recorridos` y ahora la vieja quedaría todavía más huérfana) en vez de una (`pacientes.recorridos`, la de agenda habitual, que sigue igual en ambas opciones). Más superficie de schema para un dominio que el docx ya no modela bien |

*Parte B — `conductor_id`, el punto que `CHANGES.md` deja pendiente de coordinar con el dueño del docx
"antes de cerrar el esquema de las tablas `hoja_de_ruta`/`recorrido`"*. La decisión **ya está tomada
del lado frontend** desde `hojas-de-ruta-ui` (Decisión 2 de ese `design.md`): `RN-VE-01`/`RN-VE-02`,
`US-700` y `07_flujos_principales.md §Flujo 2` exigen poder agrupar y auditar por conductor, y sin el
campo el sistema no podría decir qué chofer hizo cada viaje. **Este propose hereda esa decisión y
propone `recorrido.conductor_id NOT NULL REFERENCES conductores.conductores(id)`** — es la misma
resolución que ya está viva en el tipo `Recorrido` del frontend, y negarla en el esquema real dejaría
la UI escribiendo un dato que la base no tiene dónde guardar. **Pero sigue siendo, formalmente, una
discrepancia contra el docx que no se resuelve adivinando**: queda anotada en
`knowledge-base/04_modelo_de_datos.md` §Discrepancias como resuelta con nota de decisión, no como
cerrada por default.

**Recomendación de este propose: A + `conductor_id NOT NULL`.** Confirmar en `tasks.md` 0.1 antes de
escribir una sola migración.

**Esquema propuesto** (si se confirma la opción A):

```sql
CREATE TABLE pacientes.hoja_de_ruta (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fecha          DATE NOT NULL,
    franja_inicio  TIME NOT NULL,
    franja_fin     TIME NOT NULL,
    notas          TEXT,
    UNIQUE (fecha)   -- HojaDeRutaRepository.getByFecha asume una sola hoja por día
);

CREATE TABLE pacientes.recorrido (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hoja_de_ruta_id UUID NOT NULL REFERENCES pacientes.hoja_de_ruta(id) ON DELETE CASCADE,
    vehiculo_id    UUID NOT NULL REFERENCES conductores.vehiculo(id) ON DELETE RESTRICT,
    conductor_id   UUID NOT NULL REFERENCES conductores.conductores(id) ON DELETE RESTRICT,
    manual         BOOLEAN NOT NULL DEFAULT false,
    notas          TEXT
);

-- Expand aditivo sobre la tabla existente, ninguna columna se toca:
ALTER TABLE pacientes.historial_recorridos
  ADD COLUMN recorrido_id   UUID REFERENCES pacientes.recorrido(id) ON DELETE CASCADE,
  ADD COLUMN tramo          TEXT CHECK (tramo IN ('ida', 'vuelta')),
  ADD COLUMN orden          INTEGER,
  ADD COLUMN hora_estimada  TIME;

COMMENT ON TABLE pacientes.historial_recorridos IS
  'Filas con recorrido_id NOT NULL son paradas de una hoja de ruta armada (C-10). El uso '
  'original de "historial" (fecha + vehículo + estado, sin agrupar) queda disponible para '
  'quien lo necesite, pero no tiene consumidor hoy.';
```

*Por qué `id_vehiculo` no se dropea aunque ahora sea redundante con `recorrido.vehiculo_id`:* la
regla dura del proyecto es aditiva, nunca se borra una columna existente en un change de integración.
La función `crear_/actualizar_hoja_de_ruta_completa` la mantiene sincronizada con
`recorrido.vehiculo_id` en cada escritura (mismo vehículo, nunca diverge) — ver D3.

*Por qué `vehiculo_id`/`conductor_id` son `ON DELETE RESTRICT` y no `CASCADE`:* borrar un vehículo o
un conductor no debería poder arrastrar el historial de a quién se le asignó — mismo criterio que
`recorridos_id_dir_inicial_fkey`/`…_final_fkey` ya usan contra `direcciones`.

---

## Checkpoint 2 — `coordenadaOrigen` no se persiste: `RecorridoMapa` puede quedar sin datos

**El problema.** `ParadaRecorrido.coordenadaOrigen` es, por diseño (`hojas-de-ruta-ui` Decisión 6,
ya decidida y no se reabre acá), un fixture del lado del cliente — nunca vino de geocoding real. El
repository real de este change **no tiene de dónde sacar una coordenada**: ni `pacientes.direcciones`
ni la migración propuesta arriba tienen columnas `lat`/`lng`. Consecuencia directa y no obvia: en
cuanto `HojaDeRutaRoute.tsx` inyecte el repository real, **toda parada que venga de Postgres llega sin
`coordenadaOrigen`**, y `RecorridoMapa.tsx` (que ya filtra `paradas.filter(p => p.coordenadaOrigen !==
undefined)`) va a mostrar el estado "No hay paradas con coordenadas para mostrar en el mapa todavía"
para el 100% de las hojas de ruta reales — una regresión silenciosa de una funcionalidad que hoy
funciona (sobre fixtures) y después de este change deja de mostrar nada.

**Opciones:**

| Opción | Qué hace | Costo |
|---|---|---|
| **A. Aceptar la regresión, documentada** ✅ recomendada | El mapeo real deja `coordenadaOrigen` como `undefined` siempre; `RecorridoMapa` sigue funcionando (muestra su estado vacío, ya contemplado) pero deja de tener contenido útil sobre datos reales | Cero trabajo nuevo. Pierde valor de producto (el mapa deja de mostrar algo), pero no rompe nada — es exactamente la superficie que `hojas-de-ruta-ui` ya dejaba fuera de scope ("geocoding real... lo resuelve el backend C-10 en producción") |
| B. Agregar geocoding real en este change (columnas `lat`/`lng` en `direcciones`, integración con la API de Geocoding de Google) | El mapa vuelve a mostrar contenido con datos reales | Expande el scope de "conectar un repository" a "integrar una API externa nueva de geocoding" — no es lo que pide este propose ni lo que `CHANGES.md` §C-10 scopea (que solo menciona Geometry API para *sugerencia de orden*, no geocoding de direcciones) |

**Recomendación de este propose: A**, con un `AvisoModeloDatos` propio en `RecorridoMapa` (o en su
contenedor) que explique por qué el mapa está vacío para hojas de ruta reales, en vez de dejar el
estado vacío genérico sin contexto. Confirmar en `tasks.md` 0.1 — es una regresión de UX real y debe
quedar decidida, no descubierta en QA.

---

## Decisions

### D1 — Dos archivos nuevos: mapeo puro + repository

```
shared/lib/hojas-de-ruta/
  hojaDeRutaMapping.ts           parseHojaDeRutaRow, parseRecorridoRow, parseParadaRow,
                                  ensamblarHojaDeRuta, toCrearHojaDeRutaPayload,
                                  toActualizarHojaDeRutaPayload
  SupabaseHojaDeRutaRepository.ts
```

Mismo criterio que las cuatro implementaciones anteriores de la serie: el repository solo hace
`await`, chequea `error` y llama a las funciones puras. El mapeo no es trivial — reconstruye tres
niveles de agregado (`HojaDeRuta → Recorrido[] → ParadaRecorrido[]`) desde un único embed de
PostgREST, y `tramo`/`orden` no existían como concepto antes de este change.

### D2 — Orden del swap: `HojaDeRutaRepository` y reuso de `Paciente` primero; Vehículo/Conductor quedan para su propio change

```
§2  mapeo + repository de Hoja de Ruta (nadie los importa todavía)
§3  swap de HojaDeRutaRoute.tsx: HojaDeRuta real + Paciente real (reuso del singleton existente)
    ← corte real, Vehículo/Conductor siguen mock, documentado en el propio archivo
§4  AvisoModeloDatos nuevo en HojaDeRutaPage / RecorridoMapa (Checkpoint 2)
```

No hay una fase "§5 swap de Vehículo/Conductor" en este change — eso es
`integracion-conductores-vehiculos`. Cuando aterrice, el único trabajo pendiente en esta feature es
cambiar dos imports en `HojaDeRutaRoute.tsx`, sin tocar `HojaDeRutaPage` ni el repository de Hoja de
Ruta.

### D3 — Escritura atómica: dos funciones `SECURITY INVOKER`

**El problema.** Guardar una hoja de ruta escribe hasta 3 tablas
(`pacientes.hoja_de_ruta`, `pacientes.recorrido`, `pacientes.historial_recorridos`). PostgREST no da
transacciones entre requests.

```
pacientes.crear_hoja_de_ruta_completa(p_hoja jsonb)               RETURNS uuid
pacientes.actualizar_hoja_de_ruta_completa(p_id uuid, p_cambios jsonb) RETURNS uuid
```

**Semántica de colecciones: reemplazo completo, no diff** — mismo criterio que
`integracion-obra-social` D6 y `integracion-conductores-vehiculos` D9: ningún id de `recorrido` ni de
`historial_recorridos` (como parada) es referenciado desde afuera del agregado, así que `DELETE` +
`INSERT` dentro de la transacción es seguro y simple. `create()`/`update()` releen con `getById`
después de escribir, para que lo devuelto sea siempre lo que quedó realmente en la base.

**`id_vehiculo` de `historial_recorridos` se mantiene sincronizado con `recorrido.vehiculo_id` dentro
de la misma función** — nunca puede divergir porque la única vía de escritura es esta RPC.

**`SECURITY INVOKER`, no `SECURITY DEFINER`** — mismo requisito duro que toda la serie: `SET
search_path = ''`, `REVOKE ALL … FROM PUBLIC, anon`, `GRANT EXECUTE … TO authenticated`, `COMMENT ON
FUNCTION` con la prohibición escrita, y el mismo test automatizado que lee el `.sql` con `node:fs`
para verificar que ninguna de las dos funciones se declaró `DEFINER`.

### D4 — Códigos de error propios (clase `45`)

| Código | Cuándo | Mensaje de UI |
|---|---|---|
| `45301` | `p_hoja` no es un objeto JSON | `No se pudo guardar la hoja de ruta.` (genérico, bug de cliente) |
| `45302` | `actualizar_…` con un id que no existe (o que RLS oculta) | `No existe una hoja de ruta con id "…".` (idéntico al mensaje del mock) |
| `45303` | ya existe una hoja de ruta para esa `fecha` (viola el `UNIQUE`) en un `crear_…` | `Ya existe una hoja de ruta para esa fecha.` |
| `45304` | un `recorrido` llega sin `vehiculo_id` o `conductor_id` resoluble | `Revisá el vehículo y el conductor del recorrido.` |

### D5 — RLS: mismo módulo `hojas_de_ruta` que las dos tablas vecinas, mismas cuatro policies

```sql
ALTER TABLE pacientes.hoja_de_ruta ENABLE ROW LEVEL SECURITY;
ALTER TABLE pacientes.recorrido ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read hoja_de_ruta" ON pacientes.hoja_de_ruta FOR SELECT TO authenticated USING (modulos.tiene_permiso('hojas_de_ruta', 'read'));
CREATE POLICY "Write hoja_de_ruta" ON pacientes.hoja_de_ruta FOR ALL TO authenticated USING (modulos.tiene_permiso('hojas_de_ruta', 'write'));
CREATE POLICY "Read recorrido" ON pacientes.recorrido FOR SELECT TO authenticated USING (modulos.tiene_permiso('hojas_de_ruta', 'read'));
CREATE POLICY "Write recorrido" ON pacientes.recorrido FOR ALL TO authenticated USING (modulos.tiene_permiso('hojas_de_ruta', 'write'));

CREATE TRIGGER trg_audit_hoja_de_ruta AFTER INSERT OR UPDATE OR DELETE ON pacientes.hoja_de_ruta FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
CREATE TRIGGER trg_audit_recorrido AFTER INSERT OR UPDATE OR DELETE ON pacientes.recorrido FOR EACH ROW EXECUTE FUNCTION auditoria.log_action();
```

`historial_recorridos` ya tiene RLS + trigger de auditoría desde `20260724100004_schema_pacientes.sql`
— las columnas nuevas de la Parte A del Checkpoint 1 quedan cubiertas por las policies existentes, sin
nada que agregar.

**Índices**: `recorrido.hoja_de_ruta_id`, `recorrido.vehiculo_id`, `recorrido.conductor_id`,
`historial_recorridos.recorrido_id` — las cuatro FK nuevas, para que el embed de un solo `select` no
dependa de un seq scan.

### D6 — Degradación mientras Vehículo/Conductor sigan en mock (Checkpoint 0, opción A)

El repository real de Hoja de Ruta **no sabe nada** de si Vehículo/Conductor son mock o reales — esa
frontera la resuelve `HojaDeRutaRoute.tsx`, no el repository. Lo único que cambia en el repository es
que `recorrido.vehiculo_id`/`conductor_id` van a ser ids que **no necesariamente existen** en el mock
de Vehículo/Conductor durante esta fase transitoria (son ids reales de Postgres, y el selector de la
UI los ofrece desde `mockVehiculoRepository`/`mockConductorRepository`, que tiene sus propios ids
`generateId('vehiculo')` fixture). **Esto es una inversión del problema que ya identificó y documentó
`integracion-conductores-vehiculos` D2** para su propio corte transitorio (Vehículos real,
Conductores todavía mock) — acá el mismatch es al revés: Hoja de Ruta real, Vehículo/Conductor
todavía mock, y el selector de la UI **no puede ofrecer ids reales de la tabla `conductores.vehiculo`
hasta que ese swap aterrice**. Consecuencia práctica y explícita: **hasta que
`integracion-conductores-vehiculos` aterrice, el selector de vehículo/conductor de
`NuevoRecorridoForm` sigue mostrando la flota fixture, y guardar un recorrido nuevo contra Postgres
falla con la FK si se intentara usar un id que no corresponde a una fila real** — por eso el
`AvisoModeloDatos` del Checkpoint 0/2 tiene que ser explícito sobre esto, no cosmético. La opción **B**
del Checkpoint 0 evita este problema por completo esperando a que la otra integración aterrice
primero; la opción **A** lo acepta como limitación temporal y documentada.

---

## Open Questions

- **RF-701 (`10_preguntas_abiertas.md`, prioridad Media)**: el alcance exacto del ordenamiento por
  cercanía sigue sin cerrar con el cliente. No bloquea este change (la sugerencia ya es
  100% cliente, sin tocar backend) pero queda anotado para quien lo resuelva.
- Si la usuaria confirma Checkpoint 0 opción **B** (bloquear), este `design.md` necesita una revisión
  de D2/D6 antes de `/opsx:apply` — quedan escritos acá los dos caminos para no tener que rehacer el
  análisis desde cero.
- Si la usuaria prefiere Checkpoint 1 opción **B** (tablas 100% nuevas, sin tocar
  `historial_recorridos`), D3/D5 cambian de nombre de tabla pero no de forma — el ajuste es mecánico.
