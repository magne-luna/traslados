# Tasks — integracion-hojas-de-ruta

> **⚠️ STRICT TDD ACTIVO.** Este proyecto tiene `testing.strict_tdd: true` en `openspec/config.yaml`.
> Toda tarea que escriba código de producción se implementa con el ciclo
> **RED → GREEN → TRIANGULATE → REFACTOR**, y **antes** de modificar cualquier archivo existente se
> corre el safety net (`cd frontend && npx vitest run`) y se registra el baseline. Test runner:
> `cd frontend && npx vitest run`.
>
> **⚠️ GOVERNANCE ALTO — tres checkpoints bloqueantes, ninguno resuelto todavía.** A diferencia de
> `integracion-conductores-vehiculos` (cuyos checkpoints D3/D5/D6 ya están resueltos por la usuaria),
> los tres de `design.md` de **este** change siguen abiertos: **Checkpoint 0** (swap parcial vs.
> bloquear hasta que `integracion-conductores-vehiculos` aterrice), **Checkpoint 1** (esquema —
> repropuesta de `historial_recorridos` vs. tablas 100% nuevas, y confirmación de `conductor_id`) y
> **Checkpoint 2** (aceptar que `RecorridoMapa` queda sin coordenadas sobre datos reales). Ninguna
> tarea de la §2 en adelante corre sin que la usuaria/Enzo resuelvan los tres.
>
> **⚠️ Las migraciones NO las escribe ni las aplica el agente en este propose.** Este documento es
> **propose-only**: no se escribe código de producción, no se escribe SQL, no se corre `supabase db
> push`. Las migraciones se escriben y aplican recién en `/opsx:apply`, después de que los tres
> checkpoints estén resueltos, y las aplica la usuaria/Enzo — el sandbox no tiene Docker ni
> credenciales del proyecto real (mismo bloqueo que toda la serie).
>
> **Reglas duras aplicables** (`CLAUDE.md`): nunca `any` (usar `unknown` + narrowing); nunca
> `style={{}}` (solo utilidades Tailwind v4); reusar `frontend/src/design-system/components.tsx`;
> nunca `SUPABASE_SERVICE_ROLE_KEY` en frontend; toda tabla nueva define su RLS en el mismo change;
> type-check con `npx tsc -b --noEmit` (nunca `tsc --noEmit` a secas); Conventional Commits; el docx
> manda en estructura, la KB en reglas de negocio, discrepancias documentadas en los dos lugares y
> nunca resueltas adivinando.

## 0. Checkpoint de diseño (antes de escribir código) — GOVERNANCE ALTO

- [x] 0.1 Presentar a la usuaria/Enzo los tres checkpoints de `design.md` con su trade-off escrito, y
      registrar el veredicto de cada uno en este archivo antes de continuar:
      - **Checkpoint 0** — ¿swap parcial ahora (`HojaDeRuta` + `Paciente` reales, `Vehículo`/
        `Conductor` siguen mock, recomendado) o bloquear este change hasta que
        `integracion-conductores-vehiculos` tenga sus dos repositories reales?
        **→ VEREDICTO (2026-08-04, usuaria/Enzo): OPCIÓN A — swap parcial ahora.** HojaDeRuta +
        Paciente reales; Vehículo/Conductor siguen mock hasta que aterrice
        `integracion-conductores-vehiculos`.
      - **Checkpoint 1** — ¿repropuesta de `pacientes.historial_recorridos` como paradas + dos tablas
        nuevas de agrupación (recomendado), o tres tablas 100% nuevas sin tocar
        `historial_recorridos`? Y, dentro de esto: ¿confirmar `recorrido.conductor_id NOT NULL`
        (hereda la decisión ya tomada del lado frontend en `hojas-de-ruta-ui`, pendiente de
        coordinar con el dueño del docx desde `CHANGES.md` §C-10)?
        **→ VEREDICTO (2026-08-04, usuaria/Enzo): OPCIÓN A — repropuesta de
        `historial_recorridos` como paradas + dos tablas nuevas de agrupación.** `conductor_id
        NOT NULL` se mantiene como decidido del lado frontend; la coordinación con el dueño del
        docx queda como tarea abierta (7.4).
      - **Checkpoint 2** — ¿aceptar que `RecorridoMapa` quede sin coordenadas para toda hoja de ruta
        real (recomendado, con `AvisoModeloDatos` explicando por qué), o expandir el scope de este
        change para incluir geocoding real?
        **→ VEREDICTO (2026-08-04, usuaria/Enzo): OPCIÓN A — sin geocoding por ahora.**
        `RecorridoMapa` queda sin coordenadas sobre datos reales, con `AvisoModeloDatos`
        explicando que es por diseño.
