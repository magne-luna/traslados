import { describe, expect, it } from 'vitest';
import { ordenarVehiculos } from './ordenarVehiculos';

type Item = { patente: string; estado: 'habilitado' | 'fuera-de-servicio' };

describe('ordenarVehiculos', () => {
  it('pone los habilitados primero y los fuera de servicio al final, cada grupo por patente A→Z', () => {
    const items: Item[] = [
      { patente: 'ZZ999AA', estado: 'fuera-de-servicio' },
      { patente: 'CC333CC', estado: 'habilitado' },
      { patente: 'AB123CD', estado: 'fuera-de-servicio' },
      { patente: 'AA111AA', estado: 'habilitado' },
    ];

    expect(ordenarVehiculos(items).map((v) => v.patente)).toEqual(['AA111AA', 'CC333CC', 'AB123CD', 'ZZ999AA']);
  });

  it('ignora mayúsculas/minúsculas y no muta el array original', () => {
    const items: Item[] = [
      { patente: 'bb222bb', estado: 'habilitado' },
      { patente: 'AA111AA', estado: 'habilitado' },
    ];

    expect(ordenarVehiculos(items).map((v) => v.patente)).toEqual(['AA111AA', 'bb222bb']);
    expect(items.map((v) => v.patente)).toEqual(['bb222bb', 'AA111AA']);
  });
});
