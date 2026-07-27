import { describe, expect, it } from 'vitest';
import type { Paciente } from '../../types/paciente';
import { UMBRAL_CUD_DASHBOARD_DIAS } from './constantes';
import { cudPorVencer } from './cudPorVencer';

// tasks.md 4.5, design.md Decisión 5, spec dashboard-tarjetas-alertas: cudPorVencer reutiliza
// estadoCud de shared/lib/pacientes/, nunca reimplementa la regla de vigencia del CUD.

function paciente(overrides: Partial<Paciente> = {}): Paciente {
  return {
    id: 'p1',
    apellido: 'Pérez',
    nombre: 'Juana',
    fechaNacimiento: '2000-01-01',
    dni: '30111222',
    cuilTitular: '27301112223',
    diagnostico: '',
    accesorioMovilidad: [],
    obraSocialId: null,
    numeroAfiliado: { formato: 'numero-documento', valor: '30111222' },
    cud: null,
    direcciones: [],
    personasACargo: [],
    amparoJudicial: false,
    ...overrides,
  };
}

const HOY = new Date('2026-07-24');

describe('cudPorVencer', () => {
  it('incluye al paciente cuyo CUD vence dentro del umbral, con estado por-vencer', () => {
    const pacientes = [paciente({ id: 'p1', cud: { numero: '1', fechaEmision: '2020-01-01', fechaVencimiento: '2026-08-10' } })];
    const resultado = cudPorVencer({ pacientes, hoy: HOY, umbralDias: UMBRAL_CUD_DASHBOARD_DIAS });
    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({ pacienteId: 'p1', estado: 'por-vencer', fechaVencimiento: '2026-08-10' });
  });

  it('incluye al paciente cuyo CUD ya venció, diferenciado con estado vencido', () => {
    const pacientes = [paciente({ id: 'p1', cud: { numero: '1', fechaEmision: '2020-01-01', fechaVencimiento: '2026-01-01' } })];
    const resultado = cudPorVencer({ pacientes, hoy: HOY, umbralDias: UMBRAL_CUD_DASHBOARD_DIAS });
    expect(resultado[0]?.estado).toBe('vencido');
  });

  it('excluye al paciente cuyo CUD está vigente (vence después de la ventana de aviso)', () => {
    const pacientes = [paciente({ id: 'p1', cud: { numero: '1', fechaEmision: '2020-01-01', fechaVencimiento: '2027-06-01' } })];
    expect(cudPorVencer({ pacientes, hoy: HOY, umbralDias: UMBRAL_CUD_DASHBOARD_DIAS })).toEqual([]);
  });

  it('omite sin error al paciente con cud: null', () => {
    const pacientes = [paciente({ id: 'p1', cud: null })];
    expect(() => cudPorVencer({ pacientes, hoy: HOY, umbralDias: UMBRAL_CUD_DASHBOARD_DIAS })).not.toThrow();
    expect(cudPorVencer({ pacientes, hoy: HOY, umbralDias: UMBRAL_CUD_DASHBOARD_DIAS })).toEqual([]);
  });
});