- [ ] 0.2 Confirmar contra el filesystem del repo (no contra la memoria de una sesión anterior) que
      `integracion-conductores-vehiculos` sigue sin `SupabaseVehiculoRepository.ts` ni
      `SupabaseConductorRepository.ts` en `frontend/src/shared/lib/{vehiculos,conductores}/` al
      momento de arrancar el apply — si para entonces ya aterrizaron, el Checkpoint 0 puede
      resolverse distinto (swap completo de los tres repositories a la vez) y este documento necesita
      un ajuste antes de continuar.
- [ ] 0.3 Verificar el estado del historial de migraciones contra el remoto
      (`supabase migration list --linked`) inmediatamente antes de escribir la primera migración
      nueva — confirmar que sigue en `local == remote` (era así el 2026-08-04) y que ningún timestamp
      planeado en `design.md` Checkpoint 1 colisiona con una migración que haya aparecido desde
      entonces (mismo tipo de colisión que ya le pasó al timestamp que
      `integracion-conductores-vehiculos` tenía planeado para `conductores_vehiculos_campos.sql`).
- [ ] 0.4 Correr `cd frontend && npx vitest run` y registrar el baseline exacto (tests passing/
      failing, archivos en verde) antes de tocar cualquier archivo existente.

## 1. Precondiciones del backend (verificar, no modificar)

- [ ] 1.1 Verificar que el schema `pacientes` sigue en *Exposed schemas* del Data API (ya lo confirmó
      `integracion-pacientes` 1.2, reconfirmar que no cambió) y que `conductores` también lo está (lo
      necesitan las FK de `recorrido.vehiculo_id`/`conductor_id`, ya confirmado por
      `integracion-conductores-vehiculos` 1.1 — reconfirmar).
- [ ] 1.2 Confirmar en vivo, con `select conname, pg_get_constraintdef(oid) from pg_constraint where
      conrelid = 'pacientes.historial_recorridos'::regclass`, que la forma de la tabla sigue siendo la
      documentada en `design.md` Context antes de escribir el `ALTER TABLE` — por si alguna migración
      posterior a este propose ya la tocó.
- [ ] 1.3 Confirmar en vivo que el módulo `hojas_de_ruta` sigue existiendo en `modulos.modulos` y que
      las cuatro policies de `pacientes.recorridos`/`historial_recorridos` lo siguen usando (`select
      policyname, qual from pg_policies where tablename in ('recorridos','historial_recorridos')`) —
      es el hecho central del que depende D5 de `design.md`.
- [ ] 1.4 Si el Checkpoint 0 se resolvió por la opción B (bloquear), verificar el estado de
      `integracion-conductores-vehiculos` antes de continuar cualquier tarea de esta sección — no
      tiene sentido avanzar si sigue bloqueado.

## 2. `HojaDeRutaRepository` real — mapeo puro

- [x] 2.1 (RED) Tests de `hojaDeRutaMapping.ts`: `parseHojaDeRutaRow`, `parseRecorridoRow`,
      `parseParadaRow` contra filas de forma conocida (según el veredicto del Checkpoint 1), con casos
      de fila malformada (campo `null` donde el tipo del dominio no lo admite) que **descartan la fila
      hija sin romper el agregado completo** — mismo criterio que el mapeo de Pacientes con
      colecciones hijas.
- [x] 2.2 (GREEN) Implementar las tres funciones de parseo.
- [x] 2.3 (RED→GREEN) `ensamblarHojaDeRuta(hojaRow, recorridoRows, paradaRows): HojaDeRuta` —
      reconstruye el agregado de tres niveles agrupando por `hoja_de_ruta_id` y `recorrido_id`.
