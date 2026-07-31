import { describe, expect, it } from 'vitest';
import type { MantenimientoRegistro } from './vehiculo';

// Test de tipos (tasks.md 2.7, spec vehiculo-contract — escenarios "Detalle obligatorio del
// sub-tipo de escape verificado por el compilador" y "Un registro de tipo gasto no admite
// sub-tipo"): las dos invariantes de la unión discriminada de MantenimientoRegistro (design.md
// Decisión 4) las garantiza `tsc`, no una validación en runtime. Este archivo no tiene
// aserciones en runtime más allá de `expect(true).toBe(true)` — lo que falla o pasa es la
// compilación misma vía `npx tsc -b --noEmit` y las directivas `@ts-expect-error`.

describe('MantenimientoRegistro — invariantes verificadas por el compilador', () => {
  it('un correctivo con sub-tipo de escape (otro) sin detalle no compila', () => {
    // @ts-expect-error — 'otro' exige `detalle: string`; sin él el objeto no satisface ningún miembro de la unión (Decisión 4 de design.md).
    const invalido: MantenimientoRegistro = {
      id: 'm1',
      fecha: '2026-07-01',
      kilometraje: 1000,
      tipoIntervencion: 'correctivo',
      subtipo: 'otro',
    };
    expect(invalido.tipoIntervencion).toBe('correctivo');
  });

  it('un registro de tipo "gasto" con sub-tipo no compila', () => {
    const invalido: MantenimientoRegistro = {
      id: 'm2',
      fecha: '2026-07-01',
      kilometraje: 1000,
      tipoIntervencion: 'gasto',
      // @ts-expect-error — el miembro `gasto` de la unión no admite la propiedad `subtipo`.
      subtipo: 'cambio-aceite-filtros',
    };
    expect(invalido.tipoIntervencion).toBe('gasto');
  });

  it('un preventivo válido con sub-tipo cerrado compila', () => {
    const valido: MantenimientoRegistro = {
      id: 'm3',
      fecha: '2026-07-01',
      kilometraje: 40_000,
      tipoIntervencion: 'preventivo',
      subtipo: 'cambio-aceite-filtros',
    };
    expect(valido.tipoIntervencion).toBe('preventivo');
  });

  it('un correctivo válido con sub-tipo de escape y detalle compila', () => {
    const valido: MantenimientoRegistro = {
      id: 'm4',
      fecha: '2026-07-01',
      kilometraje: 40_000,
      tipoIntervencion: 'correctivo',
      subtipo: 'otro',
      detalle: 'Radiador perforado',
    };
    expect(valido.subtipo).toBe('otro');
  });

  it('un registro de tipo "gasto" sin sub-tipo compila (se muestra pero no se da de alta acá)', () => {
    const valido: MantenimientoRegistro = {
      id: 'm5',
      fecha: '2026-07-01',
      kilometraje: 40_000,
      tipoIntervencion: 'gasto',
    };
    expect(valido.tipoIntervencion).toBe('gasto');
  });
});
