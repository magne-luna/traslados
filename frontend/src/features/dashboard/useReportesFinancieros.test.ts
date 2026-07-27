import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Cobro, Factura } from '../../shared/types/factura';
import * as facturadoVsCobradoModule from '../../shared/lib/reportes/facturadoVsCobrado';
import * as facturasEnMoraModule from '../../shared/lib/reportes/facturasEnMora';
import * as resumenAnualModule from '../../shared/lib/reportes/resumenAnual';
import { useReportesFinancieros } from './useReportesFinancieros';

// tasks.md 5.5, design.md Decisión 7 (nota de eficiencia): facturadoVsCobrado, resumenAnual y
// facturasEnMora se memoizan sobre el par (facturas, cobros) — cambiar el período o el año
// seleccionado no debe recalcular lo que no cambió ni disparar una lectura nueva.

const facturas: Factura[] = [];
const cobros: Cobro[] = [];
const hoy = '2026-07-24';

describe('useReportesFinancieros', () => {
  it('expone serie (facturadoVsCobrado), resumen (resumenAnual) y mora (facturasEnMora) inicial', () => {
    const { result } = renderHook(() => useReportesFinancieros({ facturas, cobros, hoy }));
    expect(result.current.serie.puntos.length).toBeGreaterThan(0);
    expect(result.current.resumen.meses).toHaveLength(12);
    expect(result.current.mora).toEqual([]);
  });

  it('cambiar el período no vuelve a calcular resumenAnual ni facturasEnMora', () => {
    const spyResumen = vi.spyOn(resumenAnualModule, 'resumenAnual');
    const spyMora = vi.spyOn(facturasEnMoraModule, 'facturasEnMora');
    const spySerie = vi.spyOn(facturadoVsCobradoModule, 'facturadoVsCobrado');

    const { result } = renderHook(() => useReportesFinancieros({ facturas, cobros, hoy }));
    spyResumen.mockClear();
    spyMora.mockClear();
    spySerie.mockClear();

    act(() => result.current.setPeriodo(12));

    expect(spySerie).toHaveBeenCalledTimes(1);
    expect(spyResumen).not.toHaveBeenCalled();
    expect(spyMora).not.toHaveBeenCalled();

    spyResumen.mockRestore();
    spyMora.mockRestore();
    spySerie.mockRestore();
  });

  it('cambiar el año no vuelve a calcular facturadoVsCobrado ni facturasEnMora', () => {
    const spyResumen = vi.spyOn(resumenAnualModule, 'resumenAnual');
    const spyMora = vi.spyOn(facturasEnMoraModule, 'facturasEnMora');
    const spySerie = vi.spyOn(facturadoVsCobradoModule, 'facturadoVsCobrado');

    const { result } = renderHook(() => useReportesFinancieros({ facturas, cobros, hoy }));
    spyResumen.mockClear();
    spyMora.mockClear();
    spySerie.mockClear();

    act(() => result.current.setAnio(2025));

    expect(spyResumen).toHaveBeenCalledTimes(1);
    expect(spySerie).not.toHaveBeenCalled();
    expect(spyMora).not.toHaveBeenCalled();

    spyResumen.mockRestore();
    spyMora.mockRestore();
    spySerie.mockRestore();
  });

  it('expone los años disponibles derivados de aniosConDatos', () => {
    const { result } = renderHook(() => useReportesFinancieros({ facturas, cobros, hoy }));
    expect(result.current.aniosDisponibles).toContain(2026);
  });
});
