import { describe, expect, it } from 'vitest';
import { validateMantenimientoForm, type MantenimientoFormInput } from './validateMantenimientoForm';

// RED→GREEN (tasks.md 3.4/3.5): validación pura del alta de intervención de mantenimiento, sin
// DOM ni repository. Spec `vehiculo-mantenimiento-historial`, escenarios "Validación de fecha y
// kilometraje", "Sub-tipo de escape con detalle obligatorio" y "Próximo vencimiento opcional".

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

describe('validateMantenimientoForm', () => {
  it('caso feliz: preventivo con sub-tipo cerrado, sin errores', () => {
    expect(validateMantenimientoForm(buildInput())).toEqual({});
  });

  it('fecha vacía es obligatoria', () => {
    const errors = validateMantenimientoForm(buildInput({ fecha: '' }));
    expect(errors.fecha).toBeDefined();
  });

  it('kilometraje vacío es obligatorio', () => {
    const errors = validateMantenimientoForm(buildInput({ kilometraje: '' }));
    expect(errors.kilometraje).toBeDefined();
  });

  it('kilometraje negativo es inválido (borde)', () => {
    const errors = validateMantenimientoForm(buildInput({ kilometraje: '-5' }));
    expect(errors.kilometraje).toBeDefined();
  });

  it('kilometraje no numérico es inválido (borde)', () => {
    const errors = validateMantenimientoForm(buildInput({ kilometraje: 'abc' }));
    expect(errors.kilometraje).toBeDefined();
  });

  it('tipo de intervención vacío es obligatorio', () => {
    const errors = validateMantenimientoForm(buildInput({ tipoIntervencion: '' }));
    expect(errors.tipoIntervencion).toBeDefined();
  });

  it('sub-tipo obligatorio cuando el tipo es preventivo', () => {
    const errors = validateMantenimientoForm(buildInput({ tipoIntervencion: 'preventivo', subtipo: '' }));
    expect(errors.subtipo).toBeDefined();
  });

  it('sub-tipo obligatorio cuando el tipo es correctivo (triangulación)', () => {
    const errors = validateMantenimientoForm(buildInput({ tipoIntervencion: 'correctivo', subtipo: '' }));
    expect(errors.subtipo).toBeDefined();
  });

  it('detalle obligatorio y no vacío cuando el sub-tipo es "otro"', () => {
    const errors = validateMantenimientoForm(
      buildInput({ tipoIntervencion: 'correctivo', subtipo: 'otro', detalle: '' }),
    );
    expect(errors.detalle).toBeDefined();
  });

  it('detalle en blanco (solo espacios) también es inválido cuando el sub-tipo es "otro" (borde)', () => {
    const errors = validateMantenimientoForm(
      buildInput({ tipoIntervencion: 'correctivo', subtipo: 'otro', detalle: '   ' }),
    );
    expect(errors.detalle).toBeDefined();
  });

  it('correctivo con sub-tipo conocido (no "otro") no exige detalle', () => {
    const errors = validateMantenimientoForm(buildInput({ tipoIntervencion: 'correctivo', subtipo: 'frenos' }));
    expect(errors.detalle).toBeUndefined();
  });

  it('próximo vencimiento por fecha y por km son opcionales, el alta pasa sin ellos', () => {
    const errors = validateMantenimientoForm(
      buildInput({ proximoVencimientoFecha: '', proximoVencimientoKm: '' }),
    );
    expect(errors).toEqual({});
  });
});