- [x] 2.4 (RED→GREEN) `toCrearHojaDeRutaPayload` / `toActualizarHojaDeRutaPayload` — dominio → jsonb
      para las dos RPC de `design.md` D3. Verificar explícitamente el caso `Partial` de
      `ActualizacionHojaDeRuta`: ausencia de `recorridos` en el payload significa "no tocar", no
      "vaciar" — mismo tipo de trampa que `integracion-conductores-vehiculos` D9 documentó y testeó.
- [x] 2.5 Triangular con al menos dos hojas de ruta de distinta forma (una con un solo recorrido y una
      parada, otra con dos recorridos y paradas ida+vuelta del mismo paciente en el mismo recorrido —
      caso ya cubierto por `pacienteDisponibleEnRecorrido.ts`, verificar que el mapeo no lo rompe).

## 3. `HojaDeRutaRepository` real — repository e I/O

- [x] 3.1 (RED) Tests de `SupabaseHojaDeRutaRepository.ts` con un fake tipado del cliente de Supabase
      (mismo patrón que las cuatro implementaciones anteriores de la serie — nunca golpear la red real
      en un test).
- [x] 3.2 (GREEN) Implementar `list`/`getById`/`getByFecha`/`create`/`update` cumpliendo
      `HojaDeRutaRepository` sin cambiar una firma.
- [x] 3.3 Traducir los cuatro códigos de error de `design.md` D4 (`45301`-`45304`) más los genéricos de
      PostgREST (`PGRST204`/`PGRST202`/`42501`) a mensajes en castellano, con test dedicado por código.
- [x] 3.4 Verificar que `getByFecha` sigue resolviendo `null` (no lanza) cuando no hay hoja para esa
      fecha — semántica ya fijada por la interfaz, no se cambia.

## 4. El swap — composition root

- [x] 4.1 Correr el safety net completo antes de tocar `HojaDeRutaRoute.tsx`. **Anotación (2026-08-04,
      en orden de Enzo): se corrió SOLO el safety net dirigido** (`cd frontend && npx vitest run
      src/features/hojas-de-ruta src/features/dashboard`) — la suite completa queda para el 6.4. Línea
      de base: 188 passing / 1 failing, y el único fallo era el propio `HojaDeRutaRoute.test.tsx` por
      `localStorage.clear is not a function` (Node 25 expone un `localStorage` experimental sin API de
      Storage que tapa al de jsdom) — archivo que la 4.3 reemplaza íntegro. Los demás tests dirigidos
      que a veces caen por "Test timed out in 5000ms" son flakiness de esta máquina lenta (tests con
      `userEvent`), no regresiones del swap.
- [x] 4.2 (RED→GREEN) `HojaDeRutaRoute.tsx`: inyectar `supabaseHojaDeRutaRepository` y
      `supabasePacienteRepository` (reuso del singleton de `integracion-pacientes`, sin crear uno
      nuevo). `mockVehiculoRepository`/`mockConductorRepository` siguen inyectados — actualizar el
      comentario del archivo para reflejar el swap parcial y por qué (cita a `design.md` Checkpoint 0).
- [x] 4.3 Ajustar `HojaDeRutaRoute.test.tsx` al doble inyectado (tres reales o dos mock, según lo que
      quedó tras 4.2). El smoke test mockea `../../shared/lib/supabaseClient` con un doble que cuenta
      cada `select()` emitido (patrón `vi.hoisted` + `vi.mock`, mismo enfoque que
      `PacientesRoute.test.tsx`): RED con el composition root viejo (cero llamadas) → GREEN con el
      swap (≥1 llamada) + heading y estado vacío de un día sin hoja.
- [ ] 4.4 Verificar en navegador (`npm run dev`, con sesión real) que `HojaDeRutaPage` arma, edita y
      persiste una hoja de ruta contra Postgres, con los selectores de vehículo/conductor mostrando la
      flota fixture (comportamiento esperado del Checkpoint 0 opción A).
      **Manual, a cargo de Enzo** (no lo corre el agente): abrir `/hojas-de-ruta` con una cuenta con
      `hojas_de_ruta: write` y `pacientes: read`, crear la hoja del día, agregar un recorrido con
      paciente y direcciones reales y vehículo/conductor de la flota fixture, recargar y confirmar que
      el recorrido persiste contra Postgres. Los selectores de vehículo/conductor deben seguir
      mostrando la flota fixture (Checkpoint 0 opción A). El `AvisoModeloDatos` de la franja/discrepancia
      `conductorId` es del §5, no de este WU.

