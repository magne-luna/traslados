import { describe, expect, it } from 'vitest';
import { toMantenimientoRegistro } from './toMantenimientoRegistro';
import type { MantenimientoFormInput } from './validateMantenimientoForm';

// RED→GREEN (tasks.md 3.6): estrecha el input validado del formulario (laxo, todo `string`) al
// tipo estricto `MantenimientoRegistro` (unión discriminada, design.md Decisión 4). Se asume que
// el input ya pasó `validateMantenimientoForm` sin errores — esta función no vuelve a validar.

function buildInput(overrides: Partial<MantenimientoFormInput> = {}): MantenimientoFormInput {
  return {
    tipoIntervencion: 'preventivo',
    subtipo: 'cambio-aceite-filtros',
    detalle: '',
    fecha: '2026-07-01',
    kilometraje: '45000',
    proximoVencimientoFecha: '',
    proximoVencimientoKm: '',
    ...overrides,
  };
}

describe('toMantenimientoRegistro', () => {
  it('un preventivo sale sin la propiedad detalle ni id (el id lo asigna el caller)', () => {
    const registro = toMantenimientoRegistro(buildInput());

    expect(registro).toEqual({
      fecha: '2026-07-01',
      kilometraje: 45_000,
      tipoIntervencion: 'preventivo',
      subtipo: 'cambio-aceite-filtros',
    });
    expect('detalle' in registro).toBe(false);
    expect('id' in registro).toBe(false);
  });

  it('un correctivo con sub-tipo "otro" sale con el detalle ingresado', () => {
    const registro = toMantenimientoRegistro(
      buildInput({ tipoIntervencion: 'correctivo', subtipo: 'otro', detalle: 'Radiador perforado' }),
    );

    expect(registro).toMatchObject({
      tipoIntervencion: 'correctivo',
      subtipo: 'otro',
      detalle: 'Radiador perforado',
    });
  });

  it('un correctivo con sub-tipo conocido (no "otro") sale sin detalle', () => {
    const registro = toMantenimientoRegistro(buildInput({ tipoIntervencion: 'correctivo', subtipo: 'frenos' }));

    expect('detalle' in registro).toBe(false);
  });

  it('incluye próximo vencimiento por fecha/km cuando se ingresan', () => {
    const registro = toMantenimientoRegistro(
      buildInput({ proximoVencimientoFecha: '2027-01-01', proximoVencimientoKm: '55000' }),
    );

    expect(registro.proximoVencimientoFecha).toBe('2027-01-01');
    expect(registro.proximoVencimientoKm).toBe(55_000);
  });

  it('omite próximo vencimiento cuando se dejan vacíos (opcionales)', () => {
    const registro = toMantenimientoRegistro(buildInput());

    expect(registro.proximoVencimientoFecha).toBeUndefined();
    expect(registro.proximoVencimientoKm).toBeUndefined();
  });
});
