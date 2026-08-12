# Tasks — hojas-de-ruta-geocoding

> Change ya implementado (apply directo, sin fase de propose/design separada previa — pedido
> puntual de Enzo, backend). Este documento registra lo hecho, no un plan a ejecutar.
>
> Reglas duras aplicables (`CLAUDE.md`): nunca `any`; type-check con `npx tsc -b --noEmit`; toda
> tabla/columna nueva confirma su cobertura de RLS en el mismo change; **el agente nunca escribe
> `supabase db push`** — la migración queda redactada, Enzo la aplica.

## 1. Schema

- [x] 1.1 `supabase/migrations/20260805140000_direcciones_geocoding.sql`: `ALTER TABLE
      pacientes.direcciones ADD COLUMN lat double precision, ADD COLUMN lng double precision`
      (aditivo, sin backfill).
- [x] 1.2 `CREATE OR REPLACE FUNCTION pacientes.crear_paciente_completo` — mismo cuerpo que
      `20260805130000_personas_a_cargo_parentesco.sql`, paso 4 (direcciones) ahora también
      inserta `lat`/`lng` desde el jsonb de entrada.
      **NO aplicada por el agente** — Enzo la aplica con `supabase db push`.
- [x] 1.3 Confirmar explícitamente en el comentario de la migración que las policies de RLS
      existentes de `pacientes.direcciones` (row-level) cubren las columnas nuevas sin necesitar
      policies adicionales.

## 2. Geocoding real

- [x] 2.1 `frontend/src/shared/lib/googleMapsClient.ts`: reemplazar el placeholder por
      `geocodificarDireccion(direccion): Promise<Coordenada | undefined>` — `fetch` directo a la
      REST API de Geocoding (ver design.md D1 sobre por qué no `@vis.gl/react-google-maps`).
      Degrada a `undefined` ante cualquier falla (key ausente/vacía, dirección vacía, HTTP no-ok,
      `status !== 'OK'`, JSON malformado, error de red) — nunca lanza.
- [x] 2.2 `parseGeocodingResponse` pura y exportada, para testear cada rama de la respuesta sin
      pasar por `fetch`.
- [x] 2.3 Tests: happy path, sin key, key vacía, calle/localidad vacía, HTTP no-ok, error de red,
      JSON malformado, `ZERO_RESULTS`/`REQUEST_DENIED` — `frontend/src/shared/lib/__tests__/
      googleMapsClient.test.ts` (reemplaza los tests del placeholder anterior).

## 3. Wiring en el guardado de Pacientes

- [x] 3.1 `pacienteMapping.ts`: `direccionesACambiar(existentes, entrantes)` — pura, decide qué
      direcciones son nuevas o tienen `calle`/`localidad` cambiada.
- [x] 3.2 `pacienteMapping.ts`: `DireccionRowInput.lat`/`lng` opcionales;
      `toDireccionRows(direcciones, coordenadas?)` agrega `lat`/`lng` SOLO para los ids presentes
      en el mapa `coordenadas` (ver design.md D4 — preserva coordenadas de direcciones sin
      cambios en el `upsert`).
- [x] 3.3 `pacienteMapping.ts`: `toCrearPacientePayload(nuevo, coordenadas?)` reenvía el mapa a
      `toDireccionRows`.
- [x] 3.4 `SupabasePacienteRepository.ts`: `geocodificarDirecciones(direcciones)` — geocodifica
      en paralelo, arma el mapa `id -> Coordenada | null` (una falla individual nunca aborta el
      lote ni bloquea el guardado del paciente).
- [x] 3.5 `crearPaciente`: geocodifica TODAS las direcciones (todas son nuevas).
- [x] 3.6 `actualizarPaciente`: geocodifica solo `direccionesACambiar(existente.direcciones,
      data.direcciones)`.
- [x] 3.7 Tests de wiring (`SupabasePacienteRepository.test.ts`): create geocodifica todo; update
      geocodifica solo lo cambiado; dirección sin cambios no dispara geocoding; falla de geocoding
      no bloquea el guardado (lat/lng quedan `null`, la RPC/el upsert se siguen llamando).

## 4. Wiring en la lectura de Hojas de Ruta

- [x] 4.1 `hojaDeRutaMapping.ts`: `parseCoordenadasPorDireccion(rows)` — pura, filas de
      `pacientes.direcciones (id, lat, lng)` a `Map<string, Coordenada>`.
- [x] 4.2 `hojaDeRutaMapping.ts`: `aplicarCoordenadasOrigen(hoja, coordenadas)` — pura, resuelve
      `ParadaRecorrido.coordenadaOrigen` de cada parada contra `direccionOrigenId`. Atajo: mapa
      vacío devuelve la misma referencia de `hoja`, sin recorrer nada.
- [x] 4.3 `SupabaseHojaDeRutaRepository.ts`: `obtenerCoordenadasDirecciones()` (consulta batch,
      sin filtrar — mismo patrón que `leerCoberturasBatch`, ver design.md D5) +
      `enriquecerConCoordenadas(hojas)` (corta si no hay paradas; degrada a `[]` de coordenadas si
      la consulta falla, nunca lanza).
- [x] 4.4 Enganchado en `listarHojasDeRuta`, `getHojaDeRutaPorId`, `getHojaDeRutaPorFecha` (
      `crearHojaDeRuta`/`actualizarHojaDeRuta` lo heredan gratis: ambas releen con `getById`).
- [x] 4.5 Tests: enriquece `coordenadaOrigen` en `getById`/`getByFecha`/`list`; una sola consulta
      batch sin importar cuántos recorridos/paradas haya (anti N+1, actualiza el test existente
      que antes asumía "1 select total"); dirección sin geocodificar deja `coordenadaOrigen`
      `undefined` sin romper; error de la consulta de coordenadas degrada sin lanzar; hoja sin
      paradas no dispara la consulta.

## 5. Documentación

- [x] 5.1 Comentarios actualizados en `hojaDeRuta.ts` (`Coordenada`, `coordenadaOrigen`) y
      `hojaDeRutaMapping.ts` (`parseParadaRow`) para dejar de decir "siempre `undefined`,
      Checkpoint 2" sin matizar — ahora explican que el enriquecimiento pasa en otra capa.
      `RecorridoMapa.tsx` NO se tocó (pedido explícito) — su cartel "vacío por diseño" queda
      desactualizado como follow-up de copy, anotado en design.md D7.
- [x] 5.2 Este set de documentos (`proposal.md`/`design.md`/`tasks.md`).

## 6. Verificación

- [x] 6.1 `npx tsc -b --noEmit` limpio.
- [x] 6.2 `NODE_OPTIONS=--no-experimental-webstorage npx vitest run` — suites afectadas
      (`src/shared/lib/pacientes`, `src/shared/lib/hojas-de-ruta`,
      `src/shared/lib/__tests__/googleMapsClient.test.ts`, `src/features/hojas-de-ruta`,
      `src/features/pacientes`) en verde.
- [x] 6.3 **✅ Completa (2026-08-11).** `20260805140000_direcciones_geocoding.sql` ya estaba
      aplicada en remoto (confirmado con `supabase migration list`, `local == remote`). API key de
      Google Maps con la Geocoding API habilitada cargada en `frontend/.env.local` como
      `VITE_GOOGLE_MAPS_API_KEY` (archivo cubierto por `*.local` en `.gitignore`, no se commitea).
