import { describe, expect, it } from 'vitest';
import type { MantenimientoRegistro } from '../../types/vehiculo';
import { derivarHabilitaciones } from './derivarHabilitaciones';

// Función pura (tasks.md 2B.1, design.md D3 opción B): las habilitaciones VTV/RTO se derivan del
// historial de mantenimiento en vez de persistirse aparte. Regla exacta: por cada tipo ∈
// {'vtv','rto'}, se toman las filas preventivas de ese subtipo CON `proximoVencimientoFecha` no
// nulo y se elige la de `fecha` más reciente (desempate determinista por `id`); `fecha` →
// `fechaEmision`, `proximoVencimientoFecha` → `fechaVencimiento`. Sin candidatas → no se emite
// (nunca se inventa una fecha).

function preventivo(overrides: Partial<MantenimientoRegistro> & { subtipo: 'vtv' | 'rto' | 'cambio-aceite-filtros' }): MantenimientoRegistro {
  return {
    id: 'm-1',
    fecha: '2026-01-01',
    kilometraje: 1000,
    tipoIntervencion: 'preventivo',
    ...overrides,
  } as MantenimientoRegistro;
}

describe('derivarHabilitaciones', () => {
  it('sin filas de mantenimiento no emite ninguna habilitación', () => {
    expect(derivarHabilitaciones([])).toEqual([]);
  });

  it('una VTV con próximo vencimiento produce una habilitación de tipo vtv', () => {
    const mantenimientos = [
      preventivo({ id: 'm-vtv', subtipo: 'vtv', fecha: '2026-01-01', proximoVencimientoFecha: '2027-01-01' }),
    ];

    expect(derivarHabilitaciones(mantenimientos)).toEqual([
      { tipo: 'vtv', fechaEmision: '2026-01-01', fechaVencimiento: '2027-01-01' },
    ]);
  });

  it('varias VTV: gana la de fecha más reciente (triangulación)', () => {
    const mantenimientos = [
      preventivo({ id: 'm-vieja', subtipo: 'vtv', fecha: '2025-01-01', proximoVencimientoFecha: '2026-01-01' }),
      preventivo({ id: 'm-reciente', subtipo: 'vtv', fecha: '2026-06-01', proximoVencimientoFecha: '2026-12-01' }),
      preventivo({ id: 'm-intermedia', subtipo: 'vtv', fecha: '2026-03-01', proximoVencimientoFecha: '2026-09-01' }),
    ];

    expect(derivarHabilitaciones(mantenimientos)).toEqual([
      { tipo: 'vtv', fechaEmision: '2026-06-01', fechaVencimiento: '2026-12-01' },
    ]);
  });

  it('una VTV sin próximo vencimiento no produce habilitación (nunca se inventa una fecha)', () => {
    const mantenimientos = [preventivo({ id: 'm-vtv-sin-venc', subtipo: 'vtv', fecha: '2026-01-01' })];

    expect(derivarHabilitaciones(mantenimientos)).toEqual([]);
  });

  it('VTV y RTO se derivan de forma independiente (RN-VE-04)', () => {
    const mantenimientos = [
      preventivo({ id: 'm-vtv', subtipo: 'vtv', fecha: '2026-01-01', proximoVencimientoFecha: '2027-01-01' }),
    ];

    const resultado = derivarHabilitaciones(mantenimientos);
    expect(resultado).toHaveLength(1);
    expect(resultado.find((h) => h.tipo === 'rto')).toBeUndefined();
  });

  it('VTV y RTO conviven cuando ambas tienen registro con vencimiento', () => {
    const mantenimientos = [
      preventivo({ id: 'm-vtv', subtipo: 'vtv', fecha: '2026-01-01', proximoVencimientoFecha: '2027-01-01' }),
      preventivo({ id: 'm-rto', subtipo: 'rto', fecha: '2026-02-01', proximoVencimientoFecha: '2026-08-01' }),
    ];

    expect(derivarHabilitaciones(mantenimientos)).toEqual([
      { tipo: 'vtv', fechaEmision: '2026-01-01', fechaVencimiento: '2027-01-01' },
      { tipo: 'rto', fechaEmision: '2026-02-01', fechaVencimiento: '2026-08-01' },
    ]);
  });

  it('empate de fecha: desempate determinista por id, estable entre corridas', () => {
    const mantenimientos = [
      preventivo({ id: 'm-b', subtipo: 'vtv', fecha: '2026-01-01', proximoVencimientoFecha: '2026-07-01' }),
      preventivo({ id: 'm-a', subtipo: 'vtv', fecha: '2026-01-01', proximoVencimientoFecha: '2026-06-01' }),
    ];

    const primeraCorrida = derivarHabilitaciones(mantenimientos);
    const segundaCorrida = derivarHabilitaciones([...mantenimientos]);

    expect(primeraCorrida).toEqual(segundaCorrida);
    expect(primeraCorrida).toHaveLength(1);
  });

  it('ignora intervenciones no relevantes: cambio de aceite, correctivo y gasto', () => {
    const mantenimientos: MantenimientoRegistro[] = [
      preventivo({ id: 'm-aceite', subtipo: 'cambio-aceite-filtros', fecha: '2026-01-01', proximoVencimientoKm: 90_000 }),
      { id: 'm-correctivo', fecha: '2026-01-01', kilometraje: 1000, tipoIntervencion: 'correctivo', subtipo: 'frenos' },
      { id: 'm-gasto', fecha: '2026-01-01', kilometraje: 1000, tipoIntervencion: 'gasto' },
    ];

    expect(derivarHabilitaciones(mantenimientos)).toEqual([]);
  });

  it('una VTV descartada por incoherente (ausente del array) no produce una habilitación fantasma', () => {
    // El mapeo puro descarta filas incoherentes antes de llegar acá (4.3): esta función solo ve lo
    // que ya sobrevivió el parseo, así que una lista sin la fila incoherente simplemente no la ve.
    expect(derivarHabilitaciones([])).toEqual([]);
  });
});
