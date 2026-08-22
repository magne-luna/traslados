import { describe, expect, it } from 'vitest';
import type { RecorridoHabitual } from '../../shared/types/recorridoHabitual';
import type { Direccion } from '../../shared/types/paciente';
import { construirDatosTrasladoDesdeRecorridos } from './construirDatosTrasladoDesdeRecorridos';

const casa: Direccion = { id: 'dir-casa', tipo: 'domicilio', calle: 'San Martín 123', localidad: 'Quilmes' };
const escuela: Direccion = { id: 'dir-escuela', tipo: 'escuela-especial', calle: 'Belgrano 456', localidad: 'Quilmes' };
const direcciones = [casa, escuela];

describe('construirDatosTrasladoDesdeRecorridos (tasks.md 8.5, design.md D2)', () => {
  it('sin recorridos: devuelve diasSemana vacío y ningún otro campo', () => {
    const resultado = construirDatosTrasladoDesdeRecorridos([], direcciones);
    expect(resultado).toEqual({ diasSemana: [] });
  });

  it('un solo recorrido (solo ida): copia origen/destino/horario de entrada, sin vuelta', () => {
    const recorridos: RecorridoHabitual[] = [
      { id: 'r1', pacienteId: 'p1', direccionInicialId: 'dir-casa', direccionFinalId: 'dir-escuela', diaSemana: 'lunes', hora: '08:00' },
    ];

    const resultado = construirDatosTrasladoDesdeRecorridos(recorridos, direcciones);

    expect(resultado).toEqual({
      diasSemana: ['lunes'],
      origenIda: 'San Martín 123, Quilmes',
      destinoIda: 'Belgrano 456, Quilmes',
      horarioEntrada: '08:00',
    });
  });

  it('ida y vuelta exacta (mismo par de direcciones invertido): completa el tramo de vuelta', () => {
    const recorridos: RecorridoHabitual[] = [
      { id: 'r1', pacienteId: 'p1', direccionInicialId: 'dir-casa', direccionFinalId: 'dir-escuela', diaSemana: 'lunes', hora: '08:00' },
      { id: 'r2', pacienteId: 'p1', direccionInicialId: 'dir-escuela', direccionFinalId: 'dir-casa', diaSemana: 'lunes', hora: '16:30' },
    ];

    const resultado = construirDatosTrasladoDesdeRecorridos(recorridos, direcciones);

    expect(resultado).toEqual({
      diasSemana: ['lunes'],
      origenIda: 'San Martín 123, Quilmes',
      destinoIda: 'Belgrano 456, Quilmes',
      horarioEntrada: '08:00',
      origenVuelta: 'Belgrano 456, Quilmes',
      destinoVuelta: 'San Martín 123, Quilmes',
      horarioSalida: '16:30',
    });
  });

  it('varios días de la semana: diasSemana es la unión ordenada, no solo el día del tramo de ida', () => {
    const recorridos: RecorridoHabitual[] = [
      { id: 'r1', pacienteId: 'p1', direccionInicialId: 'dir-casa', direccionFinalId: 'dir-escuela', diaSemana: 'miercoles', hora: '08:00' },
      { id: 'r2', pacienteId: 'p1', direccionInicialId: 'dir-casa', direccionFinalId: 'dir-escuela', diaSemana: 'lunes', hora: '08:00' },
      { id: 'r3', pacienteId: 'p1', direccionInicialId: 'dir-casa', direccionFinalId: 'dir-escuela', diaSemana: 'viernes', hora: '08:00' },
    ];

    const resultado = construirDatosTrasladoDesdeRecorridos(recorridos, direcciones);

    expect(resultado.diasSemana).toEqual(['lunes', 'miercoles', 'viernes']);
  });

  it('dos recorridos que NO son el camino inverso exacto: no inventa un tramo de vuelta', () => {
    const otraDireccion: Direccion = { id: 'dir-terapia', tipo: 'terapia', calle: 'Rivadavia 789', localidad: 'Quilmes' };
    const recorridos: RecorridoHabitual[] = [
      { id: 'r1', pacienteId: 'p1', direccionInicialId: 'dir-casa', direccionFinalId: 'dir-escuela', diaSemana: 'lunes', hora: '08:00' },
      { id: 'r2', pacienteId: 'p1', direccionInicialId: 'dir-escuela', direccionFinalId: 'dir-terapia', diaSemana: 'lunes', hora: '14:00' },
    ];

    const resultado = construirDatosTrasladoDesdeRecorridos(recorridos, [...direcciones, otraDireccion]);

    expect(resultado.origenVuelta).toBeUndefined();
    expect(resultado.destinoVuelta).toBeUndefined();
    expect(resultado.horarioSalida).toBeUndefined();
  });

  it('direccionId sin correspondencia en el catálogo del paciente: usa el fallback "Dirección desconocida", sin lanzar', () => {
    const recorridos: RecorridoHabitual[] = [
      { id: 'r1', pacienteId: 'p1', direccionInicialId: 'dir-borrada', direccionFinalId: 'dir-escuela', diaSemana: 'lunes', hora: '08:00' },
    ];

    const resultado = construirDatosTrasladoDesdeRecorridos(recorridos, direcciones);

    expect(resultado.origenIda).toBe('Dirección desconocida');
    expect(resultado.destinoIda).toBe('Belgrano 456, Quilmes');
  });
});