## 5. `AvisoModeloDatos` — Checkpoints 0 y 2 visibles en pantalla

- [x] 5.1 (RED→GREEN) `HojaDeRutaPage.tsx`: `AvisoModeloDatos` explicando que los selectores de
      vehículo/conductor siguen mostrando datos fixture hasta que
      `integracion-conductores-vehiculos` aterrice (Checkpoint 0) — reemplaza o complementa el cartel
      general ya existente de la discrepancia `conductorId`, sin duplicar mensaje.
      **WU4 (2026-08-04): se COMPLEMENTA el cartel existente con un segundo `AvisoModeloDatos`** (el
      de `conductorId` queda intacto, sin texto repetido). Tests: RED→GREEN en
      `HojaDeRutaPage.test.tsx` + ajuste del test de `getByRole('note')` → `getAllByRole`.
- [x] 5.2 (RED→GREEN) `RecorridoMapa.tsx` (o su contenedor en `RecorridoCard.tsx`): mensaje explícito
      cuando la ausencia de coordenadas es por diseño (hoja de ruta real, Checkpoint 2), distinto del
      mensaje genérico actual "No hay paradas con coordenadas para mostrar en el mapa todavía" — para
      que no se lea como un bug.
      **WU4 (2026-08-04): prop `desdeRepositoryReal` (default `false`, la fija el composition root en
      `HojaDeRutaRoute.tsx`) propagada `HojaDeRutaPage → RecorridoCard → RecorridoMapa`.** Con la hoja
      del repository real y sin coordenadas → `AvisoModeloDatos` "vacío por diseño (geocoding fuera de
      scope)"; sin la flag se conserva el estado vacío genérico y el mapa funcional sobre fixtures.

## 6. Documentación y cierre

- [ ] 6.1 `knowledge-base/04_modelo_de_datos.md` §Discrepancias: bloque nuevo "Hoja de Ruta / Recorrido
      vs. esquema real de C-10" con el veredicto de los tres checkpoints.
- [ ] 6.2 `CHANGES.md` §C-10: actualizar el bloque ⚠️ existente con qué queda resuelto (esquema,
      `conductor_id`) y qué sigue abierto (Vehículo/Conductor todavía mock) + fila 6 del §Plan de
      integración.
- [ ] 6.3 `ROADMAP-FRONTEND.md` §FE-8, si aplica (verificar si esta feature tiene entrada ahí, como el
      resto de la serie).
- [ ] 6.4 Correr la suite completa (`cd frontend && npx vitest run`) y confirmar cero regresiones
      contra el baseline de 0.4.
- [ ] 6.5 `cd frontend && npx tsc -b --noEmit` limpio.

## 7. Verificación manual (bloqueante, a cargo de la usuaria/Enzo)

- [ ] 7.1 Aplicar las migraciones nuevas al proyecto real (`supabase db push`, requiere Docker o
      credenciales — no lo corre el agente).
- [ ] 7.2 Verificación con una cuenta real que tenga `hojas_de_ruta: write` y `pacientes: read`: crear
      una hoja de ruta, agregar un recorrido con paciente/dirección reales y vehículo/conductor
      fixture, recargar y confirmar que persiste.
- [ ] 7.3 Verificación con una cuenta con `hojas_de_ruta: read` solamente: confirmar que la pantalla
      queda en modo solo lectura (ya cableado por `gateo-hojas-de-ruta`, no se re-testea el mecanismo,
      solo que sigue funcionando con las tablas nuevas).
- [ ] 7.4 Confirmar con el dueño de `docs/core/Traslados-Modelo-Datos.docx` la resolución de
      `conductor_id` en `recorrido` (Checkpoint 1, Parte B) — es la coordinación pendiente que
      `CHANGES.md` §C-10 viene arrastrando desde el 2026-07-25.
