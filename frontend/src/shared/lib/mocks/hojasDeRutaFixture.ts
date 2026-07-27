import type { HojaDeRuta } from '../../types/hojaDeRuta';

// Fixture inicial de hojas de ruta (tasks.md 3.2, design.md Decisión 1/6): la hoja de ruta de
// "hoy" con dos recorridos que referencian ids que existen en vehiculosFixture.ts /
// conductoresFixture.ts / pacientesFixture.ts — 'vehiculo-etios' y 'vehiculo-kangoo' (ambos
// 'habilitado'), 'conductor-gonzalez' y 'conductor-perez' (ambos 'operando'), y las direcciones
// de 'paciente-martina'/'paciente-facundo'. Las coordenadas son FIXTURES razonables (zona CABA/
// La Plata), no geocoding real (design.md Decisión 6, google-maps-platform: "coordenadas de
// pacientes en el mock = fixtures razonables, no reales").

function isoDateHoy(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildHojasDeRutaFixture(): HojaDeRuta[] {
  const hoy: HojaDeRuta = {
    id: 'hoja-de-ruta-hoy',
    fecha: isoDateHoy(),
    franjaInicio: '08:00',
    franjaFin: '20:00',
    notas: 'Coordinar con Martina posible cambio de horario de salida de la escuela.',
    recorridos: [
      {
        // Recorrido regular (RN-HR-02: ida y vuelta como paradas independientes, cada una con su
        // propio origen/destino del catálogo de direcciones de Martina — la vuelta NO se deriva
        // invirtiendo la ida, son dos registros autónomos que acá coinciden con el trayecto
        // inverso porque así lo carga el fixture de Direcciones de Martina).
        id: 'recorrido-martina',
        vehiculoId: 'vehiculo-etios',
        conductorId: 'conductor-gonzalez',
        manual: false,
        paradas: [
          {
            id: 'parada-martina-ida',
            pacienteId: 'paciente-martina',
            tramo: 'ida',
            direccionOrigenId: 'dir-martina-domicilio-ida',
            direccionDestinoId: 'dir-martina-escuela-vuelta',
            orden: 0,
            // Fixture (Av. Rivadavia 4500, CABA) — no geocodificada realmente.
            coordenadaOrigen: { lat: -34.6091, lng: -58.4416 },
          },
          {
            id: 'parada-martina-vuelta',
            pacienteId: 'paciente-martina',
            tramo: 'vuelta',
            direccionOrigenId: 'dir-martina-escuela-vuelta',
            direccionDestinoId: 'dir-martina-domicilio-ida',
            orden: 1,
            // Fixture (Escuela N°12, Bulnes 1200, CABA) — no geocodificada realmente.
            coordenadaOrigen: { lat: -34.5947, lng: -58.4162 },
          },
        ],
      },
      {
        // Recorrido manual (RN-HR-03): traslado puntual sin frecuencia fija ni turno preestablecido.
        // 'paciente-facundo' solo tiene una Direccion cargada en el fixture de Pacientes
        // (dir-facundo-domicilio-ida) — se usa como origen y destino porque este fixture no
        // inventa una segunda dirección que no exista en el catálogo real del paciente.
        id: 'recorrido-facundo-manual',
        vehiculoId: 'vehiculo-kangoo',
        conductorId: 'conductor-perez',
        manual: true,
        notas: 'Traslado puntual a control médico, sin turno fijo.',
        paradas: [
          {
            id: 'parada-facundo-manual',
            pacienteId: 'paciente-facundo',
            tramo: 'ida',
            direccionOrigenId: 'dir-facundo-domicilio-ida',
            direccionDestinoId: 'dir-facundo-domicilio-ida',
            orden: 0,
            // Fixture (Calle 50 N°850, La Plata) — no geocodificada realmente.
            coordenadaOrigen: { lat: -34.9205, lng: -57.9536 },
          },
        ],
      },
    ],
  };

  return [hoy];
}
