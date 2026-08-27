import { describe, expect, it } from 'vitest';
import type { Direccion } from '../../types/paciente';
import type { RecorridoHabitual } from '../../types/recorridoHabitual';
import { camposDesdeRecorridoHabitual } from './camposDesdeRecorridoHabitual';

function habitual(overrides: Partial<RecorridoHabitual> = {}): RecorridoHabitual {
  return {
    id: 'h-1',
    pacienteId: 'paciente-1',
    direccionInicialId: 'dir-casa',
    direccionFinalId: 'dir-escuela',
    diaSemana: 'jueves',
    hora: '08:00',
    ...overrides,
  };
}

function direccion(id: string): Direccion {
  return { id, tipo: 'domicilio', calle: `Calle ${id}` } as Direccion;
}

const CATALOGO = [direccion('dir-casa'), direccion('dir-escuela')];

describe('camposDesdeRecorridoHabitual', () => {
  it('copia inicial -> origen, final -> destino y hora -> horaEstimada', () => {
    expect(camposDesdeRecorridoHabitual(habitual(), CATALOGO)).toEqual({
      direccionOrigenId: 'dir-casa',
      direccionDestinoId: 'dir-escuela',
      horaEstimada: '08:00',
    });
  });

  it('NUNCA invierte el par para la vuelta (RN-HR-02): el habitual se copia tal cual', () => {
    // La vuelta es su propio RecorridoHabitual en la ficha del paciente, no la ida dada vuelta.
    const ida = camposDesdeRecorridoHabitual(habitual(), CATALOGO);
    const vuelta = camposDesdeRecorridoHabitual(
      habitual({ direccionInicialId: 'dir-escuela', direccionFinalId: 'dir-casa', hora: '16:30' }),
      CATALOGO,
    );

    expect(ida.direccionOrigenId).toBe('dir-casa');
    expect(vuelta.direccionOrigenId).toBe('dir-escuela');
    expect(vuelta.direccionDestinoId).toBe('dir-casa');
  });

  it('descarta una dirección que ya no está en el catálogo del paciente', () => {
    // El habitual guarda ids: si la dirección se borró de la ficha después, copiarla dejaría el
    // select con un value que no existe entre sus <option> — peor que dejarlo vacío.
    const campos = camposDesdeRecorridoHabitual(habitual({ direccionFinalId: 'dir-borrada' }), CATALOGO);

    expect(campos.direccionOrigenId).toBe('dir-casa');
    expect(campos.direccionDestinoId).toBe('');
    expect(campos.horaEstimada).toBe('08:00');
  });

  it('con el catálogo vacío no copia ninguna dirección pero sí la hora', () => {
    expect(camposDesdeRecorridoHabitual(habitual(), [])).toEqual({
      direccionOrigenId: '',
      direccionDestinoId: '',
      horaEstimada: '08:00',
    });
  });
});
