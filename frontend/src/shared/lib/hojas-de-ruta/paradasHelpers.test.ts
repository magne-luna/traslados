import { describe, expect, it } from 'vitest';
import type { ParadaRecorrido } from '../../types/hojaDeRuta';
import { agregarParada, quitarParada } from './paradasHelpers';

// Funciones puras (tasks.md 7.1, RF-702): agregar/quitar un pasajero de un recorrido con
// reacomodo consistente del `orden` de las paradas restantes. Sin efectos de red ni
// localStorage — la persistencia la hace quien llama, vía update() del agregado.

function parada(id: string, orden: number): ParadaRecorrido {
  return {
    id,
    pacienteId: `paciente-${id}`,
    tramo: 'ida',
    direccionOrigenId: `dir-origen-${id}`,
    direccionDestinoId: `dir-destino-${id}`,
    orden,
  };
}

describe('quitarParada', () => {
  it('elimina la parada indicada y reacomoda el orden de las restantes de forma consistente (RF-702)', () => {
    const paradas = [parada('a', 0), parada('b', 1), parada('c', 2)];

    const resultado = quitarParada(paradas, 'b');

    expect(resultado.map((p) => p.id)).toEqual(['a', 'c']);
    expect(resultado.map((p) => p.orden)).toEqual([0, 1]);
  });

  it('quitar la primera parada reacomoda igual (triangulación)', () => {
    const paradas = [parada('a', 0), parada('b', 1), parada('c', 2)];

    const resultado = quitarParada(paradas, 'a');

    expect(resultado.map((p) => p.id)).toEqual(['b', 'c']);
    expect(resultado.map((p) => p.orden)).toEqual([0, 1]);
  });

  it('no cambia nada si el id no existe (borde)', () => {
    const paradas = [parada('a', 0), parada('b', 1)];

    const resultado = quitarParada(paradas, 'no-existe');

    expect(resultado.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('no muta el array original (función pura)', () => {
    const paradas = [parada('a', 0), parada('b', 1)];

    quitarParada(paradas, 'a');

    expect(paradas).toHaveLength(2);
  });
});

describe('agregarParada', () => {
  it('agrega la nueva parada al final y reacomoda el orden de todas (RF-702)', () => {
    const paradas = [parada('a', 0), parada('b', 1)];
    const nueva = parada('c', 99); // orden entrante es irrelevante: se recalcula

    const resultado = agregarParada(paradas, nueva);

    expect(resultado.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(resultado.map((p) => p.orden)).toEqual([0, 1, 2]);
  });

  it('agregar a un recorrido vacío deja una sola parada con orden 0 (triangulación)', () => {
    const resultado = agregarParada([], parada('a', 0));

    expect(resultado).toEqual([{ ...parada('a', 0), orden: 0 }]);
  });

  it('no muta el array original (función pura)', () => {
    const paradas = [parada('a', 0)];

    agregarParada(paradas, parada('b', 0));

    expect(paradas).toHaveLength(1);
  });
});
