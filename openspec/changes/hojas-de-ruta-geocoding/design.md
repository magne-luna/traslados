# Design — hojas-de-ruta-geocoding

Change pequeño y acotado (una columna aditiva, una función pura nueva, cableado en dos
repositories ya reales). No repite el formato de checkpoints bloqueantes de
`integracion-hojas-de-ruta/design.md` — las decisiones de este change ya vinieron dadas por Enzo
al pedirlo y se documentan acá como registro, no como preguntas abiertas.

## D1 — Dónde vive el geocoding: `googleMapsClient.ts`, REST directo, no SDK de mapas

`frontend/src/shared/lib/googleMapsClient.ts` era un placeholder vacío
(`export const googleMapsClient = {} as const`) con un comentario explícito: "Initialize the real
client with `@vis.gl/react-google-maps` once the API key is available". Se investigó esa vía
primero (es la librería que ya usa `RecorridoMapa.tsx` para el mapa, y la que menciona el
comentario) y se descartó: `@vis.gl/react-google-maps` (`node_modules/@vis.gl/react-google-maps/
dist/index.d.ts`) solo exporta hooks/componentes de React (`useMapsLibrary`, `APIProvider`, `Map`,
etc.) que dependen de un `<APIProvider>` montado en el árbol — no hay ningún export standalone
para pedir una geocodificación puntual desde fuera de un componente. El punto donde hace falta
geocodificar (`SupabasePacienteRepository.crearPaciente`/`actualizarPaciente`) es una capa de I/O
pura, sin árbol de React.

**Decisión**: `fetch` directo a la REST API de Geocoding
(`https://maps.googleapis.com/maps/api/geocode/json`). Mismo criterio que el resto del repo:
nunca golpear la red real en un test (se mockea `fetch` global), degradar siempre en vez de
lanzar. La función vive en el mismo archivo que el placeholder que reemplaza — no se creó un
archivo nuevo porque no hay una segunda responsabilidad de Google Maps que justifique separarlo
de `googleMapsClient.ts`, y ese nombre ya es el punto de entrada esperado (`RecorridoMapa.tsx` lo
menciona en su propio comentario).

## D2 — Persistencia: columnas en `Direccion`, no una tabla de caché aparte

Alternativa considerada y descartada: una tabla `pacientes.direcciones_geocoding` separada
(`direccion_id`, `lat`, `lng`, `geocodificado_en`) para no tocar el esquema de `direcciones`. Se
descartó por sobre-ingeniería: es una relación 1:1 estricta con `direcciones` (cada dirección
tiene a lo sumo una coordenada vigente), no hay necesidad de historizar geocodings viejos, y una
tabla aparte solo agrega un JOIN a cada lectura sin ganar nada. Columnas aditivas
`lat`/`lng double precision NULL` directamente en `pacientes.direcciones` — mismo patrón que el
resto de la serie (`localidad`, `parentesco`: expand aditivo sobre una tabla existente).

## D3 — Cuándo geocodificar: en el guardado de la dirección, nunca en la carga de la hoja de ruta

RF-701 no pide coordenadas en tiempo real ni tracking — pide que la hoja de ruta pueda sugerir un
orden de recogida. Geocodificar en cada carga de `HojaDeRutaPage` sería: (a) más lento (una
llamada de red externa por parada, en cada render), (b) más caro (cuota de la Geocoding API por
sobre el free tier), y (c) redundante — la dirección de un paciente no cambia entre una carga de
hoja de ruta y la siguiente. La única vez que tiene sentido gastar una llamada de geocoding es
cuando el dato que la origina (`calle`/`localidad`) cambió.

**Decisión**: geocodificar en `SupabasePacienteRepository.crearPaciente` (todas las direcciones,
son todas nuevas) y `actualizarPaciente` (solo las que `direccionesACambiar` marca como nuevas o
con `calle`/`localidad` distinta de lo ya guardado — nunca todo el lote en cada edición del
paciente, aunque la edición no toque direcciones). Nunca en el formulario mientras se tipea
(`DireccionesEditor.tsx` no se tocó): la geocodificación ocurre recién cuando el paciente completo
se envía al repository, mismo punto donde hoy se arma el payload de la RPC/el diff de colecciones.

## D4 — Preservar coordenadas de direcciones sin cambios en `update()`

`actualizarPaciente` reemplaza la colección de direcciones enteras con un único `upsert` (D5 de
`integracion-pacientes`) — cada fila entrante se reescribe completa. Si `toDireccionRows` siempre
incluyera `lat`/`lng` (geocodificados solo para las direcciones cambiadas, `null`/ausente para el
resto), un upsert ingenuo pisaría con `null` las coordenadas ya guardadas de una dirección que no
cambió, cada vez que se edita cualquier otro campo del paciente.

