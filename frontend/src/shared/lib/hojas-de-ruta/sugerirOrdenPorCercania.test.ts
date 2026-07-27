import { describe, expect, it } from 'vitest';
import type { ParadaRecorrido } from '../../types/hojaDeRuta';
import { sugerirOrdenPorCercania } from './sugerirOrdenPorCercania';

// Función pura (tasks.md 2.4, design.md Decisión 5/6): propone un orden de recogida por
// cercanía (vecino más cercano, distancia haversine sobre coordenadas fixture). Devuelve una
// PROPUESTA de reordenamiento del array — nunca impone la ruta (RN-HR-01): el resultado es una
// lista editable, quien llama decide si la aplica. Sin efectos de red ni localStorage.

function parada(id: string, lat: number, lng: number): ParadaRecorrido {
  return {
    id,
    pacienteId: `paciente-${id}`,
    tramo: 'ida',
    direccionOrigenId: `dir-origen-${id}`,
    direccionDestinoId: `dir-destino-${id}`,
    orden: 0,
    coordenadaOrigen: { lat, lng },
  };
}

describe('sugerirOrdenPorCercania', () => {
  it('ordena las paradas por vecino más cercano partiendo de la primera parada (RN-HR-01)', () => {
    // A en (0,0), C muy cerca de A (0, 0.01), B lejos (0, 5). Orden esperado: A, C, B.
    const a = parada('a', 0, 0);
    const b = parada('b', 0, 5);
    const c = parada('c', 0, 0.01);

    const resultado = sugerirOrdenPorCercania([a, b, c]);

    expect(resultado.map((p) => p.id)).toEqual(['a', 'c', 'b']);
  });

  it('reasigna el campo orden de forma secuencial 0..n-1 según la propuesta', () => {
    const a = parada('a', 0, 0);
    const b = parada('b', 0, 5);
    const c = parada('c', 0, 0.01);

    const resultado = sugerirOrdenPorCercania([a, b, c]);

    expect(resultado.map((p) => p.orden)).toEqual([0, 1, 2]);
  });

  it('usa un origenReferencia explícito como punto de partida (triangulación de parámetros)', () => {
    const a = parada('a', 0, 0);
    const b = parada('b', 0, 5);
    const c = parada('c', 0, 4.99);

    // Partiendo desde muy cerca de b/c, el más cercano al origen de referencia va primero.
    const resultado = sugerirOrdenPorCercania([a, b, c], { lat: 0, lng: 5 });

    expect(resultado[0]?.id).toBe('b');
  });

  it('no muta el array original (función pura)', () => {
    const a = parada('a', 0, 0);
    const b = parada('b', 0, 5);
    const original = [a, b];

    sugerirOrdenPorCercania(original);

    expect(original[0]).toBe(a);
    expect(original[1]).toBe(b);
    expect(a.orden).toBe(0);
  });

  it('devuelve un array vacío si no hay paradas (borde)', () => {
    expect(sugerirOrdenPorCercania([])).toEqual([]);
  });

  it('paradas sin coordenadaOrigen quedan al final, en su orden relativo original (borde)', () => {
    const conCoordenada = parada('con-coord', 0, 0);
    const sinCoordenada: ParadaRecorrido = { ...parada('sin-coord', 0, 0), coordenadaOrigen: undefined };

    const resultado = sugerirOrdenPorCercania([sinCoordenada, conCoordenada]);

    expect(resultado.map((p) => p.id)).toEqual(['con-coord', 'sin-coord']);
  });

  it('el resultado depende solo de los argumentos (función pura, determinista)', () => {
    const a = parada('a', 0, 0);
    const b = parada('b', 0, 5);
    const c = parada('c', 0, 0.01);

    const primero = sugerirOrdenPorCercania([a, b, c]).map((p) => p.id);
    const segundo = sugerirOrdenPorCercania([a, b, c]).map((p) => p.id);

    expect(primero).toEqual(segundo);
  });
});
