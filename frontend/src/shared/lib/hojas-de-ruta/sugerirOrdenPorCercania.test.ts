import { describe, expect, it } from 'vitest';
import type { ParadaRecorrido } from '../../types/hojaDeRuta';
import { aMinutosDesdeMedianoche, sugerirOrdenPorCercania } from './sugerirOrdenPorCercania';

// Función pura (tasks.md 2.4, design.md Decisión 5/6): propone un orden de recogida por
// cercanía (vecino más cercano, distancia haversine sobre coordenadas fixture) DENTRO de cada
// bloque horario (feedback de usuario: no tiene sentido sugerir una parada de las 14:00 antes
// que una de las 11:00) — `horaEstimada` agrupa, `coordenadaOrigen` desempata dentro del grupo.
// Devuelve una PROPUESTA de reordenamiento del array — nunca impone la ruta (RN-HR-01): el
// resultado es una lista editable, quien llama decide si la aplica. Sin efectos de red ni
// localStorage.

function parada(id: string, lat: number, lng: number, horaEstimada?: string): ParadaRecorrido {
  return {
    id,
    pacienteId: `paciente-${id}`,
    tramo: 'ida',
    direccionOrigenId: `dir-origen-${id}`,
    direccionDestinoId: `dir-destino-${id}`,
    orden: 0,
    coordenadaOrigen: { lat, lng },
    horaEstimada,
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

  describe('bloques por ventana horaria (feedback de usuario, RN-HR-01)', () => {
    it('dentro de la ventana (default 60min) ordena por cercanía, ignorando cuál horario es más temprano', () => {
      // Sanguinetti 11:00 lejos del origen; Colucchi 11:11 muy cerca del origen — 11 min de
      // diferencia caen dentro de la ventana default, así que compiten por cercanía y Colucchi
      // (más tarde, pero más cerca) va primero.
      const sanguinetti = parada('sanguinetti', 0, 5, '11:00');
      const colucchi = parada('colucchi', 0, 0.01, '11:11');

      const resultado = sugerirOrdenPorCercania([sanguinetti, colucchi], { lat: 0, lng: 0 });

      expect(resultado.map((p) => p.id)).toEqual(['colucchi', 'sanguinetti']);
    });

    it('fuera de la ventana respeta el orden cronológico estricto, aunque el más tardío esté más cerca', () => {
      // 11:00 y 14:00 están a 180 min — supera la ventana default. z (14:00) está pegado al
      // origen y x (11:00) lejos: si el algoritmo mirara solo cercanía, z iría primero. No debe.
      const x = parada('x', 0, 5, '11:00');
      const z = parada('z', 0, 0, '14:00');

      const resultado = sugerirOrdenPorCercania([z, x], { lat: 0, lng: 0 });

      expect(resultado.map((p) => p.id)).toEqual(['x', 'z']);
    });

    it('encadena paradas en un mismo bloque por transitividad aunque los extremos superen la ventana', () => {
      // 11:00 -> 11:50 (50min) -> 12:40 (50min): cada salto entra en la ventana de 60min aunque
      // el total 11:00-12:40 (100min) la supere. Las tres deben quedar en un único bloque,
      // ordenadas por cercanía entre sí (no por horario).
      const temprano = parada('temprano', 0, 5, '11:00');
      const medio = parada('medio', 0, 5.01, '11:50');
      const tarde = parada('tarde', 0, 0, '12:40');

      const resultado = sugerirOrdenPorCercania([temprano, medio, tarde], { lat: 0, lng: 0 });

      // Partiendo del origen (0,0): "tarde" (0,0) es la más cercana; desde ahí, "temprano" (0,5)
      // queda más cerca que "medio" (0,5.01) — ese orden solo es posible si las tres compiten en
      // el mismo bloque (si horario mandara, "temprano" iría primero).
      expect(resultado.map((p) => p.id)).toEqual(['tarde', 'temprano', 'medio']);
    });

    it('la ventana es configurable por parámetro explícito', () => {
      // Mismas paradas que el primer test de este describe, pero con ventana de 10min: 11 min de
      // diferencia ya no entra en la ventana, así que ahora sí gana el orden cronológico.
      const sanguinetti = parada('sanguinetti', 0, 5, '11:00');
      const colucchi = parada('colucchi', 0, 0.01, '11:11');

      const resultado = sugerirOrdenPorCercania([sanguinetti, colucchi], { lat: 0, lng: 0 }, 10);

      expect(resultado.map((p) => p.id)).toEqual(['sanguinetti', 'colucchi']);
    });

    it('paradas sin horaEstimada quedan después de todos los bloques con horario, ordenadas por cercanía entre sí', () => {
      const conHorario = parada('con-horario', 0, 5, '11:00');
      const sinHorarioLejos = parada('sin-horario-lejos', 0, 10);
      const sinHorarioCerca = parada('sin-horario-cerca', 0, 5.01);

      const resultado = sugerirOrdenPorCercania([sinHorarioLejos, conHorario, sinHorarioCerca], { lat: 0, lng: 0 });

      expect(resultado.map((p) => p.id)).toEqual(['con-horario', 'sin-horario-cerca', 'sin-horario-lejos']);
    });

    it('un horaEstimada con formato inválido degrada a "sin horario" (contrato de degradación), nunca lanza', () => {
      const invalida = parada('invalida', 0, 0, 'no-es-una-hora');

      expect(() => sugerirOrdenPorCercania([invalida])).not.toThrow();
      expect(sugerirOrdenPorCercania([invalida]).map((p) => p.id)).toEqual(['invalida']);
    });

    it('reasigna orden 0..n-1 secuencial a través de todos los bloques', () => {
      const x = parada('x', 0, 5, '11:00');
      const z = parada('z', 0, 0, '14:00');

      const resultado = sugerirOrdenPorCercania([z, x], { lat: 0, lng: 0 });

      expect(resultado.map((p) => p.orden)).toEqual([0, 1]);
    });
  });

  describe('aMinutosDesdeMedianoche (exportada para sugerirRecorridoExistente.ts)', () => {
    it('parsea "HH:mm" a minutos desde medianoche', () => {
      expect(aMinutosDesdeMedianoche('11:11')).toBe(11 * 60 + 11);
    });

    it('un formato inválido degrada a undefined, nunca lanza (borde)', () => {
      expect(aMinutosDesdeMedianoche('no-es-una-hora')).toBeUndefined();
    });
  });
});
