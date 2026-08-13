## Why

`integracion-hojas-de-ruta` (archivado) llegó a su **Checkpoint 2** con una decisión explícita: el
repository real de Hoja de Ruta nunca persiste coordenadas, así que `RecorridoMapa.tsx` queda vacío
para toda hoja real, con un `AvisoModeloDatos` que explica que es "por diseño" — ver
`openspec/changes/integracion-hojas-de-ruta/design.md` Checkpoint 2, opción A. La razón para
diferirlo en ese momento fue de scope: "conectar un repository" no debía crecer a "integrar una API
externa nueva de geocoding".

Ese trade-off ya se cobró su costo funcional real: RF-701 (`knowledge-base/06_funcionalidades.md`,
`knowledge-base/10_preguntas_abiertas.md` fila de prioridad Media) pide sugerir el orden de
recogida por cercanía, y **el algoritmo ya existe y funciona** —
`frontend/src/shared/lib/hojas-de-ruta/sugerirOrdenPorCercania.ts`, nearest-neighbor sobre
distancia haversine, con tests puros— pero nunca tiene datos reales con los que operar:
`ParadaRecorrido.coordenadaOrigen` es siempre `undefined` para una hoja de ruta real, porque
ninguna `Direccion` del paciente tiene una coordenada geocodificada en ningún lado. El mapa y la
sugerencia de orden son, hoy, funcionalidad muerta sobre datos reales.

**Este change resuelve el Checkpoint 2**: agrega geocoding real de las direcciones del paciente
(Google Geocoding API), persistido en `pacientes.direcciones`, y lo conecta a `ParadaRecorrido.
coordenadaOrigen` vía `SupabaseHojaDeRutaRepository`. No es la integración completa que
`CHANGES.md` §C-10 dejó fuera de scope originalmente (esa integración cubría Geometry
API/distancia de manejo para el criterio de cercanía en sí — ver TODO de
`sugerirOrdenPorCercania.ts` — eso sigue fuera de scope): esto solo resuelve **de dónde sale la
coordenada de cada dirección**, el gap concreto que dejaba tanto el mapa como el algoritmo sin
insumos.

## What Changes

- **Una columna nueva, aditiva**: `pacientes.direcciones.lat`/`lng` (`double precision`,
  NULLable). Sin backfill retroactivo — direcciones existentes quedan en `NULL` hasta que se
  vuelvan a guardar.
- **Geocoding real** (`frontend/src/shared/lib/googleMapsClient.ts`, reemplaza el placeholder
  vacío): `geocodificarDireccion(direccion)` contra la Geocoding API real de Google (`fetch`
  directo a la REST API — `@vis.gl/react-google-maps` no expone un helper standalone fuera de un
  árbol de componentes React, verificado contra sus tipos). Nunca lanza: toda falla (key ausente,
  dirección vacía, error de red, `status` distinto de `OK`) degrada a `undefined`.
- **Se geocodifica solo al guardar una `Direccion`** (alta o edición con `calle`/`localidad`
  cambiadas), nunca en cada tecleo ni en cada carga de una hoja de ruta —
  `SupabasePacienteRepository.ts` (`crearPaciente`/`actualizarPaciente`) y `pacienteMapping.ts`
  (`direccionesACambiar`, nueva función pura que decide qué direcciones necesitan
  re-geocodificarse).
- **`SupabaseHojaDeRutaRepository.ts` deja de resolver `coordenadaOrigen` como `undefined`
  siempre**: después de ensamblar cada hoja, una consulta BATCH (nunca N+1, mismo criterio que
  `leerCoberturasBatch` de Pacientes) resuelve `lat`/`lng` de cada `direccionOrigenId`
  referenciado. Una dirección sin geocodificar (o cuyo geocoding falló) simplemente no aporta
  coordenada — mismo contrato de degradación que el resto de la serie.
- **No se toca**: el algoritmo de `sugerirOrdenPorCercania.ts` (ya correcto, solo necesitaba
  datos), el render de `RecorridoMapa.tsx` (ya maneja "sin coordenadas"/"sin API key" con la UX
  correcta, listo para recibir coordenadas reales), ni el criterio de cercanía en sí (sigue siendo
  haversine en línea recta — Geometry API/distancia de manejo sigue en
  `knowledge-base/10_preguntas_abiertas.md`, prioridad Media, sin resolver).

## Impact

- **Affected specs**: ninguno de `integracion-hojas-de-ruta` se marca `MODIFIED` formalmente en
  este change (no se tocan sus specs) — el Checkpoint 2 queda resuelto en la práctica, documentado
  acá y en los comentarios de código que lo referencian (`RecorridoMapa.tsx`, `hojaDeRutaMapping.ts`,
  `hojaDeRuta.ts`).
- **Affected code**: `frontend/src/shared/lib/googleMapsClient.ts` (reemplazo del placeholder),
  `frontend/src/shared/lib/pacientes/{pacienteMapping,SupabasePacienteRepository}.ts`,
  `frontend/src/shared/lib/hojas-de-ruta/{hojaDeRutaMapping,SupabaseHojaDeRutaRepository}.ts`,
  `frontend/src/shared/types/hojaDeRuta.ts` (comentarios).
- **Affected schema**: `supabase/migrations/20260805140000_direcciones_geocoding.sql` — aditiva,
  no rompe ninguna fila/consulta existente.
- **Fuera de scope**: geocoding en batch/backfill de direcciones existentes; Geometry API o
  distancia de manejo real para el criterio de cercanía; cualquier cambio a
  `sugerirOrdenPorCercania.ts` o al render de `RecorridoMapa.tsx`.
- **Acción pendiente de Enzo (bloqueante para que esto tenga efecto real)**: conseguir una API key
  de Google Maps con la **Geocoding API** habilitada, cargar `VITE_GOOGLE_MAPS_API_KEY` en su
  propio `frontend/.env.local` (nunca committeada) y aplicar la migración con
  `supabase db push`. Sin la key, el código compila y los tests pasan igual (mockean la red por
  completo) — `geocodificarDireccion` simplemente degrada a `undefined` en cada llamada real, sin
  romper nada.
