import { describe, expect, it } from 'vitest';
import { validarCupoFacturacion } from './validarCupoFacturacion';

describe('validarCupoFacturacion', () => {
  it('marca exceso de días con un mensaje comparativo', () => {
    const resultado = validarCupoFacturacion({
      diasFacturados: 22,
      kmFacturados: 400,
      cupo: { pacienteId: 'p1', cupoMensualDias: 20, cupoMensualKm: 600 },
    });

    expect(resultado.excedeDias).toBe(true);
    expect(resultado.excedeKm).toBe(false);
    expect(resultado.mensaje).toContain('20');
    expect(resultado.mensaje).toContain('22');
  });

  it('marca exceso de km con un mensaje comparativo', () => {
    const resultado = validarCupoFacturacion({
      diasFacturados: 10,
      kmFacturados: 700,
      cupo: { pacienteId: 'p1', cupoMensualDias: 20, cupoMensualKm: 600 },
    });

    expect(resultado.excedeKm).toBe(true);
    expect(resultado.excedeDias).toBe(false);
    expect(resultado.mensaje).toContain('600');
    expect(resultado.mensaje).toContain('700');
  });

  it('no marca exceso cuando está dentro del cupo (borde inclusive)', () => {
    const resultado = validarCupoFacturacion({
      diasFacturados: 20,
      kmFacturados: 600,
      cupo: { pacienteId: 'p1', cupoMensualDias: 20, cupoMensualKm: 600 },
    });

    expect(resultado.excedeDias).toBe(false);
    expect(resultado.excedeKm).toBe(false);
    expect(resultado.cupoDisponible).toBe(true);
  });

  it('avisa que no hay cupo contra el cual validar cuando la autorización está ausente', () => {
    const resultado = validarCupoFacturacion({ diasFacturados: 22, kmFacturados: 700, cupo: undefined });

    expect(resultado.cupoDisponible).toBe(false);
    expect(resultado.excedeDias).toBe(false);
    expect(resultado.excedeKm).toBe(false);
    expect(resultado.mensaje.toLowerCase()).toContain('no hay cupo');
  });

  it('avisa que no hay cupo contra el cual validar cuando la autorización no tiene valores cargados', () => {
    const resultado = validarCupoFacturacion({
      diasFacturados: 22,
      kmFacturados: 700,
      cupo: { pacienteId: 'p1' },
    });

    expect(resultado.cupoDisponible).toBe(false);
    expect(resultado.mensaje.toLowerCase()).toContain('no hay cupo');
  });
});
