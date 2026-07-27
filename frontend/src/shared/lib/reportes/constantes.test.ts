import { describe, expect, it } from 'vitest';
import constantesReportesRaw from './constantes.ts?raw';
import * as constantesFacturacion from '../facturacion/constantes';
import * as constantesMantenimiento from '../mantenimiento/constantes';
import { MAX_ITEMS_TARJETA, PERIODOS_DISPONIBLES, UMBRAL_CUD_DASHBOARD_DIAS } from './constantes';

// tasks.md 4.1/4.2, design.md Decisión 10, spec reportes-contract (Scenario "Sin constantes
// duplicadas"): shared/lib/reportes/constantes.ts declara SOLO lo propio del dashboard —
// ningún umbral que ya tenga dueño en facturacion/ o mantenimiento/.

function exportedConstNames(raw: string): string[] {
  return [...raw.matchAll(/export const (\w+)/g)]
    .map((m) => m[1])
    .filter((nombre): nombre is string => nombre !== undefined);
}

describe('shared/lib/reportes/constantes.ts', () => {
  it('declara PERIODOS_DISPONIBLES, MAX_ITEMS_TARJETA y UMBRAL_CUD_DASHBOARD_DIAS', () => {
    expect(PERIODOS_DISPONIBLES).toEqual([3, 6, 12]);
    expect(MAX_ITEMS_TARJETA).toBeGreaterThan(0);
    expect(UMBRAL_CUD_DASHBOARD_DIAS).toBe(60);
  });

  it('no redeclara ningún nombre de constante ya exportado por shared/lib/facturacion/constantes.ts', () => {
    const nombresReportes = exportedConstNames(constantesReportesRaw);
    const nombresFacturacion = Object.keys(constantesFacturacion);
    const colisiones = nombresReportes.filter((n) => nombresFacturacion.includes(n));
    expect(colisiones).toEqual([]);
  });

  it('no redeclara ningún nombre de constante ya exportado por shared/lib/mantenimiento/constantes.ts', () => {
    const nombresReportes = exportedConstNames(constantesReportesRaw);
    const nombresMantenimiento = Object.keys(constantesMantenimiento);
    const colisiones = nombresReportes.filter((n) => nombresMantenimiento.includes(n));
    expect(colisiones).toEqual([]);
  });
});
