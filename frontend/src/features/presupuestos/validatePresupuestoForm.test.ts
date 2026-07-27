import { describe, expect, it } from 'vitest';
import { validatePresupuestoForm } from './validatePresupuestoForm';

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
