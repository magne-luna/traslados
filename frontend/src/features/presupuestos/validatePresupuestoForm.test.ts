import { describe, expect, it } from 'vitest';
import { validatePresupuestoForm, validatePresupuestoLoteForm } from './validatePresupuestoForm';

// Validación de campos requeridos del formulario de Presupuesto (tasks.md 5.3): exige paciente,
// obra social y monto. Función pura: sin acceso a DOM ni al repository, testeable aislada.

describe('validatePresupuestoForm', () => {
  it('señala el paciente faltante cuando pacienteId es null', () => {
    const errors = validatePresupuestoForm({ pacienteId: null, obraSocialId: 'osecac', monto: 1000 });

    expect(errors.pacienteId).toBeDefined();
  });

  it('señala la obra social faltante cuando obraSocialId es null', () => {
    const errors = validatePresupuestoForm({ pacienteId: 'paciente-martina', obraSocialId: null, monto: 1000 });

    expect(errors.obraSocialId).toBeDefined();
  });

  it('señala el monto faltante cuando es 0 o negativo (triangulación con el borde)', () => {
    expect(validatePresupuestoForm({ pacienteId: 'paciente-martina', obraSocialId: 'osecac', monto: 0 }).monto).toBeDefined();
    expect(validatePresupuestoForm({ pacienteId: 'paciente-martina', obraSocialId: 'osecac', monto: -10 }).monto).toBeDefined();
  });

  it('no devuelve errores cuando paciente, obra social y monto son válidos', () => {
    const errors = validatePresupuestoForm({ pacienteId: 'paciente-martina', obraSocialId: 'osecac', monto: 1000 });

    expect(errors).toEqual({});
  });
});

// validatePresupuestoLoteForm (presupuesto-prestaciones, tasks.md 8.7, design.md D9/D10): rama
// `por-prestacion` — sin `monto` único, valida que al menos una prestación seleccionada tenga
// monto > 0.
describe('validatePresupuestoLoteForm', () => {
  it('señala el paciente faltante cuando pacienteId es null', () => {
    const errors = validatePresupuestoLoteForm({
      pacienteId: null,
      obraSocialId: 'osecac',
      items: [{ prestacionId: 'prestacion-kine', monto: 100 }],
    });

    expect(errors.pacienteId).toBeDefined();
  });

  it('señala la obra social faltante cuando obraSocialId es null', () => {
    const errors = validatePresupuestoLoteForm({
      pacienteId: 'paciente-martina',
      obraSocialId: null,
      items: [{ prestacionId: 'prestacion-kine', monto: 100 }],
    });

    expect(errors.obraSocialId).toBeDefined();
  });

  it('señala items faltante cuando ninguna prestación seleccionada tiene monto > 0', () => {
    const errors = validatePresupuestoLoteForm({
      pacienteId: 'paciente-martina',
      obraSocialId: 'osecac',
      items: [
        { prestacionId: 'prestacion-kine', monto: 0 },
        { prestacionId: 'prestacion-fono', monto: 0 },
      ],
    });

    expect(errors.items).toBeDefined();
  });

  it('no señala items cuando al menos una prestación seleccionada tiene monto > 0 (triangulación)', () => {
    const errors = validatePresupuestoLoteForm({
      pacienteId: 'paciente-martina',
      obraSocialId: 'osecac',
      items: [
        { prestacionId: 'prestacion-kine', monto: 0 },
        { prestacionId: 'prestacion-fono', monto: 200 },
      ],
    });

    expect(errors.items).toBeUndefined();
  });

  it('no devuelve errores cuando todo es válido', () => {
    const errors = validatePresupuestoLoteForm({
      pacienteId: 'paciente-martina',
      obraSocialId: 'osecac',
      items: [{ prestacionId: 'prestacion-kine', monto: 100 }],
    });

    expect(errors).toEqual({});
  });
});