**Decisión**: `DireccionRowInput.lat`/`lng` son opcionales (la CLAVE puede faltar, no solo valer
`null`). `toDireccionRows(direcciones, coordenadas)` solo agrega `lat`/`lng` a la fila cuando el
`id` de la dirección está presente en el mapa `coordenadas` — que solo contiene las direcciones
efectivamente (re)geocodificadas en este guardado. PostgREST/Supabase, en un `upsert`, no toca una
columna ausente del objeto JSON — la fila existente conserva su valor. Una dirección sin cambios
nunca aparece en el mapa, así que su `lat`/`lng` (si ya los tenía) sobreviven intactos.

## D5 — Enriquecimiento de `coordenadaOrigen`: consulta batch, nunca N+1

`SupabaseHojaDeRutaRepository` no puede simplemente embeber `direcciones` en su `SELECT` de hoja
de ruta con lat/lng: `historial_recorridos` tiene DOS FKs a `pacientes.direcciones`
(`id_dir_inicial`/`id_dir_final`), y PostgREST necesitaría un alias por cada uno más una
resolución explícita del embed ambiguo — viable, pero más frágil y acoplado a la forma exacta del
SELECT existente. Se eligió, en cambio, el mismo patrón que
`SupabasePacienteRepository.leerCoberturasBatch` ya usa para resolver `numeroAfiliado` sin N+1: una
única consulta separada, sin filtrar (`SELECT id, lat, lng FROM pacientes.direcciones`), agrupada
client-side en un `Map<string, Coordenada>`, aplicada sobre el agregado ya ensamblado.

Trade-off explícito: esta consulta trae TODAS las direcciones de la base, no solo las referenciadas
por la hoja de ruta que se está leyendo — igual que `leerCoberturasBatch` trae todas las
coberturas. A la escala de este proyecto (una organización, no miles de pacientes) es la opción
más simple y consistente con el patrón ya establecido; si el volumen de `direcciones` creciera lo
suficiente para que esto importe, la alternativa es un `.in('id', [...])` sobre los
`direccionOrigenId` de la hoja — cambio aislado a `obtenerCoordenadasDirecciones()`, sin tocar la
forma pública del repository ni el resto del enriquecimiento.

La función de enriquecimiento corta antes de la consulta si ninguna hoja tiene paradas
(`algunaParadaConDireccionOrigen`), y un error de la consulta degrada a mapa vacío en vez de
lanzar — la hoja de ruta se sigue devolviendo igual, solo con `coordenadaOrigen: undefined` en
todas sus paradas (mismo estado que hoy, antes de este change).

## D6 — RLS: sin policies nuevas

`pacientes.direcciones` ya tiene RLS habilitada desde `20260724100004_schema_pacientes.sql`
("Read direcciones"/"Write direcciones", gateadas por `modulos.tiene_permiso('pacientes', ...)").
Row Level Security es, como dice el nombre, a nivel de FILA — Postgres no tiene RLS por columna.
Las dos columnas nuevas (`lat`/`lng`) quedan cubiertas automáticamente por las policies existentes,
sin necesidad de declarar nada nuevo. Confirmado explícito en el comentario de la migración en vez
de asumido en silencio (regla dura del proyecto).

## D7 — Qué NO cambia

- `sugerirOrdenPorCercania.ts`: sigue siendo haversine en línea recta sobre `coordenadaOrigen`. El
  TODO que ya tenía (Geometry API/distancia de manejo real, confirmar con el cliente) sigue
  abierto — este change le da datos de entrada reales, no cambia el criterio de cercanía en sí.
- `RecorridoMapa.tsx`: su render, sus estados ("sin coordenadas", "sin API key") y su cartel de
  "vacío por diseño" (`desdeRepositoryReal`) no se tocan — siguen siendo la UX correcta incluso
  después de este change, porque una hoja real puede perfectamente seguir teniendo paradas sin
  coordenada (dirección nunca geocodificada, o geocoding fallido). El texto de ese cartel ("por
  diseño... fuera de scope") queda desactualizado ahora que sí hay geocoding real — se deja
  como follow-up de copy, fuera de scope de este change (no se tocó el archivo, tal como se pidió).
- El módulo Pacientes en sí (`PacienteForm.tsx`, `DireccionesEditor.tsx`, validaciones): sin
  cambios — la geocodificación es un efecto secundario invisible del guardado, no un campo nuevo
  en el formulario.
