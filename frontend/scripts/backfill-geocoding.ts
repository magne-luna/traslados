// Backfill único de coordenadas (RF-701): geocodifica las filas de `pacientes.direcciones` con
// `lat` NULL — cargadas antes de `20260805140000_direcciones_geocoding.sql` o con geocoding
// fallido — para que aparezcan en el mapa de la hoja de ruta.
//
// Corre LOCAL, nunca en el frontend: usa la service role key (saltea RLS).
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... GOOGLE_MAPS_API_KEY=... \
//     node scripts/backfill-geocoding.ts            # simulación: solo muestra qué haría
//     node scripts/backfill-geocoding.ts --aplicar  # escribe lat/lng
//
// Idempotente: solo toca filas con lat NULL, se puede volver a correr sin riesgo.

import { createClient } from '@supabase/supabase-js';
import { parseGeocodingResponse } from '../src/shared/lib/googleMapsClient.ts';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_MAPS_API_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GOOGLE_MAPS_API_KEY) {
  console.error('Faltan SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY o GOOGLE_MAPS_API_KEY.');
  process.exit(1);
}
const aplicar = process.argv.includes('--aplicar');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: filas, error } = await supabase
  .schema('pacientes')
  .from('direcciones')
  .select('id, calle, numero, localidad')
  .is('lat', null);
if (error) {
  console.error('No se pudieron leer las direcciones:', error.message);
  process.exit(1);
}

console.log(`${filas.length} direcciones sin coordenadas${aplicar ? '' : ' (SIMULACIÓN — sin --aplicar no se escribe nada)'}`);

let ok = 0;
const fallidas: string[] = [];

for (const fila of filas) {
  // Mismo armado que `parseDireccionRow` + `geocodificarDireccion` (calle + numero, localidad, AR).
  const calle = [fila.calle, fila.numero].filter((parte) => parte && String(parte).trim() !== '').join(' ');
  const direccion = `${calle}, ${fila.localidad ?? ''}`;
  const params = new URLSearchParams({ address: direccion, components: 'country:AR', key: GOOGLE_MAPS_API_KEY });

  const respuesta = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
  const coordenada = respuesta.ok ? parseGeocodingResponse(await respuesta.json()) : undefined;

  if (!coordenada) {
    fallidas.push(direccion);
    continue;
  }

  console.log(`  ✓ ${direccion} → ${coordenada.lat}, ${coordenada.lng}`);
  if (aplicar) {
    const { error: errorUpdate } = await supabase
      .schema('pacientes')
      .from('direcciones')
      .update({ lat: coordenada.lat, lng: coordenada.lng })
      .eq('id', fila.id);
    if (errorUpdate) {
      fallidas.push(`${direccion} (update: ${errorUpdate.message})`);
      continue;
    }
  }
  ok++;
}

console.log(`\n${ok} ${aplicar ? 'actualizadas' : 'se actualizarían'}, ${fallidas.length} sin resolver:`);
for (const direccion of fallidas) console.log(`  ✗ ${direccion}`);
