import { describe, expect, it } from 'vitest';
import { validatePacienteForm } from './validatePacienteForm';

describe('validatePacienteForm', () => {
  it('señala apellido, nombre y DNI como requeridos cuando están vacíos', () => {
    const errors = validatePacienteForm({ apellido: '', nombre: '', dni: '' });

    expect(errors.apellido).toBeTruthy();
    expect(errors.nombre).toBeTruthy();
    expect(errors.dni).toBeTruthy();
  });

  it('no reporta errores cuando los tres campos requeridos están completos (triangulación)', () => {
    const errors = validatePacienteForm({ apellido: 'Gómez', nombre: 'Martina', dni: '45123456' });

    expect(errors).toEqual({});
  });

  it('trata espacios en blanco como campo vacío', () => {
    const errors = validatePacienteForm({ apellido: '   ', nombre: 'Martina', dni: '45123456' });

    expect(errors.apellido).toBeTruthy();
  });

  // RF-106/RN-ID-02: delega en validarIdentificadorAfiliado.ts (probado en detalle por separado);
  // acá solo se cubre que el resultado quede enganchado en `errors.numeroAfiliado` y bloquee.
  it('sin obra social (formato null): un valor no vacío que no matchearía ningún patrón no reporta error', () => {
    const errors = validatePacienteForm({
      apellido: 'Gómez',
      nombre: 'Martina',
      dni: '45123456',
      formato: null,
      numeroAfiliado: { valor: 'lo-que-sea' },
    });

    expect(errors.numeroAfiliado).toBeUndefined();
  });

  it('con formato numero-documento y un valor que no matchea 7-8 dígitos: reporta error y bloquea', () => {
    const errors = validatePacienteForm({
      apellido: 'Gómez',
      nombre: 'Martina',
      dni: '45123456',
      formato: 'numero-documento',
      numeroAfiliado: { valor: 'OS-AB12345' },
    });

    expect(errors.numeroAfiliado).toBeTruthy();
  });

  it('con formato numero-documento y 8 dígitos: no reporta error', () => {
    const errors = validatePacienteForm({
      apellido: 'Gómez',
      nombre: 'Martina',
      dni: '45123456',
      formato: 'numero-documento',
      numeroAfiliado: { valor: '45123456' },
    });

    expect(errors.numeroAfiliado).toBeUndefined();
  });

  it('con formato elegido pero valor vacío: no reporta error (carga diferida de la cobertura)', () => {
    const errors = validatePacienteForm({
      apellido: 'Gómez',
      nombre: 'Martina',
      dni: '45123456',
      formato: 'cuil-con-sufijo',
      numeroAfiliado: { valor: '' },
    });

    expect(errors.numeroAfiliado).toBeUndefined();
  });
});
