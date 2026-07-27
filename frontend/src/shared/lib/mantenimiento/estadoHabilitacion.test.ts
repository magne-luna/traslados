import { describe, expect, it } from 'vitest';
import { estadoHabilitacion } from './estadoHabilitacion';

// RN-VE-04: vencimiento de VTV (cada 6 meses) y RTO, evaluados de forma independiente entre sí
// a partir de la fecha de vencimiento registrada de cada habilitación.

describe('estadoHabilitacion', () => {
  it('devuelve "vigente" cuando el vencimiento está lejos en el futuro', () => {
    const estado = estadoHabilitacion({
      fechaVencimiento: '2027-01-01',
      ahora: new Date('2026-07-24'),
    });

    expect(estado).toBe('vigente');
  });

  it('devuelve "por-vencer" cuando el vencimiento cae dentro de la ventana de aviso configurada', () => {
    const estado = estadoHabilitacion({
      fechaVencimiento: '2026-08-10',
      ahora: new Date('2026-07-24'),
    });

    expect(estado).toBe('por-vencer');
  });

  it('devuelve "vencida" cuando la fecha de vencimiento ya pasó', () => {
    const estado = estadoHabilitacion({
      fechaVencimiento: '2026-01-01',
      ahora: new Date('2026-07-24'),
    });

    expect(estado).toBe('vencida');
  });

  it('VTV y RTO se evalúan de forma independiente: cada llamada solo depende de su propia fecha', () => {
    const vtv = estadoHabilitacion({ fechaVencimiento: '2027-01-01', ahora: new Date('2026-07-24') });
    const rto = estadoHabilitacion({ fechaVencimiento: '2026-01-01', ahora: new Date('2026-07-24') });

    expect(vtv).toBe('vigente');
    expect(rto).toBe('vencida');
  });
});
