import { describe, expect, it } from 'vitest';
import { agregarProgreso } from './progresoDocumental';

// documentos-checklist-por-actividad (tasks.md 5.1, design.md Checkpoint (f) VEREDICTO opción A):
// función pura que agrega el progreso ("X de Y cargados") de N instancias de checklist (el bloque
// "General" + una por actividad) en un único total para el encabezado de PacienteDocumentos.tsx.
// No conoce actividades ni React — solo suma pares {cargados, total}, misma fórmula que ya usa
// DocumentChecklist.tsx a nivel de una sola instancia (líneas 233-235), sin duplicarla ahí.
describe('agregarProgreso', () => {
  it('cero actividades: agrega un array vacío sin romper (0 de 0, 0%)', () => {
    expect(agregarProgreso([])).toEqual({ cargados: 0, total: 0, pct: 0 });
  });

  it('una actividad completa y otra vacía: suma cargados y totales por separado', () => {
    const resultado = agregarProgreso([
      { cargados: 3, total: 3 },
      { cargados: 0, total: 3 },
    ]);
    expect(resultado).toEqual({ cargados: 3, total: 6, pct: 50 });
  });

  it('todas completas: pct llega a 100', () => {
    const resultado = agregarProgreso([
      { cargados: 2, total: 2 },
      { cargados: 3, total: 3 },
      { cargados: 1, total: 1 },
    ]);
    expect(resultado).toEqual({ cargados: 6, total: 6, pct: 100 });
  });

  // Triangulación extra: ninguna cargada — pct no debe dar NaN ni dividir por cero de forma rara.
  it('ninguna cargada: pct da 0, no NaN', () => {
    const resultado = agregarProgreso([
      { cargados: 0, total: 2 },
      { cargados: 0, total: 4 },
    ]);
    expect(resultado).toEqual({ cargados: 0, total: 6, pct: 0 });
  });
});
