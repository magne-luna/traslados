import { describe, expect, it } from 'vitest';
import { estadoCud } from './estadoCud';
import type { Cud } from '../../types/paciente';

// RF-104: alerta de vencimiento próximo del CUD. Misma lógica de "días hasta vencimiento"
// que estadoHabilitacion (FE-2), pero como función independiente porque el dominio y el umbral
// por defecto (60 días) son propios de Pacientes.

function buildCud(fechaVencimiento: string): Cud {
  return { numero: '12345', fechaEmision: '2020-01-01', fechaVencimiento };
}

describe('estadoCud', () => {
  it('devuelve "vencido" cuando la fecha de vencimiento ya pasó', () => {
    const estado = estadoCud(buildCud('2026-01-01'), new Date('2026-07-24'));

    expect(estado).toBe('vencido');
  });

  it('devuelve "por-vencer" cuando el vencimiento cae dentro del umbral por defecto (60 días)', () => {
    const estado = estadoCud(buildCud('2026-08-10'), new Date('2026-07-24'));

    expect(estado).toBe('por-vencer');
  });

  it('devuelve "vigente" cuando el vencimiento está fuera del umbral', () => {
    const estado = estadoCud(buildCud('2027-01-01'), new Date('2026-07-24'));

    expect(estado).toBe('vigente');
  });

  it('caso de borde: vencimiento exactamente en el límite del umbral es "por-vencer"', () => {
    // 2026-07-24 + 60 días = 2026-09-22
    const estado = estadoCud(buildCud('2026-09-22'), new Date('2026-07-24'));

    expect(estado).toBe('por-vencer');
  });

  it('acepta un umbral configurable distinto del default', () => {
    const estado = estadoCud(buildCud('2026-08-10'), new Date('2026-07-24'), 5);

    expect(estado).toBe('vigente');
  });
});
