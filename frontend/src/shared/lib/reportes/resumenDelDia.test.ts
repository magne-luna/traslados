import { describe, expect, it } from 'vitest';
import type { HojaDeRuta, Recorrido } from '../../types/hojaDeRuta';
import { resumenDelDia } from './resumenDelDia';

// tasks.md 4.7, spec dashboard-recorridos-del-dia: conteo de recorridos, de paradas (sumando
// todos los recorridos) y de pacientes distintos de la jornada (contados una sola vez aunque
// tengan parada de ida y de vuelta, o aparezcan en dos recorridos).

function parada(overrides: Partial<Recorrido['paradas'][number]> & Pick<Recorrido['paradas'][number], 'id' | 'pacienteId' | 'tramo'>) {
  return { direccionOrigenId: 'd1', direccionDestinoId: 'd2', orden: 1, ...overrides };
}

function recorrido(overrides: Partial<Recorrido> = {}): Recorrido {
  return { id: 'r1', vehiculoId: 'v1', conductorId: 'c1', manual: false, paradas: [], ...overrides };
}

function hojaDeRuta(overrides: Partial<HojaDeRuta> = {}): HojaDeRuta {
  return { id: 'h1', fecha: '2026-07-24', franjaInicio: '08:00', franjaFin: '20:00', recorridos: [], ...overrides };
}

describe('resumenDelDia', () => {
  it('cuenta recorridos, total de paradas (sumando todos los recorridos) y pacientes distintos', () => {
    const hoja = hojaDeRuta({
      recorridos: [
        recorrido({
          id: 'r1',
          paradas: [
            parada({ id: 'p1', pacienteId: 'pac-1', tramo: 'ida' }),
            parada({ id: 'p2', pacienteId: 'pac-2', tramo: 'ida' }),
          ],
        }),
        recorrido({ id: 'r2', paradas: [parada({ id: 'p3', pacienteId: 'pac-3', tramo: 'ida' })] }),
        recorrido({ id: 'r3', paradas: [] }),
      ],
    });
    const resumen = resumenDelDia(hoja);
    expect(resumen.cantidadRecorridos).toBe(3);
    expect(resumen.cantidadParadas).toBe(3);
    expect(resumen.cantidadPacientes).toBe(3);
  });

  it('cuenta un mismo paciente una sola vez aunque tenga parada de ida y de vuelta, o aparezca en dos recorridos', () => {
    const hoja = hojaDeRuta({
      recorridos: [
        recorrido({
          id: 'r1',
          paradas: [
            parada({ id: 'p1', pacienteId: 'pac-1', tramo: 'ida' }),
            parada({ id: 'p2', pacienteId: 'pac-1', tramo: 'vuelta' }),
          ],
        }),
        recorrido({ id: 'r2', paradas: [parada({ id: 'p3', pacienteId: 'pac-1', tramo: 'ida' })] }),
      ],
    });
    const resumen = resumenDelDia(hoja);
    expect(resumen.cantidadParadas).toBe(3);
    expect(resumen.cantidadPacientes).toBe(1);
  });

  it('una hoja de ruta sin ningún recorrido devuelve todo en cero, sin lanzar error', () => {
    const hoja = hojaDeRuta({ recorridos: [] });
    expect(resumenDelDia(hoja)).toEqual({ fecha: hoja.fecha, cantidadRecorridos: 0, cantidadParadas: 0, cantidadPacientes: 0 });
  });
});
